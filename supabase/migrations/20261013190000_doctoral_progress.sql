-- Course work, doctoral committee reports, colloquia, synopsis, and thesis.
-- Evaluator selection is stored apart from the scholar record.
-- Run this after the earlier migrations. Policies stay open until real admin auth exists.

create table if not exists public.doctoral_office (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.thesis_panels (
  id text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.doctoral_office enable row level security;
alter table public.thesis_panels enable row level security;

grant select, insert, update, delete on public.doctoral_office to anon, authenticated;
grant select, insert, update, delete on public.thesis_panels to anon, authenticated;

drop policy if exists doctoral_office_public on public.doctoral_office;
create policy doctoral_office_public on public.doctoral_office
  for all to anon, authenticated using (true) with check (true);

drop policy if exists thesis_panels_public on public.thesis_panels;
create policy thesis_panels_public on public.thesis_panels
  for all to anon, authenticated using (true) with check (true);
