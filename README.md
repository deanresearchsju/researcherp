# St. Joseph University Research ERP

Public site and application forms for the Ph.D. research portal. Drafts stay in the browser. Submitted applications and the supervisor vacancy list are stored in Supabase. Sign-in is still a preview session.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. In the Supabase SQL editor, run `supabase/migrations/20261013133000_research_office_records.sql`.

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run format` — Prettier

The product brief is [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). The official forms are in `docs/forms/`.

## Structure

- `app/(public)` — home, research areas, programmes and fees, admission, scholar journey, supervisors, supervisor vacancy, downloads, contact, announcements, both applications, and application status
- `app/(auth)/login/[role]` — scholar, supervisor, and admin sign-in
- `app/(portal)` — dashboard shells, vacancy editing, and stored applications
- `components/ui` — buttons, cards, form field, stepper, and other shared controls
- `components/forms` — Ph.D. application, supervisor recognition, and file upload
- `components/home`, `components/layout`, `components/auth` — page sections and chrome
- `data` — editable copy and mock records
- `lib/constants.ts` — university details, form options, and file-size limits
- `lib/validation.ts` — zod schemas
- `lib/auth.ts` — mock sign-in
- `styles/theme.css` — colour and type tokens

## Edit content

Change text and lists in `/data` rather than in components. File-size limits and the helpdesk email live in `lib/constants.ts`.

| File                    | What it controls                                             |
| ----------------------- | ------------------------------------------------------------ |
| `data/schools.ts`       | Schools and sample research areas                            |
| `data/fees.ts`          | Fee cards and the home glance                                |
| `data/admission.ts`     | Full admission steps and the four-step home outline          |
| `data/announcements.ts` | Notices                                                      |
| `data/faqs.ts`          | Admission questions                                          |
| `data/milestones.ts`    | Scholar journey and course work                              |
| `data/downloads.ts`     | Download titles and file links                               |
| `data/sections.ts`      | Headings and hero copy                                       |
| `data/declarations.ts`  | Declaration text from the official forms                     |
| `lib/constants.ts`      | Name, email, phone, address, bank, sessions, and file limits |

## Applications

- `/apply` — Ph.D. application. A draft is saved in this browser. Uploaded files are kept only for the visit. A successful submit stores the answers in Supabase. File names are stored; the files themselves stay on the applicant’s computer.
- `/apply/status` — application number plus date of birth. A sample record is `SJU/PHD/2026/0001` with date of birth `1995-06-15`.
- `/supervisor-recognition/apply` — recognition application. Numbers look like `SJU/SUP/PHD/2026/001`.
- `/supervisor-vacancy` — research supervisor vacancy list. The research office edits it at `/admin/vacancies`.
- `/admin/applications` — Ph.D. and supervisor recognition records stored in Supabase.

## Preview sign-in

Any password of at least 6 characters opens the matching dashboard. The password `invalid` shows the error state. The captcha is an arithmetic check in the browser.

- `/login/scholar` → `/scholar/dashboard`
- `/login/supervisor` → `/supervisor/dashboard`
- `/login/admin` → `/admin/dashboard`

## Replace these placeholders

- Helpdesk phone, hours, and campus address in `lib/constants.ts` (the email is `deanresearch.sju@dmifoundations.org`)
- Site URL `https://research.sju.ac.in`
- Bank account name, number, IFSC, bank, and branch
- Ph.D. admission sessions are January and July (`lib/constants.ts`)
- Announcement dates
- Approved school names and research areas
- Eligibility marks, if the University publishes a minimum
- Guideline, regulation, and syllabus files in `data/downloads.ts`
- Social profile URLs (currently `https://example.com`)
- Privacy and terms text
- Open Graph image `public/assets/og.jpeg`
- Fee wording, if the University revises the amounts
