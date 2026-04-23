# Gmail Email Alerts — Setup Guide (Tested & Working)

> Battle-tested on the China Stock Management App. Every pitfall in here was hit during implementation and resolved. Follow the gotchas section carefully — skipping one of them is what kept this broken for days.

---

## What this gives you

- A "Connect Gmail" button that runs OAuth and stores refresh tokens.
- A `send-gmail-alert` Edge Function that sends HTML emails via Gmail API, auto-refreshing the access token before each call.
- A "Send Test Email" input + button so users can verify end-to-end without triggering a real event.
- Retry logging in a DB table so failed sends can be inspected.

Architecture (high level):
```
User → "Connect Gmail" button → Google OAuth consent popup
                                         ↓  (302 redirect)
                              Supabase Edge Function: handle-gmail-oauth
                                         ↓
                                 Exchange code for tokens
                                         ↓
                         Store refresh_token in gmail_oauth_tokens table
                                         ↓
                                 Popup closes, UI updates

App logic → fetch('/functions/v1/send-gmail-alert', {to, subject, htmlBody})
                                         ↓
                            Load refresh_token from DB
                                         ↓
                       If access_token expired → refresh via Google
                                         ↓
                            POST to Gmail API /messages/send
                                         ↓
                           Log outcome to email_retry_log
```

---

## 🔴 Gotchas — read these first

### 1. `handle-gmail-oauth` MUST have `verify_jwt = false`

Google OAuth redirects the browser back to your callback URL. Browser redirects **cannot include an Authorization header**. Supabase Edge Functions default to `verify_jwt = true`, so the gateway rejects the redirect with:
```json
{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
```
…and your function never even runs.

**Fix:** in `supabase/config.toml` add:
```toml
[functions.handle-gmail-oauth]
verify_jwt = false
```
Then deploy with `--no-verify-jwt`:
```bash
supabase functions deploy handle-gmail-oauth --no-verify-jwt
```

`send-gmail-alert` should keep `verify_jwt = true` (or default) because the frontend calls it with the anon key.

### 2. RLS policies must include `service_role`

If you write RLS like `TO authenticated USING (true)`, Edge Functions using `SUPABASE_SERVICE_ROLE_KEY` will still fail silently on writes because the policy doesn't list `service_role`. Use:
```sql
CREATE POLICY "..." ON <table> FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);
```

### 3. OAuth consent screen: force `access_type=offline` + `prompt=consent`

Without both, Google won't issue a `refresh_token` on subsequent connects, and your function will throw "No refresh token received" after a user disconnects and reconnects.

Frontend OAuth URL:
```js
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly')}&` +
  `access_type=offline&` +
  `prompt=consent&` +
  `state=${encodeURIComponent(btoa(JSON.stringify({ returnUrl })))}`;
```

### 4. Redirect URI must match *exactly* (including trailing slash or lack of)

Google OAuth compares the redirect URI byte-for-byte with what's registered in Google Cloud Console. `https://xxxx.supabase.co/functions/v1/handle-gmail-oauth` ≠ `https://xxxx.supabase.co/functions/v1/handle-gmail-oauth/`.

### 5. Test email payload must actually include `to`, `subject`, `htmlBody`

Easy to miss: calling `send-gmail-alert` with only `{ alertType: 'test' }` doesn't send anything — the function needs the recipient and content. Build the HTML in the frontend, pass it in the body.

---

## Step 1 — Database migrations

```sql
-- OAuth tokens (singleton-ish; we only ever have one connected account)
CREATE TABLE gmail_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gmail_oauth_tokens access" ON gmail_oauth_tokens
  FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- Per-app config (enabled toggles, recipients, etc). Keep as singleton.
CREATE TABLE alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_emails text NOT NULL DEFAULT '',
  gmail_connected_email text,
  enabled boolean NOT NULL DEFAULT false,
  -- add whatever domain-specific toggles you need
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_settings access" ON alert_settings
  FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- Retry/audit log for every send attempt
CREATE TABLE email_retry_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 1,
  last_error text,
  created_at timestamptz DEFAULT now(),
  succeeded_at timestamptz
);
ALTER TABLE email_retry_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_retry_log access" ON email_retry_log
  FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);
```

---

## Step 2 — Google Cloud Console

1. https://console.cloud.google.com → create project (or reuse existing).
2. APIs & Services → Enable **Gmail API**.
3. Credentials → Create Credentials → OAuth client ID → **Web application**.
4. Authorized redirect URIs: `https://<YOUR-SUPABASE-REF>.supabase.co/functions/v1/handle-gmail-oauth` (no trailing slash).
5. OAuth consent screen → add scopes: `gmail.send`, `gmail.readonly` (for profile lookup).
6. Publish status: for internal-only use, leave as "Testing" and add the connecting email as a test user. For multi-tenant, submit for verification.
7. Copy Client ID + Client Secret.

---

## Step 3 — Supabase function secrets

In Supabase Dashboard → Edge Functions → Secrets:
```
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<from Google Cloud>
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by Supabase at runtime.

---

## Step 4 — Edge Function: `handle-gmail-oauth`

Path: `supabase/functions/handle-gmail-oauth/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    let returnUrl: string | null = null;
    if (state) {
      try { returnUrl = JSON.parse(atob(state)).returnUrl ?? null; } catch {}
    }

    if (error || !code) {
      const msg = error || "no_code";
      if (returnUrl) {
        return Response.redirect(`${returnUrl}?gmail_oauth_error=${encodeURIComponent(msg)}`);
      }
      return new Response(`OAuth error: ${msg}`, { status: 400, headers: corsHeaders });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const redirectUri = `${supabaseUrl}/functions/v1/handle-gmail-oauth`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange ${tokenRes.status}: ${await tokenRes.text()}`);

    const { access_token, refresh_token, expires_in } = await tokenRes.json();
    if (!refresh_token) throw new Error("No refresh_token — user must grant offline access (prompt=consent).");

    // Fetch profile to know which account was connected
    const profRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profRes.ok) throw new Error(`Profile fetch ${profRes.status}`);
    const { emailAddress: email } = await profRes.json();

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert singleton token row
    const { data: existing } = await supabase
      .from("gmail_oauth_tokens").select("id").limit(1).maybeSingle();

    if (existing) {
      await supabase.from("gmail_oauth_tokens").update({
        email, refresh_token, access_token,
        access_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("gmail_oauth_tokens").insert({
        email, refresh_token, access_token,
        access_token_expires_at: expiresAt,
      });
    }

    // Ensure alert_settings row exists and knows the connected email
    const { data: settings } = await supabase
      .from("alert_settings").select("id").limit(1).maybeSingle();
    if (settings) {
      await supabase.from("alert_settings")
        .update({ gmail_connected_email: email }).eq("id", settings.id);
    } else {
      await supabase.from("alert_settings")
        .insert({ to_emails: "", gmail_connected_email: email, enabled: false });
    }

    if (returnUrl) {
      return Response.redirect(`${returnUrl}?gmail_oauth=success&gmail_email=${encodeURIComponent(email)}`);
    }
    return new Response(`Connected as ${email}`, { headers: corsHeaders });

  } catch (e) {
    console.error("OAuth handler error:", e);
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
```

Deploy: `supabase functions deploy handle-gmail-oauth --no-verify-jwt`

---

## Step 5 — Edge Function: `send-gmail-alert`

Path: `supabase/functions/send-gmail-alert/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { to, subject, htmlBody, alertType = "general" } = await req.json();
    if (!to || !subject || !htmlBody) throw new Error("Missing to/subject/htmlBody");

    // Load tokens
    const { data: token } = await supabase
      .from("gmail_oauth_tokens").select("*").limit(1).maybeSingle();
    if (!token?.refresh_token) throw new Error("No Gmail connected");

    // Refresh access token if expired/missing
    let accessToken = token.access_token;
    const expired = !token.access_token_expires_at ||
      new Date(token.access_token_expires_at) <= new Date(Date.now() + 30_000);
    if (expired) {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
          refresh_token: token.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (!r.ok) throw new Error(`Token refresh failed: ${r.status}`);
      const j = await r.json();
      accessToken = j.access_token;
      await supabase.from("gmail_oauth_tokens").update({
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", token.id);
    }

    // Build RFC 2822 message, base64url-encoded
    const boundary = "bdry_" + Math.random().toString(36).slice(2);
    const mime = [
      `From: ${token.email}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      htmlBody.replace(/<[^>]*>/g, ""),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(htmlBody))),
      ``,
      `--${boundary}--`,
    ].join("\r\n");
    const raw = btoa(unescape(encodeURIComponent(mime)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      await supabase.from("email_retry_log").insert({
        email_type: alertType, payload: { to, subject }, last_error: `${sendRes.status}: ${err}`,
      });
      throw new Error(`Gmail API ${sendRes.status}: ${err}`);
    }

    await supabase.from("email_retry_log").insert({
      email_type: alertType, payload: { to, subject }, succeeded_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-gmail-alert error:", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

Deploy (default verify_jwt=true is fine): `supabase functions deploy send-gmail-alert`

---

## Step 6 — Frontend

### Connect button

```ts
const handleConnectGmail = () => {
  const clientId = 'YOUR_GOOGLE_CLIENT_ID';
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-gmail-oauth`;
  const scope = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
  const returnUrl = `${window.location.origin}${window.location.pathname}`;
  const state = btoa(JSON.stringify({ returnUrl }));

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=${encodeURIComponent(state)}`;

  window.open(authUrl, 'Gmail OAuth', 'width=600,height=700');
};

// On mount, check URL for ?gmail_oauth=success|error and update UI accordingly
```

### Test email button

```tsx
const handleSendTest = async () => {
  const recipient = testEmail.trim() || alertEmails.trim();
  if (!recipient) return toast.error('Enter a recipient');

  const htmlBody = `<!DOCTYPE html>
<html><body style="background:#0f172a;color:#e2e8f0;font-family:system-ui">
  <div style="max-width:600px;margin:20px auto;background:#1e293b;padding:40px;border-radius:8px">
    <h1 style="color:#06b6d4">✅ Gmail Test</h1>
    <p>Sent to: <strong>${recipient}</strong></p>
    <p>Timestamp: ${new Date().toLocaleString()}</p>
  </div>
</body></html>`;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-gmail-alert`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        to: recipient,
        subject: '✅ Gmail Alert Test',
        htmlBody,
        alertType: 'test',
      }),
    }
  );
  const { success, error } = await res.json();
  success ? toast.success(`Sent to ${recipient}`) : toast.error(error);
};
```

---

## Debugging

```sql
-- Was the token actually stored and is it fresh?
SELECT email, access_token_expires_at, updated_at FROM gmail_oauth_tokens;

-- Recent send attempts (success and failure)
SELECT created_at, email_type, succeeded_at, last_error
FROM email_retry_log ORDER BY created_at DESC LIMIT 20;

-- Alert config
SELECT * FROM alert_settings;
```

If Connect Gmail fails:
1. Check Supabase Function logs for `handle-gmail-oauth`. If you see nothing, the gateway rejected — confirm `verify_jwt = false` was actually deployed (`supabase functions list` should show it).
2. Check the browser network tab: was the redirect URI an exact match?
3. Verify `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` secrets exist in Supabase.

If Send Test fails:
1. Look at `email_retry_log.last_error`.
2. If error is `invalid_grant`, the refresh token was revoked — user must disconnect and reconnect.
3. If error is `403 Request had insufficient authentication scopes`, the OAuth consent didn't grant `gmail.send` — reconnect with `prompt=consent`.

---

## Deploy cheat sheet (assuming .env.local setup from the China project)

```bash
# One-time: wire project-local creds
cp .env.local.example .env.local
# fill in SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, GITHUB_TOKEN

# Deploy
bash scripts/sb.sh functions deploy handle-gmail-oauth --no-verify-jwt
bash scripts/sb.sh functions deploy send-gmail-alert
```
