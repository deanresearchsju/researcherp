-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- Adds leave, extension, and title-change on scholar_records.
-- Plagiarism, examiner reports, viva, and completion stay in doctoral_office.payload.

alter table public.scholar_records drop constraint if exists scholar_records_kind_check;
alter table public.scholar_records add constraint scholar_records_kind_check check (
  kind in (
    'abc_id',
    'hall_ticket',
    'personal_details',
    'payment',
    'phd_cancellation',
    'supervisor_change',
    'study_mode_change',
    'leave',
    'extension',
    'title_change',
    'publication',
    'six_month_report'
  )
);

alter table public.rac_proposals
  add column if not exists agenda text not null default '';
alter table public.rac_proposals
  add column if not exists attendance text not null default '';
alter table public.rac_proposals
  add column if not exists minutes text not null default '';
