-- Add billing_config_id to dispatches
alter table dispatches
  add column if not exists billing_config_id uuid references client_billing_configs(id);
