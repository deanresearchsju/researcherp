-- One sign-in at a time for each user: the newest sign-in replaces the earlier one.
-- Safe to run more than once. Run it in the Supabase SQL editor.
alter table public.portal_users add column if not exists session_id text;
