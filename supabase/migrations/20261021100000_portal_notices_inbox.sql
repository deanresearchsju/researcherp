-- Portal notifications: a link to the page that needs attention and who has opened each notice.
-- Run once in the Supabase SQL editor. The app reads and writes this table only through the
-- server route /api/notices (service role), so no anon policy is added.

alter table public.portal_notices
  add column if not exists href text not null default '';

-- Reader keys ("role:identifier") of everyone who has opened the notice.
alter table public.portal_notices
  add column if not exists read_by text[] not null default '{}';

create index if not exists portal_notices_recipient_idx
  on public.portal_notices (role, identifier, created_at desc);
