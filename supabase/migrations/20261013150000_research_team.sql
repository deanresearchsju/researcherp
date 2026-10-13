-- Research office team. The publishable key cannot tell an admin from a
-- public visitor, so this policy allows the anon role to read and write.
-- Replace it with an authenticated admin policy before the portal is public.

create table if not exists public.research_team (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null unique,
  role text not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_research_team()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists research_team_touch on public.research_team;
create trigger research_team_touch
  before update on public.research_team
  for each row
  execute function public.touch_research_team();

alter table public.research_team enable row level security;

grant select, insert, update, delete on public.research_team to anon, authenticated;

drop policy if exists research_team_public on public.research_team;
create policy research_team_public
  on public.research_team
  for all
  to anon, authenticated
  using (true)
  with check (true);

insert into public.research_team (sort_order, role, name)
values
  (1, 'Dean - Research and Development', ''),
  (2, 'Coordinator', '')
on conflict (sort_order) do nothing;
