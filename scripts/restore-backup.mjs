/**
 * Puts a copy made by backup-database.mjs back into the database. Use it only to undo a
 * change; it writes the saved rows over the current ones with the same id.
 *
 *   node --env-file=.env.local scripts/restore-backup.mjs backups/<date-time> [table]
 *
 * Name one table to restore only that table, for example admission_office.
 */
import { readdir, readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const [folder, only] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!folder) {
  console.error("Say which backup folder to restore, for example backups/2026-10-25T09-00-00");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const files = (await readdir(folder)).filter(
  (name) => name.endsWith(".json") && (!only || name === `${only}.json`),
);
if (files.length === 0) {
  console.error("No saved table was found for that name.");
  process.exit(1);
}
for (const name of files) {
  const table = name.replace(/\.json$/, "");
  const rows = JSON.parse(await readFile(`${folder}/${name}`, "utf8"));
  for (let from = 0; from < rows.length; from += 10) {
    const { error } = await supabase.from(table).upsert(rows.slice(from, from + 10));
    if (error) {
      console.error(`${table}: restore stopped (${error.message}).`);
      process.exit(1);
    }
  }
  console.log(`${table}: ${rows.length} row(s) restored`);
}
console.log("Done.");
