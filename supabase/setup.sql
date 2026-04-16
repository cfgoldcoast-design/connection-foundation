-- Connection Foundation — Supabase Setup
-- Run in Supabase > SQL Editor

create table if not exists members (
  id                uuid default gen_random_uuid() primary key,
  created_at        timestamptz default now(),
  name              text not null,
  email             text not null unique,
  english_level     text,
  preferred_session text,
  source            text default 'landing_page',
  status            text default 'pending'
);

alter table members enable row level security;

create policy "Allow public insert"
  on members for insert to anon
  with check (true);

create policy "Allow service read"
  on members for select to service_role
  using (true);
