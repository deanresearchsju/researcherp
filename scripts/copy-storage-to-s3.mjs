/**
 * Copies every file in the Supabase Storage bucket `portal-private` to the Amazon S3 bucket,
 * under the same names, so no record in the database has to change. Files already in S3 are
 * skipped, so it can be run again. Nothing is deleted from Supabase.
 *
 *   node --env-file=.env.local scripts/copy-storage-to-s3.mjs --dry-run
 *   node --env-file=.env.local scripts/copy-storage-to-s3.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, S3_REGION, S3_BUCKET,
 * S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env.local.
 */
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const source = "portal-private";

const need = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const missing = need.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Set these in .env.local first: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.S3_BUCKET;

async function listAll(prefix = "") {
  const found = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from(source)
      .list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) found.push({ path, size: item.metadata?.size ?? 0, type: item.metadata?.mimetype });
      else found.push(...(await listAll(path)));
    }
    if (data.length < 100) break;
  }
  return found;
}

async function inS3(Key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }));
    return true;
  } catch {
    return false;
  }
}

const files = await listAll();
const total = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
console.log(`${files.length} file(s) in Supabase Storage, ${(total / 1048576).toFixed(1)} MB.`);

let copied = 0;
let skipped = 0;
let failed = 0;
for (const file of files) {
  if (await inS3(file.path)) {
    skipped += 1;
    continue;
  }
  if (dryRun) {
    copied += 1;
    continue;
  }
  const { data, error } = await supabase.storage.from(source).download(file.path);
  if (error || !data) {
    console.error(`Could not read ${file.path}: ${error?.message ?? "empty"}`);
    failed += 1;
    continue;
  }
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket,
        Key: file.path,
        Body: Buffer.from(await data.arrayBuffer()),
        ContentType: file.type || data.type || "application/octet-stream",
        ServerSideEncryption: "AES256",
      }),
    );
    copied += 1;
  } catch (problem) {
    console.error(`Could not write ${file.path}: ${problem.message}`);
    failed += 1;
  }
}
console.log(
  `${dryRun ? "Would copy" : "Copied"}: ${copied}. Already in S3: ${skipped}. Failed: ${failed}.`,
);
if (failed) process.exitCode = 1;
