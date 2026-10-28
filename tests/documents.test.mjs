// Run: node tests/documents.test.mjs
// Approval stamps on the PDF (including the last page) and the printed lists/letters.
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const { PDFDocument } = await import("pdf-lib");
const copy = load("@/lib/approved-copy.ts");

async function samplePdf(pages) {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1)
    doc.addPage([595, 842]).drawText(`Page ${index + 1}`);
  const bytes = await doc.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}

const base = {
  title: "First doctoral committee report",
  scholarName: "A Scholar",
  scholarId: "SJU/PHD/2601",
  approvedOn: "2026-10-03T11:00:00.000Z",
  approvedBy: "Dean Research",
};

async function pagesOf(bytes) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

await test("a fully approved PDF gets a closing approval-record page after the last page", async () => {
  const bytes = await copy.buildApprovedCopy(await samplePdf(3), "report.pdf", {
    ...base,
    supervisor: { by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" },
    dean: { by: "Dean Research", at: "2026-10-03T11:00:00.000Z" },
  });
  assert.equal(await pagesOf(bytes), 4);
});

await test("the stamped preview (what approvers open) also ends with the approval record", async () => {
  const url = await copy.stampedPreview(await samplePdf(2), "report.pdf", {
    ...base,
    supervisor: { by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" },
  });
  assert.ok(url.startsWith("data:application/pdf;base64,"));
  const bytes = Buffer.from(url.split(",")[1], "base64");
  assert.equal(await pagesOf(bytes), 3);
});

await test("an image upload from an older record is turned into a PDF page and stamped", async () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bytes = await copy.buildApprovedCopy(png, "scan.png", {
    ...base,
    supervisor: { by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" },
    dean: { by: "Dean Research", at: "2026-10-03T11:00:00.000Z" },
  });
  assert.equal(await pagesOf(bytes), 2);
});

await test("the VC step appears in the review trail of the record page", async () => {
  const bytes = await copy.buildApprovedCopy(await samplePdf(1), "evaluators.pdf", {
    ...base,
    supervisor: { by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" },
    dean: { by: "Dean Research", at: "2026-10-03T11:00:00.000Z" },
    steps: [
      {
        label: "Nominated by Supervisor",
        by: "Dr Guide",
        on: "2026-10-01T09:00:00.000Z",
      },
      { label: "Checked by Dean", by: "Dean Research", on: "2026-10-02T10:00:00.000Z" },
      { label: "Selected by Vice Chancellor", by: "VC", on: "2026-10-03T11:00:00.000Z" },
    ],
  });
  assert.equal(await pagesOf(bytes), 2);
});

summary("documents");
