-- =====================
-- CLIENT BILLING CONFIGS
-- =====================
create table if not exists client_billing_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  job_type_name text not null,
  billing_type text check (billing_type in ('per_load', 'hourly', 'per_ton')) not null,
  client_rate_amount decimal(10,4) not null,
  client_rate_unit text check (client_rate_unit in ('per_load', 'per_hour', 'per_ton')) not null,
  driver_hours_per_load decimal(5,2),
  driver_pay_type text check (driver_pay_type in ('per_load', 'per_ton', 'hourly')) not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists client_billing_configs_company_id_idx on client_billing_configs(company_id);
create index if not exists client_billing_configs_client_id_idx on client_billing_configs(client_id);

-- =====================
-- DRIVER PAY RATES
-- =====================
create table if not exists driver_pay_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  driver_id uuid references users(id) on delete cascade,
  hourly_rate decimal(10,2),
  per_load_rate decimal(10,2),
  per_ton_rate decimal(10,2),
  effective_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists driver_pay_rates_company_id_idx on driver_pay_rates(company_id);
create index if not exists driver_pay_rates_driver_id_idx on driver_pay_rates(driver_id);

-- =====================
-- DAILY TIMESHEETS
-- =====================
create table if not exists daily_timesheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  driver_id uuid references users(id),
  dispatch_id uuid references dispatches(id),
  client_id uuid references clients(id),
  job_site_id uuid references job_sites(id),
  work_date date not null,
  arrived_at timestamptz,
  departed_at timestamptz,
  hours_worked decimal(5,2),
  hours_billed_client decimal(5,2),
  hours_paid_driver decimal(5,2),
  client_rate_per_hour decimal(10,2),
  driver_hourly_rate decimal(10,2),
  client_charge_total decimal(10,2),
  driver_pay_total decimal(10,2),
  submission_method text check (submission_method in ('digital', 'paper_scan')),
  scanned_invoice_photo_url text,
  ai_extracted_data jsonb,
  client_signature_url text,
  client_signer_name text,
  status text check (status in ('submitted', 'confirmed', 'invoiced', 'disputed')) not null default 'submitted',
  dispatcher_notes text,
  dispatcher_adjusted_hours decimal(5,2),
  dispatcher_adjustment_reason text,
  confirmed_at timestamptz,
  confirmed_by uuid references users(id),
  notes text,
  submitted_at timestamptz not null default now(),
  gps_lat decimal(10,7),
  gps_lng decimal(10,7)
);

create index if not exists daily_timesheets_company_id_idx on daily_timesheets(company_id);
create index if not exists daily_timesheets_driver_id_idx on daily_timesheets(driver_id);
create index if not exists daily_timesheets_work_date_idx on daily_timesheets(work_date);

-- =====================
-- ALTER LOAD_TICKETS
-- =====================
alter table load_tickets
  add column if not exists billing_type text check (billing_type in ('per_load', 'hourly', 'per_ton')),
  add column if not exists submission_method text check (submission_method in ('tag_scan', 'paper_scan', 'manual')),
  add column if not exists tag_number text,
  add column if not exists weight_tons decimal(10,3),
  add column if not exists material_type text,
  add column if not exists hours_worked decimal(5,2),
  add column if not exists hours_billed_client decimal(5,2),
  add column if not exists hours_paid_driver decimal(5,2),
  add column if not exists client_rate_amount decimal(10,4),
  add column if not exists client_rate_unit text,
  add column if not exists client_charge_total decimal(10,2),
  add column if not exists driver_hourly_rate decimal(10,2),
  add column if not exists driver_pay_per_load decimal(10,2),
  add column if not exists driver_hours_per_load decimal(5,2),
  add column if not exists driver_pay_total decimal(10,2),
  add column if not exists tag_photo_url text,
  add column if not exists scanned_invoice_photo_url text,
  add column if not exists ai_extracted_data jsonb,
  add column if not exists client_signature_url text,
  add column if not exists client_signer_name text,
  add column if not exists dispatcher_adjusted_pay decimal(10,2),
  add column if not exists dispatcher_adjustment_reason text,
  add column if not exists invoice_line_confirmed boolean not null default false,
  add column if not exists invoice_line_confirmed_at timestamptz,
  add column if not exists invoice_line_confirmed_by uuid references users(id),
  add column if not exists invoice_line_notes text;

-- =====================
-- ALTER INVOICES
-- =====================
alter table invoices
  add column if not exists invoice_type text check (invoice_type in ('client_invoice', 'driver_payroll')) default 'client_invoice',
  add column if not exists owner_confirmed boolean not null default false,
  add column if not exists owner_confirmed_at timestamptz,
  add column if not exists lines_confirmed integer not null default 0,
  add column if not exists lines_total integer not null default 0,
  add column if not exists draft_pdf_url text;

-- =====================
-- RLS
-- =====================
alter table client_billing_configs enable row level security;
alter table driver_pay_rates enable row level security;
alter table daily_timesheets enable row level security;

-- Client billing configs: owner/dispatcher read+write, driver read
create policy "company members read billing configs" on client_billing_configs
  for select using (company_id = get_my_company_id());

create policy "owner manages billing configs" on client_billing_configs
  for all using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));

-- Driver pay rates: owner/dispatcher read+write
create policy "company members read pay rates" on driver_pay_rates
  for select using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));

create policy "owner manages pay rates" on driver_pay_rates
  for all using (company_id = get_my_company_id() and get_my_role() = 'owner');

-- Daily timesheets: drivers see their own, owner/dispatcher see all
create policy "driver sees own timesheets" on daily_timesheets
  for select using (
    company_id = get_my_company_id() and (
      driver_id = auth.uid() or get_my_role() in ('owner', 'dispatcher')
    )
  );

create policy "driver submits timesheets" on daily_timesheets
  for insert with check (company_id = get_my_company_id() and driver_id = auth.uid());

create policy "owner dispatcher manages timesheets" on daily_timesheets
  for update using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));
