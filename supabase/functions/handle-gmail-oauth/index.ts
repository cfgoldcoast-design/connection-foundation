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

    const email = "cf.goldcoast@gmail.com";

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

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

    return new Response(
      `<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#FFF8F0;">
        <h1 style="color:#2B6B6B;">✅ Connected!</h1>
        <p>Gmail is now connected as <strong>${email}</strong></p>
        <p>Welcome emails will now be sent from this address.</p>
        <p style="color:#999;margin-top:40px;font-size:14px;">You can close this window.</p>
      </body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );

  } catch (e) {
    console.error("OAuth handler error:", e);
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
