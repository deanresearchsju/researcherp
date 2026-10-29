// Run: node tests/rules.test.mjs
// Rules of the ERP that need no server: passwords, uploads, menus, approvals, quotas.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { load, root, summary, test } from "./helpers.mjs";

const rules = load("@/lib/password-rules.ts");
const change = load("@/lib/password-change.ts");
const secrets = load("@/lib/passwords.ts");
const constants = load("@/lib/constants.ts");
const portal = load("@/data/portal.ts");
const records = load("@/data/scholar-records.ts");
const flow = load("@/lib/approval-flow.ts");
const supApproval = load("@/lib/supervisor-approval.ts");
const evalModel = load("@/lib/thesis-evaluation-model.ts");

/* ----------------------------------------------- 11. passwords -------------------------- */
await test("a strong password is accepted, weak ones are refused with a reason", () => {
  assert.equal(rules.passwordProblem("Kx9#mP2vLq"), null);
  for (const weak of [
    "short1!A",
    "alllowercase1!",
    "ALLUPPERCASE1!",
    "NoDigitsHere!!",
    "NoSymbol12345",
    "Password#1234",
    "aaaaB1!xyz9",
  ]) {
    assert.ok(rules.passwordProblem(weak), `should refuse ${weak}`);
  }
  assert.ok(
    rules.passwordProblem("Meenakshi#2026x", ["meenakshi@sju.ac.in"]),
    "refuses a password holding the own sign-in name",
  );
});

await test("changing a password needs the right current one and a different strong new one", () => {
  const stored = secrets.hashSecret("Old#Passw0rd!x");
  const base = { stored, personal: ["user@sju.ac.in"] };
  assert.match(
    change.passwordChangeProblem({ ...base, current: "", next: "Kx9#mP2vLq" }),
    /current/i,
  );
  assert.match(
    change.passwordChangeProblem({ ...base, current: "wrong", next: "Kx9#mP2vLq" }),
    /not correct/i,
  );
  assert.match(
    change.passwordChangeProblem({
      ...base,
      current: "Old#Passw0rd!x",
      next: "Old#Passw0rd!x",
    }),
    /different/i,
  );
  assert.ok(
    change.passwordChangeProblem({ ...base, current: "Old#Passw0rd!x", next: "weak" }),
  );
  assert.equal(
    change.passwordChangeProblem({
      ...base,
      current: "Old#Passw0rd!x",
      next: "Kx9#mP2vLq",
    }),
    null,
  );
});

await test("stored passwords are hashed, never the plain text", () => {
  const hash = secrets.hashSecret("Kx9#mP2vLq");
  assert.ok(hash.startsWith("scrypt$") && !hash.includes("Kx9"));
  assert.ok(secrets.verifySecret("Kx9#mP2vLq", hash));
  assert.ok(!secrets.verifySecret("Kx9#mP2vLr", hash));
});

/* ------------------------------------------- 10. attachments are PDF -------------------- */
await test("scholar-side attachments accept PDF only (up to 1 MB)", () => {
  const rule = constants.fileLimits.pdfDocument;
  assert.deepEqual([...rule.types], ["application/pdf"]);
  assert.equal(rule.accept, "application/pdf");
  assert.equal(rule.maxBytes, 1024 * 1024);
});

await test("every scholar upload screen and record menu uses the PDF rule", () => {
  const dir = path.join(root, "components/portal");
  const offenders = [];
  for (const name of [
    "CommitteeScreen",
    "CourseWorkScreen",
    "FeeScreen",
    "LifecycleScreens",
    "PlagiarismScreen",
    "SixMonthScreen",
    "SynopsisScreen",
    "ThesisScreen",
  ]) {
    const text = fs.readFileSync(path.join(dir, `${name}.tsx`), "utf8");
    if (/acceptRule="document"|, "document", /.test(text)) offenders.push(name);
  }
  assert.deepEqual(offenders, []);
  const data = fs.readFileSync(path.join(root, "data/scholar-records.ts"), "utf8");
  assert.ok(!/fileRule: "document"/.test(data));
  assert.ok(/fileRule: "pdfDocument"/.test(data));
});

/* ------------------------------------------------- menus ------------------------------- */
const pageExists = (href) => {
  const base = path.join(root, "app/(portal)", href.replace(/^\//, ""));
  if (fs.existsSync(path.join(base, "page.tsx"))) return true;
  const parent = path.dirname(base);
  return (
    fs.existsSync(path.join(parent, "[slug]", "page.tsx")) ||
    fs.existsSync(path.join(parent, "[kind]", "page.tsx")) ||
    fs.existsSync(path.join(parent, "[role]", "page.tsx"))
  );
};

await test("every menu of every role opens a real page; no menu is listed twice", () => {
  for (const [role, groups] of Object.entries(portal.portalGroups)) {
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    assert.equal(new Set(hrefs).size, hrefs.length, `${role}: a menu is listed twice`);
    for (const href of hrefs) assert.ok(pageExists(href), `${role}: no page for ${href}`);
  }
});

await test("Examination is its own module: windows, registrations, registration numbers, promotion, set-up, hall tickets, invigilation, results", () => {
  const admin = portal.portalGroups.admin;
  const exam = admin.find((group) => group.heading === "Examination");
  assert.ok(exam, "admin has an Examination module");
  const hrefs = exam.items.map((item) => item.href);
  for (const href of [
    "/admin/course-windows",
    "/admin/course-work",
    "/admin/registration-numbers",
    "/admin/promotions",
    "/admin/exam-setup",
    "/admin/exam-tickets",
    "/admin/invigilation",
    "/admin/exam-results",
    "/admin/results",
  ]) {
    assert.ok(hrefs.includes(href), href);
  }
  assert.ok(
    !admin.some((group) => group.heading === "Course work"),
    "no separate Course work module for the office",
  );
  const registers = admin.find((group) => group.heading === "Registers");
  assert.ok(
    !registers.items.some((item) => item.href === "/admin/registration-numbers"),
    "registration numbers moved",
  );
  for (const role of ["coe", "coeverify"]) {
    assert.ok(
      portal.portalGroups[role].some((group) => group.heading === "Examination"),
      role,
    );
  }
});

await test("Accounts checks every kind of fee on the Fee approvals screen (the office's own); entrance invigilation sits under Admissions", () => {
  const accounts = portal.portalGroups.accounts.flatMap((g) =>
    g.items.map((i) => i.href),
  );
  assert.ok(accounts.includes("/admin/payments"));
  assert.ok(!accounts.some((href) => href.startsWith("/admin/accounts/")));
  const sections = load("@/data/menu-sections.ts").menuSections["/admin/payments"].map(
    (s) => s.id,
  );
  for (const slug of ["registration", "course-work", "annual", "synopsis", "thesis"]) {
    assert.ok(sections.includes(slug), slug);
  }
  const admissions = portal.portalGroups.admin.find((g) => g.heading === "Admissions");
  assert.ok(admissions.items.some((i) => i.href === "/admin/entrance-invigilation"));
});

/* ------------------------------------ 7. approval workflow ------------------------------ */
const chain = (supervisor, dean, extra = {}) => ({
  needsSupervisor: true,
  submittedAt: "2026-10-01T09:00:00.000Z",
  supervisor: { status: "", by: "", at: "", ...supervisor },
  dean: { status: "", by: "", at: "", ...dean },
  ...extra,
});

await test("scholar -> supervisor -> Dean: the status moves one step at a time", () => {
  assert.equal(flow.summarise(chain({}, {})).label, "Submitted to Supervisor");
  const bySup = flow.summarise(
    chain({ status: "approved", by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" }, {}),
  );
  assert.equal(bySup.label, "Approved by Supervisor");
  assert.equal(bySup.detail, "Submitted to Dean");
  const byDean = flow.summarise(
    chain(
      { status: "approved", by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" },
      { status: "approved", by: "Dean", at: "2026-10-03T11:00:00.000Z" },
    ),
  );
  assert.equal(byDean.label, "Approved by Dean");
  assert.deepEqual(
    byDean.steps.map((s) => s.state),
    ["done", "done", "done"],
  );
});

await test("a rejection by the supervisor or the Dean carries the reason back", () => {
  const sup = flow.summarise(
    chain(
      {
        status: "returned",
        by: "Dr Guide",
        at: "2026-10-02T10:00:00.000Z",
        remarks: "Add the signed page",
      },
      {},
    ),
  );
  assert.equal(sup.label, "Rejected by Supervisor");
  assert.equal(sup.detail, "Add the signed page");
  const dean = flow.summarise(
    chain(
      { status: "approved", by: "Dr Guide", at: "2026-10-02T10:00:00.000Z" },
      {
        status: "returned",
        by: "Dean",
        at: "2026-10-03T10:00:00.000Z",
        remarks: "Wrong format",
      },
    ),
  );
  assert.equal(dean.label, "Rejected by Dean");
  assert.equal(dean.detail, "Wrong format");
});

await test("items that need no supervisor go straight to the Dean", () => {
  const result = flow.summarise(chain({}, {}, { needsSupervisor: false }));
  assert.equal(result.label, "Submitted to Dean");
  assert.ok(!result.steps.some((s) => /Supervisor/.test(s.label)));
});

await test("a moment is shown with its date and time", () => {
  const text = flow.formatMoment("2026-10-02T10:05:00.000Z");
  assert.match(text, /2026/);
  assert.match(text, /(AM|PM)/);
});

await test("scholar -> supervisor -> Dean -> VC: nominees are checked, the supervisor never sees the VC choice", () => {
  const person = (n) => ({
    name: `Expert ${n}`,
    institution: "IIT",
    email: `e${n}@x.org`,
    designation: "Professor",
    address: "Department of Physics, IIT, Chennai 600036",
    phone: "9876543210",
    specialization: "Condensed matter",
    publications: [
      "P1 paper one",
      "P2 paper two",
      "P3 paper three",
      "P4 paper four",
      "P5 paper five",
    ],
  });
  const nominees = {
    indian: [1, 2, 3].map(person),
    foreign: [4, 5, 6].map(person),
    local: [7, 8, 9].map(person),
  };
  assert.equal(evalModel.nominationProblem(nominees, "Title", "Domain"), null);
  assert.ok(
    evalModel.nominationProblem(
      { ...nominees, local: nominees.local.slice(0, 2) },
      "Title",
      "Domain",
    ),
    "three names are needed in each group",
  );
  assert.ok(
    evalModel.nominationProblem(
      { ...nominees, local: [person(1), person(2), person(3)] },
      "Title",
      "Domain",
    ),
    "a name used twice is refused",
  );
  const record = {
    scholarKey: "k",
    scholarIdentifier: "s@x",
    scholarName: "S",
    supervisorIdentifier: "g@x",
    supervisorName: "G",
    title: "T",
    domain: "D",
    nominees,
    nominatedOn: "2026-10-01",
    nominatedAt: "",
    approvedBy: "Dean",
    approvedOn: "2026-10-02",
    approvedAt: "",
    selection: {
      indian: { order: [2, 0, 1], invites: [] },
      foreign: { order: [0, 1, 2], invites: [] },
      local: { order: [1, 0, 2], invites: [] },
    },
    selectedBy: "VC",
    selectedOn: "2026-10-03",
    selectedAt: "",
    updatedAt: "",
  };
  const view = evalModel.supervisorView(record);
  assert.ok(!("selection" in view) && !("selectedBy" in view) && !("approvedBy" in view));
  assert.equal(view.nominees.indian.length, 3);
});

/* ----------------------------------------- 2. quotas ----------------------------------- */
await test("supervisor quota is fixed from the designation (Professor 8, Associate 6, Assistant 4)", () => {
  assert.equal(supApproval.proposedQuota("Professor"), 8);
  assert.equal(supApproval.proposedQuota("Associate Professor"), 6);
  assert.equal(supApproval.proposedQuota("Assistant Professor"), 4);
});

summary("rules");
