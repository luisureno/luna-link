-- QuickBooks integration waitlist.
-- When 10 paying customers sign up, this is the signal to build the real integration.
create table if not exists quickbooks_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  fleet_size text,
  company_id uuid references companies(id),
  user_id uuid references users(id),
  source text default 'invoices_page',
  notes text,
  contacted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quickbooks_waitlist_email_idx on quickbooks_waitlist(email);
create index if not exists quickbooks_waitlist_company_id_idx on quickbooks_waitlist(company_id);

alter table quickbooks_waitlist enable row level security;

-- Authenticated users can insert rows for themselves (or anonymously from the landing page).
-- The service role (admin API routes) bypasses RLS.
create policy "anyone can join waitlist" on quickbooks_waitlist
  for insert with check (true);

-- Only the owner of the company can see their company's entries.
create policy "owner reads own company entries" on quickbooks_waitlist
  for select using (
    company_id = get_my_company_id() and get_my_role() = 'owner'
  );
