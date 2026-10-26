# For programmers

Read `AGENTS.md` first: this is **Next.js 16** (App Router, React 19, `cacheComponents` on), whose conventions differ from older versions. The guides are in `node_modules/next/dist/docs/`. Check them before writing code, and heed deprecation notices.

## Commands

```bash
npm install
npm run dev            # development server
npm run build          # production build (also type-checks)
npm run start          # run the build
npx tsc --noEmit       # type check only
npm run lint           # ESLint
npm run format         # Prettier
```

`npm test` runs the automated tests in `tests/` (invigilation rules and letters so far). Other changes are checked by the type check, lint, the build and by hand (see TESTING). Adding tests for the rules in `lib/` (vacancy, promotion, approvals, registration numbers) is the best next investment.

The build may print a notice about a Next.js security advisory and stop; run it again to continue.

## The folders

| Folder                      | What is in it                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `app/(public)`              | The public website pages                                                                                |
| `app/(auth)/login`          | Sign-in, forgot and reset password                                                                      |
| `app/(portal)`              | The signed-in area: `admin/` (office, Dean, Accounts, COE, Vice Chancellor), `scholar/`, `supervisor/`  |
| `app/(popup)`               | Profile pop-up pages                                                                                    |
| `app/api`                   | Server routes: `auth`, `apply`, `users`, `files`, `mail`, `contact`, `forms`, `notices`, `thesis-evaluators`, `admin/test-data` |
| `app/supervisors/photo`     | Serves a supervisor's photograph as a normal image                                                      |
| `components/ui`             | Buttons, fields, badges, headings (shadcn style)                                                        |
| `components/home`, `layout`, `forms`, `supervisors`, `seo` | Public page sections, the page frame, the application forms, the supervisor list, structured data |
| `components/portal`         | Every screen of the ERP                                                                                  |
| `data`                      | Text, lists and menu definitions (edit here before editing components)                                  |
| `lib`                       | The rules and the data access (see below)                                                                |
| `supabase/migrations`       | The database, as SQL files in order                                                                      |
| `scripts`                   | Backup, restore, file moving, first administrator, brand and register builders                           |
| `proxy.ts`                  | Sends visitors without the right role away from `/admin`, `/scholar`, `/supervisor`                     |

## How the data works

- **Stores.** Most screens read data through small stores in `lib` with `subscribeX` and `currentX` functions, used with `useSyncExternalStore`. Look at `lib/office.ts`, `lib/register.ts`, `lib/doctoral.ts`, `lib/exam-office.ts`, `lib/scholar-records.ts`.
- **Blocks of records.** The Selection desk (`admission_office`), the doctoral records (`doctoral_office`), the examination records (`exam_office`) and the register (`research_register`) are each **one JSON row**. They are saved with `saveJsonBlob` (`lib/json-lock.ts`), which uses an `updated_at` check; on a conflict the change is applied again on the fresh copy (see `commit()` in `lib/exam-office.ts`). Add new fields with a safe default in the `parse...` function of that store so older rows still read.
- **Tables.** Applications, scholar records, allotments, RAC proposals and the like are normal tables.
- **Server only.** Sign-in, users, thesis evaluators, file upload and opening, mail and test-data clearing run in `app/api` with the service key (`lib/supabase/admin.ts`). The browser uses the public key (`lib/supabase/client.ts`).
- **Browser copies.** Some stores keep a copy in `localStorage` (keys begin with `sju-`) as a fallback when the database is not reachable. When something looks stale, suspect these.
- **The register.** The first set of scholars and supervisors is in `data/research-register.ts`; corrections from the database are laid over it in place (`applyRegisterEdits`), then the Scholar information overlay (`applyPersonalOverlay`) in `lib/register.ts`. Functions such as `guideFigures`, `netAllotments`, `exitFor` rely on the loaded register.

## Rules in code

| Rule                                        | Where                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Menus and groups per role                   | `data/portal.ts`; rights in `lib/access.ts`; cookie in `lib/session.ts` |
| Supervisor, then Dean, approval             | `lib/doctoral.ts`, `lib/scholar-records.ts`, `lib/approval-flow.ts`    |
| Approval stamps and approved copy           | `lib/approved-copy.ts`, `lib/approved-documents.ts`                    |
| Vacancy and guide options                   | `lib/supervision.ts` (`guideOptions`), `lib/register.ts` (`guideFigures`), `lib/live-vacancies.ts` (the application) |
| Guide history                               | `lib/guide-history.ts`                                                 |
| Quota by designation                        | `lib/supervisor-approval.ts` (`proposedQuota`)                         |
| Registration number format                  | `lib/registration-format.ts`                                           |
| Semester promotion holds                    | `lib/promotion.ts`                                                     |
| Examination                                 | `lib/exam-office.ts` and the Exam screens                              |
| Invigilation duty (rules, store, letters)   | `lib/invigilation-core.ts` (pure, tested), `lib/invigilation.ts` (row `invigilation` of `exam_office`), `lib/invigilation-pdf.ts`, `components/portal/InvigilationDesk.tsx` |
| Files, S3                                   | `app/api/files`, `lib/s3.ts`, `lib/file-store.ts`, `lib/file-ref.ts`   |
| Test-data clearing                          | `lib/test-data.ts`, `app/api/admin/test-data/route.ts`                 |
| Excel and CSV upload                        | `lib/spreadsheet.ts` (reads .xlsx and .csv), `lib/register-import.ts` (plans and applies), `components/portal/RegisterImport.tsx` |
| Scholars and supervisors added to the register | `addedScholars` and `addedSupervisors` in the register record; `applyAddedRecords`, `importRegisterBatch` in `lib/register.ts` |
| What a box may hold (names, digits, dates)  | `lib/input-rules.ts` (`masked`, `typed`); `looseDateToIso` in `lib/dates.ts` |
| First sign-in details                       | `components/auth/PasswordReset.tsx`, `components/portal/SupervisorOwnDetails.tsx`, `saveOwnSupervisorDetails` |
| Public supervisors for search engines       | `lib/public-supervisors.ts` (`"use cache"`), `lib/seo.ts`              |
| UGC text for the home page                  | `data/ugc-norms.ts`                                                    |

## Recipes

**Add a menu.** Make `app/(portal)/admin/<name>/page.tsx` that renders a screen; add the item to the right group in `data/portal.ts`. The rights screen picks it up from there. Check `proxy.ts` needs no change (it matches by folder).

**Add a field to Scholar information.** Add it in `data/scholar-records.ts` (the `personal_details` menu). To show it in exports add a line in `lib/register-columns.ts`; to make it replace a register value add it in `applyPersonalOverlay`.

**Add a database change.** A new file in `supabase/migrations` named with the next timestamp; make it safe to run once (`if not exists`); add it to the list in `docs/SETUP.md` and to the changelog. If a table is read by the browser, think first about who may read it (see SECURITY, weak point 1) and prefer a server route.

**Add a public page.** `app/(public)/<name>/page.tsx` with `metadata` (title, description, canonical), a link in `data/navigation.ts`, a line in `app/sitemap.ts`.

**Change a rule.** Change the code, then `docs/WORKFLOW.md` and the changelog in the same piece of work.

## Conventions

- Put wording in `data/`, not in components. Keep components small.
- Keep the code in the style of its neighbours; run `npm run format`.
- Never read `process.env` secrets in code that runs in the browser. Only `NEXT_PUBLIC_` values may be there.
- Give every upload route a type, size and sign-in check.
- A new action in the ERP should leave a trace in the audit log when it matters.

## Known technical debt

- The database rules (RLS) are too open for most tables; move reads and writes to server routes (SECURITY).
- Few automated tests (only invigilation so far).
- A few very large components (for example `AdmissionDesk.tsx`) should be split.
- The upload limit is counted in server memory.
- Names stored inside older records are not rewritten when a scholar's name is corrected.
