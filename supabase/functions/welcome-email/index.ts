import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const WA_LINK = 'https://chat.whatsapp.com/CFbvAyzsyCf8XbCkOU8Yys?mode=gi_t'

const SESSION_LABELS: Record<string, string> = {
  'fri-5pm': 'Friday at 5:00 pm',
  'fri-8am': 'Friday at 8:00 am',
  'mon-5pm': 'Monday at 5:00 pm',
  'any':     'Flexible — we will find the best fit for you',
}

const LEVEL_LABELS: Record<string, string> = {
  'beginner':     'Beginner',
  'elementary':   'Elementary',
  'intermediate': 'Intermediate',
  'advanced':     'Advanced',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record || payload
    const { name, email, english_level, preferred_session } = record

    if (!name || !email) {
      console.error('Missing required fields:', { name, email, english_level, preferred_session })
      return new Response(JSON.stringify({ error: 'Missing name or email' }), { status: 400, headers: corsHeaders })
    }

    const session = SESSION_LABELS[preferred_session] ?? preferred_session
    const level   = LEVEL_LABELS[english_level] ?? english_level

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FFF8F0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#2B6B6B;border-radius:20px 20px 0 0;padding:40px 48px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.6);">Connection Foundation</p>
            <h1 style="margin:0;font-size:32px;font-weight:400;color:#FFF8F0;line-height:1.2;">Welcome, ${name} 🌱</h1>
            <p style="margin:12px 0 0;font-size:15px;color:rgba(255,255,255,0.75);">You are now part of the circle.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:40px 48px;">
            <p style="margin:0 0 20px;font-size:16px;color:#2C3E50;line-height:1.7;">
              We are really glad you joined. Connection Foundation is a free, open, and judgment-free space to practise English and meet people who care about real conversations.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5EDE0;border-radius:14px;margin:24px 0;">
              <tr>
                <td style="padding:24px 28px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9CAF88;">Your session details</p>
                  <table width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#5A6A7A;width:40%;">Preferred time</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#2C3E50;">${session}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#5A6A7A;">English level</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#2C3E50;">${level}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#5A6A7A;">Location</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#2C3E50;">Mermaid Waters, Gold Coast</td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-size:13px;color:#7A9A9A;line-height:1.5;">
                    Exact address will be shared in the WhatsApp group before your first session.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:16px;color:#2C3E50;line-height:1.7;">
              Join our WhatsApp group to receive the weekly schedule and location updates.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <a href="${WA_LINK}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:16px 36px;border-radius:32px;">
                    Join the WhatsApp Group →
                  </a>
                </td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #EAE0D8;margin:32px 0;">
            <p style="margin:0 0 12px;font-size:15px;color:#2C3E50;font-weight:600;">What to expect at your first session</p>
            <ul style="margin:0;padding-left:20px;color:#5A6A7A;font-size:14px;line-height:1.9;">
              <li>A warm welcome — everyone remembers their first session</li>
              <li>A short reading we do together as a group</li>
              <li>An open conversation — no right or wrong answers</li>
              <li>Tea, coffee, and good company</li>
              <li>No homework, no tests, no pressure</li>
            </ul>
            <p style="margin:28px 0 0;font-size:15px;color:#2C3E50;line-height:1.7;">
              Any questions? Just reply to this email.
            </p>
            <p style="margin:8px 0 0;font-size:15px;color:#2C3E50;">See you soon 🙏</p>
          </td>
        </tr>
        <tr>
          <td style="background:#F5EDE0;border-radius:0 0 20px 20px;padding:24px 48px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9AABBB;line-height:1.6;">
              Connection Foundation · Mermaid Waters, Gold Coast, Australia<br>
              <a href="mailto:cf.goldcoast@gmail.com" style="color:#2B6B6B;">cf.goldcoast@gmail.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Connection Foundation <delivered-by-resend@cf.goldcoast.com.au>',
        to: [email],
        subject: `Welcome to Connection Foundation, ${name} 🌱`,
        html: emailHtml,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
