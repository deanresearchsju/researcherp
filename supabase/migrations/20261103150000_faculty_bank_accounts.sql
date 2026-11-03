-- Faculty bank accounts, for crediting publication incentives.
--
-- Run after 20261103140000_faculty_research_rejection.sql. Safe to run more than once; it
-- deletes nothing. One row per faculty member, keyed by the mobile number (the key under which
-- incentive claims are counted). Faculty enter it on the open faculty page, where only the last
-- four digits are ever shown back; the administrator and the Dean see it in full under
-- Publication incentives. The public and signed-in database roles have no rights on it.

create table if not exists public.faculty_bank_accounts (
  faculty_key text primary key,
  faculty_name text not null default '',
  email text not null default '',
  holder_name text not null,
  account_no text not null,
  ifsc text not null,
  bank_name text not null default '',
  branch text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

alter table public.faculty_bank_accounts enable row level security;
revoke all on table public.faculty_bank_accounts from anon, authenticated;
grant select, insert, update, delete on table public.faculty_bank_accounts to service_role;
