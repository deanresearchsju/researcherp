-- Preview sign-in records. Passwords are stored in plain text because the
-- portal still uses the publishable key. Replace this before public launch.

create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('scholar', 'supervisor', 'admin')),
  name text not null,
  identifier text not null,
  password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, identifier)
);

create or replace function public.touch_portal_users()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_users_touch on public.portal_users;
create trigger portal_users_touch
  before update on public.portal_users
  for each row
  execute function public.touch_portal_users();

alter table public.portal_users enable row level security;

grant select, insert, update, delete on public.portal_users to anon, authenticated;

drop policy if exists portal_users_public on public.portal_users;
create policy portal_users_public
  on public.portal_users
  for all
  to anon, authenticated
  using (true)
  with check (true);

insert into public.portal_users (role, name, identifier, password)
values
  ('scholar', 'Sample Scholar', 'scholar@example.com', 'Scholar@2026'),
  ('scholar', 'Sample Scholar', 'SJU/PHD/2026/0001', 'Scholar@2026'),
  ('supervisor', 'Test Supervisor', 'supervisor@sju.test', 'Guide@2026'),
  ('supervisor', 'Test Supervisor', 'SUP-1001', 'Guide@2026'),
  ('admin', 'Research office', 'admin', 'Office@2026')
on conflict (role, identifier) do nothing;
