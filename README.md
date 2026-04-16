# Connection Foundation — Gold Coast

## Structure
- `index.html` — Landing page (deploy to Vercel)
- `supabase/functions/welcome-email/` — Edge Function (welcome email via Resend)
- `supabase/setup.sql` — Database setup
- `dashboard/` — Admin dashboard (Phase 2)

## Deploy

### 1. Database
Run `supabase/setup.sql` in Supabase > SQL Editor

### 2. Edge Function secrets
```bash
supabase secrets set RESEND_API_KEY=your_resend_key
```

### 3. Deploy Edge Function
```bash
supabase functions deploy welcome-email
```

### 4. Create Webhook in Supabase
Supabase > Database > Webhooks > New webhook
- Table: members
- Event: INSERT
- URL: https://kbondjwqgndghtyxddlm.supabase.co/functions/v1/welcome-email

### 5. Deploy landing page
Push to GitHub → auto-deploy on Vercel
