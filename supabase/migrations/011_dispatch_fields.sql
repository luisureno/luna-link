-- Add structured fields to dispatches: material type, billing method, PO number
alter table dispatches
  add column if not exists material_type text,
  add column if not exists billing_type  text check (billing_type in ('per_load', 'per_hour')),
  add column if not exists hours_per_load numeric,
  add column if not exists po_number      text;
