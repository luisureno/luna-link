-- Replace job_site dropdown with a free-text address field on dispatches
alter table dispatches
  add column if not exists job_site_address text;
