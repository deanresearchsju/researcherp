-- Supervisor vacancies and application records for the research office.
-- The publishable key cannot tell an admin from a public visitor, so these
-- policies allow the anon role to read and write. Replace them with
-- authenticated admin policies before this portal is opened to the public.

create table if not exists public.supervisor_vacancies (
  id uuid primary key default gen_random_uuid(),
  serial_no integer not null unique,
  supervisor_name text not null,
  designation text not null,
  department text not null,
  research_area text not null,
  vacancy_count integer not null check (vacancy_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phd_applications (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  date_of_birth date not null,
  applicant_name text not null,
  email text not null,
  study_mode text not null,
  status text not null default 'Acknowledgement sent',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.supervisor_applications (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  date_of_birth date not null,
  applicant_name text not null,
  email text not null,
  status text not null default 'Acknowledgement sent',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists supervisor_vacancies_department_idx
  on public.supervisor_vacancies (department);

create index if not exists phd_applications_created_at_idx
  on public.phd_applications (created_at desc);

create index if not exists supervisor_applications_created_at_idx
  on public.supervisor_applications (created_at desc);

create or replace function public.touch_supervisor_vacancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supervisor_vacancies_touch on public.supervisor_vacancies;
create trigger supervisor_vacancies_touch
  before update on public.supervisor_vacancies
  for each row
  execute function public.touch_supervisor_vacancy();

alter table public.supervisor_vacancies enable row level security;
alter table public.phd_applications enable row level security;
alter table public.supervisor_applications enable row level security;

grant select, insert, update, delete on public.supervisor_vacancies to anon, authenticated;
grant select, insert, update on public.phd_applications to anon, authenticated;
grant select, insert, update on public.supervisor_applications to anon, authenticated;

drop policy if exists supervisor_vacancies_public on public.supervisor_vacancies;
create policy supervisor_vacancies_public
  on public.supervisor_vacancies
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists phd_applications_public on public.phd_applications;
create policy phd_applications_public
  on public.phd_applications
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists supervisor_applications_public on public.supervisor_applications;
create policy supervisor_applications_public
  on public.supervisor_applications
  for all
  to anon, authenticated
  using (true)
  with check (true);

insert into public.supervisor_vacancies (
  serial_no,
  supervisor_name,
  designation,
  department,
  research_area,
  vacancy_count
) values
  (1, 'Dr. Ezhil S', 'Associate Professor', 'Biochemistry', 'Phytomedicine, Molecular Biochemistry', 3),
  (2, 'Dr. Arockia Doss M', 'Associate Professor', 'Chemistry', 'Organic chemistry, Computational Chemistry', 4),
  (3, 'Dr. Muthu Kannan M', 'Professor', 'Civil Engineering', 'Concrete Technology', 8),
  (4, 'Dr. Udaya Banu T', 'Associate Professor', 'Civil Engineering', 'Self-concrete, Building materials, Material science', 2),
  (5, 'Dr. Kannan T', 'Associate Professor', 'Commerce', 'HR, Marketing, Finance', 6),
  (6, 'Dr. Kalaiarasan C', 'Assistant Professor', 'Commerce', 'HRM, Finance, Marketing', 4),
  (7, 'Dr. Kalaivani K', 'Assistant Professor', 'Commerce', 'Commerce, Marketing', 2),
  (8, 'Dr. Geetha K', 'Associate Professor', 'Computer Science', 'Data science, Cloud computing', 4),
  (9, 'Dr. Govindaraju S', 'Associate Professor', 'Computer Science', 'Computer science, Image processing', 4),
  (10, 'Dr. John Paul C', 'Associate Professor', 'Computer Science', 'Data mining, AI&ML', 3),
  (11, 'Dr. George Chellin Chandran J', 'Professor & Dean (Engineering and Technology)', 'Computer Science and Engineering', 'Networks, AI', 3),
  (12, 'Dr. Annie Portia Angel', 'Assistant Professor', 'Computer Science and Engineering', 'AI&DS', 3),
  (13, 'Dr. Sherly Kanaga Priya P', 'Assistant Professor', 'Computer Science and Engineering', 'Image processing, AI, ML', 3),
  (14, 'Dr. Sampathkumar K', 'Assistant Professor', 'Economics', 'Economics', 4),
  (15, 'Dr. A. Mariya Princy', 'Assistant Professor', 'Electronics and Communication Engineering', 'Image processing, VLSI Design, Wireless Networking, ML', 2),
  (16, 'Dr. Moraji', 'Assistant Professor', 'Electronics and Communication Engineering', 'Wireless sensor networks, IoT, Embedded system, Image processing, ML', 2),
  (17, 'Dr. P L Joseph Raj', 'Assistant Professor', 'Electronics and Communication Engineering', 'Medical Imaging, Medical Processing, Medical product development, VLSI Design', 1),
  (18, 'Dr. S. R. Fernisha', 'Assistant Professor', 'Electronics and Communication Engineering', 'Image processing, AI, ML', 4),
  (19, 'Dr. Selvin V', 'Professor', 'English', 'Science Fiction, Literary Criticism, Literary theory.', 2),
  (20, 'Dr. Ponnulexmi V', 'Associate Professor', 'English', 'English Literature', 1),
  (21, 'Dr. Naveena E', 'Assistant Professor', 'Horticulture', 'Agriculture, Horticulture, Vegetable production', 4),
  (22, 'Dr. Densingh Joshua', 'Professor', 'Management', 'Management studies', 1),
  (23, 'Dr. Michal Mariyadoss J', 'Professor', 'Management', 'HR, Marketing, operations', 8),
  (24, 'Dr. Jeya Sunitha J', 'Associate Professor', 'Management', 'Management studies, HR, System, Finance, Operations', 3),
  (25, 'Dr. Aveline S', 'Assistant Professor', 'Management', 'HR', 3),
  (26, 'Dr. Siva Kumar R', 'Associate Professor', 'Mathematics', 'Complex analysis, Geometric function theory', 4),
  (27, 'Dr. Revathi S', 'Assistant Professor', 'Mathematics', 'Fluid Dynamics', 2),
  (28, 'Dr. Marlon Jones Louis', 'Professor & Deputy Registrar', 'Mechanical Engineering', 'Biomechanics, 3D printing, Composite materials, Design, FEA', 8),
  (29, 'Dr. I. Neethi Manickam', 'Professor', 'Mechanical Engineering', 'Energy Engineering', 8),
  (30, 'Dr. S. Lakshmiprabha', 'Associate Professor', 'Medical Biochemistry', 'Molecular Diagnostics, Clinical Biochemistry', 6),
  (31, 'Dr. Prabha S P', 'Assistant Professor', 'Medical Biochemistry', 'Medicine, Medical Biochemistry, Clinical Biochemistry, Molecular Biology, Epigenetics, Medical genetics', 4),
  (32, 'Dr. Auxzilia Preethi. K', 'Assistant Professor', 'Medical Biotechnology', 'Medical Biotechnology', 4),
  (33, 'Dr. Mugunthan N', 'Professor', 'Medicine (Anatomy)', 'Medicine, Anatomy, Gross, Histology, Medical genetics', 8),
  (34, 'Dr. Anand Babu Wilson', 'Assistant Professor', 'Microbiology', 'Microbiology', 4),
  (35, 'Dr. JoseMon', 'Assistant Professor', 'Physical Education', 'Sports training, Sports psychology, Sports technology', 2),
  (36, 'Dr. Rajesh Kumar', 'Assistant Professor', 'Physics', 'Crystal growth, spectroscopy', 4),
  (37, 'Dr. Leema A', 'Assistant Professor', 'Tamil', 'Tamil', 3)
on conflict (serial_no) do nothing;
