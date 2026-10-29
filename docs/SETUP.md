# Setting up an environment

For a new computer, a test copy, or a fresh live system. About an hour if the accounts are ready.

## 1. What you need

| Service                   | Used for                                                    | Cost note                       |
| ------------------------- | ----------------------------------------------------------- | ------------------------------- |
| **Supabase** (a project)  | The database and sign-in records                            | Check that the plan has backups |
| **Amazon S3** (a bucket)  | Uploaded files: receipts, thesis, documents (see STORAGE)   | A few dollars a month           |
| **A mail account (SMTP)** | Acknowledgements, hall-ticket and letter notices, passwords | Any provider that offers SMTP   |
| **Vercel** (or any host)  | Running the site online (see DEPLOYMENT)                    |                                 |
| **Node.js 20 or newer**   | On a computer that runs or builds the code                  | Free                            |

## 2. Get the code and install

```bash
git clone https://github.com/deanresearchsju/researcherp.git
cd researcherp
npm install
```

## 3. The settings file

Copy `.env.example` to `.env.local` and fill in each line. **`.env.local` is private: never put it in Git, e-mail or chat.**

| Setting                                                         | What it is, and where to get it                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                      | Supabase: Project settings, API, Project URL                                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                          | Supabase: the public (anon / publishable) key. It is visible in the browser by design                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                                     | Supabase: the secret (service role) key. **Server only.** Whoever has it has full control of the data                                                                 |
| `SESSION_SECRET`                                                | A long random text that signs the sign-in cookie. **Required on a live server.** Make one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `S3_REGION`, `S3_BUCKET`                                        | The Amazon S3 bucket and its region (see STORAGE). Leave empty to keep files in Supabase Storage                                                                      |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                      | The keys of the limited AWS user for the bucket                                                                                                                       |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | The outgoing mail account. Without them the ERP works and says that no mail was sent                                                                                  |
| `ALLOW_TEST_DATA_RESET`                                         | `true` only while testing: switches on Administration, Clear test data. **Remove for real use**                                                                       |

## 4. The database

Open the Supabase **SQL editor** and run every file in `supabase/migrations`, **one by one in the order of their names** (oldest first). Each file is safe to run once. If one says an object already exists, it was run before: continue with the next.

The files, in order:

1. `20261013133000_research_office_records`
2. `20261013143000_phd_drafts`
3. `20261013150000_research_team`
4. `20261013161000_portal_users`
5. `20261013173000_scholar_records`
6. `20261013180000_office_controls`
7. `20261013190000_doctoral_progress`
8. `20261013200000_admission_selection`
9. `20261013210000_research_team_contact`
10. `20261013220000_portal_user_password_reset`
11. `20261013230000_research_register`
12. `20261013240000_news_board`
13. `20261014010000_research_areas`
14. `20261014020000_portal_menu_rights`
15. `20261014030000_profile_photos`
16. `20261014040000_audit_log`
17. `20261014050000_lifecycle`
18. `20261014060000_application_integrity`
19. `20261014070000_json_lock`
20. `20261014080000_portal_users_rls` (run only after `SUPABASE_SERVICE_ROLE_KEY` is set and the server restarted)
21. `20261015120000_application_number_format`
22. `20261018120000_phd_application_number_jan26`
23. `20261018130000_helpdesk_messages`
24. `20261018200000_vacancy_school`
25. `20261018210000_phd_draft_followup`
26. `20261020120000_rac_dean_selection`
27. `20261020150000_thesis_evaluation`
28. `20261021100000_portal_notices_inbox`
29. `20261022100000_portal_forms`
30. `20261023100000_office_roles`
31. `20261024100000_file_storage`
32. `20261024200000_course_work_exams`
33. `20261027100000_single_sign_in` (one sign-in at a time)
34. `20261027200000_rac_vc_approval` (RAC approval by the Vice Chancellor, RAC entered by the office)
35. `20261028100000_close_public_access` (closes every table and function to the public key; run it **last**, after the new version is live and `node --env-file=.env.local scripts/seed-register.mjs` has stored the register; see SECURITY)

When a new migration is added later, run only the new file.

## 5. The first administrator

```bash
node --env-file=.env.local scripts/create-admin.mjs "Administrator" "a-long-new-password"
```

This creates the sign-in named `admin`, which sees every menu. Open `/login/admin`, sign in as `admin` and set a new password when asked. The same command resets the password if it is lost.

## 6. Start it

```bash
npm run dev        # for working on it
npm run build      # then
npm run start      # for normal use: much faster than dev
```

Open <http://localhost:3000>.

## 7. First things to do inside

1. **Administration, Users**: create the sign-ins for staff, the Dean, Accounts, the Vice Chancellor and the two COE roles, and give staff and the Dean their menus (see ROLES-AND-RIGHTS).
2. **Administration, Fee settings**: the application, annual, synopsis and thesis fees.
3. **Website**: Research areas (the schools and departments), Our Team, News and events, Supervisor profiles.
4. **Admissions, Application window**: the session and the switch that opens or closes applications.
5. Set the placeholders listed in [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md).

## 8. If something does not work

See [MAINTENANCE.md](MAINTENANCE.md), section "When something is wrong".
