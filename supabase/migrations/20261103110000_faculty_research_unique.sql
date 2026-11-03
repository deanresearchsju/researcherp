-- Faculty research: no duplicate records.
--
-- Run after 20261103100000_faculty_research.sql. A title (of the same kind), a DOI and a patent
-- number may each be saved only once. The ERP fills these key columns with the value reduced to
-- letters and digits (so spacing, capitals and punctuation do not make a second copy) and checks
-- them before saving; the unique indexes below are the final guard.
--
-- Safe to run more than once. It deletes nothing.

alter table public.faculty_research_records
  add column if not exists title_key text not null default '',
  add column if not exists doi_key text not null default '',
  add column if not exists patent_key text not null default '';

create unique index if not exists faculty_research_title_unique
  on public.faculty_research_records (kind, title_key) where title_key <> '';
create unique index if not exists faculty_research_doi_unique
  on public.faculty_research_records (doi_key) where doi_key <> '';
create unique index if not exists faculty_research_patent_unique
  on public.faculty_research_records (patent_key) where patent_key <> '';
