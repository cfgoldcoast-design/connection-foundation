// sync-to-google-sheet
// Forwards a new member registration to a Google Sheet via Apps Script Web App.
//
// Triggered by:
//   - frontend POST after a successful /rest/v1/members insert (preferred path)
//   - Supabase DB webhook on `members` INSERT (optional, set up in dashboard)
//
// Required Supabase secret:
//   GSHEET_WEBHOOK_URL = https://script.google.com/macros/s/.../exec
//     (deployment URL of the Apps Script Web App attached to the members sheet)
//
// Setup instructions live in README.md → "Member sync — Google Sheet".

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INTEREST_LABELS: Record<string, string> = {
  'language-cafe': 'Language Café',
  'dsa':           'A Discourse on Social Action',
  'unsure':        'Don’t know yet',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const webhookUrl = Deno.env.get("GSHEET_WEBHOOK_URL") ?? "";
    if (!webhookUrl || webhookUrl.indexOf('script.google.com') === -1) {
      // Log and short-circuit, but do not 500 — registration must still succeed
      await supabase.from("email_retry_log").insert({
        email_type: "gsheet-sync",
        payload: { reason: "GSHEET_WEBHOOK_URL not configured" },
        last_error: "GSHEET_WEBHOOK_URL secret missing or invalid",
      });
      return new Response(JSON.stringify({ skipped: true, reason: 'GSHEET_WEBHOOK_URL not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    // Support both shapes: frontend direct ({record: {...}}) and DB webhook ({type, table, record, old_record})
    const record = body.record || body;
    const { name, email, suburb, preferred_interest, consent_at, source, created_at } = record;

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Missing name or email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const row = {
      timestamp: created_at || consent_at || new Date().toISOString(),
      name: name || '',
      email: email || '',
      suburb: suburb || '',
      preferred_interest: preferred_interest || '',
      preferred_interest_label: INTEREST_LABELS[preferred_interest] ?? (preferred_interest || ''),
      consent_at: consent_at || '',
      source: source || 'unknown',
    };

    // Apps Script Web Apps work best with text/plain to avoid CORS preflight
    const sheetRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(row),
    });

    const sheetBody = await sheetRes.text();

    if (!sheetRes.ok) {
      await supabase.from("email_retry_log").insert({
        email_type: "gsheet-sync",
        recipient: email,
        payload: row,
        last_error: `${sheetRes.status}: ${sheetBody}`,
      });
      throw new Error(`Apps Script ${sheetRes.status}: ${sheetBody}`);
    }

    await supabase.from("email_retry_log").insert({
      email_type: "gsheet-sync",
      recipient: email,
      payload: row,
      succeeded_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, response: sheetBody }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('sync-to-google-sheet error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
