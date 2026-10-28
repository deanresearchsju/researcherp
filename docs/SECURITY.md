# Security

Written in plain words for the people who run the ERP. Read the section "Weak points to fix before real use" with the Dean and whoever looks after the technology.

## Protection already in place

- **Sign-in.** Passwords are stored in a scrambled form (scrypt), never as plain text. A signed-in browser holds one cookie that the browser's scripts cannot read, sent only over HTTPS on the live site, valid for one day (seven if "remember me" is ticked).
- **The cookie's signing key.** On a live server the cookie is signed with `SESSION_SECRET`. If that setting is missing, nobody can sign in (the ERP refuses rather than use a weaker key).
- **Roles.** The server sends a visitor who is not signed in, or has the wrong role, away from `/admin`, `/scholar` and `/supervisor`. Menus and actions are further limited by the rights the administrator grants (see ROLES-AND-RIGHTS).
- **First-sign-in password change.** A new sign-in must set its own password at the first sign-in.
- **Uploaded files** are private: they open only for a signed-in member, through a link that works for two minutes. The server checks the type of every upload (PDF, JPG or PNG) and the size (2 MB). Visitors who are not signed in can upload only to the application form, a few files at a time.
- **Audit trail.** Important actions are written to the audit log (Administration).
- **The service key** (`SUPABASE_SERVICE_ROLE_KEY`) and the AWS keys are used only on the server and are never sent to the browser.
- **Approvals are recorded** with the name, date and time of the Supervisor, the Dean and the Vice Chancellor, and shown on the document.
- **The test-data clearing tool** works only for the main administrator and only while `ALLOW_TEST_DATA_RESET=true` is set.
- **Search engines** are kept away from the portals and the sign-in pages.

## Weak points to fix before real use

These are known and honest; none is hidden. They are listed with the most serious first.

### 1. Most database tables can be read and changed with the public key (serious)

The public key of the database is, by design, visible in the browser. Most tables are set so that **anyone who has that key can read, change and delete their rows directly**, without going through the ERP. This includes the applications (with dates of birth, phone numbers and addresses), the scholar records, the doctoral and examination records, the register, allotments and the vacancy list. Only the sign-in accounts (`portal_users`), the saved drafts, and a few records handled by the server are closed.

Because of this, the rules in the ERP screens (who may approve, who may not delete) protect against mistakes and honest users, but not against someone who talks to the database directly.

**The cure** is to move the reading and writing of each such table to the server, which checks the sign-in and the role, and then to close the table to the public key (as was already done for `portal_users`). It is a piece of work to be done table by table, starting with the applications and the scholar records, **before** the real applicants' data is entered. Until then, treat the data as protected by obscurity only, and do not announce the database address or the public key.

### 2. Sign-in cookie key (done in the code; confirm on the live site)

Earlier, when `SESSION_SECRET` was missing, the cookie was signed with the public key, which would let anyone make a cookie for any role. The code now refuses this on a live server. **Check that `SESSION_SECRET` is set on the live site** and that it is a long random value used nowhere else.

### 3. The version of Next.js has a known security notice

The build prints that the version in use (16.4.0) has a known vulnerability. Plan the upgrade (see MAINTENANCE, "Updates") and test the site afterwards.

### 4. Limits that count in memory

The limit on uploads from the public form is counted in the memory of the running server; a busy or restarted server forgets it. Fine for now; a shared counter is better later.

### 5. What the backup does not hold

The backup script leaves out the sign-in accounts, and the files are in S3 or Supabase Storage (see BACKUP-AND-RESTORE).

### 6. Where the data is

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
