-- Scholar uploads and office decisions. The publishable key cannot tell an
-- admin from a scholar, so this policy is open until real admin auth exists.

create table if not exists public.scholar_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in (
      'abc_id',
      'hall_ticket',
      'personal_details',
      'payment',
      'phd_cancellation',
      'supervisor_change',
      'study_mode_change'
    )
  ),
  scholar_identifier text not null,
  scholar_name text not null default '',
  status text not null default 'Submitted' check (status in ('Submitted', 'Approved', 'Returned')),
  payload jsonb not null default '{}'::jsonb,
  file_name text,
  file_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scholar_records_kind_idx on public.scholar_records (kind, created_at desc);

create or replace function public.touch_scholar_records()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scholar_records_touch on public.scholar_records;
create trigger scholar_records_touch
  before update on public.scholar_records
  for each row
  execute function public.touch_scholar_records();

alter table public.scholar_records enable row level security;

grant select, insert, update, delete on public.scholar_records to anon, authenticated;

drop policy if exists scholar_records_public on public.scholar_records;
create policy scholar_records_public
  on public.scholar_records
  for all
  to anon, authenticated
  using (true)
  with check (true);
