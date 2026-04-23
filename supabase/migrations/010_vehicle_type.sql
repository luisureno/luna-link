-- Store driver's vehicle type on their profile
alter table users add column if not exists vehicle_type text check (vehicle_type in ('tractor_only', 'tractor_trailer'));
