# Research ERP: workflow and roles

This file records how the ERP works day to day and every workflow decision made with the research office. Keep it up to date when a rule changes. Last updated: 22 October 2026.

## 1. Sign-ins

| Sign-in                   | Login page          | Menus                                                                                                | Can change data?                            |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Scholar                   | `/login/scholar`    | Own records; opens after the admission checklist is submitted. The sign-in id is the **email only**. | Own records                                 |
| Supervisor                | `/login/supervisor` | Own scholars, requests, RAC, thesis evaluator nominations                                            | Own scholars                                |
| Administrator             | `/login/admin`      | Everything                                                                                           | Everything                                  |
| Staff                     | `/login/admin`      | Menus granted by the administrator (Users, sub-menu rights)                                          | Completes the open admission step           |
| Dean                      | `/login/admin`      | Menus granted by the administrator                                                                   | Monitors; approves requests and nominations |
| **Accounts** (new)        | `/login/admin`      | Three fee menus only (section 6)                                                                     | Verifies or returns payments                |
| **Vice Chancellor** (new) | `/login/admin`      | Scholar register, Supervisor register, Thesis evaluators                                             | Read-only on registers; selects evaluators  |

Accounts and the Vice Chancellor start with their fixed menus (they do not start dashboard-only). They cannot open scholar, supervisor or profile pages. Create them under **Administration, Users**. Run `supabase/migrations/20261023100000_office_roles.sql` once so the database accepts these sign-in types.

## 2. Ph.D. application and admission (Selection, 9 steps)

1. A candidate reads the red notice (check supervisor vacancies on the Supervisors page; the application fee is non-refundable), then applies. Subject and school list only subjects with a vacancy. An **interdisciplinary** question is asked; interdisciplinary applicants still need a vacancy in the subject chosen, and the guide is allotted from that subject.
2. The application fee is approved on **Applications** (or by Accounts, section 6). Approved applications appear in Selection.
3. **New batches.** When an application window is opened for a new intake (for example January 2027), that batch name is added automatically to every batch choice: Registration numbers, the scholar register filters, course work, semester promotion, reports and the register editor. On Registration numbers a new intake lists its admitted scholars and the numbers allotted in Selection.
4. **The application window must be closed before the shortlist can be completed** (Application window menu). Selection starts after applications close; while the window is open the shortlist step shows a notice and cannot move on.
5. Selection steps: Scrutiny, Shortlist, Entrance (hall tickets, panels, attendance), Marks (entrance and interview marks by panel), Merit list, Guide (provisional list and guide allotment), Letters, Reporting, Admission.
6. **Seating arrangement (step 3, Entrance).** For each examination venue, list its rooms (classes) and the number of seats in each (Examination centres, Edit). After the hall tickets are generated, **Seating arrangement** takes the candidates of each venue in hall ticket order and fills the rooms in the order listed, each to its seats. Within a room the seats are numbered so that candidates of the same subject are kept apart (this can be switched off). A venue without enough seats or rooms is reported, and nobody is left unseated silently. The room and seat number are printed on the hall ticket and the attendance sheet. **Print seating plan** gives large, bold notice-board sheets to fix outside the building or room door: one page per venue (room, hall ticket range, candidates) and one page per room with the room name in a banner and the seat, hall ticket number and name of every candidate. It has no signature columns; the **attendance sheets** (with photographs) are printed separately.
7. **Merit list and waiting list exports (step 5).** The step's **Export Excel / Export PDF** give the merit list: S. No., subject, rank, name, application number, written and interview marks, total and result, subject by subject. **Print subject-wise merit list and waiting list** prints each subject on its own page: the subject name in a box at the top, then a Selection list box and a Waiting list box. If both fit on one page they share it; otherwise the selection list has its own page(s) and the waiting list starts on the next page for that subject. The **Waiting list only** buttons give the waiting list on its own (subject, waiting number W1, W2, name, application number, total).
   **Candidates after the window closes.** Closing the application window only stops new applications. Candidates keep using **Track application** (`/apply/status`, with the application number and date of birth) to see their status, download the hall ticket and, after the RAB / Vice Chancellor approval and issue, the provisional letter. This stays available for the whole running selection, even after the next window is opened, until the session is closed and archived.

7a. **Co-supervisor for interdisciplinary candidates.** When the application says the research is interdisciplinary, the Guide step marks the candidate **Interdisciplinary** (with the other disciplines named) and shows a **Co-supervisor** box beside the guide. Any active supervisor other than the guide can be chosen; a co-supervisor does not use a vacancy. The approval cannot be recorded, and the Guide step cannot be completed, until every interdisciplinary candidate has a co-supervisor. The co-supervisor is printed under the guide on the approval sheet and the provisional list, and the scholar sees the name in the admission file. Changing a co-supervisor after the approval makes the approval outdated, as a change of guide does. 8. **Approval before letters.** Print the approval sheet (S.No, name, application number, subject, marks, guide, prepared by, verified by, Dean signature) for the Research Advisory Board or the Vice Chancellor. Record the approval (body, reference, date). Letters can be issued only when the recorded approval matches the list; any later change makes it outdated. 9. Until the approval is recorded the **Track application** page shows only "Under review". After approval it shows the congratulations message and the provisional letter download. The hall ticket is shown only until the candidate is selected or the Entrance step is completed. 10. **Steps 8 and 9 (Reporting and Finish) open together, only after step 7 (Letters) is complete.** Until then neither is shown. Once open they never lock and the office moves between them with the two buttons above the step card, until the admission session is closed. If an earlier step is reopened, 8 and 9 close again. 11. **Reporting (documents checklist).** The office ticks each document: Received, Not applicable (optional items) or Missing. A document may be **Missing** and the checklist still submitted; the scholar is then shown a notice in the ERP: submit the missing documents to the Research Office within **10 days** (counted from the submission date) until the office ticks them Received. Submitting the checklist opens the scholar's ERP sign-in and mails the login details. 12. **Finish (waiting list, archive and next session).** The registration numbers are no longer allotted in the ERP; the Controller of Examinations (COE) generates them. Use **Export Excel / Export PDF** on this step for the COE list: S. No., Name of the scholar, Department, School, Guide name, Guide campus, and a blank Registration No. column. The application window is already closed when the selection runs, so there is no "close admission" option. This step does three things: - **Waiting list.** Where a selected candidate did not report or declined (Reporting, **Not reported**), the seat is vacant. **Offer seat** offers it to the first candidate on that subject's waiting list; that candidate then gets the guide, the letter and the document verification like the others. - **Finish selection & archive** (administrator). Allowed only when every selected candidate is verified or has been marked Not reported. It links every admitted scholar to the guide and starts them in **semester 1** of the ERP, moves all unselected, wait-listed and not-reported files to the **Admission archive**, and resets the desk to Step 1. If a subject still has a vacant seat and candidates waiting, the confirmation warns first. - **Next session.** Right after finishing, the **Application window** dialog opens with the next session filled in (January becomes July of the same year, July becomes January of the next year) and the window switched on. Set the label and the last date and save to open applications. It can also be done later under Application window.
**Registration numbers menu (one-time, permanent).** The numbers given by the COE are recorded once, batch by batch, for the scholars on the register and for the new intakes (by typing them in, or by uploading the template with the `registration_number` column filled). A number is **permanent**: once recorded it cannot be changed or replaced, in the menu, in the register or by upload. A scholar leaves the **To allot** list the moment the number is recorded; a batch with nothing left to allot is marked "completed" and shows only its records. **Recorded numbers** keeps every number with the day it was recorded, can be searched and exported, and each recording is also written to the audit trail. The number then appears everywhere the scholar is shown (profile, scholar identity, person file, letters, supervisors' lists). Finishing a selection stamps each admitted file with its intake, so a finished intake stays listed here.
**When a candidate counts as a scholar.** A selected candidate with a guide is still a candidate on the Selection desk. The candidate becomes a scholar of the ERP, and is counted in the Scholar register batch figures and listed under Scholar information, only when the documents are verified and the checklist submitted. Until then the candidate shows only on the Selection desk (and on the guide's "My scholars", which lists allotted candidates from the approval). Verified scholars of a new intake appear in the Scholar register under their batch (for example January 2027), with the batch count, the table and the downloads agreeing with Scholar information and the Registration numbers menu. 13. **Default password.** Every newly admitted scholar gets the first password `Welcome12345` (mailed with the username). The scholar must set a new password at the first sign-in. **New sign-in password** re-issues it. 14. **Reopening a step (administrator, Manage).** Reopening deletes everything done in that step so it is worked again in full: Scrutiny clears the eligibility marks; Shortlist the shortlist; Entrance the attendance, hall tickets and campus assignments; Marks the entrance and interview marks and the panels; Merit list the selection and waiting list; Guide the guides and the RAB/VC approval (and the guides' scholar lists); Letters the issued letters; Reporting the checklist and verification; Finish nothing further (the archive and semester 1 are not undone). Only the step being reopened is cleared. Going back also takes the scholars already admitted in the session out of the ERP again (their sign-in, guide allotment, course enrolment and semester standing), and clears their reporting and verification. **Discard this session (sample testing)**, also under Manage and asking for the word DISCARD, deletes every application of the running session, the selection file and the admitted scholars with their ERP records, so a test leaves nothing behind. Scholar records such as fee receipts uploaded by a test scholar are not removed.

### What Track application shows

- Entrance test over and attendance marked (present or absent): **Under process**, until the RAB / Vice Chancellor approval is recorded. The hall ticket is no longer offered.
- After the approval: selected candidates get the congratulations message and the provisional letter download once it is issued; waiting-list candidates see their waiting status; others see "Not selected".
- Once the office verifies the documents and opens the scholar sign-in, the page no longer offers the letter: it says **"Login to the scholar portal for more information"** with a login button.

### RAC and the first doctoral committee

After the RAB / Vice Chancellor approval the supervisor sees the allotted scholars and nominates the RAC: **2 internal and 2 external members**, each with designation, department, institution, email, phone and specialisation. The Dean approves one internal and one external member; the RAC is then visible to both the scholar and the supervisor. **The first doctoral committee can be conducted only after this RAC approval** (scholars admitted through Selection; scholars already on the register are not held back).

### The candidate's journey, in order

1. The RAB / Vice Chancellor approval is recorded. The **guide's "My scholars" lists the allotted scholars from this moment** (they do not wait for verification). The letters are then issued and candidates download the **provisional admission letter** from the Track application page.
2. The candidate reports to the Dean's office with the original documents. After the documents are checked the office submits the checklist, which opens the scholar's **ERP sign-in** (username is the email, first password `Welcome12345`).
3. The scholar pays the tuition fee and uploads the receipt. When the payment is approved (any amount, even a part payment), the scholar can see the **guide's details**.
4. The registration number is generated by the Controller of Examinations.

5. **New sign-in password** (Finish step) re-issues a first password and mails it if the first one was lost.

### Promoting all batches before Reporting opens

Before the Reporting step opens (it is part of completing step 7, Letters) the administrator promotes every batch so that the **fresh batch starts in semester 1** (a newly admitted scholar is placed in semester 1 automatically when the checklist is submitted). The Letters step shows the list: every scholar moves up one semester, except those who stay in the same semester because of any of these: **course work not cleared** (checked in semesters 1 and 2, the scholar must clear it within the second semester); a **six-month report not approved**; the **Research Advisory Committee not constituted**; the **first Doctoral Committee meeting not done**; the scholar on the **passed-out list**, or the scholar's supervisor on an **open exit** (transfer first); or the **annual fee pending**. The office can tick **Promote anyway** for any one of them, which is how the annual fee is exempted case by case. From semester 2 onwards, promotion is done manually under Promote a semester.

### Registration number format

`YY S CC M SS DD NN`

| Part | Meaning                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| YY   | Year of admission (27 for the January 2027 session)                                      |
| S    | Session: 1 January, 2 July                                                               |
| CC   | **Campus code of the guide's campus** (from July 2026; earlier numbers have `CR` here)   |
| M    | Mode of study (1 full time, 2 part time internal, 3 part time external, to be confirmed) |
| SS   | School code                                                                              |
| DD   | Department code                                                                          |
| NN   | Scholar roll number within the same group                                                |

Campus codes: Tindivanam 01, Muttom 02, Panaljur 03, Sriperumbudur 04, Aral 05. School and department codes are still to be supplied by the office (`lib/registration-format.ts`). Until then the number is typed in by hand.

## 3. Supervisor recognition

1. A supervisor applies at `/supervisor-recognition/apply` (an acknowledgement email is sent).
2. On **Applications, Supervisor applications**, the office ticks the eligibility conditions for each applicant (**Verify eligibility**) and sets the guide quota.
3. The eligible applicants are listed on an approval sheet (prepared by, verified by, Dean signature) for the **RAB or Vice Chancellor**. **Record approval** approves them, adds them to the vacancy list, opens their supervisor ERP sign-in and mails the login details and the recognition notice.
4. The supervisor downloads the recognition letter from `/supervisor-recognition/status` (application number and date of birth).

## 4. Thesis evaluation panel (confidential)

1. After the Dean accepts the synopsis, the **supervisor proposes nine evaluators**: **3 foreign, 3 Indian outside Tamil Nadu, 3 local within Tamil Nadu**. The scholar never sees this.
2. The **Dean checks** the nominees (area of specialisation against the thesis domain) and presses **Check & forward to VC**. Until then the supervisor can still correct the nominations; after that they are locked.
3. The **Vice Chancellor selects** the first, second and third choice in each of the three groups.
4. The Dean then records the invitations (invited, accepted, declined); when a first choice declines the next one is approached.
5. **Reopen** (Dean) clears the approval and the selection and returns the nominations to the supervisor.

### Printed sheets and letters (details)

- **Provisional selection list approval sheet:** columns are S. No., name, application number, subject and guide allotted (no marks). The Prepared by / Verified by / Dean signature block follows the table by four blank lines, on the last page of the list; the waiting list has its own block.
- **Provisional admission letter:** shows the candidate's communication address after the name; fits one A4 page with 15 mm margins; the closing, signature, name and designation are centred in one block on the right.

### Scholar portal menus

Scholars do not see **Examiner reports** (research office only).

### Supervisor profiles on the public site

Under **Website, Supervisor profiles** the research office prepares, for each supervisor, a **photograph**, a **biography of up to 200 words** (with a live word count), the **area of research** and the **Vidwan ID** (or the full address of the Vidwan profile), which becomes a clickable link. Profiles marked **Show on the public Supervisors page** appear on the public **Supervisors** page, above the vacancy list, as cards with the photo, name, designation and department, area of research, the biography and the Vidwan link.

## 5. Registers

The Vice Chancellor sees the Scholar register and the Supervisor register read-only. The administrator and staff edit register details (including part time to full time and fee payments).

## 6. Accounts: fee verification

The Accounts sign-in has five menus (Registration fee, Course-work registration fee, Annual fee, Synopsis fee, Thesis fee), each with **Pending** and **Approved** tabs:

- **Registration fee**: the Ph.D. registration (application) fee paid with the application.
- **Course-work registration fee**.
- **Annual fee**: annual research (tuition) fee receipts uploaded by scholars.
- **Synopsis fee** and **Thesis fee**: the fees to submit the synopsis and the thesis (amounts fixed by the administrator).

Verified payments leave Pending and appear under Approved. A payment can also be returned to the scholar. Every list can be filtered by **year** and by **from and to date**, searched, and exported as **PDF or Excel** (the export carries the applied dates). The lists keep every year, so a previous year can be pulled at any time.

### Fee settings (administrator)

**Administration, Fee settings** holds every fee: the **application fee**, the **annual research fee** (full time and part time) and the **synopsis** and **Ph.D. thesis submission fees**. Change a fee there and it shows automatically on every page that mentions it: the public home page (fee cards and programmes at a glance), the application form and its receipt and PDF, the provisional admission letter, the scholars' fee pages and the Accounts screens. Fees already paid are not changed.

**Synopsis and thesis fees:** when a fee is fixed (0 means none) the scholar pays it under **Payment history** (purpose "Synopsis fee" or "Thesis fee") and attaches the receipt. The upload opens only after Accounts verifies a payment that covers the fee. Accounts has two menus for these: **Synopsis fee** and **Thesis fee**.

### Receipt review (Accounts)

**Review receipt** opens the receipt page: the receipt is shown right there with the payment details. Accounts can **Approve payment**, or **Reject** with a comment (required). A rejected payment goes back to the scholar, who sees the comment (and a notice), adds the payment again with the correct receipt and submits it for approval. Course-work fees are returned the same way; the scholar registers again with a new receipt.

**General rule:** wherever a fee applies, the next option opens only after the fee is paid and its payment is approved.

## 7. Emails

Emails are sent through SMTP (settings in `.env.local`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`; see `.env.example`). Without them the ERP works and the screen says no mail was sent.

| Event                                            | Mail                                                         |
| ------------------------------------------------ | ------------------------------------------------------------ |
| Ph.D. application submitted                      | Acknowledgement with application number and details          |
| Hall tickets generated                           | Ask the candidate to download the hall ticket                |
| Selected and letter issued                       | Download the provisional letter and complete the formalities |
| Scholar ERP access opened, or password re-issued | Username and temporary password                              |
| Supervisor application submitted                 | Acknowledgement                                              |
| Supervisor recognition approved                  | Recognition letter can be downloaded from the status page    |
| Supervisor recognition approved                  | Login details                                                |

Recipients are always read from the stored record, never from the request.

## 8. Printing

Every PDF and print sheet fits A4 including header and footer. Wide table reports (for example the scholar register) print in **column groups**, each repeating S. No. and the name, instead of squeezing columns.

## 9. Setup checklist for a new environment

Run in the Supabase SQL editor, in order: all files in `supabase/migrations`, including `20261022100000_portal_forms.sql` and `20261023100000_office_roles.sql`. Copy `.env.example` to `.env.local` and fill the Supabase and mail settings. Use `npm run build` then `npm run start` for normal use (the dev server is much slower).

## 10. Exports

Every list has **Export Excel** and **Export PDF**. The Excel file (.xlsx) has a **bold, shaded heading row**, a frozen heading and sized columns; a plain CSV file cannot hold bold text. Upload templates for bulk updates stay as CSV.

## File storage

Text and records stay in the Supabase database; uploaded files are kept in Supabase Storage so the database stays small and pages load faster.

- **Buckets** (created by `supabase/migrations/20261024100000_file_storage.sql`): `portal-private` for documents, receipts, thesis and synopsis files, and admission documents; `portal-public` is created for pictures shown on the public website but is not used yet.
- **Uploading.** The browser sends the file to `/api/files`. The server checks the folder, the size (2 MB at most) and the first bytes of the file (PDF, JPG or PNG only), stores it under a random name such as `receipts/2026-10/<random>.pdf` and returns a short reference, which is what the record keeps. Signed-in users may upload to any folder; the public application forms may upload only to `applications`, a few files at a time.
- **Opening.** The reference is `/api/files/<folder>/<month>/<name>`. Opening it needs an ERP sign-in; the server then sends the browser to a link that works for two minutes. Nothing in the private bucket is public.
- **Until storage is ready** the ERP keeps new files inside the record as before, so a missing bucket or key never loses an upload.
- **Backup first (plans without automatic backups).** `node --env-file=.env.local scripts/backup-database.mjs` saves every ERP table (not the sign-in accounts) as files in `backups/<date-time>/` on this computer, read only; the folder is kept out of Git and holds personal data, so keep it private. `node --env-file=.env.local scripts/restore-backup.mjs backups/<date-time> [table]` puts a saved copy back if a change must be undone.
- **Moving the existing files.** Run the migration SQL, then `node --env-file=.env.local scripts/migrate-files-to-storage.mjs --dry-run` to see how many files and how much space, then run it without `--dry-run` when nobody is working and after a database backup. Rows are changed only after their files are uploaded and only if they did not change meanwhile; run it again if any row is reported. Photographs, signatures and the hall-ticket signature images stay in the records (they are small and are printed on sheets).
- **Not moved yet:** profile photos, the news and team pictures, the Forms downloads and the photographs and signatures inside applications.

**Taking attendance (everywhere).** Attendance is marked with the same **Present** / **Absent** buttons on every screen: the Entrance step of Selection, the colloquium attendance, and Attendance sheets. Pressing the chosen button again clears the mark. **All present** and **Clear all** act on the list shown, and a running count (Present, Absent, Not marked) is shown. A colloquium sitting starts with everyone present for the first marking; it cannot be saved while anyone is left unmarked.

**Order of lists and look of printed lists.** Scholar lists (Scholar register, Scholar information, Registration numbers, Attendance sheets, fee, committee, promotion and six-month lists, supervisors' scholar lists and their downloads) are in **registration-number order**; a scholar who has no number yet comes after those who have one, in application-number order. Clicking a column heading still sorts a list as you like. On printed sheets and PDF lists the title and the column headings are centred, and the details under the title (batch, date, venue, filters, number of records) are shown in separate boxes, label above value.

**Scholar register and list downloads.** The Scholar register shows a short list (registration number, name, department, batch, mode of study, guide, stage); **Details** opens everything else about the scholar (identity, programme, contact, research, progress) with View application, Download, Edit and Allot number. The batch cards filter the list when clicked. **Information to export** chooses which items the Excel and PDF lists carry (name list, contact list, progress report, everything, or any ticks; remembered per browser), and every item that has a short list of values (batch, mode, department, guide, guide campus, area of research, institution, stage, and Done / Not yet for each milestone such as 1st DC or Viva) is also a filter, so what can be exported can be filtered. On every other list with Export Excel / Export PDF, a **Columns** button chooses which columns the downloads carry; a column that is also in the table on that page is shown or hidden there too.

## Course-work examinations

**Subjects first (administrator, Course work → Subjects).** Before registration, the administrator adds the **subject code** and **subject title** of every paper (by semester, school and batch; semester 1 papers are common to all). A registration window for semester 1 or 2 cannot be opened until at least one subject is listed for that semester, and scholars can register only for listed subjects (the title is taken from the list, not typed).

**Set-up (research office, Course work → Exam setup).** Add the **campuses** where scholars may write, each with its rooms and seats; set the **timetable** (date and time of each paper, printed on the hall tickets); set the **maximum marks, pass mark and grades** (defaults: 100, 50, grades O 90, A+ 80, A 70, B+ 60, B 55, C 50) and the instructions printed on the hall ticket. Until a campus is added, registration does not ask for one. The migration `20261024200000_course_work_exams.sql` must be run once.

**Registration and fee.** At registration the scholar chooses the campus where the examination will be written and uploads the fee receipt. Accounts approves or returns it under Course-work registration fee.

**Hall ticket (Course work → Hall tickets & seating).** **Issue hall tickets** gives one ticket to each scholar whose fee Accounts approved and who chose a campus; a later paper is added to the same ticket. The number is `CW` + year and month of the first paper + a serial (for example CW2612001). This is the only hall ticket in the ERP (the old Hall ticket record menus are removed). The scholar downloads it under Course work → Hall ticket, with the papers, dates, campus, room and seat.

**Seating plan and attendance.** **Arrange seating** fills the rooms of a campus in registration-number order and prints the seating plan. The Attendance tab prints a signature sheet for a paper and campus, room by room, and marks scholars Present or Absent; an absentee becomes AAA.

**Attendance is frozen and forwarded to the COE (per paper and campus).** After every scholar of a paper at a campus is marked Present or Absent, **Freeze and forward to COE** (Course work, Hall tickets & seating, Attendance) locks that sheet and sends it to the COE; the sheet shows who forwarded it and when, and nobody can change the marks of Present or Absent afterwards. Only the administrator can **Reopen** it, and only until the marks of the paper are sent for verification. The COE can enter marks only for scholars whose attendance was forwarded ("Attendance awaited" otherwise), an Absent scholar becomes AAA, and the paper cannot be sent for verification until its attendance is forwarded. The COE papers table shows the attendance status, the marks entered, absentees, Pass and RA with the pass percentage once every mark is in.

**Marks (two COE sign-ins, created under Users: "COE · Marks entry" and "COE · Verification").**

1. _Marks entry_ (`coe`): create as many of these sign-ins as needed (three, say). They work at the same time on different papers or campuses; if two save together, each save is applied on top of the other and nothing is lost. Each paper shows who entered its marks, and the marks sheet prints their names. A sign-in enters marks paper by paper, campus by campus or for the whole batch, and marks absentees (Enter moves to the next box). When every scholar of a paper has marks (or is absent) the paper is **sent for verification**; its marks are then locked.
2. _Verification_ (`coeverify`): checks the marks and either **sends them back** with a note or **freezes** them. A frozen mark can not be changed by anyone. The verifier prints the marks sheets (to sign and keep for the COE's records) and, when every paper is frozen, **submits the file to the research office**.
3. _Passing board_ (administrator, Course work → Result approval): records the board's decision. **Approved** allows publishing. **Changes suggested** (for example bossing) sends the chosen papers back to marks entry with the board's note; the COE corrects, the verifier freezes again and submits the **final file**, which the administrator can publish.
4. _Publication_ (administrator): **Publish results** writes the marks, grade and result (Pass / RA / AAA) to the scholars; a published result can not be changed. The old manual result entry is gone; Results (admin) is now a read-only list.

**What scholars see.** Course work → Results shows, for each paper, the subject, code, marks, grade and Pass / RA / AAA. A paper marked RA or AAA can be registered again as an arrear, as before.

**History.** Each file keeps a log (sent, frozen, submitted, board decision, final submission, publication) shown under History in Result approval.

## Approval of scholars' documents (Supervisor, then Dean)

A document or letter a scholar submits goes first to the **Supervisor** and then to the **Dean**. This covers the doctoral committee reports, the synopsis, the thesis, and the requests and records that need the guide: Ph.D. cancellation, supervisor change, full-time to part-time, leave, extension, title change and publications.

- **Status the scholar sees**, on each document: _Submitted to Supervisor_ → _Approved by Supervisor_ (then _Submitted to Dean_) → _Approved by Dean_. A return shows as _Returned by Supervisor_ or _Returned by Dean_, with the remarks. Under the status is a trail of three boxes: Submitted, Approved by Supervisor and Approved by Dean, each with the name of the person and the date and time.
- **Supervisor.** Committee reports and the requests are approved under the existing menus. Synopsis and thesis are approved under **Synopsis & thesis** (new, in the supervisor's menu): Approve sends the document to the Dean; Return sends it back to the scholar with remarks.
- **Dean.** The Dean (or administrator) can approve only after the Supervisor has approved. A scholar with no guide on record goes straight to the Dean.
- **On the document.** The **Approved copy** download carries the approvals: on every page a footer reads "Approved by Supervisor: name · date, time" and "Approved by Dean: name · date, time · Ref"; the first page has an APPROVED stamp with both names, dates and times; and the last page is an approval record with the review trail. The Dean's name is the person who pressed Approve.
- **Not in this chain.** The plagiarism certificate is issued by the research office, fee receipts are verified by Accounts, and the six-month report goes to the research office (it shows as Submitted to Dean). The ABC ID, personal details and payment history are recorded directly.

### Rule for every submission and request

Everything a scholar submits or requests (synopsis, thesis, committee reports, six-month report, ABC ID, study-mode change, title change, extension and similar) goes to the **Supervisor first**, then to the **Dean** for the final decision. Either one may **Reject with comments**; the scholar then corrects and submits again. Statuses seen by the scholar: Submitted to Supervisor, Approved by Supervisor (Submitted to Dean), Approved by Dean, Rejected by Supervisor / Dean. The Dean cannot decide before the Supervisor has approved, and only the Dean (or the administrator) can give the final decision.

Exceptions (their own flows):

- **RAC** – started by the Supervisor, approved by the Dean; after approval it shows to the Supervisor and the scholar.
- **Thesis evaluators** – started by the Supervisor, approved by the Dean, final approval by the Vice-Chancellor. Scholars never see the panel (confidential).
  Payments go to Accounts; personal details and plagiarism certificates are recorded by the office.

## Search engine optimisation (SEO)

- **Supervisors page** (`/supervisors`) is built on the server from the published profiles, so search engines read every name, area of research and biography as plain HTML (kept for a few minutes, so a change made under Website, Supervisor profiles shows within minutes). Supervisors do not have pages of their own; each profile has an anchor on the page (`/supervisors#<name>`) and a photograph address (`/supervisors/photo/<name>`). The page has a title, description, canonical link and social-sharing tags.
- **Structured data (JSON-LD):** the university and website on every page; a list of supervisors (Person: name, designation, department, areas, biography, photograph, Vidwan link) and breadcrumbs on the Supervisors page; the profiles inside the list.
- **Sitemap** lists the public pages; **robots** keeps the portals, sign-in pages and API out of search. Sign-in pages carry `noindex`.
- Only the public fields are published; the supervisor's sign-in e-mail is never in the page.

### Files in Amazon S3 (replaces Supabase Storage for private files)

Supabase stays for sign-in and for all text records. Private files (receipts, synopsis and thesis, admission documents, files uploaded by scholars and supervisors) go to an Amazon S3 bucket when `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are set in `.env.local`; without them the ERP keeps using Supabase Storage. The bucket is private; a signed-in user opens a file through a link that works for two minutes, as before. File references in records do not change. To copy the files already in Supabase Storage: `node --env-file=.env.local scripts/copy-storage-to-s3.mjs --dry-run`, then without `--dry-run`. It skips files already copied and deletes nothing. A file not yet copied is still opened from Supabase.

### Approval stamp on the attachment when it is viewed

**View files** now shows the attachment with the approvals stamped on it as soon as they happen: after the Supervisor approves, every page carries "Approved by Supervisor: name, date, time" and the first page has a box "APPROVED BY SUPERVISOR ... Sent to the Dean for final approval"; after the Dean approves, both names, dates and times are stamped (the same as the Approved copy, without the record page). This applies to the scholar's requests and records, committee reports, synopsis and thesis, for the scholar, the Supervisor, the Dean and the office. Fee receipts (Accounts) are not stamped. The original file is never changed; the stamp is added when it is opened.

### Thesis evaluators: who and when

The confidential evaluator sheet (PDF for the Dean and the administrator) now carries all three steps with name, date and time: "Proposed by Supervisor", "Checked and forwarded by Dean" and "Selected by Vice Chancellor" (first, second and third choice in each group). The time is kept from now on; panels recorded earlier show the date only. The panel is not an uploaded document, so there is no attachment to stamp, and scholars never see it.

### Home page: Ph.D. programme as per the UGC Regulations, 2022

Under the hero, the home page now shows (`components/home/UgcOverview.tsx`, content in `data/ugc-norms.ts`): the programme at a glance (duration, course work, 55% in course work, 70:30 selection, two external examiners, six months for evaluation); who can apply (two-year Master's after a three-year bachelor's, one-year Master's after a four-year bachelor's, the four-year bachelor's degree at 75%, M.Phil., foreign equivalents, and the 5% relaxation); how admission is made (national tests with interview, or the university entrance test with 50% research methodology and 50% subject, 50% to be called, 70:30 weightage); the stages from admission to the degree; duration, leave and modes; and supervision limits. The page does not show regulation numbers or a source note; the text is justified. To change a line, edit `data/ugc-norms.ts`. The university-specific wording that used to be here (part-time 4 to 7 years, course work within four semesters, mandatory teaching for full-time scholars) is no longer on the home page.

### Research areas on the home page

The section is headed **Research areas** only (no "Schools" label), and each tab and heading shows the school without "School of" (Engineering and Technology, Science and Humanities, and so on). Under every department the page lists its **key research areas**, taken from the **area of research** in the ERP's **supervisor register** (Administration, Supervisor register, with the office's corrections; active supervisors only): each area is a short topic, separated by commas or semicolons in the profile, with no sentences. A school that has no departments listed (Law) shows its supervisors' key areas directly. A department is matched by its full name, its abbreviation (CSE for Computer Science and Engineering) or the same name; a supervisor whose department is not in the list does not appear until that department is added under Website, Research areas. The page follows profile changes within a few minutes.

### Supervisor quota, vacancy and guide history

- **Quota by designation.** When a supervisor is approved (Applications, Supervisor applications), the guide quota is fixed automatically from the designation and cannot be typed: Professor 8, Associate Professor 6, Assistant Professor 4 (UGC Regulations, 2022). The approved supervisor is added to the **Supervisor register** with that quota, and the vacancy is the quota less the scholars they guide.
- **Only supervisors with a vacancy are offered.** The lists used to allot a guide (Selection, Guide step; Allotment), to transfer scholars and to move scholars of a leaving supervisor show only supervisors who have a vacancy. A supervisor with no vacancy cannot be chosen, a transfer of more scholars than the vacancy is refused before anything moves, and a scholar's request for a change of supervisor cannot be approved if the requested supervisor has no vacancy.
- **Guide history (administrator and Dean only).** Under **Scholar allotment**, **Guide history** lists every allotment, change, transfer and removal of a guide: date and time, scholar, from, to, and who did it, newest first, with search. It is kept in its own record that is read only when the administrator or the Dean opens it; the supervisor and the scholar have no screen that shows it. A discarded or taken-back admission session removes its scholars from the history. Changes made before this feature are not in it; the first later change shows the earlier supervisor as "From".

### Research areas: departments and Management, Law

The departments of each school are kept by the administrator under **Research areas** (Website): a department can be added to or removed from a school there, and a school can be added. When a school has no department, or only one named like the school (Management, Law), its page card shows all the key research areas of its supervisors together under the school's name. To show Management as one area, leave only "Management" under the School of Management (remove Human Resource, Finance and the rest); every supervisor whose department is Management then appears there.

### Supervisor register: Active Supervisors List

The list shows, for each supervisor, the name with designation, the department with campus, the key research areas as tags (first three, then "+n more"), how many scholars they guide against the quota with the vacancy, the status, and the actions (View, Edit, Mark inactive, Mark resigned). The arrow at the end of a row opens the rest: serial number, supervisor ID, phone, mail, quota, balance, July 2026 allotment and the full area of research. The download still carries every column.

The departments under **Research areas** on the home page are shown as a list of names; clicking a department opens its key research areas, and clicking another closes the first (one open at a time; changing the school closes all). The introduction lines of the UGC section run the full width of the page and are justified.

### Admission page and home page: no repeated content

The home page carries the UGC programme (eligibility, selection, stages, duration, supervision) and the research areas. The **Admission** page (`/admission`) carries only what is not on the home page: the four-step admission process, the study modes (full time, part-time internal and external, with the shared milestones stated once), the documents to prepare (the signature is no longer listed) and the questions. The eligibility list and the sessions line were removed from it, and the questions on eligibility and duration were dropped from the FAQ.

### Clearing test data (testing period only)

**Administration, Clear test data** (principal administrator only) removes the data entered while testing, by area: Ph.D. applications and drafts (and the application numbers start again), supervisor recognition applications, the Selection desk, scholar requests and records (with RAC proposals, evaluator nominations and guide allotments), guide history, course work / committees / synopsis / thesis, examination records, entries made in the register (registration numbers recorded, attendance sheets, exits, passed-out list, reminders), scholar sign-ins, helpdesk messages and notices, and the audit trail. Each area shows how much it holds. The set-up is never touched: fees, subjects, registration windows, campuses, timetable, grades, supervisors, profiles and quotas.

- **It works only while `ALLOW_TEST_DATA_RESET=true`** is set in the server settings (`.env.local`, and the hosting settings if the site is online). Remove it before the real work begins; without it nothing can be cleared.
- **Steps:** tick the areas, download a copy (a JSON file with everything in them; the Clear button stays off until it is downloaded), type `DELETE TEST DATA`, clear. The action is written to the audit trail.
- **Browsers also keep saved copies** of some records. After clearing, this browser's copies are cleared too; each tester presses **Clear saved copies in this browser** on their own computer (it does not sign them out).
- Uploaded files (receipts, documents) are not removed; they stay in storage unused.
- The **Scholar sign-ins** area removes every scholar account, including scholars already on the register, so use it only when those accounts are test accounts.

### Menus (review of grouping)

The menus follow the scholar's path. **Office sign-ins:** Admissions (window, vacancies, incomplete applications, applications, Selection, archive); Registers (scholar register, scholar information, **registration numbers**, supervisor register, passed-out); Course work; Doctoral progress; Supervision (RAC, transfer, exit); Requests; **Fees** (fee collection, fee approvals); Scholar records (ABC ID, approved documents, attendance sheets); Letters & reports; Website; Administration. **Scholar:** Course work, Doctoral progress (RAC members first), Requests, Scholar records (ABC ID, fee, approved documents, forms). **Supervisor:** Scholars, **Approvals** (scholar requests, doctoral committees, synopsis and thesis), Supervision (RAC proposal, thesis evaluators, colloquium), **Documents**. **Clear test data** is shown to the administrator only. The change of order signs users out once so their menus are read again.

### Home page: support for scholars

Under the UGC section the home page shows three cards (text in `data/research-support.ts`): the DrillBit similarity check (before the synopsis and the thesis; the certificate is issued by the Research Office), the stipend for full-time scholars (amount and conditions notified by the University; add the monthly amount in the file to show it), and the IRINS research profile of INFLIBNET.

### Application: vacancy check by school and department

The vacancy list is not public. In the application the candidate chooses the **school** and then the **department**; every school and department of Research areas is listed. The vacancy is read at that moment from the **supervisors list**: for each active supervisor the approved quota less the scholars they guide (nothing for a supervisor who is leaving or inactive), added up by department (abbreviations such as CSE and ECE are matched). If the department has **no vacancy**, the candidate sees "There is no vacancy in this department in the current session. Kindly apply in the upcoming sessions." and cannot go further; the mode of study, the interdisciplinary question and the later steps appear only when there is a vacancy. The same check runs again on Next and on Submit. A department that a supervisor names but that is not under Research areas (Pharmacy, Philosophy, Social Work) cannot be chosen until the administrator adds it there. While the window is closed the page says the application portal will open soon, without a last date. The check is made in the candidate's browser; the server does not repeat it.

### Scholar information changes everywhere

What the office enters under **Scholar information** (kept and locked; corrected only by the administrator) is laid over the **register**, so it changes on every screen, report and download without being typed twice: the **name, mobile, email, mode of study, department (the "programme" there) and working institution (employer)** replace the register's values, and the rest (date of birth, gender, community, nationality, blood group, parents, address, district, state, pincode, date of admission, degrees, NET/SET/GATE, area of research) is available as a new **Personal** group in the Scholar register's **Information to export** and in the new report **Scholar personal details** (Reports & downloads). The Area of research there also replaces the guide's area in the register and the reports. A record saved or corrected is picked up at once; no restart is needed.

- Only entries that are locked (approved) are used; a scholar's own entry waiting for approval is not.
- Scholar information is the first place to correct these fields: for them, it replaces a value typed on the Scholar register's Edit.
- Names stored inside older records (a receipt, a course registration) are not rewritten when a name is corrected; screens and reports that read the register show the new name.

### Documentation and menus added

The documents for the website and the ERP are listed in [README.md](README.md): setup, deployment, go-live checklist, backup, storage, security, data protection, maintenance, testing, roles, developer guide, glossary and a guide for each role in `guides/`. **Scholar allotment** (with the guide history) is now in the menu under Supervision. The scholar's old examiner-reports address leads back to the dashboard: scholars do not see examiner reports. The sign-in cookie is signed only with `SESSION_SECRET` on a live server.

### Uploading from Excel, first sign-in details and typed boxes

- **Import (main administrator).** Registers, Supervisor register and Registers, Scholar information have an **Import from Excel** box (`.xlsx` or `.csv`; the University's own headings are understood). A preview lists Add, Update, No change and Skipped before anything is saved; an empty cell never removes a stored value. Supervisors are matched by ID or e-mail, then name; new ones get the quota of the designation and join the vacancy list. Scholars are matched by e-mail, registration, application or file number; new ones need an e-mail and a recognised batch; the personal details are saved as locked Scholar information. Details: [DATA-UPLOAD.md](DATA-UPLOAD.md).
- **Edit a supervisor.** Every row of the Supervisor register has Edit (name, ID, department, designation, campus, phone, e-mail, area of research, on the vacancy list). A supervisor recognised later is entered on the register when edited.
- **First sign-in.** After the new password a scholar is taken to **My details** (the Scholar information form; the office confirms what is sent) and a supervisor to **My details** (phone, campus, area of research, Vidwan ID, biography up to 200 words; saved at once; the office decides what the public sees).
- **Typed boxes.** Dates are date boxes, numbers take digits, names take letters; masks are in `lib/input-rules.ts`. The old register's loose dates ("27.5.25") are read as dates when edited.

### Menus and sub-menus (October 2026)

- Module > menu > sub-menu. The sub-menus of a menu are its sections; they show under the menu when it is open and are chosen with `?tab=` in the address, so a sub-menu can be bookmarked.
- Sections that follow a process stay as tabs inside the page (`sequentialMenus` in `data/menu-sections.ts`). To move a menu between the two ways, add or remove it there.

### Research areas and the application form (October 2026)

- Website > Research areas: research area (school) > departments > key areas, each added, edited and removed in the ERP. This is the one list the home page, the Ph.D. application form and the school shown for a supervisor use.
- A renamed department keeps its areas; names kept elsewhere (supervisor register, vacancies, earlier applications) are not rewritten, so change them there too.
- Application form: school, then department. All departments of the school are listed. A department with no vacancy (seats of the active supervisors of that department, quota less their scholars) shows a red message and the next questions do not appear.

### RAC, grades, access levels (October 2026)

- **RAC.** The supervisor sends 1 to 3 internal and 2 to 3 external nominees (each with designation, institution, address, e-mail, contact number, area of research; no publication details are asked). Dean: selects one external member (the internal member is the one named), writes the minutes and **sends to the Vice Chancellor**, or returns with remarks. Vice Chancellor: **approves** (the RAC is in force from that day) or returns with remarks. A returned nomination can be sent again. A change of RAC is possible six months after the last approval, as before.
- **Office entry.** Admin, staff or Dean can enter a RAC for a scholar (the guide is taken from the allotment or the register). It goes the same way. The administrator can tick "approved earlier" to record the one internal and one external member directly.
- **Grades.** Each grade has marks from and to. Together the grades must cover every mark from the pass mark to the maximum marks, with no gap and no overlap. Marks below the pass mark are RA.
- **Access levels.** Menu (module and menu) > Add / edit, Approve, Export, Upload > Sections (tabs) of a menu. A sign-in whose rights name sections sees only those tabs; rights saved earlier keep every section.
- **Scholars of a supervisor.** One count everywhere: the scholars linked to the supervisor in the register (not passed out) plus allotments made in the ERP; vacancy is the quota less that count.

### Subjects, one sign-in, orders (October 2026)

- **Subjects.** Code, title and syllabus (PDF) are all required. A code is used once for the whole University; "RM 101" and "rm101" count as the same. A new subject is **Waiting for approval** until the Dean or the administrator approves it; only approved subjects appear at registration. A subject that scholars have registered cannot be removed. The scholar's portal shows the syllabus only for the papers the scholar registered. (The syllabus files are part of the shared course-work record, so this is a screen rule; moving files behind server checks is the longer-term fix in SECURITY.)
- **One sign-in at a time.** Each sign-in carries an id; signing in again gives a new id and the earlier one stops working. Browsers check every minute and when the tab is opened again. Wrong passwords: 8 tries in 15 minutes for one sign-in from one address, then a wait. Idle: 30 minutes. Not active until the migration `20261027100000_single_sign_in.sql` is run.
- **Chief Superintendent order.** Under Invigilation duty, name one or two Chief Superintendents (name, designation, department). The order PDF (one for each person, naming the other) gives the examination, the dates, sessions, venues and the duties; no signature, system-generated footer. The letters to invigilators name them too.

### Passwords, PDF attachments, examination menu (October 2026)

- Every signed-in user can **change their own password** (top bar). The current password must be given; the new one needs 10 or more characters with a capital letter, a small letter, a digit and a symbol, must not hold the sign-in or name or a common word, and must differ from the current one. Eight wrong tries in ten minutes pause the attempts.
- Attachments from scholars are **PDF only**, up to 1 MB. Older records that hold JPG or PNG still open and are stamped as a PDF page.
- The approved copy (view and download) ends with an **approval record page** listing every step with name, date and time; a copy approved only by the supervisor says so and that it waits for the Dean.
- Fee approvals: the office desk is the same as the Accounts desk (receipt shown beside the details; Approve, or Reject with a written reason the scholar sees).
- **Examination** is a separate menu: once the course-work fee is approved and the hall ticket issued, the paper is in the examination lists; the COE enters marks, the verifier freezes, the passing board approves and the administrator publishes.

### Invigilation duty (entrance test and course-work examination)

- The invigilators are a list kept by the Research Office (ID, name, designation, department, mobile, dates not available). Supervisors of the register can be added in one step.
- The rooms of a sitting come from the seating: for the entrance test the shortlisted candidates with a hall ticket and a room, not marked Absent; for the course work the hall tickets with a room, for the batches and semesters whose papers fall on that date and time.
- A room gets **one** invigilator; a room whose candidates reach the set number (40 unless changed) gets **two**. A set number of invigilators (2 unless changed) is kept on **reserved duty** in every sitting.
- Allotting takes, each time, the available invigilators with the fewest duties so far. Nobody is on two duties in the same sitting, and nobody is given a date they marked as not available. If there are too few invigilators the system says which sitting is short and leaves the places empty.
- The office may change any place from the plan; the system refuses a double booking and an unavailable date.
- The plan can be finalised only when every place is filled, nobody is double booked, and the Chief Superintendent and the letter heading are entered. A final plan is read-only; only the administrator reopens it.
- After finalising, each person with duties has a letter (dates, sessions and halls, RESERVED lines, the examination dates and the usual instructions). The letter has **no signatures**; the footer reads that it is system-generated.
- The date-wise list is in one running serial order from the first day to the last (by date, sitting, room; the second invigilator of a room follows the first; reserved invigilators close each sitting), with Excel and PDF exports.
- Finalising and reopening are written to the audit log. Test-data clearing has an Invigilation duty area.
