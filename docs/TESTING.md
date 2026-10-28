# Testing the ERP across the portals

Use this while the ERP is being tested, and again before the real start. Work through the scenarios in order; each has what to do and what should happen. Write the result (works, wrong, not tried) and the date beside each, and give the wrong ones to the programmer with a screenshot.

## Rules for testing

- Use **made-up people**: invented names, an e-mail you control, a made-up phone. Do not use real applicants.
- Test with a **separate sign-in per role**, in separate browsers or private windows.
- Test on a phone as well as a computer.
- Take a **backup** before a big round of testing (BACKUP-AND-RESTORE).
- Write down which build you tested.

## Automated tests

A programmer runs `npm test` before each release (no server needed) and `npm run test:live` with the app running. Together they check: passwords (strong, changing needs the current one), PDF-only uploads, every menu of every role opening, the Examination module, the approval chains (scholar, supervisor, Dean, then Vice Chancellor for the evaluators), supervisor quotas, merit list and waiting list, seat release, seating, hall tickets, fee-gated exam lists, linked changes in the register, the approval stamps and record page, invigilation, who may open which page, the password-change API, and the Ph.D. and supervisor application submission. All lines must say `ok`. The live tests create temporary records and remove them; the Ph.D. window is opened for the test and put back.

## Browser test

With the app running (`npm run build`, then `npm start`), `npm run test:browser` opens every menu page of every role in a real Chrome and fails when a page never loads its data, shows an error, logs a script error, or takes more than 8 seconds. Test the built app, not `npm run dev`: the development server compiles each page the first time it is opened and is much slower.

## Standards check

`tests/standards.test.mjs` checks the ERP against a list taken from a standard educational ERP: a dashboard for every role, the usual modules (admissions, registers, faculty, course work, examination, fees, letters and reports, website, administration), student and faculty portals with their usual pages, separate Accounts, COE and Vice Chancellor desks, one clear title for every page, public pages in the sitemap, https and the security headers, and no repeated menu or button. Add a line there whenever a rule is agreed.

## Invigilation scenarios

- Add five invigilators; arrange the seating (or issue hall tickets); in **Duty plan** press **Allot invigilators**: every room with candidates has one invigilator, a room at or above the set number has two, each sitting has the set number on reserved duty.
- Change a place to a person already on duty in that sitting: the system refuses.
- **Finalise plan** without the Chief Superintendent's name: refused. With it: the plan is final and the places cannot be changed.
- **Letters**: a letter opens with the person's dates, sessions and halls, a RESERVED line where it applies, and no signature blocks.
- **Date-wise list**: the serial numbers run 1, 2, 3 … across all days; the Excel and PDF exports match the screen.

## Clearing what testing leaves behind

**Administration, Clear test data** (main administrator only):

1. The programmer sets `ALLOW_TEST_DATA_RESET=true` on the server and restarts.
2. Tick what to clear. Each area shows how much it holds. Set-up (fees, subjects, windows, campuses, timetable, grades, supervisors, profiles, quotas) is never touched.
3. **Download the copy** it offers; the Clear button stays off until you do.
4. Type `DELETE TEST DATA` and press Clear.
5. Every tester presses **Clear saved copies in this browser** on their own computer (it does not sign them out).
6. Uploaded files stay in storage unused; they are not deleted.
7. **Scholar sign-ins** removes every scholar account, including scholars already on the register. Use it only if they are all test accounts.

Selection's **Manage, Discard this session** still removes a test admission session (applications, the selection file and the admitted scholars).

## The scenarios

### 1. The public website

- Every page in the menu opens; the footer has Privacy and Terms.
- With the window closed, `/apply` says the application portal will open soon.
- The Supervisors page shows each supervisor with the areas of research and a working Vidwan link; the search box finds a name.
- The home page shows the UGC section, the support cards and the research areas; clicking a department opens its key areas and clicking another closes the first.

### 2. Application (window open)

- Choose a **school and a department with no vacancy**: you are told there is none and cannot go on.
- Choose one **with a vacancy**: the next questions appear; fill, upload the documents, pay (a test receipt), submit.
- The acknowledgement mail arrives; `/apply/status` shows the status with the number and date of birth.
- A second tester applies with the same e-mail: the ERP handles it as the rules say.

### 3. Selection (office)

- Applications show; verify a fee (Accounts) and the application enters Selection.
- Walk the nine steps: scrutiny, shortlist, entrance (hall tickets, seating, attendance Present or Absent), marks, merit list, guide (only supervisors with a vacancy are offered; an interdisciplinary candidate needs a co-supervisor), letters (after the recorded approval), reporting (documents), finish.
- After Finish, the admitted scholar can sign in with the e-mail and the first password.

### 4. Scholar information changes everywhere

- Under Scholar information enter or correct a scholar (name, mobile, mode, department, address).
- The Scholar register, its exports (the Personal group) and Reports and downloads show the new values.

### 4a. Excel upload (rehearse it on test data)

- Supervisor register and Scholar information (main administrator): choose the University's workbook or a small `.csv`; the preview shows Add, Update, No change and Skipped; a row with a name that is nearly like another supervisor is not mixed up with them. Press Save only when the preview is right, then check the register and the reports.
- Empty cells do not remove stored values.

### 4b. Typed boxes

- Dates are chosen from a calendar, numbers accept digits only, names accept letters only, in the application, Scholar information, the register editors, Users, Team, Vacancies, Course work subjects and the exam set-up.

### 4c. First sign-in

- A new scholar and a new supervisor set a password and land on My details; a scholar's changes wait for the office, a supervisor's are saved at once.

### 5. Fees

- A scholar uploads a payment receipt; Accounts opens the receipt, approves one and rejects one with a comment; the scholar sees the comment and can pay again.
- A step that needs the fee (course-work registration, synopsis, thesis) opens only after approval.

### 6. Course work and examination

- The administrator adds the subject code and title (Course work, Subjects) before the window opens; the window cannot be opened without subjects.
- The scholar registers for papers, chooses the campus, pays; Accounts approves; the office issues hall tickets and seating; the scholar downloads the ticket.
- Mark attendance Present or Absent for a paper at a campus and press **Freeze and forward to COE**; attendance can no longer change.
- COE (marks entry): enter marks (two sign-ins together on different papers); send for verification. COE (verification): send one back with a note, freeze the others, submit to the office.
- Administrator: record the passing board; publish. The scholar sees marks, grade and Pass, RA or AAA.

### 7. Approvals (Supervisor, then Dean)

- A scholar submits a leave request, a synopsis and a committee report.
- The Dean cannot approve before the Supervisor has; the Supervisor rejects one with comments and the scholar sees them and submits again.
- After approval, **View files** shows the attachment stamped with the names, dates and times; **Approved copy** carries the record page.

### 8. RAC and thesis evaluators

- A supervisor nominates the RAC (1 to 3 internal and 2 to 3 external, with five publications each, nothing uploaded); the Dean selects one external member and sends it to the Vice Chancellor; the Vice Chancellor approves; only then it shows to the supervisor and the scholar. The research office can enter the RAC of a scholar with **Enter RAC details**.
- A supervisor proposes nine evaluators; the Dean forwards; the Vice Chancellor selects first, second and third choices. The scholar never sees them. The evaluator sheet shows the three steps with date and time.

### 9. Guides and vacancies

- Transfer a scholar to a supervisor with a vacancy: allowed, and the vacancy drops. A supervisor with no vacancy is not offered. A transfer of more scholars than the vacancy is refused.
- Under Scholar allotment, **Guide history** (administrator and Dean only) shows the change with date, time and who did it.

### 10. Roles and rights

- Each role sees only its own menus. A Staff sign-in with only the Admissions menus cannot open Fees. The Vice Chancellor cannot open scholar pages.
- A scholar cannot open `/admin/...` (sent away).

### 11. Lists, reports and printing

- Export Excel and PDF from a few lists: headings centred, plain black and white, A4, registration-number order, columns you chose.
- The Scholar register's **Information to export** and filters work.

### 12. When things go wrong

- Sign in with a wrong password: a clear message.
- Upload a file that is not PDF, JPG or PNG, and one over 2 MB: refused with a message.
- Open the same record in two browsers and save in both: nothing is lost.

## After testing

Record what failed, what was fixed and the build tested in [CHANGELOG.md](CHANGELOG.md) or a test log kept by the Research Office, and tick Section E of the [go-live checklist](GO-LIVE-CHECKLIST.md).
