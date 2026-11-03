-- Checklists kept by the administrator, faculty research evidence, and publication incentives.
--
-- Run after 20261103110000_faculty_research_unique.sql. Safe to run more than once; it deletes
-- nothing. The ERP server reads and writes these tables with the service key after checking who
-- is asking; the public and signed-in database roles have no rights on them.

-- One row per checklist (application, admission, synopsis, thesis, publication-evidence,
-- proposal-evidence). Until a row exists the list written in the code is used.
create table if not exists public.erp_checklists (
  id text primary key,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

-- The incentive rules (rates and the yearly ceiling of each cadre), one row with id 'rules'.
create table if not exists public.faculty_incentive_settings (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

-- One incentive claim per publication or patent.
create table if not exists public.faculty_incentive_claims (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null unique references public.faculty_research_records (id) on delete restrict,
  faculty_key text not null,
  faculty_name text not null default '',
  designation text not null default '',
  academic_year text not null,
  basis text not null default '',
  computed numeric(12, 2) not null default 0,
  claimed numeric(12, 2) not null default 0,
  approved numeric(12, 2) not null default 0,
  status text not null default 'Claimed' check (status in ('Claimed', 'Approved', 'Paid', 'Rejected')),
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create index if not exists faculty_incentive_year_idx
  on public.faculty_incentive_claims (faculty_key, academic_year);

alter table public.erp_checklists enable row level security;
alter table public.faculty_incentive_settings enable row level security;
alter table public.faculty_incentive_claims enable row level security;
revoke all on table public.erp_checklists from anon, authenticated;
revoke all on table public.faculty_incentive_settings from anon, authenticated;
revoke all on table public.faculty_incentive_claims from anon, authenticated;
grant select, insert, update, delete on table public.erp_checklists to service_role;
grant select, insert, update, delete on table public.faculty_incentive_settings to service_role;
grant select, insert, update, delete on table public.faculty_incentive_claims to service_role;
