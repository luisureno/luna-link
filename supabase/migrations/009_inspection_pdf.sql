-- Add PDF URL and driver signature to pre_trip_inspections
alter table pre_trip_inspections add column if not exists pdf_url text;
alter table pre_trip_inspections add column if not exists signature text;
