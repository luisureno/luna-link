-- Allow storing a free-text client name on a dispatch without creating a clients row
alter table dispatches
  add column if not exists client_name text;
