// Run: node tests/fee-entry.test.mjs
// The office entering the fee a scholar already paid: the buttons are data entry (the Add / edit
// right), not an approval, and the last instalment is the whole balance.
import assert from "node:assert/strict";
import fs from "node:fs";

import { load, root, summary, test } from "./helpers.mjs";

const { actionForLabel } = load("@/lib/access.ts");
const { nextInstallment } = load("@/lib/fees.ts");

await test("entering a payment needs the Add / edit right, never the Approve right", () => {
  for (const label of [
    "Record payment",
    "Record selected as paid (3)",
    "Record as paid in full",
    "Fee paid",
    "Enter RAC",
    "Enter details",
    "Review & lock",
    "Save",
    "Submit",
  ]) {
    assert.notEqual(actionForLabel(label), "approve", `"${label}" reads as an approval`);
  }
  assert.equal(actionForLabel("Record payment"), "edit");
  // The approval buttons still need the Approve right.
  assert.equal(actionForLabel("Approve"), "approve");
  assert.equal(actionForLabel("Verify payment"), "approve");
});

await test("the fee screens do not bring back a 'Mark …' button", () => {
  for (const file of [
    "components/portal/MarkFeePaidDialog.tsx",
    "components/portal/FeeCollectionScreen.tsx",
    "components/portal/ScholarInfoScreen.tsx",
  ]) {
    const source = fs.readFileSync(`${root}/${file}`, "utf8");
    assert.ok(!/>\s*Mark (selected )?(as )?paid|submitLabel="Mark /.test(source), file);
  }
});

const year = (installments, paid) => ({
  index: 1,
  label: "Year 1",
  from: "2025-01-01",
  to: "2025-12-31",
  amount: 30000,
  paid,
  pending: 0,
  balance: 30000 - paid,
  installments: installments.map((amount, i) => ({ number: i + 1, amount })),
  status: "Partly paid",
});

await test("the last instalment is the whole balance and is not typed", () => {
  const first = nextInstallment(year([], 0));
  assert.equal(first.number, 1);
  assert.equal(first.mustPayAll, false);
  const third = nextInstallment(year([10000, 10000], 20000));
  assert.equal(third.number, 3);
  assert.equal(third.mustPayAll, true);
  assert.equal(third.due, 10000);
  // The dialog fills that amount in itself (MarkFeePaidDialog: amountFor).
  const dialog = fs.readFileSync(`${root}/components/portal/MarkFeePaidDialog.tsx`, "utf8");
  assert.match(dialog, /next\.mustPayAll \? next\.due/);
});

summary("fee-entry");
