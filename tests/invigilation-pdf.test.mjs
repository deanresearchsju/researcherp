// Run: node tests/invigilation-pdf.test.mjs  (writes a sample letter PDF to the temp folder)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const jiti = require("jiti")(import.meta.url, { alias: { "@": root } });
const core = jiti("@/lib/invigilation-core.ts");
const pdf = jiti("@/lib/invigilation-pdf.ts");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "inv-"));
process.chdir(out);
globalThis.fetch = async () => ({ ok: false });

const pool = Array.from({ length: 6 }, (_, i) => ({
  id: `T${i + 1}`, name: `Teacher ${i + 1}`, designation: "", department: "", phone: "", unavailable: [],
}));
const result = core.allocate(
  [
    { date: "2026-04-07", time: "13:00", venue: "MAIN BUILDING", room: "MF 15", strength: 20 },
    { date: "2026-04-09", time: "13:00", venue: "MAIN BUILDING", room: "MF 12", strength: 60 },
  ],
  pool,
  { twoFrom: 40, reservedPerSitting: 1 },
);
const plan = { ...core.emptyPlan("course-work"), ...result, examination: "Semester Examination - April 2026", chiefSuperintendent: "Dr. A. Kumar", finalisedOn: "2026-04-01", status: "Final" };
const letters = core.lettersFor(plan, pool);
await pdf.downloadInvigilatorLetters(plan, letters, "letters");
const file = fs.readdirSync(out).find((name) => name.endsWith(".pdf"));
assert.ok(file, "a PDF was written");
const raw = fs.readFileSync(path.join(out, file)).toString("latin1");
const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
assert.equal(pages, letters.length, "one page per letter");
console.log(`ok   ${letters.length} letters, ${pages} pages, ${(raw.length / 1024).toFixed(0)} KB -> ${path.join(out, file)}`);
