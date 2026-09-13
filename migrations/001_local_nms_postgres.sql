create table if not exists sites (
  site_key text primary key,
  name text not null,
  type text not null default 'site',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  region text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  device_id text primary key,
  site_key text not null references sites(site_key) on delete cascade,
  name text not null,
  type text not null default 'device',
  label text not null default '',
  profile text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_attributes (
  device_id text not null references devices(device_id) on delete cascade,
  key text not null,
  value jsonb not null,
  value_type text not null default 'string',
  last_update_ts bigint not null default 0,
  primary key (device_id, key)
);

create table if not exists telemetry_latest (
  device_id text not null references devices(device_id) on delete cascade,
  metric text not null,
  ts timestamptz not null,
  value_type text not null,
  value_number double precision,
  value_string text,
  tags jsonb not null default '{}'::jsonb,
  primary key (device_id, metric)
);

create table if not exists telemetry_history (
  id bigserial primary key,
  device_id text not null references devices(device_id) on delete cascade,
  metric text not null,
  ts timestamptz not null,
  value_type text not null,
  value_number double precision,
  value_string text,
  tags jsonb not null default '{}'::jsonb
);

create table if not exists alarms (
  alarm_id text primary key,
  device_id text not null references devices(device_id) on delete cascade,
  type text not null,
  severity text not null,
  status text not null,
  created_at timestamptz not null default now(),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  details jsonb not null default '{}'::jsonb
);

create table if not exists agent_ingest_batches (
  id bigserial primary key,
  agent_id text not null,
  site_key text not null,
  item_count int not null,
  sent_at timestamptz,
  received_at timestamptz not null default now()
);

create table if not exists topology_snapshots (
  site_key text primary key references sites(site_key) on delete cascade,
  generated_at timestamptz not null default now(),
  fingerprint text not null default '',
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_devices_site_key on devices(site_key);
create index if not exists idx_telemetry_history_lookup on telemetry_history(device_id, metric, ts desc);
create index if not exists idx_alarms_status_created on alarms(status, severity, created_at desc);
