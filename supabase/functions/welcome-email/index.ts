import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const WA_LINK = 'https://chat.whatsapp.com/CFbvAyzsyCf8XbCkOU8Yys?mode=gi_t'
const SITE_LINK = 'https://connection-foundation.vercel.app'
const CONTACT_EMAIL = 'cf.goldcoast@gmail.com'

const INTEREST_LABELS: Record<string, string> = {
  'language-cafe': 'Language Café',
  'dsa':           'A Discourse on Social Action',
  'unsure':        'Still deciding — we will walk you through the options',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const payload = await req.json()
    const record = payload.record || payload
    const { name, email, suburb, preferred_interest } = record

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Missing name or email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const interestLabel = INTEREST_LABELS[preferred_interest] ?? (preferred_interest || 'To be confirmed')
    const suburbLabel = suburb || 'Mermaid Waters area'

    const unsubscribeLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Unsubscribe — Connection Foundation')}&body=${encodeURIComponent('Please remove me from Connection Foundation communications.\n\nEmail: ' + email)}`

    const { data: token } = await supabase
      .from("gmail_oauth_tokens").select("*").limit(1).maybeSingle();
    if (!token?.refresh_token) throw new Error("No Gmail connected — run OAuth flow first");

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
      if (!r.ok) throw new Error(`Token refresh failed: ${r.status} ${await r.text()}`);
      const j = await r.json();
      accessToken = j.access_token;
      await supabase.from("gmail_oauth_tokens").update({
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", token.id);
    }

    const subject = `Welcome to Connection Foundation, ${name}`

    // Rosewood palette (matches the website)
    const C_WINE = '#5B1F3A'
    const C_CREAM = '#F7F0E8'
    const C_INK = '#2A1A22'
    const C_STONE = '#8A7A7E'
    const C_EMBER = '#D45D5D'
    const C_BLUSH = '#E8B5BD'

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${C_CREAM};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${C_INK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C_CREAM};padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${C_WINE};border-radius:2px 2px 0 0;padding:48px 48px 40px;text-align:center;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${C_BLUSH};">Connection Foundation · Gold Coast</p>
            <h1 style="margin:0;font-size:34px;font-weight:500;letter-spacing:-0.025em;color:${C_CREAM};line-height:1.05;">Welcome, ${name}.</h1>
            <p style="margin:16px 0 0;font-size:16px;color:rgba(247,240,232,0.8);line-height:1.55;">You are now part of the circle.</p>
          </td>
        </tr>
        <tr>
          <td style="background:${C_CREAM};padding:40px 48px;">
            <p style="margin:0 0 20px;font-size:17px;color:${C_INK};line-height:1.6;">
              We are glad you joined. Connection Foundation is a free, open space for personal and community transformation — through real conversation, study, and friendship.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(42,26,34,0.12);border-radius:2px;margin:28px 0;">
              <tr>
                <td style="padding:24px 28px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${C_EMBER};">Your details</p>
                  <table width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${C_STONE};width:38%;">Suburb</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:500;color:${C_INK};">${suburbLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${C_STONE};">Preferred interest</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:500;color:${C_INK};">${interestLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${C_STONE};">Location</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:500;color:${C_INK};">Mermaid Waters, Gold Coast</td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-size:13px;color:${C_STONE};line-height:1.55;">
                    We will follow up shortly with session details, the exact address, and a warm welcome before your first meeting.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;font-size:17px;color:${C_INK};line-height:1.6;">
              Join our WhatsApp group to receive updates and meet the rest of the community.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${WA_LINK}" style="display:inline-block;background:${C_EMBER};color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:14px 28px;border-radius:999px;">
                    Join the WhatsApp group &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid rgba(42,26,34,0.12);margin:36px 0;">
            <p style="margin:0 0 12px;font-size:15px;color:${C_INK};font-weight:500;">A few things you can expect</p>
            <ul style="margin:0;padding-left:20px;color:${C_STONE};font-size:14px;line-height:1.85;">
              <li>A warm welcome — everyone remembers their first session</li>
              <li>Open conversations — no right or wrong answers</li>
              <li>No fees, no booking, no pressure</li>
              <li>Tea, coffee, and good company</li>
            </ul>
            <p style="margin:28px 0 0;font-size:15px;color:${C_INK};line-height:1.6;">
              Any questions? Just reply to this email — we read every message.
            </p>
            <p style="margin:8px 0 0;font-size:15px;color:${C_INK};">See you soon.</p>
          </td>
        </tr>
        <tr>
          <td style="background:${C_WINE};border-radius:0 0 2px 2px;padding:32px 48px;text-align:center;">
            <p style="margin:0 0 12px;font-size:13px;color:rgba(247,240,232,0.85);">
              <a href="${SITE_LINK}" style="color:${C_CREAM};text-decoration:none;font-weight:500;">Visit the site &rarr;</a>
            </p>
            <p style="margin:0;font-size:12px;color:rgba(247,240,232,0.55);line-height:1.7;">
              Connection Foundation &middot; Mermaid Waters, Gold Coast, Australia<br>
              <a href="mailto:${CONTACT_EMAIL}" style="color:${C_CREAM};">${CONTACT_EMAIL}</a>
            </p>
            <p style="margin:18px 0 0;font-size:11px;color:rgba(247,240,232,0.5);line-height:1.6;">
              You are receiving this because you registered on our site.<br>
              <a href="${unsubscribeLink}" style="color:${C_BLUSH};text-decoration:underline;">Unsubscribe</a>
              or email <a href="mailto:${CONTACT_EMAIL}" style="color:${C_BLUSH};">${CONTACT_EMAIL}</a> to be removed.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const boundary = "bdry_" + Math.random().toString(36).slice(2);
    const mime = [
      `From: Connection Foundation <${token.email}>`,
      `To: ${email}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `List-Unsubscribe: <${unsubscribeLink}>`,
      `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      emailHtml.replace(/<[^>]*>/g, ""),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(emailHtml))),
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
        email_type: "welcome", payload: { to: email, subject }, last_error: `${sendRes.status}: ${err}`,
      });
      throw new Error(`Gmail API ${sendRes.status}: ${err}`);
    }

    await supabase.from("email_retry_log").insert({
      email_type: "welcome", payload: { to: email, subject }, succeeded_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
