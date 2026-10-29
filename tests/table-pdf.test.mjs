// Run: node tests/table-pdf.test.mjs
// The printed reports (lib/table-pdf.ts): the header carries the title, the menu the report was
// made from and the filters applied; long tables repeat their header; multi-line cells stay whole.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { load, summary, test } from "./helpers.mjs";

const { downloadTablePdf } = load("@/lib/table-pdf.ts");

const folder = mkdtempSync(join(tmpdir(), "sju-pdf-"));
const before = process.cwd();
process.chdir(folder);

async function make(input) {
  const name = `report-${readdirSync(folder).length}`;
  await downloadTablePdf({ filename: `${name}.csv`, ...input });
  return readFileSync(join(folder, `${name}.pdf`)).toString("latin1");
}

await test("the header carries the title, the menu and the filters", async () => {
  const pdf = await make({
    title: "Publications of scholars",
    context: "Scholar records › Publications",
    criteria: ["Department: Computer Science", "Mode: Part time", "Search: “graph”"],
    headers: ["Scholar", "Department", "Mode"],
    rows: [["Asha", "Computer Science", "Part time"]],
  });
  assert.match(pdf, /PUBLICATIONS OF SCHOLARS/);
  // The PDF writes the "›" in the Windows character set (0x9B).
  assert.ok(pdf.includes("(Scholar records  Publications) Tj"));
  assert.match(pdf, /\(DEPARTMENT\) Tj/);
  assert.match(pdf, /\(Computer Science\) Tj/);
  assert.match(pdf, /\(MODE\) Tj/);
  assert.match(pdf, /\(Part time\) Tj/);
});

await test("a cell of several lines is kept as separate lines", async () => {
  const pdf = await make({
    title: "Publications",
    context: "",
    criteria: [],
    headers: ["Scholar", "Title · Authors"],
    rows: [["Asha", "A study of graphs\nAuthors: Asha, Ravi"]],
  });
  assert.ok(pdf.includes("(A study of graphs) Tj"));
  assert.ok(pdf.includes("(Authors: Asha, Ravi) Tj"));
});

await test("a report with no filter says it covers all records", async () => {
  const pdf = await make({
    title: "Fee approvals",
    context: "Fee verification › Fee approvals",
    criteria: [],
    headers: ["Scholar"],
    rows: [["Asha"]],
  });
  assert.match(pdf, /All records/);
});

await test("a long list is spread over pages and every page has the letterhead", async () => {
  const rows = Array.from({ length: 120 }, (_, i) => [`Scholar ${i + 1}`, "Dept", "Full time"]);
  const pdf = await make({
    title: "Course registrations",
    context: "Examination › Course registrations",
    criteria: [],
    headers: ["Scholar", "Department", "Mode"],
    rows,
  });
  const pages = (pdf.match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pages >= 2, `expected several pages, got ${pages}`);
  const heads = (pdf.match(/COURSE REGISTRATIONS/g) ?? []).length;
  assert.equal(heads, pages);
});

process.chdir(before);
rmSync(folder, { recursive: true, force: true });
summary();
