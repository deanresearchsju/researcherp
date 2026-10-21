-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- Public Contact form writes through the service role. Anon cannot read or write rows.

create table if not exists public.helpdesk_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists helpdesk_messages_created_at_idx
  on public.helpdesk_messages (created_at desc);

alter table public.helpdesk_messages enable row level security;
