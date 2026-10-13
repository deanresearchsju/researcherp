-- Team photograph, email, and phone. Run this in the SQL editor for this project.
-- Policies stay open until real admin auth exists.

alter table public.research_team
  add column if not exists email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists photo text not null default '';
