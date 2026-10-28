// Run: node tests/invigilation-pdf.test.mjs
// The invigilation letter is built with the research office letter layout, with no signature.
import assert from "node:assert/strict";

import { PDFDocument } from "pdf-lib";

import { load, summary, test } from "./helpers.mjs";

const core = load("@/lib/invigilation-core.ts");
const pdf = load("@/lib/invigilation-pdf.ts");
const letterPdf = load("@/lib/letter-pdf.ts");
globalThis.fetch = async () => ({ ok: false });

const pool = Array.from({ length: 6 }, (_, i) => ({
  id: `T${i + 1}`,
  name: `Teacher ${i + 1}`,
  designation: "Assistant Professor",
  department: "Physics",
  phone: "",
  unavailable: [],
}));
const result = core.allocate(
  [
    {
      date: "2026-04-07",
      time: "13:00",
      venue: "MAIN BUILDING",
      room: "MF 15",
      strength: 20,
    },
    {
      date: "2026-04-09",
      time: "13:00",
      venue: "MAIN BUILDING",
      room: "MF 12",
      strength: 60,
    },
  ],
  pool,
  { twoFrom: 40, reservedPerSitting: 1 },
);
const chiefs = [
  { name: "Dr. A. Kumar", designation: "Professor", department: "Physics" },
  { name: "Dr. B. Meena", designation: "Associate Professor", department: "Chemistry" },
];
const plan = {
  ...core.emptyPlan("course-work"),
  ...result,
  examination: "Semester Examination - April 2026",
  chiefs,
  chiefSuperintendent: core.chiefNames(chiefs),
  finalisedOn: "2026-04-01",
  status: "Final",
};
const letters = core.lettersFor(plan, pool);

await test("the letter draft has the dates, sessions, halls and reserved lines, and no closing or signature", () => {
  const draft = pdf.invigilationLetterDraft(plan, letters[0]);
  assert.equal(draft.closing, "");
  assert.equal(draft.title, "Invigilation assignment");
  assert.ok(draft.details.some((row) => /\d{2}-\d{2}-2026 · /.test(row.label)));
  assert.ok(draft.details.some((row) => row.label === "Examination dates"));
  assert.ok(draft.body.some((line) => /Chief Superintendent, Dr. A. Kumar/.test(line)));
  assert.ok(!draft.body.join(" ").match(/signature/i));
  assert.ok(
    letters.some((l) =>
      pdf
        .invigilationLetterDraft(plan, l)
        .details.some((row) => row.value === "RESERVED"),
    ),
  );
});

await test("each letter is built with the office letter layout, without a signature block", async () => {
  const pages = [];
  for (const letter of letters) {
    const doc = await letterPdf.buildLetter(
      pdf.invigilationLetterDraft(plan, letter),
      null,
    );
    pages.push(doc.getNumberOfPages());
    const loaded = await PDFDocument.load(doc.output("arraybuffer"));
    assert.equal(loaded.getPageCount(), doc.getNumberOfPages());
  }
  assert.ok(
    pages.every((n) => n >= 1 && n <= 2),
    pages.join(","),
  );
});

await test("a signed office letter still has its signature block (the system letter is the only one without)", async () => {
  const draft = pdf.invigilationLetterDraft(plan, letters[0]);
  const signed = await letterPdf.buildLetter(
    { ...draft, closing: "Best wishes," },
    { name: "Dean Research", title: "Dean Research" },
  );
  const unsigned = await letterPdf.buildLetter(draft, null);
  const size = (doc) => doc.output("arraybuffer").byteLength;
  assert.ok(size(signed) > size(unsigned), "the signed letter carries more content");
});

await test("an order is drawn up for each Chief Superintendent (two together), with the dates and venues, and no signature", async () => {
  assert.equal(core.chiefNames(chiefs), "Dr. A. Kumar and Dr. B. Meena");
  const drafts = chiefs.map((chief) => pdf.chiefOrderDraft(plan, chief, "2026-04-01"));
  assert.deepEqual(
    drafts.map((d) => d.refNo),
    ["ORD/CW/CS/1", "ORD/CW/CS/2"],
  );
  for (const draft of drafts) {
    assert.equal(draft.closing, "");
    assert.ok(
      draft.details.some(
        (row) =>
          row.label === "Examination dates" && /07-04-2026 to 09-04-2026/.test(row.value),
      ),
    );
    assert.ok(
      draft.details.some(
        (row) => /07-04-2026/.test(row.label) && /MAIN BUILDING/.test(row.value),
      ),
    );
    assert.ok(draft.details.some((row) => row.label === "Together with"));
    assert.match(draft.body[0], /Semester Examination - April 2026/);
    const doc = await letterPdf.buildLetter(draft, null);
    assert.ok(doc.getNumberOfPages() >= 1 && doc.getNumberOfPages() <= 2);
  }
  assert.equal(drafts[0].toLines[0], "Dr. A. Kumar");
  assert.match(
    drafts[0].details.find((row) => row.label === "Together with").value,
    /Meena/,
  );
});

await test("one Chief Superintendent alone: no Together-with line", () => {
  const solo = { ...plan, chiefs: [chiefs[0]] };
  const draft = pdf.chiefOrderDraft(solo, chiefs[0], "2026-04-01");
  assert.ok(!draft.details.some((row) => row.label === "Together with"));
});

summary("invigilation-pdf");
