-- Course-work examinations: exam campuses, hall tickets, seating, attendance, marks, the
-- passing board and the published results are kept in one record, exam_office, like the
-- other office records. Two Controller of Examinations sign-ins are added: coe (marks entry)
-- and coeverify (verification and freezing).
--
-- Run once in the Supabase SQL editor, after 20261023100000_office_roles.sql.
--
-- Rollback (only if no coe / coeverify sign-in exists):
--   alter table public.portal_users drop constraint if exists portal_users_role_check;
--   alter table public.portal_users add constraint portal_users_role_check
--     check (role in ('scholar', 'supervisor', 'admin', 'staff', 'dean', 'accounts', 'vc'));
--   drop table if exists public.exam_office;

alter table public.portal_users drop constraint if exists portal_users_role_check;

alter table public.portal_users
  add constraint portal_users_role_check
  check (
    role in (
      'scholar', 'supervisor', 'admin', 'staff', 'dean', 'accounts', 'vc', 'coe', 'coeverify'
    )
  );

create table if not exists public.exam_office (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.exam_office enable row level security;

grant select, insert, update, delete on public.exam_office to anon, authenticated;

drop policy if exists exam_office_public on public.exam_office;
create policy exam_office_public on public.exam_office
  for all to anon, authenticated using (true) with check (true);

-- The optimistic lock accepts the new table.
create or replace function public.save_json_blob(
  p_table text,
  p_id text,
  p_payload jsonb,
  p_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'doctoral_office',
    'admission_office',
    'research_register',
    'news_board',
    'research_areas',
    'thesis_panels',
    'exam_office'
  ];
  stamp timestamptz;
begin
  if p_table is null or not (p_table = any (allowed)) then
    raise exception 'unknown table';
  end if;
  if p_id is null or length(trim(p_id)) = 0 then
    raise exception 'invalid id';
  end if;
  if p_updated_at is null then
    execute format(
      'insert into public.%I (id, payload, updated_at)
       values ($1, $2, now())
       on conflict (id) do nothing
       returning updated_at',
      p_table
    )
    into stamp
    using trim(p_id), p_payload;
    if stamp is null then
      raise exception 'conflict' using errcode = 'P0001';
    end if;
    return stamp;
  end if;
  execute format(
    'update public.%I
     set payload = $1, updated_at = now()
     where id = $2 and updated_at = $3
     returning updated_at',
    p_table
  )
  into stamp
  using p_payload, trim(p_id), p_updated_at;
  if stamp is null then
    raise exception 'conflict' using errcode = 'P0001';
  end if;
  return stamp;
end;
$$;

revoke all on function public.save_json_blob(text, text, jsonb, timestamptz) from public;
grant execute on function public.save_json_blob(text, text, jsonb, timestamptz)
  to anon, authenticated;
