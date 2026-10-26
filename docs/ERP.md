# The ERP: modules, menus and where the data lives

How each process works, rule by rule, is in [WORKFLOW.md](WORKFLOW.md). This document is the map: what is where.

## The idea

A Ph.D. scholar's journey has the same stages for everyone. The ERP follows it, and a stage opens only when the one before it is done:

**Apply, select, admit, course work, committees and reports, synopsis, thesis, evaluation and viva.**

Anything a scholar submits goes to the **Supervisor first and then the Dean**; either may reject with comments. Two flows have their own approvals: the **RAC** (supervisor, then Dean) and the **thesis evaluators** (supervisor, Dean, then Vice Chancellor; confidential).

## The menus of the office (Research Office, Dean)

| Module              | Menus                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Admissions          | Application window, Vacancies, Incomplete applications, Applications, **Selection** (nine steps), Admission archive |
| Registers           | Scholar register, Scholar information, Registration numbers, Supervisor register, Passed-out scholars              |
| Course work         | Registration, Exam setup, Hall tickets and seating, Result approval, Results, Semester promotion                   |
| Doctoral progress   | First committee, Ph.D. confirmation, Colloquium, Publications, Six-month report, Third committee, Plagiarism check, Synopsis, Thesis evaluators, Thesis, Examiner reports, Viva, Completion |
| Supervision         | Scholar allotment (with the guide history), RAC, Supervisor transfer, Supervisor exit                                                                         |
| Requests            | Supervisor change, Full-time to part-time, Title change, Leave, Extension, Ph.D. cancellation                      |
| Fees                | Fee collection, Fee approvals                                                                                      |
| Scholar records     | ABC ID, Approved documents, Attendance sheets                                                                      |
| Letters and reports | Letters, Reports and downloads, Forms and formats                                                                  |
| Website             | News and events, Helpdesk, Research areas, Our Team, Supervisor profiles                                           |
| Administration      | Users, Fee settings, Clear test data (main administrator only)                                                     |

The other roles see a smaller set: see [ROLES-AND-RIGHTS.md](ROLES-AND-RIGHTS.md) and the guides.

## Where the data is kept

| What                                           | Place                                         | Note                                                                       |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Ph.D. applications, drafts, number counters    | Tables `phd_applications`, `phd_drafts`, `application_counters` |                                                                |
| Supervisor recognition applications            | `supervisor_applications`                     |                                                                            |
| The Selection desk (cases, marks, progress)    | `admission_office` (one block of records)     | Also holds the guide history in a second row                               |
| Course work, committees, synopsis, thesis, viva, letters | `doctoral_office` (one block)        |                                                                            |
| Examination: tickets, seating, attendance, marks, result files | `exam_office` (one block)           |                                                                            |
| The register of scholars and supervisors       | The register is built into the program; corrections, registration numbers, quotas, exits, standings, profiles are in `research_register` (one block) | The register of the first loaded scholars is in `data/research-register.ts` |
| Scholar requests, fees, reports, personal details | `scholar_records`                          | One kind per menu                                                          |
| Guide allotments                               | `scholar_allocations`                         |                                                                            |
| RAC proposals                                  | `rac_proposals`                               |                                                                            |
| Thesis evaluator nominations                   | `thesis_evaluation` (server only)             | Never shown to scholars                                                    |
| Sign-ins                                       | `portal_users` (server only)                  |                                                                            |
| Vacancy list used by Selection                 | `supervisor_vacancies`                        | Kept in step with allotments                                               |
| Website: news, research areas, team, settings, photos, forms | `news_board`, `research_areas`, `research_team`, `site_settings`, `profile_photos`, `portal_forms` |                      |
| Helpdesk, notices, audit                       | `helpdesk_messages`, `portal_notices`, `audit_log` |                                                                       |
| Uploaded files                                 | Amazon S3 (older: Supabase Storage)           | See STORAGE                                                                |

"One block" means one row holding many records. Two people saving at the same moment cannot overwrite each other: the second save is applied on top of the first (this is how several COE sign-ins can enter marks together).

## How the pieces connect

- **The register is the single source** for a scholar's name, contact, mode, department, guide and batch. What the office enters under **Scholar information** is laid over it, so it changes in every screen, report and download.
- **Vacancies** are the approved quota of each active supervisor less the scholars they guide. The same figure decides who can be offered as a guide, how many scholars can be transferred, and whether a department accepts applications.
- **Fees** are set once (Fee settings). A step that needs a fee opens only after Accounts approves the payment.
- **Letters, hall tickets, approved copies** are generated from the records; approved documents carry the approvals.
- **Mail** is sent for the events listed in WORKFLOW (acknowledgement, hall tickets, letters, sign-in details). Without a mail setting the ERP works and says that no mail was sent.
- **The audit trail** records important actions.

## Reports

Reports and downloads (office): scholar master list, research titles and areas, scholar personal details, supervisor-wise lists and more; every list has Export Excel and Export PDF, and the Scholar register lets you choose the information to export and filter by it.

## Printing

Every PDF and print sheet fits A4. Tables are plain black and white with centred headings.
