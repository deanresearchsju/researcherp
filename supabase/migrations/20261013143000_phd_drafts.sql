-- In-progress Ph.D. applications, resumed by mobile number.
-- Same publishable-key access as the other research-office tables.

create table if not exists public.phd_drafts (
  mobile text primary key,
  email text not null,
  department text not null,
  step integer not null default 0 check (step >= 0),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_phd_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists phd_drafts_touch on public.phd_drafts;
create trigger phd_drafts_touch
  before update on public.phd_drafts
  for each row
  execute function public.touch_phd_draft();

alter table public.phd_drafts enable row level security;

grant select, insert, update, delete on public.phd_drafts to anon, authenticated;

drop policy if exists phd_drafts_public on public.phd_drafts;
create policy phd_drafts_public
  on public.phd_drafts
  for all
  to anon, authenticated
  using (true)
  with check (true);
