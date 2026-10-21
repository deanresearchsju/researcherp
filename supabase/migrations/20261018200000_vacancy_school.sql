-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- School name on supervisor vacancies so the same subject can be offered
-- in more than one school when a vacancy is open.

alter table public.supervisor_vacancies
  add column if not exists school text not null default '';

create index if not exists supervisor_vacancies_school_idx
  on public.supervisor_vacancies (school);
