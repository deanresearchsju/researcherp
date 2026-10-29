# What changed and when

Newest first. Add a line here with every change that people will notice. "Incidents" at the end records anything that went wrong with data or security and what was done.

## Scholar lists, exports and report headers (29 October 2026, not yet saved to Git)

- **Every list of scholars** now carries **Department, Campus, Guide and Mode**: as filters in the filter box, as a column on the page where the table has room, and in the Excel and PDF downloads. Done on: Scholar information, Course registrations (and Arrears), Results, Fee approvals, Tuition fees, Colloquium (scholar-wise), Committee reports (both lists), Synopsis, Thesis, Plagiarism, Evaluators, Examiner reports, Viva, Completion, Six-month reports (and the office entry), RAC, Allotments, Supervisor transfer, Semester promotion, Registration numbers, Approved documents, Passed-out scholars, Attendance sheets (Excel), Scholar record requests, and the Reports page (every report that lists scholars gets the four columns, and Department and Campus filters).
- **PDF reports** print, under the title, the line **module › menu › sub-menu** the report was made from, beside the filters applied (shown in boxes) and the search words. This is done in one place (`lib/table-pdf.ts`, `lib/menu-context.ts`), so every PDF has it, including the invigilation and selection lists.
- **Publications** (Scholar records, Publications): an **Export CSV** button besides Excel and PDF. The CSV and Excel carry every detail of every publication (type, title, authors, journal, volume, issue, pages, ISSN, indexing, quality panel, impact factor, DOI, month, year, status) with the scholar's registration number, department, campus, guide and mode. The PDF has a shorter layout (scholar, department and campus, guide and mode, title and authors, journal, indexing, DOI, month, status). Filters: publication type, indexed in, year, department, campus, guide, mode, scholar, status.
- **Scholar information is now the one place the office enters a scholar's details.** Besides the personal details, each row shows the fee paid and balance and the RAC, and has **Fee paid** (mark the years already paid, in full or in part, with the date) and **Enter RAC** (one internal, one external, co-guide if any, recorded as approved earlier). Both write to the same stores as the Fee and RAC menus, so they show in the scholar's own Fee page, the Tuition fees ledger, Fee approvals totals, the Reports and the RAC menu at once. New filters Fee (balance due / paid up) and RAC, and the same columns in Excel and PDF. Staff need this menu ticked under Users, Menu rights, with Add / edit.
- A cell that begins with `=`, `+`, `-` or `@` is written to the CSV as text, so a spreadsheet does not run it.

## Security hardening (28 October 2026, not yet saved to Git)

**What a visitor or a signed-in member can reach**

- The browser no longer talks to the database. Every request goes through the site's own `/api/db`, which checks the sign-in and the rules in `lib/db-policy.ts` (table by table, role by role, with rate limits) and forwards allowed requests with the server's key. Scholars and supervisors see only their own application, file only their own records, and cannot approve, delete or change the public site.
- New SQL `20261028100000_close_public_access` closes every table and function to the public key. **Run it only after the new version is live** (docs/SECURITY.md, step A).
- The register of scholars and supervisors (names, mobile numbers, e-mail addresses) was part of the program's code and therefore downloadable by every visitor of the website. It now lives in the database (`research_register`, id `seed`, set by `scripts/seed-register.mjs`) and is trimmed for scholars and supervisors to their own details and those of the person they work with.
- Finding an application by mobile number now needs the e-mail address as well.

**Hardening**

- Rate limits: application form, contact form, acknowledgement mail, announcements, uploads, sign-in (per address as well as per sign-in), and the database gate.
- Content-security policy, cross-origin opener policy, no `X-Powered-By`; requests from other sites cannot write through the gate.
- Packages updated (Next.js 16.4.3, React 19.3, Supabase, AWS, nodemailer 10): `npm audit` shows no known weakness; the unused `html2canvas` and `@types/nodemailer` were removed.
- The whole Git history was searched for keys, passwords and tokens: none. The public GitHub repository still holds personal data in old commits (docs/SECURITY.md, step B).

**ERP changes of 28 October 2026**

- Sign-in no longer stays on "Signing in…" after a sign-out: signing in and out now load a fresh page, which also drops everything the earlier sign-in left in the browser.
- **Scholar, Fee:** tabs for the annual fee, the **synopsis fee** and the **thesis fee**; the synopsis and thesis pages point there. Accounts checks them under Fee approvals.
- **Fees and Fee verification were the same screen** (Fee approvals); Accounts now has the one menu, Fee approvals, and rights given before on the old Accounts screens carry over.
- **Course-work registration** adds a **mark sheet fee** (₹500 by default; Administration, Fee settings) once to each registration, besides the fee of each paper; Accounts sees it in the total.
- **Course registrations:** "Add subject" shows only under Subjects.
- **Examination menu** order: registration numbers first, then windows, registrations, promotion, exam setup, hall tickets, invigilation, results, mark entry, verify and freeze marks, result approval.
- **Scholar records:** Vidwan ID added to the personal details (also in the register exports and the import).
- **Reports, Fee paid & balance:** department, campus and guide columns.
- **Rights:** the administrator can give any office menu to any office sign-in (Accounts, the Vice Chancellor and the Controllers of Examinations included) and take any away; the sign-ins start with the same menus as before.
- **RAC:** a co-guide (if required) can be entered with the RAC; the office staff (as well as the administrator) can record a RAC that was approved earlier, needing only the name, designation and institution of each member.
- **RAC without publications:** the RAC (the supervisor's nomination and the office entry) asks for the area of research and no publication details. The office enters the RAC members of a scholar from **Scholar register, RAC members**: one internal, one external and, if required, a co-guide.
- **Thesis evaluators:** two publications of each evaluator are asked (was five).
- **The public Contact page is closed** (its address now leads to the home page, and so does the "Contact" link). Questions are asked inside the ERP: **Helpdesk** in the scholar and supervisor menus (what it is about, a subject, the question). It goes to the administrator and the Dean, who reply on **Helpdesk** in their menu; the question is then closed. Messages sent from the website earlier stay under "Website messages".
- **Public Supervisors page:** the "All schools" drop-down was removed; the search box is enough.
- **Colloquium:** the minimum attendance is no longer shown on the colloquium pages, dashboards, reports or alerts; scholars attend until they submit the synopsis. The research office checks the minimum (full time 3 of 6, part time 4 of 8) at the **synopsis and thesis checklists**, where the scholar's attendance is shown beside the item.
- **Vidwan ID** is its own menu for scholars (like ABC ID): the number is entered and saved. It then shows on the scholar's home page as a link that opens the Vidwan portal (it is no longer in the personal details). The register exports carry it.
- **Footer of the public pages:** the social icons and the Privacy · Terms links were removed.
- **NPTEL courses in course work:** a scholar may take up to **two of the four papers** (semester 1 and semester 2, two papers each) as NPTEL courses: NPTEL RM, NPTEL Research ethics, NPTEL major, NPTEL elective. The scholar is asked whether the **RAC approved** the course: if **no**, the scholar is told to get the RAC's approval first and cannot add it; if **yes**, the RAC minutes are attached. Then the NPTEL subject name, credit, month and year of the pass, and passed or in progress are entered; a passed course needs the proof of passing (an in-progress one gets its proof added later). The **Dean approves** the proof (Course registrations, NPTEL courses); the scholar is then **exempt** from appearing for that paper, and the semester allows one paper fewer to register.
- **ABC ID** shows on the scholar's home page once the proof is approved, as a link to the ABC portal (www.abc.gov.in); until then it shows where the request stands.
- **Approval rules** (Administration, Approval rules): the administrator ticks, for each request, the steps it goes through: **Supervisor, Dean, Vice Chancellor**, each tickable, with the steps now shown beside it (and whether they are the usual ones). The last step ticked gives the final approval; the steps before it recommend and pass the request on. It covers the **RAC**, the **doctoral committee reports**, the **synopsis**, the **Ph.D. thesis** and each **scholar request** (ABC ID, leave, extension, change of supervisor, mode of study or title, Ph.D. cancellation and so on). Every request needs at least one step; for the RAC the Dean or, with the Dean unticked, the Vice Chancellor selects the members, and the Supervisor tick means the supervisor names them (off: the office enters the RAC). A rule applies to requests made after it is saved: a request already on its way keeps its steps (a RAC already with the Vice Chancellor can be finished by the Dean once that step is off). Each person sees the approve button only at their own step; to see a request, the Vice Chancellor needs the menu (Users, menu rights). Every change is logged on the screen. Until something is changed the usual steps apply.
- **Fees:** the menu **Fee collection** is now **Tuition fees**; its **Fee ledger** shows the scholar's **department, campus and guide** (in the table and the downloads).
- **RAC entered by the office** can be **deleted** (administrator and office staff) but not edited: delete it and enter it again if it was wrong.
- **Six-month report:** the separate "Manuscript details" section was removed; papers are reported under "Paper published details".
- The test scholar "Jude" was removed (sign-in, notices, guide history, enrolment).

**Tests**

- `tests/db-policy.test.mjs` (rules of the gate and the rate counter) joined `npm test`; `npm run test:live` now also checks the gate, the trimmed register and that the public key of the database opens nothing (a WARN until the SQL is run). The change-password live tests now use the cookie of the newest sign-in.

## Not yet saved to Git (prepared on 25 October 2026)

**Website**

- The home page shows the Ph.D. under the UGC Regulations, 2022 (eligibility including the four-year bachelor's degree, selection, stages, duration, supervision), a support section (DrillBit similarity check, stipend for full-time scholars, IRINS), and research areas by department with the key areas of the supervisors; departments open one at a time.
- The Admission page no longer repeats the home page; the signature is not listed in the documents.
- The application page says the portal will open soon while the window is closed; the Supervisors page has no per-supervisor pages and no admission line.
- New privacy page, terms link, a security contact file, a sitemap with the supervisors page.
- The Scholar journey page was removed.

**Application**

- The candidate chooses the school and the department; a department with no vacancy (worked out from the supervisor register) stops the application with a clear message; the next questions appear only when there is a vacancy.

**ERP**

- Menus regrouped along the scholar's path; Fees became their own group; supervisors' menus grouped into Scholars, Approvals, Supervision, Documents; Clear test data only for the main administrator.
- Supervisor quota is fixed by designation (Professor 8, Associate 6, Assistant 4); only supervisors with a vacancy are offered for allotment, transfer and the guide step; a change-of-supervisor request cannot be approved when there is no vacancy.
- Guide history for the administrator and the Dean.
- Attendance of a paper at a campus is frozen and forwarded to the COE; marks can be entered only then; pass percentage in the COE list.
- Scholar information now changes the register everywhere (name, mobile, e-mail, mode, department, institution); a Personal group in the register exports; a Scholar personal details report.
- The supervisor register list was redesigned.
- Clear test data tool for the testing period.
- **Scholar allotment** (which holds the guide history) was missing from the menu and is now under Supervision; the scholar's old examiner-reports address now leads to the dashboard.
- Attachments show the approval stamp (name, date and time) when viewed, and the evaluator sheet shows each step with time (these two were saved in the last commit).

**Sub-menus instead of tabs**

- The office ERP now works like a usual education ERP: where a menu had tabs, each tab is a **sub-menu under the menu in the side bar** (for example Examination > Exam setup > Exam campuses, Timetable, Marks & grades). The tab bar inside the page is gone for these menus.
- Menus whose parts follow a process keep their tabs: **Hall tickets & seating** (hall tickets, seating, attendance), **Invigilation duty** (both), and **Passed-out scholars** (viva passed, then passed out).
- The sub-menus follow the rights: a sign-in sees only the sections it was given (Users, Rights).
- The logo at the top of the side bar no longer leads Staff, Dean, Accounts, VC and COE to a missing page.

**Research areas kept in the ERP, application form**

- **Website, Research areas** is now a three-level tree: a **research area** (school) holds **departments**, and a department holds its **key areas**. Each level can be added, edited (renamed) and removed; the areas move with a renamed department. A button adds the areas the supervisors give in their profiles to a department. The public home page shows what is kept here (where nothing is kept for a department, the supervisors' areas still fill in).
- **Ph.D. application form:** the applicant chooses the school and then the department; every department of the school is listed, including those named by supervisors but not yet kept under Research areas. Only a department with a vacancy lets the applicant go on; otherwise a **red** message says there is no vacancy for the department selected and to apply in the coming sessions.
- The Name of the school on the supervisor pages follows the schools kept here.

**RAC through the Dean and the Vice Chancellor, grades, access, menus**

- **RAC:** the supervisor names **1 to 3 internal members and 2 to 3 external members**; for each: designation, institution, address, e-mail, contact number, area of research and the **latest five publications**, typed (no document is uploaded). The **Dean** selects one internal and one external member and sends the RAC to the **Vice Chancellor**, who gives the **final approval** (menu **RAC approval** for the Vice Chancellor). The RAC is in force, and shown to the scholar and the supervisor, only after that. Either can return it with remarks.
- **Research office entry:** **Enter RAC details** (RAC decisions menu) lets the office staff, the Dean or the administrator enter the RAC of a scholar for the supervisor; it goes through the same approvals. The administrator can instead record a RAC approved earlier.
- **Thesis evaluators:** the supervisor also gives the address, contact number, area of research and the latest five publications of each of the nine experts (typed; still no file).
- **Grades are entered between marks** (from - to), checked for gaps and overlaps, from the pass mark to the maximum marks.
- **Examination menu** now holds the course-work menus: Registration windows (its own menu), Course registrations, Registration numbers, Semester promotion, Exam set-up, Hall tickets, Invigilation, Result approval, Results.
- **Access in the administrator's portal** now has a third level: besides the menu, Add / edit, Approve, Export and Upload, the **sections (tabs) inside a menu** can be opened or closed for each sign-in (Users, Rights).
- **Supervisors:** the **Name of the school** is shown on the public Supervisors page (with a school filter) and in the ERP supervisor list and exports. The number of scholars of a supervisor now counts the scholars linked in the register, so the dashboard, the list, the exports and the vacancy agree.
- **Speed:** a page-shaped loading screen appears at once in the ERP; the Selection page no longer waits for, or carries, every application before it opens.
- Needs the migration `20261027200000_rac_vc_approval.sql` (see SETUP).

**Subjects, sign-in security, orders, speed**

- A subject needs a code, a title and a syllabus (PDF); a code can belong to one subject only (case and spaces ignored). A new subject waits for the **approval of the Dean or the administrator**; only approved subjects are offered at course-work registration. A scholar sees the syllabus only of the papers registered.
- **One sign-in at a time** for each user: a newer sign-in ends the earlier one (the earlier browser is signed out within a minute, with a message). Changing the password ends other sign-ins. After 8 wrong passwords for one sign-in from one address, further tries are refused for 15 minutes. A person who has done nothing for 30 minutes is signed out. Needs the one-line migration `20261027100000_single_sign_in.sql`.
- **Order for the Chief Superintendent** (one or two for each examination, entrance test and course work): a PDF order for each person in the research office letter layout, with the dates and venues, no signature.
- The public **Our Team** page is kept in a short cache and its photographs are small image addresses of their own: the page was about three times larger and asked the database on every visit.

**Dashboards, invigilation list, audit**

- Every dashboard greets the user by name ("Welcome, name") with the date. Count cards are for the administrator and the Dean only; the other roles see the greeting and their work. The dashboards no longer repeat the side menu as buttons.
- Invigilation: the Chief Superintendent, the rules and the reserved count could not be typed into (fixed). The supervisors list is no longer offered; the name list is uploaded for each session (Excel or CSV, or pasted) and can replace the old list. The letter is now built with the research office letter layout (letterhead, boxed details, footer) with no signature, and says in the footer that it is system-generated.
- Security headers on every page, HSTS and https upgrade on the live site, a mobile viewport, and a tidier top bar on phones.
- New standards test: menus, modules of an educational ERP, page titles, sitemap, https, headers, dashboards.

**Passwords, attachments, fees, examination**

- **Change password** for every signed-in user (button in the top bar): the current password is asked for, the new one must be strong and different.
- Attachments from scholars (reports, receipts, synopsis, thesis, requests) are **PDF only**, up to 1 MB. The stamped copy now ends with an approval-record page when viewed as well as when downloaded.
- Fee approvals (office) uses the same receipt page as Accounts: the receipt is opened and approved, or returned with a written reason, on that page.
- **Examination** is its own module in the office menu (Exam setup, Hall tickets & seating, Invigilation duty, Result approval, Results); Course work keeps Registration and Semester promotion. The COE sign-ins have an Examination menu too.
- A **Consolidated list** of invigilators (one row for each person with all duties) beside the date-wise list.
- Automated tests grew to cover passwords, uploads, menus, approvals, selection, seating, course-work rules, linked changes, applications and the running app (see TESTING).

**Invigilation**

- Invigilation duty for the entrance test (Admissions, Entrance invigilation) and the course-work examination (Course work, Invigilation duty): one invigilator for a room, two when the room has at least the set number of candidates, and some invigilators kept on reserved duty in each sitting. Nobody is on two duties in the same sitting, duties are spread evenly, and dates a person cannot attend are respected.
- After the plan is finalised, an invigilation letter for each person (no signatures; the footer says it is system-generated) and the date-wise list of invigilators in one running order, in Excel and PDF.

**Upload and details**

- Excel and CSV upload of supervisors and scholars (with their personal details) for the main administrator, with a preview before saving; scholars and supervisors can now be added to the register without code.
- Every supervisor, also those recognised later, has an Edit on the Supervisor register.
- At the first sign-in a scholar is taken to My details (confirmed by the office) and a supervisor to My details (phone, campus, area, Vidwan ID, biography).
- Boxes take only what they should: dates from a calendar, numbers digits only, names letters only; the old milestone dates in the register are edited as dates.

**Setup and safety**

- The sign-in cookie is signed only with `SESSION_SECRET` on a live server.
- `scripts/create-admin.mjs` creates or resets the main administrator.
- Documents added: setup, deployment, go-live checklist, backup, storage, security, data protection, maintenance, testing, website, ERP, roles, developer guide, glossary and a guide for each role.
- Working files with personal data at the project root were taken out of Git (they remain on the computer).

## 25 October 2026

- Stamp approvals on attachments when viewed, and time each thesis evaluator step.
- Store private files in Amazon S3 when configured, and add a home page admission notice.

## 24 October 2026

- Add public supervisor profile pages and SEO metadata.
- Add course work exams, attendance, accounts fee desk and file storage.

## 22 October 2026

- Add outgoing mail, supervisor application status look-up and print-fit PDFs.

## 21 October 2026

- Add Forms downloads, Scholar information desk, register editors and request time-outs.
- Fix Dean and staff sign-in when many submenu rights are granted.
- Group ERP menus into modules with per-option rights, move Reset and profiles into pop-ups, and add follow-up of incomplete Ph.D. applications.

## 15 October 2026

- Give the Research Office staff and Dean roles, archive closed admissions and allot registration numbers by batch.
- Put programme highlights and an ERP-managed announcements board on the public site.
- Open the remaining office desks and a shared portal sidebar; look up sign-in with the service role.

## 14 October 2026

- Move the ERP onto signed-in sessions and office-controlled Ph.D. windows.
- Put the research register, supervisor contacts and scholar portals into the ERP.
- Fixes to the production build.

## 13 October 2026

- First versions of the website and the application forms.

## Incidents

None recorded. Write here: date, what happened, who was affected, what was done, what was changed to prevent it.
