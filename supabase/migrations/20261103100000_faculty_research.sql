-- Faculty publications and project proposals.
--
-- One row per record. The full record is kept in `details`; the columns beside it are copies
-- used to find records (the mobile number and date of birth for the public look-up, the date and
-- year for date-wise and year-wise lists). The ERP server reads and writes this table with the
-- service key after checking who is asking (app/api/faculty-research); the public and signed-in
-- database roles have no rights on it. Every create and update is written to audit_log.
--
-- Safe to run more than once. It deletes nothing.

create table if not exists public.faculty_research_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('publication', 'proposal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'public',
  owner_role text not null default '',
  owner_identifier text not null default '',
  faculty_name text not null default '',
  mobile text not null default '',
  dob date,
  record_date date,
  record_year integer,
  details jsonb not null default '{}'::jsonb
);

create index if not exists faculty_research_kind_date_idx
  on public.faculty_research_records (kind, record_date desc);
create index if not exists faculty_research_lookup_idx
  on public.faculty_research_records (kind, mobile, dob);
create index if not exists faculty_research_owner_idx
  on public.faculty_research_records (owner_role, lower(owner_identifier));

alter table public.faculty_research_records enable row level security;
revoke all on table public.faculty_research_records from anon, authenticated;
grant select, insert, update, delete on table public.faculty_research_records to service_role;
