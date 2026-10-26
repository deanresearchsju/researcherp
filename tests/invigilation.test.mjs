// Run: node tests/invigilation.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const jiti = require("jiti")(import.meta.url, { alias: { "@": root } });
const core = jiti("@/lib/invigilation-core.ts");

let passed = 0;
function test(name, run) {
  try {
    run();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}\n     ${error.message}`);
    process.exitCode = 1;
  }
}

const person = (n, extra = {}) => ({
  id: `T${String(n).padStart(3, "0")}`,
  name: `Teacher ${n}`,
  designation: "Assistant Professor",
  department: "Physics",
  phone: "",
  unavailable: [],
  ...extra,
});
const pool = (count) => Array.from({ length: count }, (_, i) => person(i + 1));
const sit = (date, time, room, strength, venue = "Main") => ({
  date,
  time,
  venue,
  room,
  strength,
});
const planOf = (scope, result) => ({ ...core.emptyPlan(scope), ...result });

test("one invigilator below the threshold, two at or above it", () => {
  assert.equal(core.slotsFor(39, 40), 1);
  assert.equal(core.slotsFor(40, 40), 2);
  assert.equal(core.slotsFor(80, 40), 2);
  assert.equal(core.slotsFor(5, 0), 2);
});

test("rooms get the right number of places and reserved duty is kept", () => {
  const result = core.allocate(
    [sit("2026-04-07", "10:00", "R1", 20), sit("2026-04-07", "10:00", "R2", 60)],
    pool(10),
    { twoFrom: 40, reservedPerSitting: 2 },
  );
  assert.deepEqual(
    result.duties.map((d) => d.assigned.length),
    [1, 2],
  );
  assert.equal(result.reserved.length, 2);
  assert.equal(result.shortages.length, 0);
  assert.equal(core.planProblems(result, pool(10)).length, 0);
});

test("rooms with no candidates need nobody", () => {
  const result = core.allocate([sit("2026-04-07", "10:00", "R1", 0)], pool(3), {
    twoFrom: 40,
    reservedPerSitting: 1,
  });
  assert.equal(result.duties.length, 0);
});

test("nobody is on two duties in the same sitting", () => {
  const people = pool(8);
  const result = core.allocate(
    [
      sit("2026-04-07", "10:00", "R1", 50),
      sit("2026-04-07", "10:00", "R2", 50),
      sit("2026-04-07", "10:00", "R3", 10),
    ],
    people,
    { twoFrom: 40, reservedPerSitting: 2 },
  );
  const ids = [
    ...result.duties.flatMap((d) => d.assigned),
    ...result.reserved.map((r) => r.invigilatorId),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 7);
});

test("duties are spread evenly over days", () => {
  const sittings = ["07", "08", "09", "10"].map((day) =>
    sit(`2026-04-${day}`, "10:00", "R1", 20),
  );
  const result = core.allocate(sittings, pool(4), { twoFrom: 40, reservedPerSitting: 1 });
  const totals = [...core.dutyCounts(result).values()].map((c) => c.room + c.reserved);
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 1, JSON.stringify(totals));
});

test("a person is not given duty on an unavailable date", () => {
  const people = [person(1, { unavailable: ["2026-04-07"] }), person(2), person(3)];
  const result = core.allocate([sit("2026-04-07", "10:00", "R1", 20)], people, {
    twoFrom: 40,
    reservedPerSitting: 1,
  });
  const ids = [
    ...result.duties.flatMap((d) => d.assigned),
    ...result.reserved.map((r) => r.invigilatorId),
  ];
  assert.ok(!ids.includes("T001"));
});

test("a shortage is reported, not hidden", () => {
  const result = core.allocate([sit("2026-04-07", "10:00", "R1", 60)], pool(1), {
    twoFrom: 40,
    reservedPerSitting: 1,
  });
  assert.ok(result.shortages.length > 0);
  assert.ok(core.planProblems(result, pool(1)).some((p) => /empty/.test(p)));
});

test("assigning refuses a double booking and an unavailable person", () => {
  const people = [
    person(1, { unavailable: ["2026-04-08"] }),
    person(2),
    person(3),
    person(4),
  ];
  const base = planOf(
    "course-work",
    core.allocate(
      [sit("2026-04-07", "10:00", "R1", 20), sit("2026-04-07", "10:00", "R2", 20)],
      people,
      { twoFrom: 40, reservedPerSitting: 1 },
    ),
  );
  const first = base.duties[0].assigned[0];
  assert.ok("error" in core.assignSlot(base, people, 1, 0, first));
  assert.ok("plan" in core.assignSlot(base, people, 0, 0, ""));
  const away = planOf(
    "course-work",
    core.allocate([sit("2026-04-08", "10:00", "R1", 20)], people, {
      twoFrom: 40,
      reservedPerSitting: 0,
    }),
  );
  assert.ok("error" in core.assignSlot(away, people, 0, 0, "T001"));
});

test("a final plan can not be edited, and an incomplete plan can not be finalised", () => {
  const people = pool(4);
  const filled = planOf(
    "entrance",
    core.allocate([sit("2026-04-07", "10:00", "R1", 20)], people, {
      twoFrom: 40,
      reservedPerSitting: 1,
    }),
  );
  const done = core.finalise(filled, people, "Admin", "2026-04-01");
  assert.ok("plan" in done);
  assert.ok("error" in core.assignSlot(done.plan, people, 0, 0, ""));
  const emptied = core.assignSlot(filled, people, 0, 0, "");
  assert.ok("error" in core.finalise(emptied.plan, people, "Admin", "2026-04-01"));
  assert.ok(
    "error" in core.finalise(core.emptyPlan("entrance"), people, "Admin", "2026-04-01"),
  );
});

test("the date-wise list runs in one continuous serial order", () => {
  const people = pool(10);
  const result = core.allocate(
    [
      sit("2026-04-08", "10:00", "R1", 20),
      sit("2026-04-07", "10:00", "R2", 60),
      sit("2026-04-07", "10:00", "R1", 20),
      sit("2026-04-07", "14:00", "R1", 20),
    ],
    people,
    { twoFrom: 40, reservedPerSitting: 1 },
  );
  const rows = core.dutyList(result, people);
  assert.deepEqual(
    rows.map((r) => r.serial),
    rows.map((_, i) => i + 1),
  );
  const order = rows.map((r) => `${r.date} ${r.time}`);
  assert.deepEqual(order, [...order].sort());
  const first = rows.filter((r) => r.date === "2026-04-07" && r.time === "10:00");
  assert.equal(first.at(-1).kind, "Reserved");
  assert.deepEqual(
    first.map((r) => r.room),
    ["R1", "R2", "R2", "Reserved"],
  );
  assert.equal(rows.length, 8);
});

test("one letter per person with duties in date order and RESERVED lines", () => {
  const people = pool(6);
  const result = core.allocate(
    [sit("2026-04-09", "13:00", "MF 15", 20), sit("2026-04-07", "13:00", "MF 12", 20)],
    people,
    { twoFrom: 40, reservedPerSitting: 1 },
  );
  const letters = core.lettersFor(result, people);
  const total = letters.reduce((sum, l) => sum + l.lines.length, 0);
  assert.equal(total, core.dutyList(result, people).length);
  for (const letter of letters) {
    const dates = letter.lines.map((l) => l.date);
    assert.deepEqual(dates, [...dates].sort());
  }
  assert.ok(
    letters.some((l) => l.lines.some((x) => x.reserved && x.hall === "RESERVED")),
  );
  assert.ok(letters.some((l) => l.lines.some((x) => /Main - MF/.test(x.hall))));
});

test("course-work rooms are counted from the seated scholars of the sitting", () => {
  const centres = [
    {
      id: "c1",
      name: "Tindivanam",
      rooms: [
        { id: "r1", name: "Hall 1" },
        { id: "r2", name: "Hall 2" },
      ],
    },
  ];
  const timetable = [
    { batchId: "b1", semester: 1, date: "2026-04-07", time: "10:00" },
    { batchId: "b1", semester: 1, date: "2026-04-08", time: "10:00" },
    { batchId: "b2", semester: 2, date: "2026-04-07", time: "10:00" },
  ];
  const tickets = [
    { batchId: "b1", semester: 1, centreId: "c1", roomId: "r1" },
    { batchId: "b1", semester: 1, centreId: "c1", roomId: "r1" },
    { batchId: "b2", semester: 2, centreId: "c1", roomId: "r2" },
    { batchId: "b1", semester: 1, centreId: "c1", roomId: "" },
    { batchId: "b9", semester: 1, centreId: "c1", roomId: "r1" },
  ];
  const list = core.courseWorkSittings(timetable, tickets, centres);
  const find = (date, room) => list.find((s) => s.date === date && s.room === room);
  assert.equal(find("2026-04-07", "Hall 1").strength, 2);
  assert.equal(find("2026-04-07", "Hall 2").strength, 1);
  assert.equal(find("2026-04-08", "Hall 1").strength, 2);
  assert.equal(find("2026-04-08", "Hall 2"), undefined);
});

test("entrance rooms count shortlisted, seated, not-absent candidates", () => {
  const schedule = {
    date: "2026-07-10",
    examTime: "10:00",
    campuses: [{ id: "k1", name: "Campus A" }],
  };
  const row = (extra) => ({
    shortlisted: true,
    hallTicketNo: "PHD1",
    examCampusId: "k1",
    examRoom: "Room 1",
    ...extra,
  });
  const list = core.entranceSittings(schedule, [
    row({}),
    row({}),
    row({ attendance: "Absent" }),
    row({ shortlisted: false }),
    row({ hallTicketNo: "" }),
    row({ examRoom: "" }),
    row({ examCampusId: "zz" }),
    row({ examRoom: "Room 2" }),
  ]);
  assert.equal(list.find((s) => s.room === "Room 1").strength, 2);
  assert.equal(list.find((s) => s.room === "Room 2").strength, 1);
  assert.deepEqual(core.entranceSittings({ ...schedule, date: "" }, [row({})]), []);
});

test("dates are shown day-month-year", () => {
  assert.equal(core.shortDate("2026-04-09"), "09-04-2026");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
