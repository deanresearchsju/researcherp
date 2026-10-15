-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- New Ph.D. numbers: SJU/PHD/YEAR/Jan/0001 or SJU/PHD/YEAR/Jul/0001.
-- New supervisor numbers: SJU/PHD/SUP.App/MM/YY/001.
-- Existing application numbers stay as stored. Does not rewrite rows.

create table if not exists public.application_counters (
  key text primary key,
  last_value bigint not null default 0
);

alter table public.application_counters enable row level security;

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
    counter_key := 'phd:' || year || ':' || code;
    insert into public.application_counters as c (key, last_value)
    values (counter_key, 1)
    on conflict (key) do update
      set last_value = c.last_value + 1
    returning last_value into n;
    return 'SJU/PHD/' || year || '/' || code || '/' || lpad(n::text, 4, '0');
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
grant execute on function public.issue_application_number(text, text, text) to anon, authenticated;
