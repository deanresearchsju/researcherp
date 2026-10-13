-- News and events published from the research office.
-- Preview access stays open to anon and authenticated until real admin auth exists.

create table if not exists public.news_board (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.news_board enable row level security;

grant select, insert, update, delete on public.news_board to anon, authenticated;

drop policy if exists news_board_public on public.news_board;
create policy news_board_public
  on public.news_board
  for all
  to anon, authenticated
  using (true)
  with check (true);
