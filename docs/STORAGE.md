# Uploaded files

Receipts, synopsis and thesis files, admission documents and every file that scholars, supervisors and the office upload.

## How it works

- A file is uploaded through the ERP (`/api/files`). The server checks the folder, the size (**2 MB at most**) and the first bytes of the file (**PDF, JPG or PNG only**), gives it a random name such as `receipts/2026-10/<random>.pdf`, stores it, and returns a short reference. The record keeps only the reference.
- **Where it is stored:** in the Amazon S3 bucket when the four `S3_` settings are present; otherwise in the Supabase Storage bucket `portal-private`. The ERP opens a file from either place, so older files keep working while newer ones go to S3.
- **Opening a file:** the address `/api/files/<folder>/<month>/<name>` opens only for a signed-in member; the server then sends the browser to a link that works for **two minutes**. Nothing in the private bucket is public.
- **Who may upload:** any signed-in member to the allowed folders. The public application form may upload only to `applications`, a few files at a time (the number is limited per address).
- **Pictures** shown on the public website (news, team) and the profile photographs, signatures and hall-ticket signature images are small and stay inside their records, not in the file store.

## Setting up Amazon S3

1. In AWS, choose the region (the bucket in use is in Sydney, `ap-southeast-2`; a region in India, such as Mumbai `ap-south-1`, may suit better).
2. **S3, Create bucket:** a name that is yours, **Block all public access** on, **Versioning** on, encryption on.
3. **IAM, Policies, Create policy (JSON):** allow only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::YOUR-BUCKET/*`. Attach it to a new IAM user (no console login) and create an access key for it.
4. Put the four values in `.env.local` and in the host settings: `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Redeploy.
5. Test: upload a receipt as a scholar; a file appears under `receipts/` in the bucket; open it in the ERP.

## Moving older files

| Task                                          | Command                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Files inside database rows to Supabase Storage| `node --env-file=.env.local scripts/migrate-files-to-storage.mjs --dry-run`, then without `--dry-run` |
| Supabase Storage to Amazon S3                 | `node --env-file=.env.local scripts/copy-storage-to-s3.mjs --dry-run`, then without `--dry-run` |

Both skip what is already done and can be run again. Take a database backup first (see BACKUP-AND-RESTORE).

## Care

- **Cost:** storage is cheap, but look at the AWS bill every month for the first three months.
- **Keys:** the S3 keys are secret. If they leak, create new ones in IAM, delete the old, and update the settings (see SECURITY, "If a key leaks").
- **Cleaning:** files of cleared test data stay in the bucket unused. Delete a test folder by hand in the AWS console only when sure nothing real is in it.
- **Not yet moved:** profile photographs, news and team pictures and the Forms downloads still live in their records.
