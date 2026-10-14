-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- B05: optimistic lock for one-row JSON office tables.
-- Does not delete rows. Direct table grants stay as they are.

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
    'thesis_panels'
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

-- Rollback:
-- drop function if exists public.save_json_blob(text, text, jsonb, timestamptz);
