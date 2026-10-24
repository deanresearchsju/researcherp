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

7a. **Co-supervisor for interdisciplinary candidates.** When the application says the research is interdisciplinary, the Guide step marks the candidate **Interdisciplinary** (with the other disciplines named) and shows a **Co-supervisor** box beside the guide. Any active supervisor other than the guide can be chosen; a co-supervisor does not use a vacancy. The approval cannot be recorded, and the Guide step cannot be completed, until every interdisciplinary candidate has a co-supervisor. The co-supervisor is printed under the guide on the approval sheet and the provisional list, and the scholar sees the name in the admission file. Changing a co-supervisor after the approval makes the approval outdated, as a change of guide does.
8. **Approval before letters.** Print the approval sheet (S.No, name, application number, subject, marks, guide, prepared by, verified by, Dean signature) for the Research Advisory Board or the Vice Chancellor. Record the approval (body, reference, date). Letters can be issued only when the recorded approval matches the list; any later change makes it outdated.
9. Until the approval is recorded the **Track application** page shows only "Under review". After approval it shows the congratulations message and the provisional letter download. The hall ticket is shown only until the candidate is selected or the Entrance step is completed.
10. **Steps 8 and 9 (Reporting and Finish) open together, only after step 7 (Letters) is complete.** Until then neither is shown. Once open they never lock and the office moves between them with the two buttons above the step card, until the admission session is closed. If an earlier step is reopened, 8 and 9 close again.
11. **Reporting (documents checklist).** The office ticks each document: Received, Not applicable (optional items) or Missing. A document may be **Missing** and the checklist still submitted; the scholar is then shown a notice in the ERP: submit the missing documents to the Research Office within **10 days** (counted from the submission date) until the office ticks them Received. Submitting the checklist opens the scholar's ERP sign-in and mails the login details.
12. **Finish (waiting list, archive and next session).** The registration numbers are no longer allotted in the ERP; the Controller of Examinations (COE) generates them. Use **Export Excel / Export PDF** on this step for the COE list: S. No., Name of the scholar, Department, School, Guide name, Guide campus, and a blank Registration No. column. The application window is already closed when the selection runs, so there is no "close admission" option. This step does three things:
    - **Waiting list.** Where a selected candidate did not report or declined (Reporting, **Not reported**), the seat is vacant. **Offer seat** offers it to the first candidate on that subject's waiting list; that candidate then gets the guide, the letter and the document verification like the others.
    - **Finish selection & archive** (administrator). Allowed only when every selected candidate is verified or has been marked Not reported. It links every admitted scholar to the guide and starts them in **semester 1** of the ERP, moves all unselected, wait-listed and not-reported files to the **Admission archive**, and resets the desk to Step 1. If a subject still has a vacant seat and candidates waiting, the confirmation warns first.
    - **Next session.** Right after finishing, the **Application window** dialog opens with the next session filled in (January becomes July of the same year, July becomes January of the next year) and the window switched on. Set the label and the last date and save to open applications. It can also be done later under Application window.
    **Registration numbers menu (one-time, permanent).** The numbers given by the COE are recorded once, batch by batch, for the scholars on the register and for the new intakes (by typing them in, or by uploading the template with the `registration_number` column filled). A number is **permanent**: once recorded it cannot be changed or replaced, in the menu, in the register or by upload. A scholar leaves the **To allot** list the moment the number is recorded; a batch with nothing left to allot is marked "completed" and shows only its records. **Recorded numbers** keeps every number with the day it was recorded, can be searched and exported, and each recording is also written to the audit trail. The number then appears everywhere the scholar is shown (profile, scholar identity, person file, letters, supervisors' lists). Finishing a selection stamps each admitted file with its intake, so a finished intake stays listed here.
    **When a candidate counts as a scholar.** A selected candidate with a guide is still a candidate on the Selection desk. The candidate becomes a scholar of the ERP, and is counted in the Scholar register batch figures and listed under Scholar information, only when the documents are verified and the checklist submitted. Until then the candidate shows only on the Selection desk (and on the guide's "My scholars", which lists allotted candidates from the approval). Verified scholars of a new intake appear in the Scholar register under their batch (for example January 2027), with the batch count, the table and the downloads agreeing with Scholar information and the Registration numbers menu.
13. **Default password.** Every newly admitted scholar gets the first password `Welcome12345` (mailed with the username). The scholar must set a new password at the first sign-in. **New sign-in password** re-issues it.
14. **Reopening a step (administrator, Manage).** Reopening deletes everything done in that step so it is worked again in full: Scrutiny clears the eligibility marks; Shortlist the shortlist; Entrance the attendance, hall tickets and campus assignments; Marks the entrance and interview marks and the panels; Merit list the selection and waiting list; Guide the guides and the RAB/VC approval (and the guides' scholar lists); Letters the issued letters; Reporting the checklist and verification; Finish nothing further (the archive and semester 1 are not undone). Only the step being reopened is cleared. Going back also takes the scholars already admitted in the session out of the ERP again (their sign-in, guide allotment, course enrolment and semester standing), and clears their reporting and verification. **Discard this session (sample testing)**, also under Manage and asking for the word DISCARD, deletes every application of the running session, the selection file and the admitted scholars with their ERP records, so a test leaves nothing behind. Scholar records such as fee receipts uploaded by a test scholar are not removed.

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

**Set-up (research office, Course work → Exam setup).** Add the **campuses** where scholars may write, each with its rooms and seats; set the **timetable** (date and time of each paper, printed on the hall tickets); set the **maximum marks, pass mark and grades** (defaults: 100, 50, grades O 90, A+ 80, A 70, B+ 60, B 55, C 50) and the instructions printed on the hall ticket. Until a campus is added, registration does not ask for one. The migration `20261024200000_course_work_exams.sql` must be run once.

**Registration and fee.** At registration the scholar chooses the campus where the examination will be written and uploads the fee receipt. Accounts approves or returns it under Course-work registration fee.

**Hall ticket (Course work → Hall tickets & seating).** **Issue hall tickets** gives one ticket to each scholar whose fee Accounts approved and who chose a campus; a later paper is added to the same ticket. The number is `CW` + year and month of the first paper + a serial (for example CW2612001). This is the only hall ticket in the ERP (the old Hall ticket record menus are removed). The scholar downloads it under Course work → Hall ticket, with the papers, dates, campus, room and seat.

**Seating plan and attendance.** **Arrange seating** fills the rooms of a campus in registration-number order and prints the seating plan. The Attendance tab prints a signature sheet for a paper and campus, room by room, and marks scholars Present or Absent; an absentee becomes AAA.

**Marks (two COE sign-ins, created under Users: "COE · Marks entry" and "COE · Verification").**
1. *Marks entry* (`coe`): create as many of these sign-ins as needed (three, say). They work at the same time on different papers or campuses; if two save together, each save is applied on top of the other and nothing is lost. Each paper shows who entered its marks, and the marks sheet prints their names. A sign-in enters marks paper by paper, campus by campus or for the whole batch, and marks absentees (Enter moves to the next box). When every scholar of a paper has marks (or is absent) the paper is **sent for verification**; its marks are then locked.
2. *Verification* (`coeverify`): checks the marks and either **sends them back** with a note or **freezes** them. A frozen mark can not be changed by anyone. The verifier prints the marks sheets (to sign and keep for the COE's records) and, when every paper is frozen, **submits the file to the research office**.
3. *Passing board* (administrator, Course work → Result approval): records the board's decision. **Approved** allows publishing. **Changes suggested** (for example bossing) sends the chosen papers back to marks entry with the board's note; the COE corrects, the verifier freezes again and submits the **final file**, which the administrator can publish.
4. *Publication* (administrator): **Publish results** writes the marks, grade and result (Pass / RA / AAA) to the scholars; a published result can not be changed. The old manual result entry is gone; Results (admin) is now a read-only list.

**What scholars see.** Course work → Results shows, for each paper, the subject, code, marks, grade and Pass / RA / AAA. A paper marked RA or AAA can be registered again as an arrear, as before.

**History.** Each file keeps a log (sent, frozen, submitted, board decision, final submission, publication) shown under History in Result approval.

## Approval of scholars' documents (Supervisor, then Dean)

A document or letter a scholar submits goes first to the **Supervisor** and then to the **Dean**. This covers the doctoral committee reports, the synopsis, the thesis, and the requests and records that need the guide: Ph.D. cancellation, supervisor change, full-time to part-time, leave, extension, title change and publications.

- **Status the scholar sees**, on each document: *Submitted to Supervisor* → *Approved by Supervisor* (then *Submitted to Dean*) → *Approved by Dean*. A return shows as *Returned by Supervisor* or *Returned by Dean*, with the remarks. Under the status is a trail of three boxes: Submitted, Approved by Supervisor and Approved by Dean, each with the name of the person and the date and time.
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
