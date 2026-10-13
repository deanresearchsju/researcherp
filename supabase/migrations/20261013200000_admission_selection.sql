-- Ph.D. admission selection: payment, entrance, marks, provisional letter, certificates.
-- Run this in the SQL editor for this project. Policies stay open until real admin auth exists.

create table if not exists public.admission_office (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admission_office enable row level security;

grant select, insert, update, delete on public.admission_office to anon, authenticated;

drop policy if exists admission_office_public on public.admission_office;
create policy admission_office_public on public.admission_office
  for all to anon, authenticated using (true) with check (true);
