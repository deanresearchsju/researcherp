/**
 * Saves a copy of the ERP's data to a folder on this computer: one file per table, read only.
 *
 *   node --env-file=.env.local scripts/backup-database.mjs
 *
 * The copy goes to backups/<date-time>/ in the project folder. It holds personal data and
 * uploaded documents, so keep it private. Sign-in accounts are not copied. Put it back with
 * scripts/restore-backup.mjs if a change ever needs to be undone.
 */
import { mkdir, writeFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "phd_applications",
  "supervisor_applications",
  "phd_drafts",
  "scholar_records",
  "admission_office",
  "doctoral_office",
  "research_register",
  "scholar_allocations",
  "rac_proposals",
  "thesis_panels",
  "thesis_evaluation",
  "supervisor_vacancies",
  "site_settings",
  "news_board",
  "research_areas",
  "research_team",
  "profile_photos",
  "portal_forms",
  "helpdesk_messages",
  "portal_notices",
  "application_counters",
];

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const folder = `backups/${stamp}`;
await mkdir(folder, { recursive: true });

let total = 0;
for (const table of tables) {
  const listed = await supabase.from(table).select("*", { count: "exact", head: true });
  if (listed.error) {
    console.log(`${table}: skipped (${listed.error.message})`);
    continue;
  }
  // Rows are read one page at a time so the large ones (with files) do not time out.
  const rows = [];
  const pageSize = 20;
  for (let from = 0; from < (listed.count ?? 0); from += pageSize) {
    const page = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (page.error) {
      console.error(`${table}: the copy failed (${page.error.message}). Nothing was changed.`);
      process.exit(1);
    }
    rows.push(...(page.data ?? []));
  }
  if ((listed.count ?? 0) !== rows.length) {
    console.error(`${table}: expected ${listed.count} rows but read ${rows.length}. Run it again.`);
    process.exit(1);
  }
  await writeFile(`${folder}/${table}.json`, JSON.stringify(rows));
  total += rows.length;
  console.log(`${table}: ${rows.length} row(s) saved`);
}
console.log(`\nDone. ${total} row(s) saved in ${folder}`);
console.log("Keep this folder safe. Do not share it or upload it anywhere.");
