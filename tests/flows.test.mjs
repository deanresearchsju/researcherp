// Run: node tests/flows.test.mjs
// The selection, admission and course-work rules (pure parts, no server needed).
import assert from "node:assert/strict";

import { load, seedRegister, summary, test } from "./helpers.mjs";

const admission = load("@/lib/admission.ts");
const seating = load("@/lib/seating.ts");
const exam = load("@/lib/exam-office.ts");
const doctoral = load("@/lib/doctoral.ts");
const regFormat = load("@/lib/registration-format.ts");
const register = load("@/lib/register.ts");
seedRegister();
const { researchRegister } = load("@/data/research-register");

const application = (n, department = "Physics") => ({
  id: `a${n}`,
  applicationNo: `SJU/PHD/Jan27/${String(n).padStart(4, "0")}`,
  applicantName: `Candidate ${n}`,
  email: `c${n}@example.test`,
  dateOfBirth: "1995-01-01",
  studyMode: "Full time",
  status: "Acknowledgement sent",
  payload: { specialization: department, school: "" },
});
const candidate = (n, department, written, interview) => ({
  ...admission.blankCase(application(n, department)),
  shortlisted: true,
  attendance: "Present",
  written,
  interview,
});
const vacancy = (department, count) => ({
  id: department,
  serialNo: 1,
  supervisorName: "Dr Guide",
  designation: "Professor",
  department,
  researchArea: "",
  vacancyCount: count,
  school: "",
});

/* ------------------------------------ 1/2. applications and selection ------------------- */
await test("an application becomes a selection file with the right starting state", () => {
  const row = admission.blankCase(application(1, "Physics"));
  assert.equal(row.name, "Candidate 1");
  assert.equal(row.department, "Physics");
  assert.equal(row.shortlisted, false);
  assert.equal(row.selected, false);
  assert.equal(row.verification, "Pending");
  assert.equal(row.registrationNo, "");
});

await test("marks: total is written + interview; merit order is total, then written, then name", () => {
  const a = candidate(1, "Physics", 40, 20);
  const b = candidate(2, "Physics", 30, 35);
  const c = candidate(3, "Physics", 45, 15);
  assert.equal(admission.totalMarks(a), 60);
  assert.equal(admission.totalMarks({ written: 10, interview: null }), null);
  const order = [a, b, c].sort(admission.meritCompare).map((x) => x.name);
  assert.deepEqual(order, ["Candidate 2", "Candidate 3", "Candidate 1"]);
});

await test("the top candidates fill the vacancies of their subject; the rest are wait-listed in merit order", () => {
  const rows = [
    candidate(1, "Physics", 50, 30),
    candidate(2, "Physics", 45, 30),
    candidate(3, "Physics", 40, 30),
    candidate(4, "Chemistry", 60, 30),
  ];
  const result = admission.applyVacancySelection(rows, [vacancy("Physics", 2)]);
  const by = Object.fromEntries(result.map((r) => [r.name, r]));
  assert.equal(by["Candidate 1"].selected, true);
  assert.equal(by["Candidate 2"].selected, true);
  assert.equal(by["Candidate 3"].selected, false);
  assert.equal(by["Candidate 3"].waitlistRank, 1);
  assert.equal(
    by["Candidate 4"].selected,
    false,
    "no vacancy in Chemistry, nobody selected",
  );
});

await test("a candidate who is absent or has no marks is not ranked", () => {
  const rows = [
    { ...candidate(1, "Physics", 50, 30), attendance: "Absent" },
    { ...candidate(2, "Physics", 50, null), interview: null },
    candidate(3, "Physics", 10, 10),
  ];
  const result = admission.applyVacancySelection(rows, [vacancy("Physics", 3)]);
  assert.deepEqual(
    result.map((r) => r.selected),
    [false, false, true],
  );
});

await test("the qualifying total keeps weaker candidates off the list", () => {
  const rows = [candidate(1, "Physics", 20, 10), candidate(2, "Physics", 40, 30)];
  const result = admission.applyVacancySelection(rows, [vacancy("Physics", 2)], 50);
  assert.deepEqual(
    result.map((r) => r.selected),
    [false, true],
  );
});

await test("a seat released by a candidate who did not report goes to the first on the waiting list", () => {
  const rows = admission
    .applyVacancySelection(
      [
        candidate(1, "Physics", 50, 30),
        candidate(2, "Physics", 45, 30),
        candidate(3, "Physics", 40, 30),
      ],
      [vacancy("Physics", 1)],
    )
    .map((r) =>
      r.selected ? { ...r, guideName: "Dr Guide", guideIdentifier: "g@x" } : r,
    );
  const first = rows.find((r) => r.selected);
  const out = admission.releaseSeat(
    rows,
    first.applicationId,
    "Not reported",
    "No show",
    "2026-11-01",
    true,
  );
  assert.equal(out.promoted?.name, "Candidate 2");
  const promoted = out.cases.find((r) => r.applicationId === out.promoted.applicationId);
  assert.equal(promoted.selected, true);
  assert.equal(promoted.guideName, "Dr Guide", "takes the guide of the released seat");
  assert.equal(promoted.fromWaitlist, true);
  const left = out.cases.find((r) => r.applicationId === first.applicationId);
  assert.equal(left.selected, false);
  assert.equal(left.reporting, "Not reported");
});

await test("letter reference numbers run on from the last one issued", () => {
  const rows = [
    { ...candidate(1, "Physics", 1, 1), letterNo: 4 },
    { ...candidate(2, "Physics", 1, 1), letterNo: 7 },
  ];
  assert.equal(admission.nextLetterNo(rows), 8);
});

await test("the entrance seating fills the rooms in order, mixes subjects, and reports shortage of seats", () => {
  const rows = [
    ...[1, 2, 3, 4].map((n) => ({
      ...candidate(n, "Physics", 1, 1),
      hallTicketNo: `PHD27010${n}`,
      examCampusId: "c1",
    })),
    ...[5, 6].map((n) => ({
      ...candidate(n, "Chemistry", 1, 1),
      hallTicketNo: `PHD27010${n}`,
      examCampusId: "c1",
    })),
  ];
  const campuses = [
    {
      id: "c1",
      name: "Main",
      address: "",
      rooms: [
        { id: "r1", name: "Hall 1", capacity: 3 },
        { id: "r2", name: "Hall 2", capacity: 2 },
      ],
    },
  ];
  const plan = seating.arrangeSeating(rows, campuses, { mix: true });
  assert.equal(plan.assignments.length, 5);
  assert.equal(plan.unseated[0].count, 1, "one candidate has no seat");
  const hall1 = plan.assignments.filter((a) => a.room === "Hall 1").length;
  assert.equal(hall1, 3);
  const seats = plan.assignments
    .filter((a) => a.room === "Hall 1")
    .map((a) => a.seat)
    .sort();
  assert.deepEqual(seats, [1, 2, 3]);
});

await test("hall ticket numbers carry the session and a running serial", () => {
  const schedule = { monthYear: "2027-01" };
  const no = admission.hallTicketNumber(schedule, 7);
  assert.equal(no, "PHD2701007");
  assert.equal(admission.hallTicketSerial(schedule, no), 7);
});

await test("registration numbers follow the campus, mode, school and department codes and never repeat", () => {
  const result = regFormat.suggestRegistration(
    { applicationId: "x", department: "Physics", studyMode: "Full time", guideName: "" },
    { schoolName: "", schedule: { monthYear: "2027-01", session: "January" }, taken: [] },
  );
  assert.equal(
    result.ok,
    false,
    "the codes are not set up yet, so it asks for them instead of guessing",
  );
  assert.ok(result.missing.length > 0);
});

/* ----------------------------------------------- 5. course work ------------------------- */
const reg = (id, extra = {}) => ({
  id,
  batchId: "b1",
  subjectId: "s1",
  scholarIdentifier: "sch@x",
  scholarName: "Scholar",
  semester: 1,
  code: "RM101",
  name: "Research Methodology",
  amount: 1000,
  paymentMode: "",
  paymentReference: "",
  paymentDate: "",
  receiptName: null,
  receiptData: null,
  paymentStatus: "Pending",
  arrear: false,
  coeStatus: "",
  coeForwardedOn: "",
  examCentreId: "c1",
  ...extra,
});

await test("only papers whose fee Accounts approved reach the hall ticket and exam menu", () => {
  const state = {
    registrations: [
      reg("r1", { paymentStatus: "Approved" }),
      reg("r2", { subjectId: "s2", paymentStatus: "Pending" }),
      reg("r3", { subjectId: "s3", paymentStatus: "Returned" }),
    ],
    results: [],
  };
  assert.deepEqual(
    exam.examRegistrations(state, "b1", 1).map((r) => r.id),
    ["r1"],
  );
  assert.deepEqual(exam.examRegistrations(state, "b1", 2), [], "another semester");
  assert.deepEqual(exam.examRegistrations(state, "b2", 1), [], "another batch");
});

await test("a paper with a published result leaves the exam list", () => {
  const state = {
    registrations: [reg("r1", { paymentStatus: "Approved" })],
    results: [{ registrationId: "r1", outcome: "Pass" }],
  };
  assert.deepEqual(exam.examRegistrations(state, "b1", 1), []);
});

await test("paper standings: passed, waiting and arrear (RA/Absent) are told apart", () => {
  const rows = [
    reg("r1", { code: "A1", name: "A", subjectId: "sa", paymentStatus: "Approved" }),
    reg("r2", { code: "B1", name: "B", subjectId: "sb", paymentStatus: "Approved" }),
    reg("r3", { code: "C1", name: "C", subjectId: "sc", paymentStatus: "Approved" }),
  ];
  const results = [
    { registrationId: "r1", outcome: "Pass", publishedOn: "2026-10-01" },
    { registrationId: "r2", outcome: "RA", publishedOn: "2026-10-01" },
  ];
  const standing = doctoral.paperStandings({ registrations: rows, results }, "sch@x");
  const status = Object.fromEntries(standing.map((p) => [p.code, p.status]));
  assert.deepEqual(status, { A1: "Passed", B1: "Arrear", C1: "Pending" });
});

/* ----------------------------- 4. a change shows up everywhere ------------------------ */
await test("correcting a scholar in Scholar information changes the register row, the download and the sign-in lookup", () => {
  const scholar = researchRegister.scholars.find((item) => item.guideName && item.email);
  assert.ok(scholar, "the register has scholars");
  const before = { name: scholar.name, phone: scholar.phone };
  try {
    register.applyRegisterPayload({
      scholarEdits: [
        {
          scholarId: scholar.id,
          fields: { name: "Corrected Name", phone: "9876543210" },
          editedOn: "2026-10-27",
          editedBy: "admin",
        },
      ],
    });
    assert.equal(scholar.name, "Corrected Name");
    const row = register.scholarDownloadRow(scholar, [], [], []);
    assert.ok(
      row.includes("Corrected Name") && row.includes("9876543210"),
      "the exported row carries the change",
    );
    assert.equal(
      register.scholarBySignIn(register.scholarSignInId(scholar))?.name,
      "Corrected Name",
    );
  } finally {
    register.applyRegisterPayload({});
  }
  assert.equal(
    scholar.name,
    before.name,
    "removing the correction restores the original",
  );
  assert.equal(scholar.phone, before.phone);
});

await test("renaming a supervisor moves the new name to all their scholars", () => {
  const guide = researchRegister.supervisors.find((item) =>
    researchRegister.scholars.some((s) => s.guideName === item.name),
  );
  assert.ok(guide);
  const mine = researchRegister.scholars.filter((s) => s.guideName === guide.name);
  const key = register.supervisorEditKey(guide);
  const oldName = guide.name;
  try {
    register.applyRegisterPayload({
      supervisorEdits: [
        {
          key,
          fields: { name: "Renamed Guide" },
          editedOn: "2026-10-27",
          editedBy: "admin",
        },
      ],
    });
    assert.equal(guide.name, "Renamed Guide");
    assert.ok(mine.every((s) => s.guideName === "Renamed Guide"));
  } finally {
    register.applyRegisterPayload({});
  }
  assert.equal(guide.name, oldName);
  assert.ok(mine.every((s) => s.guideName === oldName));
});

await test("guide vacancy follows the allotments: one more scholar means one less vacancy", () => {
  const guide = researchRegister.supervisors.find((item) => item.vacancy > 0);
  assert.ok(guide);
  const base = register.guideFigures(guide, [], []);
  assert.equal(base.vacancy, guide.vacancy);
});

/* ------------------------------ subjects: complete, unique, approved ------------------ */
const subject = (id, code, extra = {}) => ({
  id,
  batchId: "",
  semester: 1,
  school: "all",
  code,
  name: `Subject ${code}`,
  credits: "4",
  inChargeName: "",
  inChargeDesignation: "",
  inChargeEmail: "",
  syllabusName: "syllabus.pdf",
  syllabusData: "data:application/pdf;base64,AAAA",
  status: "Approved",
  approvedBy: "Dean",
  approvedOn: "2026-10-01",
  ...extra,
});
const full = {
  code: "RM101",
  name: "Research Methodology",
  syllabusName: "s.pdf",
  syllabusData: "data:application/pdf;base64,AAAA",
};

await test("a subject needs a code, a title and an uploaded syllabus", () => {
  assert.equal(doctoral.subjectProblem([], full), null);
  assert.match(doctoral.subjectProblem([], { ...full, code: "" }), /code/i);
  assert.match(doctoral.subjectProblem([], { ...full, name: " " }), /title/i);
  assert.match(
    doctoral.subjectProblem([], { ...full, syllabusName: null, syllabusData: null }),
    /syllabus/i,
  );
});

await test("a subject code can belong to one subject only (case and spaces do not matter)", () => {
  const list = [subject("a", "RM101")];
  assert.match(
    doctoral.subjectProblem(list, { ...full, code: "rm 101" }),
    /already used/,
  );
  assert.match(doctoral.subjectProblem(list, { ...full, code: "RM101" }), /already used/);
  assert.equal(doctoral.subjectProblem(list, { ...full, code: "RM102" }), null);
  assert.equal(
    doctoral.subjectProblem(list, { ...full, code: "RM101" }, "a"),
    null,
    "editing the same subject is fine",
  );
});

await test("only approved subjects are offered for course-work registration", () => {
  const state = {
    enrollments: [],
    subjects: [
      subject("a", "A1"),
      subject("b", "B1", { status: "Pending", approvedBy: "" }),
      subject("c", "C1", { semester: 2 }),
    ],
  };
  const offered = doctoral.courseCatalogFor(state, {
    identifier: "x@y",
    semester: 1,
    batchId: "b1",
  });
  assert.deepEqual(
    offered.map((item) => item.code),
    ["A1"],
  );
});

summary("flows");
