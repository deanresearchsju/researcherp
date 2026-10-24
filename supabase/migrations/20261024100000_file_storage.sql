-- Files live in Supabase Storage instead of inside database rows. The server reads and
-- writes them with the service-role key; there are no storage policies, so nothing is
-- reachable with the publishable key. The private bucket is opened only through
-- /api/files, which checks the ERP sign-in and hands out short-lived links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'portal-private',
    'portal-private',
    false,
    5242880,
    array['application/pdf', 'image/jpeg', 'image/png']
  ),
  (
    'portal-public',
    'portal-public',
    true,
    1048576,
    array['image/jpeg', 'image/png']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
