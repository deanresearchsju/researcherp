# What changed and when

Newest first. Add a line here with every change that people will notice. "Incidents" at the end records anything that went wrong with data or security and what was done.

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
