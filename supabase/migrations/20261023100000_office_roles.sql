-- Sign-in types for the research office. The first portal_users migration allowed only
-- scholar, supervisor and admin. Staff and the Dean are office sign-ins too, and Accounts
-- (fee verification) and the Vice Chancellor (registers and thesis evaluator selection) are new.
--
-- Run once in the Supabase SQL editor.
--
-- Rollback (only if no accounts / vc / staff / dean sign-in exists):
--   alter table public.portal_users drop constraint if exists portal_users_role_check;
--   alter table public.portal_users add constraint portal_users_role_check
--     check (role in ('scholar', 'supervisor', 'admin'));

alter table public.portal_users drop constraint if exists portal_users_role_check;

alter table public.portal_users
  add constraint portal_users_role_check
  check (role in ('scholar', 'supervisor', 'admin', 'staff', 'dean', 'accounts', 'vc'));
