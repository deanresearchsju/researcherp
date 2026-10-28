# Putting the site online

The site is built to run on **Vercel**, connected to the GitHub repository. Any host that runs Node.js can also run it.

## The usual routine

1. The changes are saved in Git and pushed to GitHub (`main`).
2. Vercel builds the new version by itself and publishes it when the build succeeds.
3. In Vercel, **Deployments** shows each version. A failed build never replaces the working site.

## Settings on the host

In Vercel: the project, **Settings, Environment Variables**. Add every setting of [SETUP.md](SETUP.md) section 3 for **Production** (and Preview, if you use it). Mark the keys and passwords as **Secret**. **A change to a setting applies only to the next deployment**: after changing one, open Deployments, press the three dots on the latest one and choose **Redeploy**.

Must be present on the live site:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **`SESSION_SECRET`**: without it nobody can sign in (this is deliberate: it protects the sign-in)
- `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (to keep new files in Amazon S3)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (to send mail)

Must **not** be present on the live site once real work begins: `ALLOW_TEST_DATA_RESET`.

## The web address

The site address used in the search-engine files is set in `lib/constants.ts` (`siteUrl`, now `https://research.sju.ac.in`). To use the address: in Vercel, **Settings, Domains**, add it and follow the two DNS records Vercel shows (the University's IT team adds them where the domain is managed). HTTPS is set up by Vercel itself.

## HTTPS and browsers

- The live site must be served over **HTTPS only**. Vercel issues the certificate for the domain and redirects http to https. On the live host (the `VERCEL` setting is present) the app also sends `Strict-Transport-Security` (browsers remember to use https) and `upgrade-insecure-requests`; the sign-in cookie is marked `Secure`. All pages also send `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.
- After going live, open the address with `http://` and check it jumps to `https://`, then test the site on the SSL Labs and securityheaders.com checkers (free) and keep the result.
- The pages are responsive (phone, tablet, laptop). They work in the current and previous versions of Chrome, Edge, Firefox and Safari (iOS and macOS) and Android Chrome; very old browsers (Internet Explorer, Safari before 16.4) are not supported. Before the real start, open the main pages on one Windows, one Mac, one Android and one iPhone device and note the result in GO-LIVE-CHECKLIST.

## Build notes

- `npm run build` must finish without errors before anything is published. It also runs a type check.
- The build may print a notice that the version of Next.js has a known security advisory and stop; running the same command again continues. The proper cure is to upgrade Next.js (see MAINTENANCE, "Updates").
- Size limit: a file uploaded to the ERP can be at most 2 MB (PDF, JPG or PNG).

## Amazon S3 for files

Create a **private** bucket (block all public access, versioning on) in the chosen region, and an AWS user for the ERP with only this permission, naming your bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

Details, and how to copy older files across, are in [STORAGE.md](STORAGE.md).

## Mail

Use an SMTP account of the University or a mail service. Ask the provider for the host, port, user and password, and set `MAIL_FROM` to an address the University owns. For mail to reach inboxes and not spam, the University's IT team should add the provider's **SPF and DKIM** records to the domain.

## Going back

Vercel keeps earlier deployments: open one and choose **Promote to Production** to return to it. A change to the database (a migration) is not undone this way; see BACKUP-AND-RESTORE.

## Before the real start

Work through [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md).
