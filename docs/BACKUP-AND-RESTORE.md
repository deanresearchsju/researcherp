# Backup and restore

The data of the ERP is in three places. Each needs its own protection.

| What                                   | Where it is                     | Protected by                                                            |
| -------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Records (applications, scholars, ...)  | Supabase database               | The backup script below, and the plan's own backups if the plan has any |
| Uploaded files                         | Amazon S3 (and older ones in Supabase Storage) | S3 **versioning** (turn it on), and the copy script |
| Sign-in accounts                       | Supabase, table `portal_users`  | **Not** in the backup script on purpose (they hold password hashes)     |

## Saving the records

On a computer that has the project and `.env.local`:

```bash
node --env-file=.env.local scripts/backup-database.mjs
```

It writes one file per table into `backups/<date-time>/`, read only, and prints how many rows each table has. If a table fails it stops and tells you; nothing is changed in the database. Run it:

- **before** any bulk change, migration, clearing of test data or move of files;
- **every week** during testing and **every day** once real work begins (ask for it to be scheduled);
- after the admission session is finished.

**The `backups/` folder holds personal data.** It is kept out of Git. Keep it on an encrypted disk or a private drive of the University, copy it to a second place, and never send it by mail or chat.

## Saving the files

Turn on **Versioning** on the Amazon S3 bucket: a deleted or overwritten file can then be recovered from the AWS console (show versions). Older files still in Supabase Storage are copied across with:

```bash
node --env-file=.env.local scripts/copy-storage-to-s3.mjs --dry-run   # look first
node --env-file=.env.local scripts/copy-storage-to-s3.mjs
```

It deletes nothing and skips files already copied.

## Putting records back

Use this only to undo a change:

```bash
node --env-file=.env.local scripts/restore-backup.mjs backups/<date-time>            # every saved table
node --env-file=.env.local scripts/restore-backup.mjs backups/<date-time> admission_office   # one table
```

It writes the saved rows over the current rows that have the same id. Rows created after the backup are left alone. Records stored as one block (the Selection desk, doctoral records, examination records, the register) come back as they were at the time of the backup, so work done since then in that block is lost: save a fresh backup first and note what was done.

## Clearing test data is not a backup

The Clear test data screen offers a copy of what it is about to remove, as a file for the administrator. It is a safety net for that one action, not a replacement for the routine above.

## A simple yearly drill

Once a year, restore a backup into a **separate, empty** Supabase project and check that the ERP opens and shows the records. A backup that has never been tried is a hope, not a backup.

## Questions to settle with the University

- Who runs the backup and on which day, and who holds the second copy?
- How long are old backups kept? (See DATA-PROTECTION.)
- Does the Supabase plan include automatic backups and point-in-time recovery? If it does, note how far back it goes.
