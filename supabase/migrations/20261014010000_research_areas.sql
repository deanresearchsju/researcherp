-- Research areas shown on the home page.
-- Preview access stays open to anon and authenticated until real admin auth exists.

create table if not exists public.research_areas (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.research_areas enable row level security;

grant select, insert, update, delete on public.research_areas to anon, authenticated;

drop policy if exists research_areas_public on public.research_areas;
create policy research_areas_public
  on public.research_areas
  for all
  to anon, authenticated
  using (true)
  with check (true);
