-- RAC: Dean selects one internal member and one of three external panel candidates.
-- Adds the office notes, the supervisor's reason for a reconstitution, and who decided and when.
-- A reconstitution can be requested six months after the last approved RAC (checked in the app).

alter table public.rac_proposals add column if not exists remarks text not null default '';
alter table public.rac_proposals add column if not exists agenda text not null default '';
alter table public.rac_proposals add column if not exists attendance text not null default '';
alter table public.rac_proposals add column if not exists minutes text not null default '';
alter table public.rac_proposals add column if not exists reason text not null default '';
alter table public.rac_proposals add column if not exists decided_on date;
alter table public.rac_proposals add column if not exists decided_by text not null default '';

