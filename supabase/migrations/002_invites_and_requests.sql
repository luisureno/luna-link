-- Add invite token to companies (owner shares with drivers to join)
alter table companies
  add column if not exists invite_token text unique default replace(gen_random_uuid()::text, '-', '');

-- Backfill any existing rows that don't have one
update companies set invite_token = replace(gen_random_uuid()::text, '-', '') where invite_token is null;

-- Company requests (landing page "Request Access" form)
create table if not exists company_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  fleet_size text,
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table company_requests enable row level security;

-- No public read; writes happen server-side via service role
create policy "no public read" on company_requests for select using (false);
