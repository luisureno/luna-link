-- Create storage buckets used by the app.
-- These are idempotent: insert does nothing if the bucket already exists.

insert into storage.buckets (id, name, public)
values ('ticket-photos', 'ticket-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('fuel-receipts', 'fuel-receipts', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

-- ticket-photos: authenticated users can upload to their own company folder
create policy "auth upload ticket-photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ticket-photos');

create policy "public read ticket-photos"
  on storage.objects for select
  using (bucket_id = 'ticket-photos');

-- fuel-receipts
create policy "auth upload fuel-receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fuel-receipts');

create policy "auth update fuel-receipts"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fuel-receipts');

create policy "public read fuel-receipts"
  on storage.objects for select
  using (bucket_id = 'fuel-receipts');

-- company-logos: only authenticated users can upload; public read
create policy "auth upload company-logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'company-logos');

create policy "auth update company-logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'company-logos');

create policy "public read company-logos"
  on storage.objects for select
  using (bucket_id = 'company-logos');
