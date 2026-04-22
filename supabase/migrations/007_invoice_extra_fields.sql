-- Extra metadata fields on invoices for the generate form.
alter table invoices
  add column if not exists client_address  text,
  add column if not exists origin          text,
  add column if not exists destination     text,
  add column if not exists custom_items    jsonb default '[]'::jsonb;

-- loads_count was missing from load_tickets — causes silent insert failures.
alter table load_tickets
  add column if not exists loads_count integer not null default 1;
