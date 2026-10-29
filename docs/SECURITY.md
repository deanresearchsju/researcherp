# Security

Written in plain words for the people who run the ERP. Read the section "Weak points to fix before real use" with the Dean and whoever looks after the technology.

## Protection already in place

- **Sign-in.** Passwords are stored in a scrambled form (scrypt), never as plain text; old plain passwords are scrambled the next time their owner signs in. A signed-in browser holds one cookie that the browser's scripts cannot read, sent only over HTTPS on the live site, valid for one day (seven if "remember me" is ticked), signed with `SESSION_SECRET`.
- **One sign-in at a time, and idle sign-out.** A newer sign-in of the same person ends the earlier one; a browser left idle for 30 minutes signs out. After 8 wrong passwords for one sign-in from one address, further tries are refused for 15 minutes; one address that tries more than 300 sign-ins in 15 minutes is slowed as well.
- **The database is reached only through the server.** The browser has no database key. Every database request goes to the site's own `/api/db`, which reads the sign-in cookie, checks the rules in `lib/db-policy.ts` (who may read, add, change or delete in each table, and which database functions may be called), and only then forwards the request with the server's own key. Anything not listed is refused. In short:
  - a visitor who is not signed in can read only the public lists (vacancies, research areas, news, site settings), look up one application by its number **with** the date of birth, and use the few functions of the application form, each at a limited rate;
  - a scholar sees only their own application, files and changes only their own records, can submit but not approve, and cannot change the public site or the office lists;
  - a supervisor can pass a scholar's record on or return it, send a RAC proposal and see their own supervisor application, but cannot approve finally or change the office lists;
  - the sign-in accounts, the draft applications, the helpdesk, the notices and the forms are never reachable from a browser;
  - the audit trail can be added to by anyone signed in, read only by the administrator, and never changed;
  - the register's mobile numbers and e-mail addresses are shown to a scholar or supervisor only for themselves and the person they work with.
- **The register is not in the program's code.** The program's code is downloaded by every visitor of the website, so the scholars' and supervisors' names, mobile numbers and e-mail addresses are kept in the database (table `research_register`, id `seed`; put there by `scripts/seed-register.mjs`) and not in `data/research-register.ts`.
- **Roles.** The server sends a visitor who is not signed in, or has the wrong role, away from `/admin`, `/scholar` and `/supervisor`. Menus and actions are further limited by the rights the administrator grants (see ROLES-AND-RIGHTS).
- **Every API checks who is asking.** The routes that change or list anything need a sign-in (and the right role); the few open to visitors (application form, acknowledgement mail, announcement of a new application, sign-in) check their input and are limited in rate per address.
- **Requests from other sites are refused.** A write to `/api/db` whose origin is another site is refused; the cookie is also `SameSite=Lax`.
- **Security headers.** Every page carries a content-security policy (the page may load only from this site; no plug-ins; no framing by other sites; forms post only to this site), `nosniff`, a frame limit, a referrer policy, a permissions policy (no camera, microphone, location or payment), and, on the live site, HTTPS-only (HSTS). The server does not announce that it runs Next.js.
- **Uploaded files** are private: they open only for a signed-in member, through a link that works for two minutes. The server checks the type of every upload (PDF, JPG or PNG) by its content and the size (2 MB). Visitors who are not signed in can upload only to the application form, a few files at a time.
- **Audit trail.** Important actions are written to the audit log (Administration).
- **Secrets stay on the server.** The service key (`SUPABASE_SERVICE_ROLE_KEY`), `SESSION_SECRET`, the AWS keys and the mail password are used only on the server and are never sent to the browser. `.env.local` is not in Git (`.env.example` holds names only). A search of the whole Git history found no key, password or token.
- **Debug off.** There is no debug output in the code, no source maps are published, and the live site runs the production build.
- **Dependencies.** Updated on 28 October 2026 (Next.js 16.4.3, React 19.3, Supabase, AWS, nodemailer 10); `npm audit` reports no known weakness; a package that was not used (html2canvas) was removed.
- **Approvals are recorded** with the name, date and time of the Supervisor, the Dean and the Vice Chancellor, and shown on the document.
- **The test-data clearing tool** works only for the main administrator and only while `ALLOW_TEST_DATA_RESET=true` is set.
- **Search engines** are kept away from the portals and the sign-in pages.

## Two steps only the programmer or the Dean can take

### A. Close the database to the public key (do this once, right after the new version is live)

The database still has the old open doors for the public key until this is done, so a person who has that key (it is visible in the browser of the old version) could still read and change the tables directly. After the new version of the ERP is live and you have signed in and seen the pages load:

1. Run `scripts/seed-register.mjs` once (`node --env-file=.env.local scripts/seed-register.mjs`) if it has not been run: it stores the register in the database.
2. Open the Supabase SQL editor and run `supabase/migrations/20261028100000_close_public_access.sql`. It removes every right of the public key on every table and function. It deletes no data.
3. Run `npm run test:live`. The line "the public key of the database opens nothing" must not print a WARN.

Do **not** run the file before the new version is live: the old version still uses the public key and would stop working.

### B. The code on GitHub is public and its history holds personal data

The repository `deanresearchsju/researcherp` is **public**. The current files no longer hold personal data (the register was moved to the database on 28 October 2026), but the **earlier commits still do**: the register file with about 160 e-mail addresses and mobile numbers of scholars and supervisors, and possibly the working spreadsheets and Word files that were once committed. Anyone can read old commits. What to do (the Dean decides; the programmer does it):

1. Make the repository **private** (GitHub, Settings, Danger zone, Change visibility). Vercel keeps working.
2. Remove the old commits' personal data from the history (for example with `git filter-repo --path data/research-register.ts --invert-paths`, then a forced push) and ask GitHub support to clear cached views. Anyone who already copied the repository still has the old data, so also treat those addresses as exposed (see DATA-PROTECTION).
3. Keep the private working files (`*.xlsx`, `*.docx`, `backups/`, `data/research-register.seed.json`) out of Git; `.gitignore` already lists them.

## What is still weak (known and honest)

These are listed with the most serious first.

### 1. The one-row office records are shared by every signed-in member

The doctoral records (courses, committees, colloquia, synopses, theses, results, letters), the admission records, the examination records and the register's corrections are each kept as one record that every signed-in scholar and supervisor loads, and that scholars and supervisors save when they submit their part. So a signed-in scholar or supervisor who talks to `/api/db` directly (not through the screens) could read other people's records in these, or overwrite one. What is blocked: the public cannot reach them at all; scholars and supervisors cannot save the news, the research areas, the examination records or the thesis panels; the register's contact details are trimmed for them. The cure is to move each scholar and supervisor action to its own server route that checks the sign-in and changes only that person's part; it is a piece of work to be done step by step, starting with the doctoral records.

### 2. Limits that count in memory

The limits on guessing, uploads and the forms are counted in the memory of the running server; a restarted or second server forgets them. Fine for now; a shared counter (a small database table or a hosted counter) is better later.

### 3. Sign-in cookie key (done in the code; confirm on the live site)

When `SESSION_SECRET` is missing the ERP refuses to sign anyone in on a live server. **Check that `SESSION_SECRET` is set on the live site** and that it is a long random value used nowhere else.

### 4. What the backup does not hold

The backup script leaves out the sign-in accounts, and the files are in S3 or Supabase Storage (see BACKUP-AND-RESTORE).

### 5. Where the data is

The files bucket is in Sydney. If the University wishes the data to stay in India, choose an Indian region for the bucket and for the Supabase project (see DATA-PROTECTION).

## Good habits

- Give each person their own sign-in. Never share the `admin` sign-in.
- Remove a sign-in on the day a person leaves (Administration, Users).
- Grant only the menus a person needs. Dean and staff sign-ins get menus one by one.
- Use long passwords. The office issues a first password; the person changes it at the first sign-in.
- Do not paste keys, passwords or the `.env.local` file into mail, chat or documents.
- Keep the `backups/` folder private.

## If a key leaks

| What leaked                                  | What to do                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`                             | Make a new one (see SETUP), set it on the host and in `.env.local`, redeploy. Everyone is signed out and signs in again.                                   |
| Supabase **service role** key                | In Supabase: Project settings, API, **reset** the service key. Put the new one in the host settings and `.env.local`, redeploy. Then read the audit trail. |
| Supabase public key                          | It is public by design; changing it does not cure weak point 1.                                                                                            |
| AWS access key                               | In AWS IAM open the user, **create a new key**, update the settings, redeploy, then **delete the old key**. Look at the bucket for files you do not know.  |
| An SMTP password                             | Change it at the mail provider and in the settings.                                                                                                        |
| An administrator password                    | `node --env-file=.env.local scripts/create-admin.mjs "Administrator" "a-new-long-password"` (or reset in Users for others).                                |
| A backup folder or a file with personal data | Remove it from where it should not be; tell the Dean; see DATA-PROTECTION for what to do about the people concerned.                                       |

## Reporting

Write to deanresearch.sju@dmifoundations.org (see the root `SECURITY.md`).
