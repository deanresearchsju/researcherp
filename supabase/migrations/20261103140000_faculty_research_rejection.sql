-- Faculty research: the Dean or the administrator may reject a record, with the reason; and the
-- faculty member's email, by which uploaded records are matched when the faculty member signs in.
--
-- Run after 20261103130000_faculty_research_approval.sql. Safe to run more than once; it deletes
-- nothing. A rejected record keeps its details but frees its title, DOI and patent number, so the
-- faculty member can add a corrected record.

alter table public.faculty_research_records
  add column if not exists rejected_at timestamptz,
  add column if not exists review_note text not null default '';

alter table public.faculty_research_records
  add column if not exists email text not null default '';

create index if not exists faculty_research_email_idx
  on public.faculty_research_records (email);
