# Looking after it

## Routine

| When                      | What                                                                                                                                  | Who                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Every day (real use)      | A database backup (BACKUP-AND-RESTORE). Look at the helpdesk messages and the notices.                                                | Technology / Office  |
| Every week                | Check the list of users: leavers removed, rights right. Look at the audit trail for anything strange.                                 | Administrator        |
| Start of each session     | Open the application window (Admissions, Application window). Check vacancies, fee settings, research areas, supervisor profiles. Review users and rights. | Office, Dean         |
| During Selection          | Follow WORKFLOW section 2; back up before a step is reopened, a session is finished or discarded.                                     | Office               |
| End of each session       | Finish the selection (archive, semester 1, next window). Back up.                                                                      | Administrator        |
| Every semester            | Promote the batches (Semester promotion); registration windows for course work; examination set-up.                                   | Office               |
| Every month (first 3 months) | Look at the Amazon S3 bill and the Supabase usage.                                                                                  | Technology           |
| Every year                | Practise a restore into an empty project. Renew the mail and domain. Review the privacy page and the retention rules. Review this document. | Technology / Dean    |

## When something is wrong

| What you see                                                    | Try this                                                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Sign-in is not set up on this server"                          | The `SESSION_SECRET` setting is missing on the host. Add it and redeploy (DEPLOYMENT).                                                                          |
| Nobody can sign in after a change of settings                   | A setting was changed but the site was not redeployed, or the secret changed (everyone must sign in again).                                                     |
| A person cannot sign in                                         | Check the spelling of the sign-in (a scholar uses the e-mail only). For a scholar: the admission checklist must be submitted. Reissue the password in Users.   |
| The administrator password is lost                              | `node --env-file=.env.local scripts/create-admin.mjs "Administrator" "a-new-long-password"`                                                                     |
| A screen shows old data                                         | Refresh the page. Some records are kept in the browser as a copy: press **Clear saved copies in this browser** (Administration, Clear test data, last block).   |
| A change is saved but another screen does not show it           | Refresh. If it still does not, note the two screens and what was changed and tell the programmer.                                                               |
| "This record was changed in another session"                    | Someone saved the same record a moment ago. Refresh, then save again.                                                                                           |
| An upload is refused                                            | It must be a PDF, JPG or PNG of at most 2 MB.                                                                                                                   |
| A file cannot be opened                                         | The link lasts two minutes: open it again from the record. If it says the file was not found, the file was not stored; ask the person to upload it again.      |
| No mail arrives                                                 | The mail settings are missing or wrong (SETUP section 3); look in the spam folder; ask IT about SPF and DKIM.                                                    |
| The build fails                                                 | Read the first error line; run `npm run build` again (it may only be the Next.js notice). Send the error text to the programmer.                                |
| "Run the SQL migration" appears on a screen                     | A migration file is missing: run the named file in the Supabase SQL editor (SETUP section 4).                                                                   |
| The site is slow                                                | On the host run `npm run build` and `npm run start`, not `dev`. Check the Supabase and Vercel dashboards for limits.                                            |
| A department says "no vacancy" but there is a seat              | The vacancy is the quota less the scholars each **active** supervisor guides. Check the supervisor's quota, status (active or leaving) and department name in the Supervisor register, and that the department is under Research areas. |
| A supervisor does not show under a department on the home page  | The supervisor's department name must match a department under Research areas (an abbreviation such as CSE is matched).                                         |

## Updates

- **The Next.js notice.** The build says the version has a known security issue. Ask the programmer to upgrade (`npx next upgrade`), then run the checks in TESTING and deploy. Do it in a quiet week and keep the previous deployment to go back to.
- **Packages.** Every few months the programmer runs `npm outdated` and updates what is safe, then tests.
- **After any change to the code:** `npm run lint`, `npm run build`, test the affected screens, update the documents, then publish.

## Who to ask

Write the names and numbers here once decided:

- Research Office in charge: ...
- Technology: ...
- University IT (domain, mail): ...
- Supabase, Vercel and AWS account owner: ...

## A short note for the person who looks after it

The data is the University's record of its scholars. If you are about to do something you cannot undo (restore a backup, clear data, change a key), **take a backup first and write down what you did**.
