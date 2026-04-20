-- =====================
-- PLANS
-- =====================
create table if not exists plans (
  id text primary key,                -- 'solo' | 'starter' | 'fleet' | 'enterprise'
  name text not null,
  price_monthly integer not null,     -- cents
  price_annual integer,               -- cents (null = custom)
  driver_limit integer,               -- null = unlimited / custom
  truck_limit integer,                -- null = unlimited / custom
  is_custom boolean not null default false,
  features jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into plans (id, name, price_monthly, price_annual, driver_limit, truck_limit, is_custom, features, sort_order) values
  ('solo',       'Solo',       2900,   29000,  1,    1,    false,
    '["Owner operator combined view","Unlimited loads","Tag scan","Client invoicing","Fuel + earnings","Mobile + desktop"]'::jsonb, 1),
  ('starter',    'Starter',    7900,   79000,  5,    5,    false,
    '["Dispatcher dashboard","Up to 5 drivers / trucks","Unlimited loads","Tag scan","Client invoicing","Driver payroll","Fuel + earnings"]'::jsonb, 2),
  ('fleet',      'Fleet',      14900,  149000, 20,   20,   false,
    '["Everything in Starter","Up to 20 drivers / trucks","Priority support","Advanced reporting","Bulk invoicing"]'::jsonb, 3),
  ('enterprise', 'Enterprise', 0,      null,   null, null, true,
    '["Unlimited drivers / trucks","Dedicated onboarding","SLA","Custom integrations","QuickBooks priority"]'::jsonb, 4)
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_annual = excluded.price_annual,
  driver_limit = excluded.driver_limit,
  truck_limit = excluded.truck_limit,
  is_custom = excluded.is_custom,
  features = excluded.features,
  sort_order = excluded.sort_order;

-- =====================
-- ALTER COMPANIES
-- =====================
alter table companies
  add column if not exists account_type text
    check (account_type in ('solo', 'fleet', 'enterprise')) default 'fleet',
  add column if not exists plan_id text references plans(id),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists billing_status text
    check (billing_status in ('trialing','active','past_due','canceled','none')) default 'none';

-- =====================
-- SUBSCRIPTIONS
-- =====================
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  plan_id text not null references plans(id),
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')) default 'monthly',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_company_id_idx on subscriptions(company_id);
create index if not exists subscriptions_status_idx on subscriptions(status);

-- =====================
-- ONBOARDING PROGRESS
-- =====================
create table if not exists onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade unique,
  current_step integer not null default 1,
  completed boolean not null default false,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_progress_company_id_idx on onboarding_progress(company_id);

-- =====================
-- RLS
-- =====================
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table onboarding_progress enable row level security;

-- Plans: public read (needed for pricing page + upgrade modals)
create policy "plans readable by all" on plans
  for select using (true);

-- Subscriptions: owner-only for their own company
create policy "owner sees own subscription" on subscriptions
  for select using (company_id = get_my_company_id() and get_my_role() = 'owner');
create policy "owner manages own subscription" on subscriptions
  for all using (company_id = get_my_company_id() and get_my_role() = 'owner');

-- Onboarding: owner-only for their own company
create policy "owner sees own onboarding" on onboarding_progress
  for select using (company_id = get_my_company_id() and get_my_role() = 'owner');
create policy "owner manages own onboarding" on onboarding_progress
  for all using (company_id = get_my_company_id() and get_my_role() = 'owner');
