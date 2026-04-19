-- Companies (each trucking company is a tenant)
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  logo_url text,
  created_at timestamptz default now()
);

-- Users (dispatchers, owners, drivers all live here)
create table users (
  id uuid primary key references auth.users(id),
  company_id uuid references companies(id),
  full_name text not null,
  phone text,
  role text check (role in ('owner', 'dispatcher', 'driver')) not null,
  truck_number text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Clients (companies the trucking company works for)
create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  name text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  address text,
  created_at timestamptz default now()
);

-- Job Sites
create table job_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  client_id uuid references clients(id),
  name text not null,
  address text,
  latitude decimal(10,7),
  longitude decimal(10,7),
  geofence_radius_meters integer default 300,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Ticket Form Templates
create table ticket_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  name text not null,
  description text,
  fields jsonb not null default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Dispatches
create table dispatches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  dispatcher_id uuid references users(id),
  client_id uuid references clients(id),
  job_site_id uuid references job_sites(id),
  ticket_template_id uuid references ticket_templates(id),
  title text not null,
  notes text,
  scheduled_date date not null,
  scheduled_time time,
  status text check (status in ('pending', 'active', 'completed', 'cancelled')) default 'pending',
  created_at timestamptz default now()
);

-- Dispatch Assignments
create table dispatch_assignments (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid references dispatches(id),
  driver_id uuid references users(id),
  acknowledged_at timestamptz,
  status text check (status in ('assigned', 'acknowledged', 'en_route', 'completed')) default 'assigned',
  created_at timestamptz default now()
);

-- Check-ins
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  driver_id uuid references users(id),
  dispatch_id uuid references dispatches(id),
  location_type text check (location_type in ('yard', 'quarry', 'job_site', 'other')) not null,
  location_label text,
  latitude decimal(10,7),
  longitude decimal(10,7),
  notes text,
  checked_in_at timestamptz default now()
);

-- Load Tickets
create table load_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  driver_id uuid references users(id),
  dispatch_id uuid references dispatches(id),
  client_id uuid references clients(id),
  job_site_id uuid references job_sites(id),
  ticket_template_id uuid references ticket_templates(id),
  form_data jsonb not null default '{}',
  photo_urls text[] default '{}',
  latitude decimal(10,7),
  longitude decimal(10,7),
  status text check (status in ('submitted', 'confirmed', 'invoiced', 'disputed')) default 'submitted',
  submitted_at timestamptz default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references users(id),
  notes text
);

-- Daily Driver Logs
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  driver_id uuid references users(id),
  log_date date not null,
  total_loads integer default 0,
  total_hours decimal(5,2) default 0,
  first_check_in timestamptz,
  last_check_in timestamptz,
  created_at timestamptz default now(),
  unique(driver_id, log_date)
);

-- Invoices
create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  client_id uuid references clients(id),
  invoice_number text not null,
  date_from date,
  date_to date,
  total_loads integer,
  total_amount decimal(10,2),
  status text check (status in ('draft', 'sent', 'paid', 'disputed')) default 'draft',
  pdf_url text,
  notes text,
  created_at timestamptz default now()
);

-- Invoice Line Items
create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id),
  load_ticket_id uuid references load_tickets(id),
  description text,
  quantity decimal(10,2),
  unit_price decimal(10,2),
  total decimal(10,2)
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table companies enable row level security;
alter table users enable row level security;
alter table clients enable row level security;
alter table job_sites enable row level security;
alter table ticket_templates enable row level security;
alter table dispatches enable row level security;
alter table dispatch_assignments enable row level security;
alter table check_ins enable row level security;
alter table load_tickets enable row level security;
alter table daily_logs enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;

-- Helper function: get current user's company_id
create or replace function get_my_company_id()
returns uuid
language sql stable
as $$
  select company_id from users where id = auth.uid()
$$;

-- Helper function: get current user's role
create or replace function get_my_role()
returns text
language sql stable
as $$
  select role from users where id = auth.uid()
$$;

-- companies: users can only see their own company
create policy "users see own company" on companies
  for all using (id = get_my_company_id());

-- users: same company
create policy "users see own company users" on users
  for all using (company_id = get_my_company_id());

-- clients
create policy "users see own company clients" on clients
  for all using (company_id = get_my_company_id());

-- job_sites
create policy "users see own company job_sites" on job_sites
  for all using (company_id = get_my_company_id());

-- ticket_templates
create policy "users see own company templates" on ticket_templates
  for all using (company_id = get_my_company_id());

-- dispatches
create policy "users see own company dispatches" on dispatches
  for all using (company_id = get_my_company_id());

-- dispatch_assignments: drivers only see their own
create policy "dispatcher see all assignments" on dispatch_assignments
  for select using (
    get_my_role() in ('owner', 'dispatcher') and
    exists (select 1 from dispatches d where d.id = dispatch_id and d.company_id = get_my_company_id())
  );
create policy "driver see own assignments" on dispatch_assignments
  for select using (driver_id = auth.uid());
create policy "dispatcher manage assignments" on dispatch_assignments
  for all using (
    get_my_role() in ('owner', 'dispatcher') and
    exists (select 1 from dispatches d where d.id = dispatch_id and d.company_id = get_my_company_id())
  );
create policy "driver update own assignment" on dispatch_assignments
  for update using (driver_id = auth.uid());

-- check_ins
create policy "dispatcher see all checkins" on check_ins
  for select using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));
create policy "driver see own checkins" on check_ins
  for select using (driver_id = auth.uid());
create policy "driver insert own checkin" on check_ins
  for insert with check (driver_id = auth.uid() and company_id = get_my_company_id());

-- load_tickets
create policy "dispatcher see all tickets" on load_tickets
  for select using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));
create policy "driver see own tickets" on load_tickets
  for select using (driver_id = auth.uid());
create policy "driver insert own ticket" on load_tickets
  for insert with check (driver_id = auth.uid() and company_id = get_my_company_id());
create policy "dispatcher update ticket" on load_tickets
  for update using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));

-- daily_logs
create policy "dispatcher see all logs" on daily_logs
  for select using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));
create policy "driver see own logs" on daily_logs
  for select using (driver_id = auth.uid());
create policy "driver upsert own log" on daily_logs
  for all using (driver_id = auth.uid() and company_id = get_my_company_id());

-- invoices
create policy "dispatcher manage invoices" on invoices
  for all using (company_id = get_my_company_id() and get_my_role() in ('owner', 'dispatcher'));

-- invoice_line_items
create policy "dispatcher manage line items" on invoice_line_items
  for all using (
    exists (select 1 from invoices i where i.id = invoice_id and i.company_id = get_my_company_id())
    and get_my_role() in ('owner', 'dispatcher')
  );
