# Before real use (go-live checklist)

Tick each line with the date and the person. Do not start taking real applications until every line in sections A to C is ticked.

## A. Security and settings (must be done)

- [ ] `SESSION_SECRET` is set on the live site (a long random value used nowhere else) and the site was redeployed.
- [ ] `ALLOW_TEST_DATA_RESET` is **removed** from the live site and from `.env.local`.
- [ ] The weak points in [SECURITY.md](SECURITY.md) section 1 (database tables open to the public key) are fixed, or the Dean has accepted the risk in writing for a stated period.
- [ ] The main administrator's password was changed from the first one and is known to one named person only.
- [ ] Every test sign-in was removed or its password changed (Administration, Users).
- [ ] The Supabase service key and the AWS keys are known only to the person looking after the technology.
- [ ] The Next.js security notice was dealt with (MAINTENANCE, "Updates") or its date is written down.

## B. Data

- [ ] The real data was uploaded from Excel in the order of [DATA-UPLOAD.md](DATA-UPLOAD.md) (supervisors, then scholars), the counts were checked and the sign-ins were created.

- [ ] Test data cleared (Administration, Clear test data), after a backup, and each tester pressed "Clear saved copies in this browser".
- [ ] A backup was taken and a restore was tried once on an empty project (BACKUP-AND-RESTORE).
- [ ] The day and the person for the weekly or daily backup are written down.
- [ ] Amazon S3 versioning is on; the bucket is private; the AWS bill alert is set.
- [ ] The supervisor register is correct: names, designations, departments, areas of research, quotas, who is active.
- [ ] Research areas (schools and departments) are complete, including departments that supervisors name (Pharmacy, Philosophy, Social Work ...), so applicants can choose them.
- [ ] Fee settings are right: application, annual (full and part time), synopsis, thesis.
- [ ] The application window has the right session, and is closed until the day it opens.

## C. Content and contact details

- [ ] **Helpdesk phone number, hours and address** replace the placeholders in `lib/constants.ts` (`phone`, `phoneDisplay`, `hours`, `addressLines`).
- [ ] **Social-media links** in `lib/constants.ts` (`social`) are real, or removed (they now point to example.com).
- [ ] **Bank details** in `lib/constants.ts` (`bank`) are right and approved by Accounts.
- [ ] **The stipend** amount and conditions are written in `data/research-support.ts` (`amount`).
- [ ] The **UGC section** on the home page was read by the Dean against the Regulations and the University's Ordinance (four-year bachelor's at 75%; the part-time durations on the Admission page).
- [ ] **Terms** (`/terms`) and **Privacy** (`/privacy`) were read and approved by the University's legal adviser.
- [ ] News and announcements are current; old test items removed.
- [ ] Supervisor profiles: photograph, biography (up to 200 words), area of research, Vidwan ID, ticked to show on the public page.
- [ ] **Our Team** is correct.
- [ ] The forms in **Forms & formats** and `public/downloads` are the current official ones.

## D. Decisions waiting for the University

- [ ] School and department **codes** for the registration number (the COE issues the numbers; the format is in `lib/registration-format.ts`).
- [ ] The **mail** provider and the sending address.
- [ ] How long records are kept (DATA-PROTECTION).
- [ ] The **region** for the data (India or abroad).
- [ ] Who in the Research Office is the **second administrator** when the first is away.

## E. Test once more in the real setting

- [ ] A candidate applies on a phone: a department with a vacancy lets them go on; one without says to apply in a later session.
- [ ] Every role signs in, sees only its own menus, and signs out.
- [ ] One scholar goes through: admission, course-work registration, fee approval, hall ticket, marks, result.
- [ ] A request goes Supervisor, then Dean, with the stamp visible on the attachment.
- [ ] A mail arrives in an inbox (not in spam) for an application, a hall ticket and a first password.
- [ ] The pages open on a phone and on a slow connection; the text is readable.
- [ ] `/sitemap.xml` and `/robots.txt` open; the site is added in Google Search Console.

## F. People

- [ ] Staff, the Dean, Accounts, the COE sign-ins and a few supervisors were shown their guide in [guides/](guides/README.md).
- [ ] Everyone knows whom to call and where to write when something fails (MAINTENANCE).
- [ ] The date of the real start is announced, and the application window is opened that day.
