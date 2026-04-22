# Connection Foundation — Gold Coast

Free English conversation circle. Landing page + registration + automated welcome email.

**Live:** https://connection-foundation.vercel.app

## Structure

```
├── index.html                                  # Landing page (static, served by Vercel)
├── images/                                     # Site images (referenced from index.html)
│   ├── hero-bg.jpg                             # Hero section background
│   ├── about.jpg                               # "Real people" section
│   ├── why-different.jpg                       # "What makes this different" section
│   ├── testimonials-bg.jpg                     # Testimonials background
│   └── bk.jpg, bk2.jpg, bk3.jpg                # Event banner backgrounds
├── supabase/
│   ├── setup.sql                               # Initial DB schema (members table)
│   └── functions/
│       ├── welcome-email/                      # Sends welcome email via Gmail API
│       └── handle-gmail-oauth/                 # One-time OAuth flow to connect Gmail
├── vercel.json                                 # Vercel config (static site)
└── EMAIL-SETUP-GUIDE.md                        # Gmail OAuth playbook (reference)
```

## Local preview (no commit needed)

To test changes before pushing:

```bash
# From the project root
python -m http.server 8000
```

Open http://localhost:8000 in your browser. Any change to `index.html` or anything in `images/` is reflected just by refreshing the page (Ctrl+Shift+R to force-bypass cache).

Only push to `master` once you're happy with the result — Vercel auto-deploys every push.

## How it works

1. User fills out the form on `index.html` → POST to Supabase REST API inserts a row in `members`
2. Frontend calls the `welcome-email` edge function directly
3. Edge function loads the Gmail refresh token from `gmail_oauth_tokens`, refreshes access token if expired, sends the email via Gmail API using `cf.goldcoast@gmail.com` as sender
4. Every send is logged in `email_retry_log` (success or error)

## Changing images

All site images live in `images/`. To swap one:

1. Replace the file in `images/` (keep the same filename, e.g. `hero-bg.jpg`)
2. `git add images/ && git commit -m "Update hero image" && git push`
3. Vercel auto-deploys in ~30 seconds

Recommended dimensions: ~1600×900 for backgrounds, ~1200×800 for content images. Keep each under 150 KB for fast load.

## Event banner (next event promo)

Between the hero and "How it works" sections there is an event banner promoting the next get-together. To update it, edit `index.html` and look for the `<!-- NEXT EVENT BANNER -->` block:

- Background image → `background-image: url('images/bk.jpg')` (swap for `bk2.jpg` or `bk3.jpg`, or replace the file)
- Title, date, time, location → plain text inside the `.event-banner-content` div
- CTA button → `<a href="#join">` scrolls to the registration form

## Session video (YouTube embed)

The "See it for yourself" section embeds a YouTube video. To replace it, edit `index.html`, search for the `<!-- VIDEO: REAL SESSION -->` block and change the iframe `src`:

```html
<iframe src="https://www.youtube.com/embed/<VIDEO_ID>" ...></iframe>
```

Where `<VIDEO_ID>` is the part after `youtu.be/` in the share link (e.g. for `https://youtu.be/BQ1oa4aXs6c` the ID is `BQ1oa4aXs6c`).

**Do NOT commit large video files to the repo.** Always host on YouTube/Vimeo and embed.

## Email system — Gmail OAuth

**Do NOT use Resend for this project.** It requires a verified domain to send to arbitrary recipients, which we don't have. We use Gmail API via OAuth2 instead.

### One-time setup (already done — reference only)

1. Google Cloud project `connection-foundation` with Gmail API enabled
2. OAuth consent screen: External, scope `gmail.send`, test user `cf.goldcoast@gmail.com`
3. OAuth Client: Web application with redirect URI `https://kbondjwqgndghtyxddlm.supabase.co/functions/v1/handle-gmail-oauth`
4. Supabase secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
5. DB tables: `gmail_oauth_tokens`, `email_retry_log` (both with RLS `authenticated, service_role`)
6. Visit the OAuth URL once → refresh token stored in `gmail_oauth_tokens` → all future sends work automatically

### If the token ever stops working

Re-run the OAuth connect by visiting:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=<CLIENT_ID>&redirect_uri=https%3A%2F%2Fkbondjwqgndghtyxddlm.supabase.co%2Ffunctions%2Fv1%2Fhandle-gmail-oauth&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send&access_type=offline&prompt=consent
```

Log in as `cf.goldcoast@gmail.com`, grant permissions — the refresh token updates in the DB.

Full playbook in [EMAIL-SETUP-GUIDE.md](EMAIL-SETUP-GUIDE.md).

## Deploy commands

```bash
# Database (already done, for reference)
supabase db query --linked -f supabase/setup.sql

# Set email secrets (already done, for reference)
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...

# Deploy edge functions
supabase functions deploy welcome-email --no-verify-jwt
supabase functions deploy handle-gmail-oauth --no-verify-jwt

# Frontend deploys automatically on push to master via Vercel
git push
```

## Debugging

```sql
-- Last 20 email attempts (success + failure)
SELECT created_at, email_type, succeeded_at, last_error
FROM email_retry_log
ORDER BY created_at DESC LIMIT 20;

-- Most recent registrations
SELECT created_at, name, email, english_level, preferred_session
FROM members
ORDER BY created_at DESC LIMIT 10;

-- Gmail token status
SELECT email, access_token_expires_at, updated_at FROM gmail_oauth_tokens;
```

## Gotchas

- `handle-gmail-oauth` MUST be deployed with `--no-verify-jwt` (Google redirects cannot include auth headers)
- OAuth URL must include BOTH `access_type=offline` AND `prompt=consent`, otherwise Google stops issuing refresh tokens
- Redirect URI in Google Cloud must match byte-for-byte (no trailing slash)
- Scope `gmail.send` does NOT allow reading the user's profile. The OAuth handler hardcodes `cf.goldcoast@gmail.com` as the connected email since this is a single-account setup
