# St. Joseph University: Research website and ERP

This project is two things in one:

- **The public website** (`research.sju.ac.in`) for candidates, scholars and supervisors: the Ph.D. programme under the UGC Regulations, 2022, supervisors and research areas, the online Ph.D. and supervisor-recognition applications, announcements, downloads and contact.
- **The Research ERP**: the sign-in area where the Research Office, the Dean, Accounts, the Controller of Examinations, the Vice Chancellor, supervisors and scholars run the whole Ph.D. journey, from the application and selection to the thesis and viva.

If you are not a programmer, start with the guide for your job in [docs/guides](docs/guides/README.md), or with [docs/README.md](docs/README.md), which lists every document and who it is for.

## What is in place

| Need                                  | Where                                                              |
| ------------------------------------- | ------------------------------------------------------------------ |
| How the whole ERP works, step by step | [docs/WORKFLOW.md](docs/WORKFLOW.md) (kept up to date)             |
| Modules, menus and where data lives   | [docs/ERP.md](docs/ERP.md)                                         |
| Public website pages and content      | [docs/WEBSITE.md](docs/WEBSITE.md)                                 |
| Who can do what                       | [docs/ROLES-AND-RIGHTS.md](docs/ROLES-AND-RIGHTS.md)               |
| Setting up a new environment          | [docs/SETUP.md](docs/SETUP.md)                                     |
| Putting the site online               | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                           |
| Before real use                       | [docs/GO-LIVE-CHECKLIST.md](docs/GO-LIVE-CHECKLIST.md)             |
| Backups and restoring                 | [docs/BACKUP-AND-RESTORE.md](docs/BACKUP-AND-RESTORE.md)           |
| Files (receipts, thesis, documents)   | [docs/STORAGE.md](docs/STORAGE.md)                                 |
| Testing the ERP and clearing the test | [docs/TESTING.md](docs/TESTING.md)                                 |
| Security and known weak points        | [docs/SECURITY.md](docs/SECURITY.md), [SECURITY.md](SECURITY.md)   |
| Personal data and privacy             | [docs/DATA-PROTECTION.md](docs/DATA-PROTECTION.md)                 |
| Day-to-day care and problems          | [docs/MAINTENANCE.md](docs/MAINTENANCE.md)                         |
| For programmers                       | [docs/DEVELOPER.md](docs/DEVELOPER.md)                             |
| What changed and when                 | [docs/CHANGELOG.md](docs/CHANGELOG.md)                             |
| Words and abbreviations               | [docs/GLOSSARY.md](docs/GLOSSARY.md)                               |

## Quick start for a programmer

```bash
npm install
cp .env.example .env.local   # then fill in the values; see docs/SETUP.md
npm run dev                  # http://localhost:3000
```

Other commands: `npm run build` (production build), `npm run start` (run the build), `npm run lint`, `npm run format`. The first administrator is created with `node --env-file=.env.local scripts/create-admin.mjs "Name" "password"`.

The technology: Next.js (App Router) with React and TypeScript, Tailwind CSS, Supabase (database), Amazon S3 or Supabase Storage (files), and SMTP for e-mail. This version of Next.js differs from older ones; read `AGENTS.md` and `docs/DEVELOPER.md` before changing code.

## Keep private

`.env.local` (passwords and keys), the `backups/` folder (personal data) and the working files at the project root (Word and Excel files, photographs) are kept out of Git on purpose. Never put them in the repository or send them by e-mail or chat.
