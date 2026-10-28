// Run: node tests/invigilation-list.test.mjs
// The name list uploaded each session, and the consolidated list.
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const core = load("@/lib/invigilation-core.ts");

const person = (n) => ({
  id: `T${String(n).padStart(3, "0")}`,
  name: `Teacher ${n}`,
  designation: "",
  department: "",
  phone: "",
  unavailable: [],
});
const pool = (count) => Array.from({ length: count }, (_, i) => person(i + 1));
const sit = (date, time, room, strength) => ({
  date,
  time,
  venue: "Main",
  room,
  strength,
});

await test("the name list is read from a sheet with headings, in any order", () => {
  const table = {
    headers: ["Staff ID", "Staff Name", "Designation", "Dept", "Mobile No"],
    rows: [
      {
        "Staff ID": "S1",
        "Staff Name": "Asha K",
        Designation: "AP",
        Dept: "Physics",
        "Mobile No": "98765 43210",
      },
      {
        "Staff ID": "S2",
        "Staff Name": "Ravi",
        Designation: "",
        Dept: "",
        "Mobile No": "",
      },
      {
        "Staff ID": "S1",
        "Staff Name": "Repeated",
        Designation: "",
        Dept: "",
        "Mobile No": "",
      },
      { "Staff ID": "S4", "Staff Name": "", Designation: "", Dept: "", "Mobile No": "" },
    ],
  };
  const result = core.invigilatorsFromTable(table);
  assert.deepEqual(
    result.people.map((p) => p.id),
    ["S1", "S2"],
  );
  assert.equal(result.people[0].phone, "9876543210");
  assert.equal(result.skipped, 2);
  assert.equal(
    core.invigilatorsFromTable({ headers: ["x"], rows: [] }).missingName,
    true,
  );
  const noId = core.invigilatorsFromTable({
    headers: ["Name"],
    rows: [{ Name: "A" }, { Name: "B" }],
  });
  assert.deepEqual(
    noId.people.map((p) => p.id),
    ["INV001", "INV002"],
  );
});

await test("pasted text is read one person a line, comma or tab apart", () => {
  const result = core.invigilatorsFromText(
    "S1, Asha K, AP, Physics, 9876543210\nS2\tRavi\n\nS1, Dup\nonlyid",
  );
  assert.deepEqual(
    result.people.map((p) => p.id),
    ["S1", "S2"],
  );
  assert.equal(result.skipped, 2);
});

await test("the consolidated list has one row for each invigilator with every duty", () => {
  const people = pool(6);
  const result = core.allocate(
    [
      sit("2026-04-07", "10:00", "R1", 20),
      sit("2026-04-08", "10:00", "R1", 20),
      sit("2026-04-09", "10:00", "R1", 60),
    ],
    people,
    { twoFrom: 40, reservedPerSitting: 1 },
  );
  const rows = core.consolidatedList(result, people);
  assert.deepEqual(
    rows.map((r) => r.serial),
    rows.map((_, i) => i + 1),
  );
  assert.equal(new Set(rows.map((r) => r.invigilatorId)).size, rows.length);
  assert.equal(
    rows.reduce((sum, r) => sum + r.total, 0),
    core.dutyList(result, people).length,
  );
  for (const row of rows) assert.equal(row.total, row.roomDuties + row.reservedDuties);
  assert.ok(rows.every((r) => r.duties.length > 0));
});

summary("invigilation-list");
