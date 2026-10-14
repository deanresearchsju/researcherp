-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- B06: application numbers from sequences.
-- B14: Ph.D. drafts by signed token; direct table access revoked.
-- Does not delete application or draft rows.

create sequence if not exists public.phd_application_seq;
create sequence if not exists public.supervisor_application_seq;

do $$
declare
  phd_max integer;
  sup_max integer;
begin
  select coalesce(max(nullif(substring(application_no from '([0-9]+)$'), '')::int), 0)
    into phd_max
    from public.phd_applications;
  select coalesce(max(nullif(substring(application_no from '([0-9]+)$'), '')::int), 0)
    into sup_max
    from public.supervisor_applications;
  perform setval('public.phd_application_seq', greatest(phd_max, 1), phd_max > 0);
  perform setval(
    'public.supervisor_application_seq',
    greatest(sup_max, 1),
    sup_max > 0
  );
end;
$$;

create or replace function public.issue_application_no(p_kind text, p_year text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
  year text := trim(p_year);
begin
  if year !~ '^[0-9]{4}$' then
    raise exception 'invalid year';
  end if;
  if p_kind = 'phd' then
    n := nextval('public.phd_application_seq');
    return 'SJU/PHD/' || year || '/' || lpad(n::text, 4, '0');
  end if;
  if p_kind = 'supervisor' then
    n := nextval('public.supervisor_application_seq');
    return 'SJU/SUP/PHD/' || year || '/' || lpad(n::text, 3, '0');
  end if;
  raise exception 'unknown kind';
end;
$$;

revoke all on function public.issue_application_no(text, text) from public;
grant execute on function public.issue_application_no(text, text) to anon, authenticated;

alter table public.phd_drafts add column if not exists token text;

update public.phd_drafts
set token = gen_random_uuid()::text
where token is null or token = '';

alter table public.phd_drafts alter column token set not null;

create unique index if not exists phd_drafts_token_key on public.phd_drafts (token);

create or replace function public.upsert_phd_draft(
  p_token text,
  p_mobile text,
  p_email text,
  p_department text,
  p_step integer,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'invalid token';
  end if;
  insert into public.phd_drafts as d (
    mobile,
    email,
    department,
    step,
    payload,
    token
  )
  values (
    trim(p_mobile),
    trim(p_email),
    trim(p_department),
    greatest(p_step, 0),
    p_payload,
    trim(p_token)
  )
  on conflict (mobile) do update
    set email = excluded.email,
        department = excluded.department,
        step = excluded.step,
        payload = excluded.payload
  where d.token = excluded.token;
end;
$$;

create or replace function public.get_phd_draft(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;
  select jsonb_build_object(
    'step', d.step,
    'payload', d.payload
  )
  into result
  from public.phd_drafts d
  where d.token = trim(p_token);
  return result;
end;
$$;

create or replace function public.delete_phd_draft(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return;
  end if;
  delete from public.phd_drafts where token = trim(p_token);
end;
$$;

revoke all on function public.upsert_phd_draft(text, text, text, text, integer, jsonb) from public;
revoke all on function public.get_phd_draft(text) from public;
revoke all on function public.delete_phd_draft(text) from public;
grant execute on function public.upsert_phd_draft(text, text, text, text, integer, jsonb) to anon, authenticated;
grant execute on function public.get_phd_draft(text) to anon, authenticated;
grant execute on function public.delete_phd_draft(text) to anon, authenticated;

drop policy if exists phd_drafts_public on public.phd_drafts;
revoke all on table public.phd_drafts from anon, authenticated;

-- Rollback (run only if you need to undo this file):
-- grant select, insert, update, delete on public.phd_drafts to anon, authenticated;
-- create policy phd_drafts_public on public.phd_drafts
--   for all to anon, authenticated using (true) with check (true);
-- drop function if exists public.delete_phd_draft(text);
-- drop function if exists public.get_phd_draft(text);
-- drop function if exists public.upsert_phd_draft(text, text, text, text, integer, jsonb);
-- drop function if exists public.issue_application_no(text, text);
-- drop index if exists public.phd_drafts_token_key;
-- alter table public.phd_drafts drop column if exists token;
-- drop sequence if exists public.phd_application_seq;
-- drop sequence if exists public.supervisor_application_seq;
