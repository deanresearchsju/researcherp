// Run: node tests/chain.test.mjs
// The approval steps ticked on the Approval rules screen (Supervisor, Dean, Vice Chancellor),
// followed through the real functions of the ERP with a browser's storage standing in for the
// database: synopsis, committee report, thesis, scholar request and RAC.
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const memory = new Map();
const storage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => void memory.set(key, String(value)),
  removeItem: (key) => void memory.delete(key),
};
globalThis.window = {
  localStorage: storage,
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  location: { origin: "http://test.local", pathname: "/admin", search: "" },
};

const rules = load("@/lib/approval-rules");
const doctoral = load("@/lib/doctoral.ts");
const flow = load("@/lib/approval-flow.ts");
const records = load("@/lib/scholar-records.ts");
const office = load("@/lib/office.ts");
const { storageKeys, sessionStorageKey } = load("@/lib/constants.ts");

const signIn = (role, identifier = `${role}@x.org`) =>
  storage.setItem(
    sessionStorageKey,
    JSON.stringify({
      role,
      identifier,
      name: `Test ${role}`,
      mustReset: false,
      menus: null,
    }),
  );
const tick = (id, choice) => rules.setApprovalRulesInMemory({ [id]: choice });
const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

/** A fresh doctoral record holding what a synopsis, thesis or committee report needs first. */
async function fresh(extra = {}) {
  const base = {
    committees: [
      {
        id: "c-third",
        kind: "third",
        scholarIdentifier: "s@x.org",
        scholarName: "Scholar",
        status: "Approved",
        fileName: "",
        fileData: null,
        remarks: "",
        agenda: "",
        attendance: "",
        minutes: "",
        decidedOn: "2026-01-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        officeEntry: true,
      },
    ],
    plagiarism: ["synopsis", "thesis"].map((stage) => ({
      id: `p-${stage}`,
      stage,
      scholarIdentifier: "s@x.org",
      scholarName: "Scholar",
      checks: [],
      issuedBy: "office",
      similarity: "5",
      fileName: "",
      fileData: null,
      status: "Approved",
      remarks: "",
      decidedOn: "2026-01-02",
      createdAt: "2026-01-02T00:00:00.000Z",
    })),
    ...extra,
  };
  storage.setItem(storageKeys.doctoral, JSON.stringify(base));
  doctoral.subscribeDoctoral(() => undefined);
  await wait(60);
  return doctoral.currentDoctoral();
}

const submitSynopsis = () =>
  doctoral.saveSynopsis({
    scholarIdentifier: "s@x.org",
    scholarName: "Scholar",
    checks: [],
    fileName: "synopsis.pdf",
    fileData: "data",
  });
const synopsisNow = () => doctoral.currentDoctoral().synopses[0];
const decide = (id, status = "Approved") =>
  doctoral.decideSynopsis(id, {
    status,
    remarks: status === "Rejected" ? "No." : "",
    decidedOn: "2026-10-29",
  });

await test("the usual steps with no guide: the Dean alone decides a synopsis", async () => {
  rules.setApprovalRulesInMemory({});
  await fresh();
  signIn("scholar", "s@x.org");
  assert.equal((await submitSynopsis()).ok, true);
  assert.deepEqual(synopsisNow().chain, ["dean"]);
  signIn("staff");
  assert.match((await decide(synopsisNow().id)).message, /Dean/);
  signIn("dean");
  assert.equal((await decide(synopsisNow().id)).ok, true);
  assert.equal(synopsisNow().status, "Approved");
  assert.equal(flow.submissionSummary(synopsisNow()).label, "Approved by Dean");
});

await test("Dean then Vice Chancellor: the Dean recommends, only the Vice Chancellor approves", async () => {
  tick("synopsis", { supervisor: true, dean: true, vc: true });
  await fresh();
  signIn("scholar", "s@x.org");
  await submitSynopsis();
  assert.deepEqual(synopsisNow().chain, ["dean", "vc"]);
  const id = synopsisNow().id;
  signIn("vc");
  assert.match((await decide(id)).message, /waiting for the Dean/);
  signIn("dean");
  assert.equal((await decide(id)).ok, true);
  assert.equal(
    synopsisNow().status,
    "Submitted",
    "the Dean's approval is a recommendation",
  );
  assert.equal(doctoral.waitingStageOf(synopsisNow()), "vc");
  assert.equal(flow.submissionSummary(synopsisNow()).label, "Approved by Dean");
  assert.equal(
    flow.submissionSummary(synopsisNow()).detail,
    "Submitted to Vice Chancellor",
  );
  assert.match(
    (await decide(id)).message,
    /Vice Chancellor/,
    "the Dean cannot do it twice",
  );
  signIn("vc");
  assert.equal((await decide(id)).ok, true);
  assert.equal(synopsisNow().status, "Approved");
  assert.equal(
    flow.submissionSummary(synopsisNow()).label,
    "Approved by Vice Chancellor",
  );
});

await test("the Vice Chancellor alone (Dean unticked): the Dean has no step", async () => {
  tick("synopsis", { supervisor: false, dean: false, vc: true });
  await fresh();
  signIn("scholar", "s@x.org");
  await submitSynopsis();
  assert.deepEqual(synopsisNow().chain, ["vc"]);
  signIn("dean");
  assert.match((await decide(synopsisNow().id)).message, /Vice Chancellor/);
  signIn("vc");
  assert.equal((await decide(synopsisNow().id)).ok, true);
  assert.equal(synopsisNow().status, "Approved");
});

await test("a rejection at the Dean ends the request, whatever follows", async () => {
  tick("synopsis", { supervisor: true, dean: true, vc: true });
  await fresh();
  signIn("scholar", "s@x.org");
  await submitSynopsis();
  signIn("dean");
  assert.equal((await decide(synopsisNow().id, "Rejected")).ok, true);
  assert.equal(synopsisNow().status, "Rejected");
  assert.equal(flow.submissionSummary(synopsisNow()).label, "Rejected by Dean");
});

await test("with the supervisor's step, the supervisor goes first and the Dean cannot skip it", async () => {
  tick("synopsis", { supervisor: true, dean: true, vc: false });
  await fresh({
    synopses: [
      {
        id: "syn-1",
        scholarIdentifier: "s@x.org",
        scholarName: "Scholar",
        checks: [],
        fileName: "s.pdf",
        fileData: "x",
        status: "Submitted",
        remarks: "",
        decidedOn: "",
        createdAt: "2026-10-01T00:00:00.000Z",
        needsSupervisor: true,
        chain: ["supervisor", "dean"],
        steps: [],
        supervisorStatus: "",
      },
    ],
  });
  signIn("dean");
  assert.match((await decide("syn-1")).message, /supervisor has to approve first/);
  signIn("supervisor");
  assert.equal(
    (
      await doctoral.recommendSubmission("synopsis", "syn-1", {
        status: "Recommended",
        remarks: "",
      })
    ).ok,
    true,
  );
  assert.equal(doctoral.waitingStageOf(doctoral.currentDoctoral().synopses[0]), "dean");
  signIn("dean");
  assert.equal((await decide("syn-1")).ok, true);
  assert.equal(doctoral.currentDoctoral().synopses[0].status, "Approved");
});

await test("a request already on its way keeps its steps when the rules change", async () => {
  tick("synopsis", { supervisor: false, dean: true, vc: false });
  await fresh();
  signIn("scholar", "s@x.org");
  await submitSynopsis();
  const id = synopsisNow().id;
  tick("synopsis", { supervisor: true, dean: true, vc: true });
  signIn("dean");
  assert.equal((await decide(id)).ok, true);
  assert.equal(synopsisNow().status, "Approved", "it started as a Dean-only request");
});

await test("committee reports follow the same steps", async () => {
  tick("committee", { supervisor: false, dean: true, vc: true });
  await fresh({
    committees: [
      {
        id: "c-1",
        kind: "first",
        scholarIdentifier: "s@x.org",
        scholarName: "Scholar",
        status: "Submitted",
        fileName: "r.pdf",
        fileData: "x",
        remarks: "",
        agenda: "",
        attendance: "",
        minutes: "",
        decidedOn: "",
        createdAt: "2026-10-01T00:00:00.000Z",
        needsSupervisor: false,
        chain: ["dean", "vc"],
        steps: [],
        supervisorStatus: "",
        officeEntry: false,
      },
    ],
  });
  const body = {
    status: "Approved",
    remarks: "",
    decidedOn: "2026-10-29",
    minutes: "Minutes of the meeting",
  };
  signIn("dean");
  assert.equal((await doctoral.decideCommittee("c-1", body)).ok, true);
  assert.equal(doctoral.currentDoctoral().committees[0].status, "Submitted");
  assert.equal(doctoral.waitingStageOf(doctoral.currentDoctoral().committees[0]), "vc");
  signIn("vc");
  assert.equal((await doctoral.decideCommittee("c-1", body)).ok, true);
  assert.equal(doctoral.currentDoctoral().committees[0].status, "Approved");
  assert.equal(
    flow.committeeSummary(doctoral.currentDoctoral().committees[0]).label,
    "Approved by Vice Chancellor",
  );
});

await test("a scholar request goes through its stored steps (Dean, then Vice Chancellor)", async () => {
  const record = {
    id: "local-rec-1",
    kind: "leave",
    scholarIdentifier: "s@x.org",
    scholarName: "Scholar",
    status: "Submitted",
    payload: { chain: "dean,vc" },
    fileName: null,
    fileData: null,
    supervisorIdentifier: "",
    supervisorName: "",
    createdAt: "2026-10-01T00:00:00.000Z",
  };
  storage.setItem(storageKeys.scholarRecords, JSON.stringify([record]));
  const current = () => JSON.parse(storage.getItem(storageKeys.scholarRecords))[0];
  signIn("vc");
  assert.equal(
    await records.setScholarRecordStatus(record, "Approved"),
    false,
    "the Vice Chancellor waits for the Dean",
  );
  signIn("dean");
  assert.equal(await records.setScholarRecordStatus(record, "Approved"), true);
  assert.equal(current().status, "Submitted", "the Dean recommends");
  assert.ok(current().payload.deanOn);
  assert.equal(flow.recordSummary(current(), false).label, "Approved by Dean");
  signIn("vc");
  assert.equal(await records.setScholarRecordStatus(current(), "Approved"), true);
  assert.equal(current().status, "Approved");
  assert.equal(flow.recordSummary(current(), false).label, "Approved by Vice Chancellor");
});

await test("a scholar request with the supervisor's step: supervisor, then the Dean decides", async () => {
  const record = {
    id: "local-rec-2",
    kind: "leave",
    scholarIdentifier: "s@x.org",
    scholarName: "Scholar",
    status: "Submitted",
    payload: { chain: "supervisor,dean" },
    fileName: null,
    fileData: null,
    supervisorIdentifier: "guide@x.org",
    supervisorName: "Guide",
    createdAt: "2026-10-01T00:00:00.000Z",
  };
  storage.setItem(storageKeys.scholarRecords, JSON.stringify([record]));
  const current = () => JSON.parse(storage.getItem(storageKeys.scholarRecords))[0];
  signIn("dean");
  assert.equal(await records.setScholarRecordStatus(record, "Approved"), false);
  signIn("supervisor", "guide@x.org");
  assert.equal(await records.setScholarRecordStatus(record, "Supervisor approved"), true);
  assert.equal(current().status, "Supervisor approved");
  signIn("dean");
  assert.equal(await records.setScholarRecordStatus(current(), "Approved"), true);
  assert.equal(current().status, "Approved");
});

await test("a thesis follows its steps too, and a rejected one stays rejected", async () => {
  tick("thesis", { supervisor: false, dean: true, vc: true });
  await fresh({
    theses: [
      {
        id: "th-1",
        scholarIdentifier: "s@x.org",
        scholarName: "Scholar",
        title: "A title",
        domain: "A domain",
        checks: [],
        fileName: "t.pdf",
        fileData: "x",
        version: 1,
        versions: [],
        local: [],
        indian: [],
        foreign: [],
        status: "Submitted",
        remarks: "",
        decidedOn: "",
        createdAt: "2026-10-01T00:00:00.000Z",
        needsSupervisor: false,
        chain: ["dean", "vc"],
        steps: [],
        supervisorStatus: "",
      },
    ],
  });
  const body = { status: "Approved", remarks: "", decidedOn: "2026-10-29" };
  signIn("dean");
  assert.equal((await doctoral.decideThesis("th-1", body)).ok, true);
  assert.equal(doctoral.currentDoctoral().theses[0].status, "Submitted");
  signIn("vc");
  assert.equal(
    (
      await doctoral.decideThesis("th-1", {
        ...body,
        status: "Rejected",
        remarks: "Not ready.",
      })
    ).ok,
    true,
  );
  assert.equal(doctoral.currentDoctoral().theses[0].status, "Rejected");
  assert.equal(
    flow.submissionSummary(doctoral.currentDoctoral().theses[0]).label,
    "Rejected by Vice Chancellor",
  );
});

let racNumber = 0;
const proposal = (status = "Submitted") => ({
  id: `local-rac-${(racNumber += 1)}`,
  kind: "constitution",
  scholarIdentifier: "s@x.org",
  scholarName: "Scholar",
  supervisorIdentifier: "g@x.org",
  supervisorName: "Guide",
  status,
  nominees: ["internal-1", "external-1", "external-2"].map((key) => ({
    key,
    side: key.startsWith("internal") ? "internal" : "external",
    name: key,
    designation: "Prof",
    department: "",
    institution: "Univ",
    email: "a@b.org",
    phone: "9876543210",
    specialization: "x",
    address: "address here",
    publications: [],
  })),
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
  createdAt: "2026-10-01T00:00:00.000Z",
  officeEntry: false,
  enteredBy: "",
});
const selection = {
  status: "Approved",
  remarks: "",
  selectedInternal: "internal-1",
  selectedExternal: "external-1",
  agenda: "",
  attendance: "",
  minutes: "Minutes",
};
const racNow = () => JSON.parse(storage.getItem(storageKeys.racProposals))[0];

await test("RAC: Dean selects, then the Vice Chancellor approves (the usual steps)", async () => {
  rules.setApprovalRulesInMemory({});
  const item = proposal();
  storage.setItem(storageKeys.racProposals, JSON.stringify([item]));
  signIn("vc");
  assert.equal((await office.decideRac(item, selection)).ok, false);
  signIn("dean");
  assert.equal((await office.decideRac(item, selection)).ok, true);
  assert.equal(racNow().status, "With VC");
  signIn("vc");
  assert.equal(
    (await office.decideRacFinal(racNow(), { status: "Approved", remarks: "" })).ok,
    true,
  );
  assert.equal(racNow().status, "Approved");
});

await test("RAC with the Vice Chancellor unticked: the Dean's selection is final", async () => {
  tick("rac", { supervisor: true, dean: true, vc: false });
  const item = proposal();
  storage.setItem(storageKeys.racProposals, JSON.stringify([item]));
  signIn("dean");
  assert.equal((await office.decideRac(item, selection)).ok, true);
  assert.equal(racNow().status, "Approved");
});

await test("RAC with the Dean unticked: the Vice Chancellor selects the members and approves", async () => {
  tick("rac", { supervisor: true, dean: false, vc: true });
  const item = proposal();
  storage.setItem(storageKeys.racProposals, JSON.stringify([item]));
  signIn("dean");
  assert.match((await office.decideRac(item, selection)).message, /Vice Chancellor/);
  signIn("vc");
  assert.equal((await office.decideRac(item, selection)).ok, true);
  assert.equal(racNow().status, "Approved");
});

await test("a nomination already with the Vice Chancellor can be finished by the Dean once that step is off", async () => {
  tick("rac", { supervisor: true, dean: true, vc: false });
  const waiting = {
    ...proposal("With VC"),
    selectedInternal: "internal-1",
    selectedExternal: "external-1",
  };
  storage.setItem(storageKeys.racProposals, JSON.stringify([waiting]));
  signIn("dean");
  assert.equal(
    (await office.decideRacFinal(waiting, { status: "Approved", remarks: "" })).ok,
    true,
  );
  assert.equal(racNow().status, "Approved");
});

await test("the steps cannot be saved empty, and the RAC needs the Dean or the Vice Chancellor", () => {
  assert.match(
    rules.rulesProblem({ synopsis: { supervisor: false, dean: false, vc: false } }),
    /Synopsis: tick at least one step/,
  );
  assert.match(
    rules.rulesProblem({ rac: { supervisor: true, dean: false, vc: false } }),
    /Dean or the Vice Chancellor/,
  );
  assert.equal(rules.rulesProblem({}), null);
  assert.equal(rules.rulesProblem({ rac: { dean: false, vc: true } }), null);
});

/* ------------------------------------------ audit trail ------------------------------------ */
const auditLines = () => JSON.parse(storage.getItem(storageKeys.auditLog) ?? "[]");
const audit = load("@/lib/audit.ts");
const auditView = load("@/lib/audit-view.ts");

await test("the audit trail names who submitted and who decided a synopsis", async () => {
  storage.setItem(storageKeys.auditLog, "[]");
  rules.setApprovalRulesInMemory({});
  await fresh();
  signIn("scholar", "s@x.org");
  assert.equal((await submitSynopsis()).ok, true);
  signIn("staff");
  await decide(synopsisNow().id); // refused: the Dean decides
  signIn("dean", "dean@x.org");
  assert.equal((await decide(synopsisNow().id)).ok, true);
  const lines = auditLines();
  const submitted = lines.find((line) => line.action === "synopsis:submitted");
  assert.ok(submitted, "the submission is recorded");
  assert.equal(submitted.actorRole, "scholar");
  assert.equal(submitted.actorIdentifier, "s@x.org");
  assert.equal(submitted.subject, "s@x.org");
  const decided = lines.find((line) => /^synopsis:Approved$/.test(line.action));
  assert.ok(decided, "the approval is recorded");
  assert.equal(decided.actorRole, "dean");
  assert.equal(decided.actorIdentifier, "dean@x.org");
  assert.ok(
    !lines.some((line) => line.actorRole === "staff" && /approved/i.test(line.action)),
    "a refused decision leaves no approval behind",
  );
});

await test("a change that fails leaves no line; one that succeeds leaves one", async () => {
  storage.setItem(storageKeys.auditLog, "[]");
  signIn("admin", "admin");
  const ok = audit.withAudit(
    async (value) => ({ ok: value }),
    (value) => ({ action: "demo:changed", subject: String(value), detail: "d" }),
  );
  await ok(false);
  assert.equal(auditLines().length, 0);
  await ok(true);
  assert.equal(auditLines().length, 1);
  assert.equal(auditLines()[0].actorRole, "admin");
});

await test("the audit trail reads in words: module, kind of act, and who did what", () => {
  assert.equal(auditView.moduleLabel("rac:vc-approved"), "RAC");
  assert.equal(auditView.moduleLabel("auth:sign-in"), "Sign-in and passwords");
  assert.equal(auditView.actionLabel("record:Supervisor approved"), "Record · Supervisor approved");
  assert.equal(auditView.kindOf("synopsis:submitted"), "Submitted");
  assert.equal(auditView.kindOf("record:resubmitted"), "Submitted");
  assert.equal(auditView.kindOf("record:Approved"), "Approved");
  assert.equal(auditView.kindOf("record:recommended"), "Approved");
  assert.equal(auditView.kindOf("thesis:Rejected"), "Returned");
  assert.equal(auditView.kindOf("record:Returned"), "Returned");
  assert.equal(auditView.kindOf("auth:sign-in"), "Sign-in");
  assert.equal(auditView.kindOf("register:scholar-edited"), "Changed");
});

summary("chain");
