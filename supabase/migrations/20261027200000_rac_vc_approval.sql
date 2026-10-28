-- RAC approval by the Vice Chancellor after the Dean, and RAC entered by the research office.
-- Safe to run more than once. Run it in the Supabase SQL editor.
alter table public.rac_proposals drop constraint if exists rac_proposals_status_check;
alter table public.rac_proposals
  add constraint rac_proposals_status_check
  check (status in ('Submitted', 'With VC', 'Approved', 'Returned'));

alter table public.rac_proposals add column if not exists vc_by text not null default '';
alter table public.rac_proposals add column if not exists vc_on text not null default '';
alter table public.rac_proposals add column if not exists vc_remarks text not null default '';
alter table public.rac_proposals add column if not exists office_entry boolean not null default false;
alter table public.rac_proposals add column if not exists entered_by text not null default '';
