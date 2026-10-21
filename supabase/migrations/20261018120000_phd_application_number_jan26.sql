-- Ph.D. application numbers: SJU/PHD/Jan26/0001 and SJU/PHD/Jul26/0001.
-- Serial restarts at 0001 for each session-year (new counter keys).
-- Existing stored numbers are not rewritten.
-- Extra form fields (country, community name, NET/SET) stay in payload JSON.
-- Do not apply until asked. Run in the SQL editor for project vpqkcetfuawhcieljkju.

-- ROLLBACK:
--   drop function if exists public.submit_phd_application(text, text, text, text, text, text, jsonb);
--   Restore public.issue_application_number from 20261015120000_application_number_format.sql;
--   drop index if exists public.phd_applications_application_no_uidx;

create table if not exists public.application_counters (
  key text primary key,
  last_value bigint not null default 0
);

alter table public.application_counters enable row level security;

create unique index if not exists phd_applications_application_no_uidx
  on public.phd_applications (application_no);

create or replace function public.issue_application_number(
  p_kind text,
  p_year text,
  p_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
  year text := trim(p_year);
  code text := trim(p_code);
  counter_key text;
  yy text;
begin
  if year !~ '^[0-9]{4}$' then
    raise exception 'invalid year';
  end if;
  if p_kind = 'phd' then
    if code not in ('Jan', 'Jul', 'Jun') then
      raise exception 'invalid session';
    end if;
    yy := right(year, 2);
    counter_key := 'phd-fmt2:' || code || ':' || yy;
    insert into public.application_counters as c (key, last_value)
    values (counter_key, 1)
    on conflict (key) do update
      set last_value = c.last_value + 1
    returning last_value into n;
    return 'SJU/PHD/' || code || yy || '/' || lpad(n::text, 4, '0');
  end if;
  if p_kind = 'supervisor' then
    if code !~ '^[0-9]{2}$' then
      raise exception 'invalid month';
    end if;
    yy := right(year, 2);
    counter_key := 'supervisor:' || code || ':' || yy;
    insert into public.application_counters as c (key, last_value)
    values (counter_key, 1)
    on conflict (key) do update
      set last_value = c.last_value + 1
    returning last_value into n;
    return 'SJU/PHD/SUP.App/' || code || '/' || yy || '/' || lpad(n::text, 3, '0');
  end if;
  raise exception 'unknown kind';
end;
$$;

revoke all on function public.issue_application_number(text, text, text) from public;
grant execute on function public.issue_application_number(text, text, text) to anon, authenticated, service_role;

create or replace function public.submit_phd_application(
  p_date_of_birth text,
  p_applicant_name text,
  p_email text,
  p_study_mode text,
  p_year text,
  p_code text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  issued text;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    issued := public.issue_application_number('phd', p_year, p_code);
    begin
      insert into public.phd_applications (
        application_no,
        date_of_birth,
        applicant_name,
        email,
        study_mode,
        status,
        payload
      ) values (
        issued,
        p_date_of_birth,
        p_applicant_name,
        p_email,
        coalesce(p_study_mode, ''),
        'Acknowledgement sent',
        p_payload
      );
      return issued;
    exception
      when unique_violation then
        if attempt >= 5 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.submit_phd_application(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_phd_application(text, text, text, text, text, text, jsonb) to service_role;
