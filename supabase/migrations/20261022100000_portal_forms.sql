-- Forms and formats the research office uploads (Word or PDF) for scholars, supervisors and the
-- public website to download.
--
-- No policy grants access to the browser keys. Only the server (service role) reads and writes
-- this table, through /api/forms: office sign-ins upload and remove, and each reader sees only
-- the forms meant for them.

create table if not exists public.portal_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '',
  audience text[] not null default '{scholar,supervisor}',
  file_name text not null,
  file_type text not null,
  file_size integer not null default 0,
  file_data text not null,
  -- False while a large file is still arriving in parts; readers see complete forms only.
  complete boolean not null default true,
  uploaded_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_forms_updated_idx on public.portal_forms (updated_at desc);

alter table public.portal_forms enable row level security;

revoke all on public.portal_forms from anon, authenticated;
