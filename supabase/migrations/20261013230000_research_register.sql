-- Registration numbers allotted for January 2026 and June 2026.
-- Preview access stays open to anon and authenticated until real admin auth exists.

create table if not exists public.research_register (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.research_register enable row level security;

grant select, insert, update, delete on public.research_register to anon, authenticated;

drop policy if exists research_register_public on public.research_register;
create policy research_register_public
  on public.research_register
  for all
  to anon, authenticated
  using (true)
  with check (true);
