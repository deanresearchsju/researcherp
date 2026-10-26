# Personal data and privacy

What personal data the ERP holds, who can see it, and what to do when a person asks about it. This is a working note for the Research Office. It is not legal advice: have the University's legal adviser read it, in particular against the **Digital Personal Data Protection Act, 2023** and the University's own policies.

## What is held

| Group                         | Examples                                                                                  | Where                                   | Who sees it                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Application                   | Name, date of birth, contact, address, education, experience, photograph, signature      | Database (applications)                 | Research Office, Dean; the applicant with the number and date of birth |
| Documents                     | Certificates, fee receipts, ID proofs                                                     | File storage (S3)                       | Signed-in members who need them                        |
| Scholar information           | Parents, community, blood group, degrees, NET/SET/GATE                                     | Database (scholar records)              | Research Office, Dean, the scholar, the supervisor     |
| Academic record               | Course work, results, committees, reports, publications, synopsis, thesis, viva           | Database and file storage               | Research Office, Dean, supervisor, scholar; COE for marks |
| Money                         | Fee payments and receipts                                                                 | Database and file storage               | Accounts, Research Office, the scholar                 |
| Sign-in                       | E-mail or username, name, scrambled password, menus                                       | Database (`portal_users`)               | The administrator (not the password)                   |
| Messages                      | Helpdesk messages                                                                         | Database                                | Research Office                                        |
| Supervisors                   | Profile, photograph, biography, Vidwan link, contact                                      | Database; part is public                | Public (profile page); office (contact)                |
| Audit trail                   | Who did what and when                                                                     | Database                                | Administrator                                          |

The thesis **evaluators** proposed for a scholar are confidential: the scholar never sees them.

## Public by design

The Supervisors page (name, designation, department, area of research, biography, Vidwan link, photograph) and the application status for someone who has the application number and the date of birth.

## Rules to follow

1. **Collect only what is needed** for the admission and the academic record.
2. **Show each person only what their work needs** (the menus and rights do this; review them each session).
3. **Do not copy** personal data to personal e-mail, chat, USB sticks or loose Excel files. The backup folder is the one permitted copy and is kept private.
4. **Remove access** the day a person leaves.
5. **Test data** should be made-up. If real data was used in testing, clear it with Administration, Clear test data before real use, and tell the testers.
6. **Photographs and documents** are shown only inside the ERP and are not published.

## What to decide

These need an answer from the University; write the answer here once decided.

- **How long records are kept** (selected scholars: the programme and after; applications not selected: ...; helpdesk messages: ...; the audit trail: ...).
- **Who answers requests** from a person to see or correct their data (the draft privacy page names the Research Office e-mail).
- **Where the data may be stored** (country of the database and the file store).
- **Consent text** on the application form, if the legal adviser wants one.

## When a person asks to see or correct their data

1. Check the person's identity against the application number and date of birth, or the registration number and e-mail.
2. Show them the details from the Scholar information, the Scholar register or the application. Corrections are made by the Research Office in Scholar information (which then changes the register and reports), and in the application where it is a correction of the application.
3. Note the request and the answer (date, who) in the helpdesk record.

## If personal data was exposed

1. Stop the cause (see SECURITY, "If a key leaks").
2. Tell the Dean of Research the same day, with what was exposed, for whom, and for how long.
3. Keep the audit trail and the backup as they are for the enquiry.
4. The University decides whom to inform and in what way, with its legal adviser.
5. Write what happened and what was changed in [CHANGELOG.md](CHANGELOG.md) under "Incidents".

## The privacy page

The public page `/privacy` states the above for applicants in plain words. If a rule here changes, change the page too (`app/(public)/privacy/page.tsx`).
