-- Faculty research: approval by the Dean or the administrator ("Checked & Approved").
--
-- Run after 20261103120000_erp_checklists_incentives.sql. Safe to run more than once; it deletes
-- nothing. A record is approved when approved_at is set; approved_by names who approved it.

alter table public.faculty_research_records
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text not null default '';

create index if not exists faculty_research_approved_idx
  on public.faculty_research_records (kind, approved_at);
