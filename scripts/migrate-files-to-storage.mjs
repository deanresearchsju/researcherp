/**
 * Moves the files kept inside database rows (as data URLs) into Supabase Storage and leaves a
 * short reference in their place.
 *
 *   node --env-file=.env.local scripts/migrate-files-to-storage.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-files-to-storage.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and the file_storage
 * migration applied (it creates the buckets). Run it when nobody is working in the ERP, and
 * take a database backup first. A row is changed only after all of its files are uploaded, and
 * only if it has not changed since it was read. Photographs and signatures stay as they are.
 */
import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const minChars = Number(
  process.argv.find((arg) => arg.startsWith("--min-chars="))?.split("=")[1] ?? 20000,
);
const bucket = "portal-private";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).",
  );
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Tables and what to move: JSON payloads, and plain file_data columns. */
const targets = [
  { table: "phd_applications", folder: "applications", json: "payload", stamp: null },
  {
    table: "supervisor_applications",
    folder: "applications",
    json: "payload",
    stamp: null,
  },
  {
    table: "scholar_records",
    folder: "records",
    json: "payload",
    text: "file_data",
    stamp: "updated_at",
  },
  {
    table: "admission_office",
    folder: "admission",
    json: "payload",
    stamp: "updated_at",
  },
  { table: "doctoral_office", folder: "thesis", json: "payload", stamp: "updated_at" },
];

const skipParents = new Set(["photo", "signature"]);
const fileKeys = new Set(["fileData", "feeReceiptData", "receiptData"]);

const seen = new Map();
const stats = { files: 0, reused: 0, chars: 0, rows: 0, skipped: 0, failed: 0 };

function sniff(bytes) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  return null;
}

async function move(dataUrl, folder) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !/;base64$/i.test(dataUrl.slice(0, comma))) return null;
  const bytes = Buffer.from(dataUrl.slice(comma + 1), "base64");
  const kind = sniff(bytes);
  if (!kind || bytes.length > 5 * 1024 * 1024) return null;
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (seen.has(hash)) {
    stats.reused += 1;
    return seen.get(hash);
  }
  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${kind.ext}`;
  const ref = `/api/files/${path}`;
  if (!dryRun) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType: kind.mime, upsert: false });
    if (error) throw new Error(`upload failed: ${error.message}`);
  }
  seen.set(hash, ref);
  stats.files += 1;
  return ref;
}

/** Replaces every stored file inside a JSON value; returns how many were replaced. */
async function convert(node, folder, parent = "") {
  let changed = 0;
  if (Array.isArray(node)) {
    for (const item of node) changed += await convert(item, folder, parent);
    return changed;
  }
  if (!node || typeof node !== "object") return 0;
  for (const [name, value] of Object.entries(node)) {
    if (
      fileKeys.has(name) &&
      typeof value === "string" &&
      value.startsWith("data:") &&
      value.length >= minChars &&
      !skipParents.has(parent)
    ) {
      const ref = await move(value, folder);
      if (ref) {
        node[name] = ref;
        stats.chars += value.length;
        changed += 1;
      } else {
        stats.skipped += 1;
      }
    } else if (value && typeof value === "object") {
      changed += await convert(value, folder, name);
    }
  }
  return changed;
}

async function run(target) {
  const columns = ["id", target.json, target.text, target.stamp]
    .filter(Boolean)
    .join(",");
  const { data: rows, error } = await supabase.from(target.table).select(columns);
  if (error) {
    console.log(`${target.table}: skipped (${error.message})`);
    return;
  }
  for (const row of rows ?? []) {
    const patch = {};
    let changed = 0;
    try {
      const payload = row[target.json];
      if (payload) {
        const copy = structuredClone(payload);
        const count = await convert(copy, target.folder);
        if (count > 0) {
          patch[target.json] = copy;
          changed += count;
        }
      }
      const text = target.text ? row[target.text] : null;
      if (
        typeof text === "string" &&
        text.startsWith("data:") &&
        text.length >= minChars
      ) {
        const ref = await move(text, target.folder);
        if (ref) {
          patch[target.text] = ref;
          stats.chars += text.length;
          changed += 1;
        } else {
          stats.skipped += 1;
        }
      }
    } catch (failure) {
      stats.failed += 1;
      console.log(`${target.table} ${row.id}: ${failure.message}; row left unchanged`);
      continue;
    }
    if (changed === 0) continue;
    stats.rows += 1;
    if (dryRun) continue;
    let update = supabase.from(target.table).update(patch).eq("id", row.id);
    if (target.stamp) update = update.eq(target.stamp, row[target.stamp]);
    const { data: done, error: updateError } = await update.select("id");
    if (updateError || !done?.length) {
      stats.failed += 1;
      console.log(
        `${target.table} ${row.id}: not updated (${updateError?.message ?? "the row changed meanwhile"}); run again`,
      );
    }
  }
  console.log(`${target.table}: done`);
}

console.log(
  dryRun ? "Dry run: nothing is uploaded or changed." : "Moving files to storage…",
);
for (const target of targets) await run(target);
console.log(
  `${stats.files} file(s) ${dryRun ? "would be " : ""}moved (${stats.reused} repeated copy/copies shared), ` +
    `${(stats.chars / 1024 / 1024).toFixed(1)} MB of text ${dryRun ? "would be " : ""}freed from the database, ` +
    `${stats.rows} row(s), ${stats.skipped} left as they were, ${stats.failed} failed.`,
);
