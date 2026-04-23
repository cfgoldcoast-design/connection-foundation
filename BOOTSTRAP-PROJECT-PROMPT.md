# 🚀 THE Prompt — copy this into Claude in a sibling project

Use this ONE file. Pega el bloque de abajo entero en una sesión de Claude Code abierta en el otro proyecto (CF-GC u otro).

Hace dos cosas de una:
1. Instala el patrón `.env.local` (credenciales Supabase/GitHub LOCALES al proyecto, sin login global).
2. Implementa el sistema de Gmail email alerts (OAuth + Edge Functions + UI + todos los gotchas ya resueltos).

---

## 📋 EL PROMPT (copia todo lo que está en el bloque de código)

````
I'm working in a sibling repo of c:\PROYECTS\China. I want you to do two
things in this repo, in order:

PART 1 — Install the project-local CLI credential pattern.
PART 2 — Install the Gmail email alerts system.

The canonical source of truth for both lives in c:\PROYECTS\China.
Read the files listed below from there and replicate them here,
adapting project-specific values (project ref, GitHub username, repo
name) where needed.

===== PART 1: project-local CLI credentials =====

Context: I run 2–3 VSCode windows in parallel, each on a different
repo with different Supabase orgs and different GitHub accounts.
Global `supabase login` / `gh auth login` / Windows Credential Manager
step on each other. Credentials must live in a git-ignored .env.local
at this repo root and be consumed by wrapper scripts.

Read and replicate (adapt paths inside the scripts if needed):
  1. c:\PROYECTS\China\.env.local.example
  2. c:\PROYECTS\China\scripts\sb.sh
  3. c:\PROYECTS\China\scripts\setup-git-auth.sh
  4. c:\PROYECTS\China\scripts\git-credential-env-local.sh
  5. The "sb", "sb:deploy-oauth", "sb:deploy-all" entries in
     c:\PROYECTS\China\package.json under "scripts".

Also in this repo:
  - Ensure .gitignore has `.env` and `*.local`. Add if missing.
  - Add "BACKUP*/" and ".claude/" to .gitignore if those folders exist.
  - Do NOT create a .env.local. Only the .example. I'll fill the real
    one myself.
  - Do NOT run any auth command. No `supabase login`, no `gh auth login`.

===== PART 2: Gmail email alerts =====

Read c:\PROYECTS\China\docs\EMAIL-SETUP-GUIDE.md end-to-end. It is
battle-tested; every pitfall we hit on the China project is documented
there. Replicate it in this repo, adapting:
  - Table/column names if this repo already has alert settings.
  - The frontend UI location to wherever this repo keeps its config
    screen.
  - Use Supabase function secrets GOOGLE_CLIENT_ID and
    GOOGLE_CLIENT_SECRET; ask me for these if not already set in this
    project's Supabase.

Non-negotiables (from the guide's "Gotchas" section — re-read it if
you're about to skip one):
  a. `handle-gmail-oauth` MUST have `verify_jwt = false` in
     supabase/config.toml. Deploy it with `--no-verify-jwt`.
  b. RLS policies must grant `TO authenticated, service_role`, never
     just `authenticated`.
  c. OAuth URL from the frontend needs `access_type=offline` AND
     `prompt=consent`.
  d. Redirect URI must match the Google Cloud registration exactly.
  e. The test email button must send `{ to, subject, htmlBody }` — not
     just `{ alertType: 'test' }`.

Also reference the deployed Edge Functions for shape:
  - c:\PROYECTS\China\supabase\functions\handle-gmail-oauth\index.ts
  - c:\PROYECTS\China\supabase\functions\send-gmail-alert\index.ts

===== COMMITS =====

Make TWO commits:
  1. "chore(cli): project-local CLI credential wrappers" — Part 1 only.
  2. "feat(alerts): Gmail email alert system" — Part 2 only.

Do NOT push. Do NOT open browsers.

===== WHEN DONE, REPORT BACK =====

Tell me exactly:
(a) Detected Supabase project ref (from .env or supabase/config.toml).
(b) Detected GitHub owner/repo (from `git remote -v`).
(c) The step-by-step for me to finish setup myself:

    1. Supabase PAT:
       - URL: https://supabase.com/dashboard/account/tokens
       - Must be logged in as the account that OWNS this project
         (check the org on the dashboard URL; don't assume the
         globally-active account is correct).
       - Generate new token → copy (starts with `sbp_`).

    2. GitHub fine-grained PAT (preferred; scoped to this one repo):
       - URL: https://github.com/settings/personal-access-tokens/new
       - Token name: anything memorable (e.g. "<repo>-local-git").
       - Expiration: required; 90 days is fine.
       - Repository access: "Only select repositories" → pick <repo>.
       - Permissions: click "Add permissions" (opens a long dropdown).
         In the dropdown's SEARCH BOX, type "Contents". Tick the
         Contents checkbox, then choose "Read and write" in the
         selector that appears beside it. Click outside to confirm.
         Do NOT tick anything else.
         Note: Metadata: Read is mandatory and GitHub auto-includes
         it when the token is generated — don't look for it in the
         list.
       - Scroll down → Generate token → copy (starts with `github_pat_`).
       - Classic fallback only if org blocks fine-grained:
         https://github.com/settings/tokens/new, tick only `repo`.

    3. Google Cloud OAuth client + secrets:
       - https://console.cloud.google.com → enable Gmail API.
       - Create OAuth 2.0 Web client.
       - Authorized redirect URI:
         https://<supabase-ref>.supabase.co/functions/v1/handle-gmail-oauth
       - Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to Supabase
         function secrets.

    4. cp .env.local.example .env.local; fill in SUPABASE_ACCESS_TOKEN,
       SUPABASE_PROJECT_REF, GITHUB_TOKEN, GITHUB_USERNAME.

    5. bash scripts/setup-git-auth.sh.

    6. Verify: `git fetch origin` and `git push --dry-run origin main`
       both exit clean.

    7. Deploy the Edge Functions:
       npm run sb:deploy-oauth
       npm run sb functions deploy send-gmail-alert
       (add any GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET via
        `npm run sb secrets set KEY=value` if not set yet)

    8. Run the Supabase migrations for the alert tables if they
       aren't applied yet: `npm run sb db push`.

    9. Test end-to-end: open the app, click "Connect Gmail", authorize,
       then use "Send Test Email" with my own email address.

Do not actually run steps 1–9 for me. Print them.
````

---

## 📂 Archivos que este prompt referencia (todos en este repo)

- `c:\PROYECTS\China\.env.local.example` — template del .env.local
- `c:\PROYECTS\China\scripts\sb.sh` — wrapper Supabase CLI
- `c:\PROYECTS\China\scripts\setup-git-auth.sh` — wire git credentials
- `c:\PROYECTS\China\scripts\git-credential-env-local.sh` — helper git
- `c:\PROYECTS\China\docs\EMAIL-SETUP-GUIDE.md` — guía completa del sistema de email
- `c:\PROYECTS\China\supabase\functions\handle-gmail-oauth\index.ts` — Edge Function OAuth
- `c:\PROYECTS\China\supabase\functions\send-gmail-alert\index.ts` — Edge Function send

No tenés que abrir ninguno. Claude en el otro proyecto los lee solo.

---

## ❓ Si algo falla en el otro proyecto

Pega el error aquí. Los gotchas conocidos ya están resueltos en `EMAIL-SETUP-GUIDE.md`:
- `UNAUTHORIZED_NO_AUTH_HEADER` → falta `verify_jwt = false` en `handle-gmail-oauth`.
- `No refresh token` → falta `access_type=offline` + `prompt=consent`.
- `Repository not found` en git push → cuenta equivocada; correr `scripts/setup-git-auth.sh` después de poner `GITHUB_TOKEN` en `.env.local`.
