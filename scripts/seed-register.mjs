/**
 * Puts the research register (the scholars and supervisors that came with the ERP) into the
 * database, in the research_register table under the id "seed". The register is no longer part
 * of the program's code, because the code is downloaded by every visitor of the website.
 *
 *   node --env-file=.env.local scripts/seed-register.mjs [path-to-seed.json]
 *
 * The default file is data/research-register.seed.json, which is kept only on this computer
 * (it is listed in .gitignore). Safe to run again: it replaces the stored "seed" row.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).",
  );
  process.exit(1);
}
const file = path.resolve(process.argv[2] ?? "data/research-register.seed.json");
const seed = JSON.parse(fs.readFileSync(file, "utf8"));
for (const part of ["batches", "supervisors", "scholars"]) {
  if (!Array.isArray(seed[part])) {
    console.error(`The file has no list called "${part}".`);
    process.exit(1);
  }
}
const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db
  .from("research_register")
  .upsert({ id: "seed", payload: seed, updated_at: new Date().toISOString() });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(
  `Stored the register: ${seed.batches.length} batches, ${seed.supervisors.length} supervisors, ${seed.scholars.length} scholars.`,
);
