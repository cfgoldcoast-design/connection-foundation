-- Connection Foundation — Supabase Setup
-- Run in Supabase > SQL Editor

-- ============================================================
-- Members table
-- ============================================================
-- New (May 2026) schema: name + email + suburb + preferred_interest + consent.
-- The english_level and preferred_session columns are kept for historical
-- registrations from the old form; new submissions do not write to them.

create table if not exists members (
  id                  uuid default gen_random_uuid() primary key,
  created_at          timestamptz default now(),
  name                text not null,
  email               text not null unique,
  suburb              text,
  preferred_interest  text check (preferred_interest in ('language-cafe','dsa','unsure')),
  consent_at          timestamptz,
  english_level       text,           -- legacy, kept for historical rows
  preferred_session   text,           -- legacy, kept for historical rows
  source              text default 'landing_page',
  status              text default 'pending',
  unsubscribed_at     timestamptz     -- set when a user requests unsubscribe
);

-- Migration for existing deployments (no-op if columns already exist)
alter table members add column if not exists suburb              text;
alter table members add column if not exists preferred_interest  text;
alter table members add column if not exists consent_at          timestamptz;
alter table members add column if not exists unsubscribed_at     timestamptz;

-- Add/refresh the check constraint on preferred_interest
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'members' and constraint_name = 'members_preferred_interest_check'
  ) then
    alter table members drop constraint members_preferred_interest_check;
  end if;
  alter table members add constraint members_preferred_interest_check
    check (preferred_interest is null or preferred_interest in ('language-cafe','dsa','unsure'));
end$$;

alter table members enable row level security;

drop policy if exists "Allow public insert" on members;
create policy "Allow public insert"
  on members for insert to anon
  with check (true);

drop policy if exists "Allow service read" on members;
create policy "Allow service read"
  on members for select to service_role
  using (true);

-- ============================================================
-- Gmail OAuth tokens (existing — kept as-is)
-- ============================================================
create table if not exists gmail_oauth_tokens (
  id                        bigserial primary key,
  email                     text not null unique,
  refresh_token             text not null,
  access_token              text,
  access_token_expires_at   timestamptz,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

alter table gmail_oauth_tokens enable row level security;

drop policy if exists "service_role full access" on gmail_oauth_tokens;
create policy "service_role full access"
  on gmail_oauth_tokens for all to service_role
  using (true) with check (true);

-- ============================================================
-- Email retry log (existing — kept as-is)
-- ============================================================
create table if not exists email_retry_log (
  id              bigserial primary key,
  created_at      timestamptz default now(),
  email_type      text,
  recipient       text,
  succeeded_at    timestamptz,
  last_error      text,
  attempts        integer default 0,
  payload         jsonb
);

alter table email_retry_log enable row level security;

drop policy if exists "service_role full access on log" on email_retry_log;
create policy "service_role full access on log"
  on email_retry_log for all to service_role
  using (true) with check (true);
