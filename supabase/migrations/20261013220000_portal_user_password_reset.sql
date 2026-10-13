-- First sign-in replaces the password issued by the office.
-- Preview access stays open to anon and authenticated until real admin auth exists.

alter table public.portal_users
  add column if not exists must_reset boolean not null default false;
