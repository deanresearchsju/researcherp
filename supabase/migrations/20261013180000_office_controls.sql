-- Home-page copy, application window, scholar allotment, and RAC.
-- Also extends scholar records for publications, six-month reports,
-- and supervisor-then-office approval.
-- Run this in the SQL editor after the earlier migrations.
-- Policies stay open because the publishable key cannot tell an admin from a scholar.

create table if not exists public.scholar_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  scholar_identifier text not null,
  scholar_name text not null default '',
  status text not null default 'Submitted',
  payload jsonb not null default '{}'::jsonb,
  file_name text,
  file_data text,
  supervisor_identifier text not null default '',
  supervisor_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scholar_records add column if not exists supervisor_identifier text not null default '';
alter table public.scholar_records add column if not exists supervisor_name text not null default '';

alter table public.scholar_records drop constraint if exists scholar_records_kind_check;
alter table public.scholar_records add constraint scholar_records_kind_check check (
  kind in (
    'abc_id',
    'hall_ticket',
    'personal_details',
    'payment',
    'phd_cancellation',
    'supervisor_change',
    'study_mode_change',
    'publication',
    'six_month_report'
  )
);

alter table public.scholar_records drop constraint if exists scholar_records_status_check;
alter table public.scholar_records add constraint scholar_records_status_check check (
  status in ('Submitted', 'Supervisor approved', 'Approved', 'Returned')
);

create table if not exists public.site_settings (
  id text primary key,
  hero_eyebrow text not null,
  hero_title text not null,
  hero_summary text not null,
  admission_label text not null,
  admission_session text not null,
  deadline_label text not null,
  deadline text not null,
  phd_open boolean not null default true,
  supervisor_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (
  id, hero_eyebrow, hero_title, hero_summary, admission_label, admission_session, deadline_label, deadline
) values (
  'office',
  'Center for Research · Ph.D. programmes',
  'Advancing Knowledge. Shaping Scholars.',
  'A supervised Ph.D. at St. Joseph University, from application to thesis.',
  'Admissions open',
  'January 2027',
  'Last Date to Apply',
  '30 December 2026'
) on conflict (id) do nothing;

create table if not exists public.scholar_allocations (
  id uuid primary key default gen_random_uuid(),
  scholar_identifier text not null unique,
  scholar_name text not null default '',
  supervisor_identifier text not null,
  supervisor_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rac_proposals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('constitution', 'reconstitution')),
  scholar_identifier text not null,
  scholar_name text not null default '',
  supervisor_identifier text not null,
  supervisor_name text not null default '',
  status text not null default 'Submitted' check (status in ('Submitted', 'Approved', 'Returned')),
  nominees jsonb not null,
  selected_internal text not null default '',
  selected_external text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rac_proposals_scholar_idx
  on public.rac_proposals (scholar_identifier, created_at desc);

create or replace function public.touch_office_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_office_row();

drop trigger if exists scholar_allocations_touch on public.scholar_allocations;
create trigger scholar_allocations_touch
  before update on public.scholar_allocations
  for each row execute function public.touch_office_row();

drop trigger if exists rac_proposals_touch on public.rac_proposals;
create trigger rac_proposals_touch
  before update on public.rac_proposals
  for each row execute function public.touch_office_row();

alter table public.site_settings enable row level security;
alter table public.scholar_allocations enable row level security;
alter table public.rac_proposals enable row level security;

grant select, insert, update, delete on public.site_settings to anon, authenticated;
grant select, insert, update, delete on public.scholar_allocations to anon, authenticated;
grant select, insert, update, delete on public.rac_proposals to anon, authenticated;

drop policy if exists site_settings_public on public.site_settings;
create policy site_settings_public on public.site_settings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists scholar_allocations_public on public.scholar_allocations;
create policy scholar_allocations_public on public.scholar_allocations
  for all to anon, authenticated using (true) with check (true);

drop policy if exists rac_proposals_public on public.rac_proposals;
create policy rac_proposals_public on public.rac_proposals
  for all to anon, authenticated using (true) with check (true);
