-- CLOSE THE DATABASE TO THE PUBLIC KEY.
--
-- Run this in the Supabase SQL editor ONLY AFTER the new version of the ERP (the one with
-- /api/db) is live and you have signed in and seen the pages load. Until the new version is
-- live, the old one still reads and writes with the public key and would stop working.
--
-- What it does: removes every right that the public (anon) and signed-in (authenticated)
-- database roles have on the ERP's tables and functions, and drops the open policies. After
-- this the public key, which is visible in the browser, opens nothing. The ERP server reads and
-- writes with the service key, which only the server holds, after checking who is asking.
--
-- It deletes no rows. Safe to run more than once.

do $$
declare
  item record;
begin
  -- Every table of the public schema.
  for item in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', item.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', item.tablename);
    execute format('grant select, insert, update, delete on table public.%I to service_role', item.tablename);
  end loop;

  -- Every open policy that was written for the public or signed-in roles.
  for item in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (roles && array['anon', 'authenticated', 'public']::name[])
  loop
    execute format('drop policy if exists %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;

  -- Every function of the public schema.
  for item in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', item.signature);
    execute format('grant execute on function %s to service_role', item.signature);
  end loop;
end $$;

-- Tables made later should not be open either.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- To check: with the public key, this must now answer with a permission error or nothing.
--   curl "<project url>/rest/v1/phd_applications?select=id" -H "apikey: <public key>"

-- Rollback (re-opens everything; use only to get the old version working again):
-- grant select, insert, update, delete on all tables in schema public to anon, authenticated;
-- grant execute on all functions in schema public to anon, authenticated;
-- and re-create the policies named *_public in the earlier migration files.
