// Run: node tests/access-rac.test.mjs
// Grades between marks, RAC through the Dean and the Vice Chancellor, section rights, schools,
// and one count of scholars for a supervisor.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { load, root, seedRegister, summary, test } from "./helpers.mjs";

process.env.SESSION_SECRET ??= "test-only-secret-for-the-cookie-checks";

const exam = load("@/lib/exam-office.ts");
const office = load("@/lib/office.ts");
const access = load("@/lib/access.ts");
const session = load("@/lib/session.ts");
const portal = load("@/data/portal.ts");
const sections = load("@/data/menu-sections.ts");
const schools = load("@/lib/schools.ts");
const register = load("@/lib/register.ts");
seedRegister();
const { researchRegister } = load("@/data/research-register");

/* ------------------------------------------ grades ------------------------------------- */
await test("grades are marks from-to, and a table with a gap, an overlap or a short end is refused", () => {
  assert.equal(exam.gradesProblem(exam.defaultGrades, 50, 100), null);
  const gap = exam.defaultGrades.map((band) =>
    band.grade === "A+" ? { ...band, max: 88 } : band,
  );
  assert.match(exam.gradesProblem(gap, 50, 100), /have no grade/);
  const overlap = exam.defaultGrades.map((band) =>
    band.grade === "A+" ? { ...band, max: 91 } : band,
  );
  assert.match(exam.gradesProblem(overlap, 50, 100), /overlap/);
  assert.match(
    exam.gradesProblem(exam.defaultGrades.slice(0, 5), 50, 100),
    /top grade|lowest grade|have no grade/,
  );
  assert.match(
    exam.gradesProblem(
      exam.defaultGrades.filter((b) => b.grade !== "C"),
      50,
      100,
    ),
    /pass mark/,
  );
  assert.match(
    exam.gradesProblem([{ min: 60, max: 50, grade: "X" }], 50, 100),
    /below the/,
  );
});

await test("a mark gets the grade whose range holds it; below the pass mark is RA", () => {
  const settings = { ...exam.defaultExamSettings };
  const at = (marks) => exam.gradeFor(settings, marks);
  assert.deepEqual([100, 90, 89, 80, 79, 70, 69, 60, 59, 55, 54, 50, 49, 0].map(at), [
    "O",
    "O",
    "A+",
    "A+",
    "A",
    "A",
    "B+",
    "B+",
    "B",
    "B",
    "C",
    "C",
    "RA",
    "RA",
  ]);
});

await test("grades saved before a to-mark existed still read: each runs up to the grade above", () => {
  const parsed = exam.parseExam({
    settings: {
      maxMarks: 100,
      passMark: 50,
      grades: [
        { min: 80, grade: "A" },
        { min: 60, grade: "B" },
        { min: 50, grade: "C" },
      ],
    },
  });
  assert.deepEqual(
    parsed.settings.grades.map((g) => [g.grade, g.min, g.max]),
    [
      ["A", 80, 100],
      ["B", 60, 79],
      ["C", 50, 59],
    ],
  );
});

/* -------------------------------------------- RAC -------------------------------------- */
const nominee = (key, side, extra = {}) => ({
  key,
  side,
  name: `Member ${key}`,
  designation: "Professor",
  department: "Physics",
  institution: "IIT Madras",
  address: "IIT Madras, Chennai 600036",
  email: `${key}@x.org`,
  phone: "9876543210",
  specialization: "Optics",
  publications: [
    "Paper one 2025",
    "Paper two 2024",
    "Paper three 2023",
    "Paper four 2022",
    "Paper five 2021",
  ],
  ...extra,
});
const proposal = (status, extra = {}) => ({
  id: "p1",
  kind: "constitution",
  scholarIdentifier: "s@x.org",
  scholarName: "S",
  supervisorIdentifier: "g@x.org",
  supervisorName: "G",
  status,
  nominees: [
    nominee("internal-1", "internal"),
    nominee("external-1", "external"),
    nominee("external-2", "external"),
  ],
  selectedInternal: "",
  selectedExternal: "",
  remarks: "",
  agenda: "",
  attendance: "",
  minutes: "",
  reason: "",
  decidedOn: "",
  decidedBy: "",
  vcBy: "",
  vcOn: "",
  vcRemarks: "",
  officeEntry: false,
  enteredBy: "",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

await test("a RAC nomination is 1 to 3 internal and 2 to 3 external members, each with the usual details but no publications, no document", () => {
  assert.deepEqual(
    [
      office.racInternalMin,
      office.racInternalMax,
      office.racExternalMin,
      office.racExternalMax,
    ],
    [1, 3, 2, 3],
  );
  const base = {
    kind: "constitution",
    scholarIdentifier: "s@x.org",
    scholarName: "S",
    supervisorIdentifier: "g@x.org",
    supervisorName: "G",
    reason: "",
  };
  assert.equal(office.nomineeProblem(nominee("internal-1", "internal")), null);
  assert.match(
    office.nomineeProblem(nominee("x", "external", { address: "" })),
    /address/,
  );
  assert.match(
    office.nomineeProblem(nominee("x", "external", { phone: "12" })),
    /contact number/,
  );
  assert.match(
    office.nomineeProblem(nominee("x", "external", { specialization: "" })),
    /area of research/,
  );
  assert.equal(
    office.nomineeProblem(nominee("x", "external", { publications: [] })),
    null,
    "publication details are not asked",
  );
  assert.match(
    office.nomineeProblem(nominee("x", "external", { email: "nope" })),
    /email/,
  );
  const ok = proposal("Submitted").nominees;
  const mk = (internals, externals) => [
    ...Array.from({ length: internals }, (_, i) =>
      nominee(`internal-${i + 1}`, "internal"),
    ),
    ...Array.from({ length: externals }, (_, i) =>
      nominee(`external-${i + 1}`, "external"),
    ),
  ];
  const check = (internals, externals) =>
    office.nominationProblem({ ...base, nominees: mk(internals, externals) });
  assert.equal(check(1, 2), null, "1 internal and 2 external is the least");
  assert.equal(check(3, 3), null, "3 and 3 is the most");
  assert.equal(check(2, 3), null);
  assert.match(check(0, 2), /1 to 3 internal/);
  assert.match(check(4, 2), /1 to 3 internal/);
  assert.match(check(1, 1), /2 to 3/);
  assert.match(check(1, 4), /2 to 3/);
  assert.ok(
    ok.every((n) => !("fileData" in n) && !("file" in n)),
    "nothing is uploaded",
  );
  assert.ok(
    Array.isArray(
      office.normaliseNominee({ ...ok[0], publications: undefined, address: undefined })
        .publications,
    ),
  );
});

await test("the RAC is in force only after the Vice Chancellor approves; with the Dean or the VC it is pending", () => {
  const today = "2026-10-27";
  for (const status of ["Submitted", "With VC"]) {
    const standing = office.racStanding([proposal(status)], "s@x.org", today);
    assert.ok(standing.pending, status);
    assert.equal(standing.approved, null);
    assert.equal(standing.canRequest, null);
    assert.equal(
      office.presentRac([proposal(status)], "s@x.org"),
      null,
      "no RAC members shown before the final approval",
    );
  }
  assert.match(
    office.racStanding([proposal("With VC")], "s@x.org", today).blocked,
    /Vice Chancellor/,
  );
  assert.match(
    office.racStanding([proposal("Submitted")], "s@x.org", today).blocked,
    /Dean/,
  );
  const done = proposal("Approved", {
    selectedInternal: "internal-1",
    selectedExternal: "external-2",
    decidedOn: "2026-10-05",
    vcOn: "2026-10-10",
    vcBy: "VC",
  });
  const standing = office.racStanding([done], "s@x.org", today);
  assert.equal(standing.pending, null);
  assert.equal(standing.approved.id, "p1");
  const present = office.presentRac([done], "s@x.org");
  assert.equal(present.external.name, "Member external-2");
  assert.equal(
    present.approvedOn,
    "2026-10-10",
    "dated from the Vice Chancellor's approval",
  );
  assert.ok(
    office.racIsPending({ status: "With VC" }) &&
      !office.racIsPending({ status: "Returned" }),
  );
});

await test("a returned RAC can be sent again", () => {
  const standing = office.racStanding([proposal("Returned")], "s@x.org", "2026-10-27");
  assert.equal(standing.canRequest, "constitution");
});

/* ------------------------------------ sections (sub-sub menus) -------------------------- */
await test("sections of a menu can be closed for one sign-in; without the marker every section is open", () => {
  const href = "/admin/course-work";
  assert.equal(
    access.canOpenSection(["/admin/course-work"], href, "subjects"),
    true,
    "older rights keep every section",
  );
  assert.equal(access.canOpenSection(null, href, "subjects"), true);
  const rights = [href, access.sectionsMarker, access.sectionKey(href, "registrations")];
  assert.equal(access.canOpenSection(rights, href, "registrations"), true);
  assert.equal(access.canOpenSection(rights, href, "subjects"), false);
  assert.equal(
    access.canOpenSection(rights, "/admin/users", "anything"),
    true,
    "a screen with no sections is unaffected",
  );
  assert.ok(sections.menuSections[href].length >= 3);
});

await test("older rights get every section ticked when opened for editing, and storedMenus keeps only sections of granted menus", () => {
  const older = ["/admin/dashboard", "/admin/course-work", "/admin/invigilation"];
  const all = access.withAllSections("admin", older);
  assert.ok(all.includes(access.sectionsMarker));
  assert.ok(all.includes(access.sectionKey("/admin/invigilation", "letters")));
  assert.ok(
    !all.some((key) => key.startsWith("/admin/payments#tab")),
    "no sections for a menu that is not granted",
  );
  const saved = access.storedMenus("admin", [
    ...all,
    access.sectionKey("/admin/payments", "annual"),
  ]);
  assert.ok(
    !saved.includes(access.sectionKey("/admin/payments", "annual")),
    "a section of a menu not granted is dropped",
  );
  assert.ok(saved.includes(access.rightsMarker) && saved.includes(access.sectionsMarker));
});

await test("section rights survive the sign-in cookie", async () => {
  const hrefs = access.menuHrefs("staff");
  assert.ok(
    hrefs.includes("/admin/course-work") && hrefs.includes("/admin/invigilation"),
  );
  const rights = access.storedMenus("staff", [
    "/admin/course-work",
    "/admin/invigilation",
    access.sectionsMarker,
    access.sectionKey("/admin/course-work", "registrations"),
    access.sectionKey("/admin/invigilation", "plan"),
    access.sectionKey("/admin/invigilation", "letters"),
  ]);
  const token = await session.encodeSessionCookie(
    { role: "staff", identifier: "s@x.org", name: "S", mustReset: false, menus: rights },
    false,
  );
  assert.ok(token.length < 3800, `the cookie stays small (${token.length})`);
  const back = (await session.decodeSessionCookie(token)).menus;
  assert.equal(access.canOpenSection(back, "/admin/course-work", "registrations"), true);
  assert.equal(access.canOpenSection(back, "/admin/course-work", "subjects"), false);
  assert.equal(access.canOpenSection(back, "/admin/invigilation", "plan"), true);
  assert.equal(access.canOpenSection(back, "/admin/invigilation", "pool"), false);
  assert.equal(access.canOpenSection(back, "/admin/invigilation", "letters"), true);
});

await test("the section ids are the ids the screens use", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const screens = {
    "/admin/course-work": "components/portal/CourseWorkScreen.tsx",
    "/admin/exam-setup": "components/portal/ExamSetupScreen.tsx",
    "/admin/exam-tickets": "components/portal/ExamTicketsScreen.tsx",
    "/admin/invigilation": "components/portal/InvigilationDesk.tsx",
    "/admin/supervisors": [
      "components/portal/SupervisorRegisterHub.tsx",
      "components/portal/SupervisorRegister.tsx",
    ],
    "/admin/register": "components/portal/ScholarRegisterHub.tsx",
    "/admin/payments": "components/portal/PaymentDesk.tsx",
    "/admin/fee": "components/portal/FeeCollectionScreen.tsx",
    "/admin/supervisor-exit": "components/portal/SupervisorExitScreen.tsx",
    "/admin/passed-out": "components/portal/PassedOutScreen.tsx",
    "/admin/plagiarism": "components/portal/PlagiarismScreen.tsx",
    "/admin/colloquium": "components/portal/ColloquiumScreen.tsx",
    "/admin/entrance-invigilation": "components/portal/InvigilationDesk.tsx",
  };
  for (const [href, files] of Object.entries(screens)) {
    const list = Array.isArray(files) ? files : [files];
    const text = list
      .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
      .join("\n");
    for (const section of sections.menuSections[href]) {
      assert.ok(
        text.includes(`"${section.id}"`) || text.includes(`id: "${section.id}"`),
        `${href}: ${section.id} in ${list.join(" or ")}`,
      );
    }
  }
});

/* ---------------------------------------- the school ----------------------------------- */
await test("a department is shown with the name of its school", () => {
  assert.equal(
    schools.schoolOfDepartment("Civil Engineering"),
    "School of Engineering and Technology",
  );
  assert.equal(
    schools.schoolOfDepartment("chemistry"),
    "School of Science and Humanities",
  );
  assert.equal(
    schools.schoolOfDepartment("School of Engineering and Technology"),
    "School of Engineering and Technology",
  );
  assert.equal(schools.schoolOfDepartment("Astrology"), "");
  const known = researchRegister.supervisors.filter((s) =>
    schools.schoolOfDepartment(s.department),
  );
  assert.ok(known.length > 0, "the register supervisors map to schools");
});

/* ------------------------------ one count of scholars for a supervisor ----------------- */
await test("a supervisor with scholars linked in the register never shows fewer, and vacancy is quota less scholars", () => {
  for (const supervisor of researchRegister.supervisors) {
    const linked = register.registerScholarsOf(supervisor);
    const figures = register.guideFigures(supervisor, [], []);
    assert.ok(
      figures.currentScholars >= linked,
      `${supervisor.name}: ${figures.currentScholars} < ${linked}`,
    );
    assert.equal(
      figures.vacancy,
      Math.max(0, figures.quota - figures.currentScholars),
      supervisor.name,
    );
    assert.equal(figures.balance, figures.vacancy);
  }
  const princy = researchRegister.supervisors.find(
    (s) => s.name === "Dr. A. Mariya Princy",
  );
  assert.equal(
    register.guideFigures(princy, [], []).currentScholars,
    2,
    "two scholars are linked to Dr. Mariya Princy",
  );
  assert.equal(
    register.supervisorDownloadRow(princy, [], [])[
      register.supervisorDownloadHeaders.indexOf("Current scholars")
    ],
    "2",
  );
});

await test("the VC has the RAC approval menu", () => {
  const vc = portal.portalGroups.vc.flatMap((g) => g.items);
  assert.ok(
    vc.some((item) => item.href === "/admin/rac" && item.label === "RAC approval"),
  );
});

/* ------------------------- research areas: school > department > area ------------------- */
const areasLib = load("@/lib/research-areas.ts");
const baseSchools = () => [
  {
    id: "eng",
    name: "School of Engineering and Technology",
    summary: "",
    icon: "cpu",
    areas: ["Civil Engineering", "Mechanical Engineering"],
  },
  {
    id: "sci",
    name: "School of Science and Humanities",
    summary: "",
    icon: "flask",
    areas: ["Chemistry"],
  },
];

await test("departments and areas can be added, renamed, edited and removed at every level", () => {
  let schools = baseSchools();
  const added = areasLib.addDepartment(schools, "eng", "Aeronautical Engineering");
  assert.ok(added.ok);
  schools = added.schools;
  assert.ok(schools[0].areas.includes("Aeronautical Engineering"));
  assert.equal(
    areasLib.addDepartment(schools, "eng", " civil engineering ").ok,
    false,
    "a repeated department is refused",
  );
  assert.equal(areasLib.addDepartment(schools, "eng", "X").ok, false);
  schools = areasLib.setDepartmentAreas(schools, "eng", "Civil Engineering", [
    "Structures",
    "Geotechnics",
    "structures",
    " ",
  ]);
  assert.deepEqual(
    areasLib.managedAreas(schools[0], "civil engineering"),
    ["Structures", "Geotechnics"],
    "no repeats, no empty lines",
  );
  const renamed = areasLib.renameDepartment(
    schools,
    "eng",
    "Civil Engineering",
    "Civil and Structural Engineering",
  );
  assert.ok(renamed.ok);
  schools = renamed.schools;
  assert.ok(
    schools[0].areas.includes("Civil and Structural Engineering") &&
      !schools[0].areas.includes("Civil Engineering"),
  );
  assert.deepEqual(
    areasLib.managedAreas(schools[0], "Civil and Structural Engineering"),
    ["Structures", "Geotechnics"],
    "the areas move with the department",
  );
  assert.equal(
    areasLib.renameDepartment(
      schools,
      "eng",
      "Civil and Structural Engineering",
      "Mechanical Engineering",
    ).ok,
    false,
  );
  schools = areasLib.setDepartmentAreas(
    schools,
    "eng",
    "Civil and Structural Engineering",
    ["Structures"],
  );
  assert.deepEqual(
    areasLib.managedAreas(schools[0], "Civil and Structural Engineering"),
    ["Structures"],
  );
  schools = areasLib.removeDepartment(schools, "eng", "Civil and Structural Engineering");
  assert.ok(!schools[0].areas.includes("Civil and Structural Engineering"));
  assert.deepEqual(
    areasLib.managedAreas(schools[0], "Civil and Structural Engineering"),
    [],
    "its areas go with it",
  );
  const edited = areasLib.editSchool(schools, "sci", {
    name: "School of Sciences",
    summary: "Pure sciences",
    icon: "flask",
  });
  assert.ok(edited.ok);
  assert.equal(edited.schools[1].name, "School of Sciences");
  assert.deepEqual(
    edited.schools[1].areas,
    ["Chemistry"],
    "the departments stay with the school",
  );
  assert.equal(
    areasLib.editSchool(schools, "sci", {
      name: "school of engineering and technology",
      summary: "",
      icon: "flask",
    }).ok,
    false,
  );
});

await test("the tree survives being saved and read back (parse keeps departments and areas)", () => {
  let schools = baseSchools();
  schools = areasLib.setDepartmentAreas(schools, "sci", "Chemistry", [
    "Organic chemistry",
    "Nanomaterials",
  ]);
  const back = areasLib.parseSchools(JSON.parse(JSON.stringify(schools)));
  assert.deepEqual(back[1].areas, ["Chemistry"]);
  assert.deepEqual(areasLib.managedAreas(back[1], "Chemistry"), [
    "Organic chemistry",
    "Nanomaterials",
  ]);
  assert.equal(back[0].topics, undefined);
});

await test("a department is placed in its school using the kept list (a department added in the ERP is found)", () => {
  const schools = areasLib.addDepartment(baseSchools(), "sci", "Data Science").schools;
  assert.equal(
    load("@/lib/schools.ts").schoolOfDepartment("data science", schools),
    "School of Science and Humanities",
  );
  assert.equal(
    load("@/lib/schools.ts").schoolOfDepartment("data science", baseSchools()),
    "",
  );
});

await test("the application form lists every department of a school; only a department with a vacancy lets the applicant go on", () => {
  const vac = load("@/lib/vacancies.ts");
  const row = (department, count, school = "School of Engineering and Technology") => ({
    id: department,
    serialNo: 1,
    supervisorName: "",
    designation: "",
    department,
    researchArea: "",
    vacancyCount: count,
    school,
  });
  const rows = [
    row("Civil Engineering", 2),
    row("Mechanical Engineering", 0),
    row("Chemistry", 1, "School of Science and Humanities"),
  ];
  assert.deepEqual(vac.allSchools(rows), [
    "School of Engineering and Technology",
    "School of Science and Humanities",
  ]);
  assert.deepEqual(
    vac.allSubjects(rows, "School of Engineering and Technology"),
    ["Civil Engineering", "Mechanical Engineering"],
    "the department with no seat is still listed",
  );
  assert.equal(
    vac.hasOpenVacancy(rows, "School of Engineering and Technology", "Civil Engineering"),
    true,
  );
  assert.equal(
    vac.hasOpenVacancy(
      rows,
      "School of Engineering and Technology",
      "Mechanical Engineering",
    ),
    false,
  );
  assert.deepEqual(vac.openSubjects(rows, "School of Engineering and Technology"), [
    "Civil Engineering",
  ]);
  const copy = load("@/data/forms.ts").scholarFormCopy;
  assert.match(copy.noVacancyDepartment, /no vacancy for the department you selected/);
  assert.match(copy.noVacancyDepartment, /coming sessions/);
});

await test("the administrator can give any office sign-in any office menu; Accounts starts with Fee approvals only", () => {
  const access = load("@/lib/access.ts");
  for (const role of ["admin", "staff", "dean", "accounts", "vc", "coe", "coeverify"]) {
    const catalog = access.menuHrefs(role);
    for (const href of [
      "/admin/rac",
      "/admin/payments",
      "/admin/coe/marks",
      "/admin/coe/verify",
      "/admin/register",
      "/admin/users",
    ]) {
      assert.ok(catalog.includes(href), `${role} can be given ${href}`);
    }
    assert.equal(catalog.includes("/admin/test-data"), role === "admin", role);
  }
  const start = access.resolvedMenus({
    role: "accounts",
    identifier: "a@x.org",
    menus: null,
  });
  assert.ok(start.includes("/admin/payments"));
  assert.ok(
    !start.includes("/admin/rac"),
    "the starting menus of Accounts are unchanged",
  );
  const moved = access.resolvedMenus({
    role: "accounts",
    identifier: "a@x.org",
    menus: ["/admin/accounts/thesis", "/admin/accounts/thesis#approve"],
  });
  assert.ok(
    moved.includes("/admin/payments") && moved.includes("/admin/payments#approve"),
  );
});

await test("a RAC can carry a co-guide, and one entered by hand needs only the name, designation and institution", () => {
  const office = load("@/lib/office.ts");
  const member = {
    key: "coguide-1",
    side: "coguide",
    name: "Dr. Co Guide",
    designation: "Professor",
    department: "",
    institution: "Another University",
    email: "",
    phone: "",
    specialization: "Organic chemistry",
    address: "",
    publications: [],
  };
  assert.equal(office.racMemberProblem(member), null);
  assert.match(office.racMemberProblem({ ...member, institution: "" }), /institution/);
  assert.match(
    office.racMemberProblem({ ...member, specialization: "" }),
    /area of research/,
  );
  assert.match(office.racMemberProblem({ ...member, email: "bad" }), /email/);
});

await test("the colloquium minimum is read at the synopsis and thesis checklists, not on the colloquium pages", () => {
  const doctoralData = load("@/data/doctoral.ts");
  assert.ok(doctoralData.synopsisChecklist.includes(doctoralData.colloquiumCheck));
  assert.ok(doctoralData.thesisChecklist.includes(doctoralData.colloquiumCheck));
  const report = load("@/lib/scholar-report.ts");
  assert.match(report.colloquiumMinimumText("Full time"), /3 of 6/);
  assert.match(report.colloquiumMinimumText("Part time"), /4 of 8/);
  for (const file of [
    "components/portal/ColloquiumScreen.tsx",
    "components/portal/MemberDashboard.tsx",
  ]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(!/minimum|At risk/i.test(text), `${file} shows no minimum`);
  }
});

await test("a Vidwan ID is the number only; a pasted profile address is accepted too", () => {
  const doctoral = load("@/lib/doctoral.ts");
  assert.equal(doctoral.vidwanProblem("123456"), null);
  assert.equal(doctoral.vidwanProblem("VN-2345_a"), null);
  assert.equal(
    doctoral.vidwanProblem("https://vidwan.inflibnet.ac.in/profile/123456"),
    null,
  );
  assert.match(doctoral.vidwanProblem("12"), /Vidwan ID/);
  assert.match(doctoral.vidwanProblem("12 34;"), /letters, numbers/);
  const state = {
    vidwanIds: [{ id: "a@x.org", identifier: "A@x.org", vidwanId: "9876", savedOn: "" }],
  };
  assert.equal(doctoral.vidwanOf(state, "a@X.org"), "9876");
  assert.equal(doctoral.vidwanOf(state, "b@x.org"), "");
  const register = load("@/lib/register.ts");
  assert.equal(
    register.vidwanLink("9876"),
    "https://vidwan.inflibnet.ac.in/profile/9876",
    "the home page link opens the Vidwan portal",
  );
});

await test("NPTEL courses: at most two of the four papers, only with the RAC's approval and minutes, a pass needs its proof", () => {
  const doctoral = load("@/lib/doctoral.ts");
  const data = load("@/data/doctoral.ts");
  assert.deepEqual(
    [...data.nptelKinds],
    ["NPTEL RM", "NPTEL Research ethics", "NPTEL major", "NPTEL elective"],
  );
  assert.equal(data.nptelMax, 2);
  const ok = {
    semester: 1,
    kind: "NPTEL RM",
    subjectName: "Research methodology",
    credit: "2",
    status: "In progress",
    passMonth: "",
    passYear: "",
    racApproved: true,
    hasRacMinutes: true,
    hasProof: false,
  };
  const check = (change, existing = []) =>
    doctoral.nptelProblem({ ...ok, ...change }, existing, "2026-10-29");
  assert.equal(check({}), null, "in progress needs no proof yet");
  assert.match(check({ racApproved: null }), /RAC/);
  assert.match(check({ racApproved: false }), /Get the approval of the RAC/);
  assert.match(check({ hasRacMinutes: false }), /minutes/);
  assert.match(check({ subjectName: "ab" }), /subject/);
  assert.match(check({ credit: "0" }), /credit/i);
  assert.match(check({ semester: 3 }), /semester/i);
  assert.match(check({ status: "Passed" }), /month/);
  assert.match(
    check({ status: "Passed", passMonth: "March", passYear: "2026" }),
    /proof/,
  );
  assert.equal(
    check({ status: "Passed", passMonth: "March", passYear: "2026", hasProof: true }),
    null,
  );
  assert.match(
    check({ status: "Passed", passMonth: "December", passYear: "2026", hasProof: true }),
    /future/,
  );
  assert.match(
    check({ passMonth: "March" }),
    /year/,
    "a month without a year is refused",
  );
  assert.match(check({}, [{ kind: "NPTEL RM" }]), /already taken/);
  assert.match(
    check({ kind: "NPTEL major" }, [{ kind: "NPTEL RM" }, { kind: "NPTEL elective" }]),
    /At most 2/,
  );
  const state = {
    nptel: [
      { scholarIdentifier: "a@x.org", semester: 1, approval: "Approved" },
      { scholarIdentifier: "a@x.org", semester: 2, approval: "Rejected" },
      { scholarIdentifier: "a@x.org", semester: 1, approval: "Submitted" },
      { scholarIdentifier: "b@x.org", semester: 1, approval: "Approved" },
    ],
  };
  assert.equal(
    doctoral.nptelUsed(state, "A@x.org", 1),
    2,
    "each takes one of the two papers",
  );
  assert.equal(
    doctoral.nptelUsed(state, "a@x.org", 2),
    0,
    "a course turned down does not count",
  );
  assert.equal(doctoral.nptelOf(state, "a@x.org").length, 2);
});

await test("the Approval rules say who approves each request: the Dean always, the supervisor and (RAC) the Vice Chancellor by a tick", () => {
  const rules = load("@/lib/approval-rules.ts");
  const none = {};
  // Until something is ticked, the steps are the usual ones.
  assert.equal(
    rules.chainText(none, "rac"),
    "Supervisor names the members → Dean selects → Vice Chancellor",
  );
  assert.equal(rules.chainText(none, "synopsis"), "Supervisor → Dean");
  assert.equal(rules.chainText(none, "committee"), "Supervisor → Dean");
  assert.equal(rules.stageApplies(none, "record:abc_id", "supervisor"), true);
  // The Dean decides alone for the RAC this semester; the Vice Chancellor joins later by a tick.
  const deanOnly = { rac: { vc: false } };
  assert.equal(
    rules.chainText(deanOnly, "rac"),
    "Supervisor names the members → Dean selects",
  );
  assert.equal(rules.stageApplies(deanOnly, "rac", "vc"), false);
  assert.equal(rules.stageApplies({ rac: { vc: true } }, "rac", "vc"), true);
  // Every step can be ticked for every request.
  assert.equal(rules.stageApplies({ synopsis: { vc: true } }, "synopsis", "vc"), true);
  assert.equal(
    rules.chainText({ synopsis: { vc: true } }, "synopsis"),
    "Supervisor → Dean → Vice Chancellor",
  );
  assert.equal(
    rules.stageApplies({ rac: { supervisor: false } }, "rac", "supervisor"),
    false,
  );
  assert.equal(rules.chainText({ thesis: { supervisor: false } }, "thesis"), "Dean");
  // Every scholar request that goes to the supervisor is listed.
  const ids = rules.approvalItems.map((item) => item.id);
  for (const id of [
    "rac",
    "committee",
    "synopsis",
    "thesis",
    "record:abc_id",
    "record:leave",
  ]) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(new Set(ids).size, ids.length, "no request is listed twice");
});

summary("access-rac");
