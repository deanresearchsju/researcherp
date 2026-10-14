-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- A01: close portal_users to the publishable (anon) key.
-- Other tables are not changed.
--
-- Do this AFTER SUPABASE_SERVICE_ROLE_KEY is in .env.local and the
-- Next.js server has been restarted. Login, password reset, and Users
-- then read and write through the service role. If this SQL runs first,
-- sign-in will fail until that key is set.
--
-- Does not delete rows.

revoke all on table public.portal_users from anon, authenticated;
drop policy if exists portal_users_public on public.portal_users;
grant select, insert, update, delete on public.portal_users to service_role;

-- Rollback:
-- grant select, insert, update, delete on public.portal_users to anon, authenticated;
-- create policy portal_users_public
--   on public.portal_users
--   for all
--   to anon, authenticated
--   using (true)
--   with check (true);
