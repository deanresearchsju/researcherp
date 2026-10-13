-- One profile photo per scholar or supervisor sign-in.
-- Preview access stays open to anon and authenticated until real admin auth exists.

create table if not exists public.profile_photos (
  id text primary key,
  photo text not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_photos enable row level security;

grant select, insert, update, delete on public.profile_photos to anon, authenticated;

drop policy if exists profile_photos_public on public.profile_photos;
create policy profile_photos_public
  on public.profile_photos
  for all
  to anon, authenticated
  using (true)
  with check (true);
