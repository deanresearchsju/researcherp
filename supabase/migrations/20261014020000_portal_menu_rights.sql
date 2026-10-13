-- Menu rights for staff sign-ins. Null means every menu for that role.

alter table public.portal_users
  add column if not exists menu_rights jsonb;
