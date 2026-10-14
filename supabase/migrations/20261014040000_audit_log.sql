-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- Do not grant anon write access. The app records a local copy until writes move server-side.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_role text not null,
  actor_identifier text not null,
  action text not null,
  subject text not null,
  detail text not null default ''
);

create table if not exists public.portal_notices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null,
  identifier text not null,
  title text not null,
  detail text not null default ''
);

alter table public.rac_proposals
  add column if not exists remarks text not null default '';

alter table public.audit_log enable row level security;
alter table public.portal_notices enable row level security;
