// Run: node tests/faculty-research.test.mjs
// Faculty publications and project proposals: the checks on a record, the audit lines, who may
// see and change the records, and the guards on the public page.
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const model = load("@/lib/faculty-research.ts");
const server = load("@/lib/faculty-research-server.ts");
const access = load("@/lib/access.ts");
const { decideDbRequest } = load("@/lib/db-policy.ts");
const body = load("@/lib/request-body.ts");
const { portalGroups } = load("@/data/portal.ts");
const report = load("@/lib/faculty-research-report.ts");

const today = "2026-11-03";
const person = {
  facultyName: "Dr. A. Kumar",
  designation: "Assistant Professor",
  department: "Chemistry",
  school: model.schoolNames[0],
  campus: "Muttom",
  mobile: "9876543210",
  dob: "1985-06-15",
};
const article = {
  ...person,
  type: "Journal article",
  title: "Green synthesis of nanoparticles",
  source: "Journal of Materials",
  indexing: ["Scopus", "Web of Science"],
  authorRole: "Corresponding author",
  authorPosition: "2",
  authorCount: "4",
  publishedOn: "2026-03-10",
  year: "2026",
  doi: "https://doi.org/10.1000/xyz123",
};

await test("a complete journal article is accepted and patent fields are dropped", () => {
  const result = model.cleanValues(
    "publication",
    { ...article, patentNumber: "X1", filedOn: "2026-01-01" },
    today,
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.values.patentNumber, undefined);
  assert.equal(result.values.filedOn, undefined);
  assert.deepEqual(result.values.indexing, ["Scopus", "Web of Science"]);
});

await test("missing and malformed fields are named, one message each", () => {
  const result = model.cleanValues(
    "publication",
    {
      ...article,
      title: "",
      mobile: "12345",
      year: "2025",
      authorCount: "1",
      link: "not a link",
    },
    today,
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.title);
  assert.ok(result.errors.mobile);
  assert.match(result.errors.year, /does not match/i);
  assert.match(result.errors.authorCount, /less than/i);
  assert.ok(result.errors.link);
});

await test("a mobile number with +91 or spaces is stored as ten digits", () => {
  const result = model.cleanValues(
    "publication",
    { ...article, mobile: "+91 98765 43210" },
    today,
  );
  assert.equal(result.ok, true);
  assert.equal(result.values.mobile, "9876543210");
});

await test("future dates and unknown options are refused; unknown fields are dropped", () => {
  const result = model.cleanValues(
    "publication",
    { ...article, publishedOn: "2027-01-01", year: "2027", type: "Blog" },
    today,
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.type);
  const ok = model.cleanValues("publication", { ...article, hacker: "<script>" }, today);
  assert.equal(ok.ok, true);
  assert.equal(ok.values.hacker, undefined);
});

await test("a patent needs its number, status and filing date; a granted one its grant date", () => {
  const patent = {
    ...person,
    type: "Patent",
    title: "A sensor",
    authorRole: "First author",
    authorPosition: "1",
    authorCount: "2",
    year: "2025",
  };
  const missing = model.cleanValues("publication", patent, today);
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.patentNumber && missing.errors.patentStatus);
  assert.ok(missing.errors.filedOn);
  assert.equal(missing.errors.source, undefined, "no journal name for a patent");
  const filed = { ...patent, patentNumber: "IN123", filedOn: "2025-02-01" };
  const granted = model.cleanValues(
    "publication",
    { ...filed, patentStatus: "Granted" },
    today,
  );
  assert.ok(granted.errors?.grantedOn);
  const done = model.cleanValues(
    "publication",
    { ...filed, patentStatus: "Granted", grantedOn: "2026-01-05" },
    today,
  );
  assert.equal(done.ok, true, JSON.stringify(done.errors));
  assert.equal(model.recordDate("publication", done.values), "2025-02-01");
});

const proposal = {
  ...person,
  projectTitle: "Water quality of the Tamirabarani",
  agency: "DST",
  amountProposed: "15,00,000",
  submittedOn: "2025-04-01",
  status: "Submitted",
};

await test("a submitted proposal needs no funding details; an accepted one does", () => {
  const sent = model.cleanValues(
    "proposal",
    { ...proposal, amountSanctioned: "5" },
    today,
  );
  assert.equal(sent.ok, true, JSON.stringify(sent.errors));
  assert.equal(sent.values.amountProposed, "1500000");
  assert.equal(sent.values.amountSanctioned, undefined, "hidden funding field dropped");
  const accepted = model.cleanValues(
    "proposal",
    { ...proposal, status: "Accepted" },
    today,
  );
  assert.equal(accepted.ok, false);
  assert.ok(accepted.errors.amountSanctioned && accepted.errors.sanctionedOn);
});

await test("instalments add up to the amount received and leave the balance", () => {
  const result = model.cleanValues(
    "proposal",
    {
      ...proposal,
      status: "Accepted",
      amountSanctioned: "1000000",
      sanctionedOn: "2025-06-01",
      bankAccountNo: "123456789012",
      instalments: [
        { amount: "400000", receivedOn: "2025-07-01" },
        { amount: "", receivedOn: "" },
        { amount: "250000", receivedOn: "2025-12-01" },
      ],
      settlement: "Open",
    },
    today,
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.values.instalments.length, 2, "empty rows dropped");
  assert.equal(model.receivedTotal(result.values), 650000);
  assert.equal(model.balanceOf(result.values), 350000);
  assert.equal(model.fundingStage(result.values), "Instalments");
});

await test("instalments above the sanction, or before it, are refused", () => {
  const base = {
    ...proposal,
    status: "Accepted",
    amountSanctioned: "100",
    sanctionedOn: "2025-06-01",
  };
  const over = model.cleanValues(
    "proposal",
    { ...base, instalments: [{ amount: "200", receivedOn: "2025-07-01" }] },
    today,
  );
  assert.match(over.errors.instalments, /more than/);
  const early = model.cleanValues(
    "proposal",
    { ...base, instalments: [{ amount: "50", receivedOn: "2025-05-01" }] },
    today,
  );
  assert.match(early.errors.instalments, /before the sanction/);
});

await test("'Other' agency asks for the agency name", () => {
  const result = model.cleanValues("proposal", { ...proposal, agency: "Other" }, today);
  assert.ok(result.errors.agencyOther);
  const named = model.cleanValues(
    "proposal",
    { ...proposal, agency: "Other", agencyOther: "Tata Trust" },
    today,
  );
  assert.equal(model.agencyOf(named.values), "Tata Trust");
});

await test("the audit line names each changed field and hides the account number", () => {
  const lines = model.describeChanges(
    "proposal",
    { ...proposal, status: "Submitted" },
    { ...proposal, status: "Accepted", bankAccountNo: "123456789012" },
  );
  assert.ok(lines.includes("Status: Submitted → Accepted"));
  const account = lines.find((line) => line.startsWith("Bank account number"));
  assert.ok(account && !account.includes("123456789012") && account.endsWith("9012"));
  assert.deepEqual(model.describeChanges("proposal", proposal, { ...proposal }), []);
});

await test("the public look-up shows only the last four digits of the account", () => {
  const copy = server.publicCopy({
    id: "1",
    kind: "proposal",
    createdAt: "",
    updatedAt: "",
    source: "public",
    ownerRole: "scholar",
    ownerIdentifier: "a@b.c",
    values: { bankAccountNo: "123456789012" },
  });
  assert.ok(copy.values.bankAccountNo.endsWith("9012"));
  assert.ok(!copy.values.bankAccountNo.includes("5678"));
  assert.equal(copy.ownerIdentifier, "");
});

await test("the administrator and the Dean see every record; staff only with the menu", () => {
  const see = (session, kind = "publication") => server.researchAccess(session, kind);
  assert.deepEqual(see({ role: "admin", identifier: "admin", menus: null }), {
    scope: "all",
    edit: true,
  });
  const dean = see(
    { role: "dean", identifier: "d@x", menus: ["/admin/dashboard"] },
    "proposal",
  );
  assert.equal(dean.scope, "all");
  const staff = see({
    role: "staff",
    identifier: "s@x",
    menus: ["/admin/dashboard", "/rights#v2"],
  });
  assert.equal(staff.scope, null);
  const granted = see({
    role: "staff",
    identifier: "s@x",
    menus: [
      "/admin/dashboard",
      "/admin/faculty-publications",
      "/admin/faculty-publications#edit",
      "/rights#v2",
    ],
  });
  assert.deepEqual(granted, { scope: "all", edit: true });
  const viewOnly = see({
    role: "staff",
    identifier: "s@x",
    menus: ["/admin/dashboard", "/admin/faculty-publications", "/rights#v2"],
  });
  assert.deepEqual(viewOnly, { scope: "all", edit: false });
  assert.equal(see({ role: "vc", identifier: "vc@x", menus: null }).scope, null);
  assert.deepEqual(see({ role: "supervisor", identifier: "f@x", menus: null }), {
    scope: "own",
    edit: true,
  });
  assert.equal(see({ role: "scholar", identifier: "s@x", menus: null }).scope, null);
  assert.deepEqual(see(null), { scope: null, edit: false });
});

await test("the Dean always has both menus with export, and can open the pages", () => {
  const menus = access.resolvedMenus({
    role: "dean",
    identifier: "d",
    menus: ["/admin/dashboard", "/rights#v2"],
  });
  for (const href of access.deanStandingHrefs) {
    assert.ok(menus.includes(href));
    assert.ok(menus.includes(`${href}#export`));
    assert.ok(access.canOpenMenu(href, "dean", menus));
  }
  const staff = access.resolvedMenus({
    role: "staff",
    identifier: "s",
    menus: ["/admin/dashboard"],
  });
  assert.ok(!staff.includes("/admin/project-proposals"));
});

await test("the menus are in the office and faculty (supervisor) side bars, not the scholar's", () => {
  const hrefs = (role) =>
    portalGroups[role].flatMap((group) => group.items.map((item) => item.href));
  assert.ok(hrefs("admin").includes("/admin/faculty-publications"));
  assert.ok(hrefs("dean").includes("/admin/project-proposals"));
  assert.ok(!hrefs("scholar").some((href) => href.includes("faculty-publications")));
  assert.ok(hrefs("supervisor").includes("/supervisor/project-proposals"));
});

await test("nobody reaches the records table through /api/db", () => {
  const actors = [
    null,
    { role: "admin", identifier: "admin" },
    { role: "scholar", identifier: "s@x" },
  ];
  for (const actor of actors) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const decision = decideDbRequest({
        method,
        path: "rest/v1/faculty_research_records",
        query: new URLSearchParams(method === "GET" ? "select=*" : "id=eq.1"),
        prefer: "",
        actor,
        body: method === "GET" || method === "DELETE" ? undefined : {},
      });
      assert.ok(
        decision.action === "deny" || decision.action === "empty",
        `${actor?.role ?? "visitor"} ${method}: ${decision.action}`,
      );
    }
  }
});

await test("a request body that is too large, not JSON or not an object is refused", async () => {
  const make = (text) => new Request("http://x/api", { method: "POST", body: text });
  assert.equal(await body.readBody(make("x".repeat(30_000))), null);
  assert.equal(await body.readBody(make("not json")), null);
  assert.equal(await body.readBody(make("[1,2]")), null);
  assert.deepEqual(await body.readBody(make('{"a":1}')), { a: 1 });
});

await test("a form posted from another website is refused", () => {
  const request = (origin) =>
    new Request("http://erp.test/api", {
      method: "POST",
      headers: { host: "erp.test", ...(origin ? { origin } : {}) },
    });
  assert.equal(body.sameOrigin(request("http://erp.test")), true);
  assert.equal(body.sameOrigin(request("https://evil.example")), false);
  assert.equal(body.sameOrigin(request(null)), true);
});

await test("India's date is used for the checks", () => {
  assert.equal(server.indiaToday(Date.parse("2026-11-03T20:00:00Z")), "2026-11-04");
});

const rec = (kind, values) => ({
  id: Math.random().toString(36),
  kind,
  createdAt: "",
  updatedAt: "",
  source: "public",
  ownerRole: "public",
  ownerIdentifier: "",
  values,
});

await test("only faculty designations are offered", () => {
  assert.ok(!model.designations.some((item) => /student|scholar/i.test(item)));
});

await test("cross report: department by year counts, with row and column totals", () => {
  const records = [
    rec("publication", { department: "Chemistry", year: "2025", type: "Book" }),
    rec("publication", { department: "Chemistry", year: "2026", type: "Book" }),
    rec("publication", { department: "Physics", year: "2026", type: "Patent" }),
  ];
  const dims = report.reportDimensions("publication");
  const dim = (id) => dims.find((item) => item.id === id);
  const table = report.crossReport(
    records,
    [dim("department")],
    dim("year"),
    report.reportMeasures("publication")[0],
  );
  assert.deepEqual(table.headers, ["Department", "2025", "2026", "Total"]);
  assert.deepEqual(table.rows, [
    ["Chemistry", "1", "1", "2"],
    ["Physics", "0", "1", "1"],
    ["Total", "1", "2", "3"],
  ]);
  assert.match(table.title, /Department × Year/);
});

await test("cross report: two row fields, no column field, and a multi-valued field", () => {
  const records = [
    rec("publication", {
      school: "S1",
      department: "D1",
      indexing: ["Scopus", "PubMed"],
    }),
    rec("publication", { school: "S1", department: "D2", indexing: [] }),
  ];
  const dims = report.reportDimensions("publication");
  const dim = (id) => dims.find((item) => item.id === id);
  const table = report.crossReport(
    records,
    [dim("school"), dim("department")],
    dim("indexing"),
    report.reportMeasures("publication")[0],
  );
  assert.deepEqual(table.headers, [
    "School",
    "Department",
    "Not indexed",
    "PubMed",
    "Scopus",
    "Total",
  ]);
  assert.deepEqual(table.rows.at(-1), ["Total", "", "1", "1", "1", "2"]);
  const flat = report.crossReport(
    records,
    [dim("school")],
    null,
    report.reportMeasures("publication")[0],
  );
  assert.deepEqual(flat.headers, ["School", "Number of records"]);
  assert.deepEqual(flat.rows, [
    ["S1", "2"],
    ["Total", "2"],
  ]);
});

await test("cross report: proposal amounts count only accepted projects for sanction", () => {
  const records = [
    rec("proposal", {
      agency: "DST",
      status: "Accepted",
      amountProposed: "100",
      amountSanctioned: "80",
      instalments: [{ amount: "30", receivedOn: "2025-01-01" }],
    }),
    rec("proposal", {
      agency: "DST",
      status: "Rejected",
      amountProposed: "50",
      amountSanctioned: "50",
    }),
    rec("proposal", {
      agency: "Other",
      agencyOther: "Tata Trust",
      status: "Submitted",
      amountProposed: "20",
    }),
  ];
  const dims = report.reportDimensions("proposal");
  const measure = (id) =>
    report.reportMeasures("proposal").find((item) => item.id === id);
  const agency = dims.find((item) => item.id === "agency");
  const sanctioned = report.crossReport(records, [agency], null, measure("sanctioned"));
  assert.deepEqual(sanctioned.rows, [
    ["DST", "₹80"],
    ["Tata Trust", "₹0"],
    ["Total", "₹80"],
  ]);
  const balance = report.crossReport(records, [agency], null, measure("balance"));
  assert.equal(balance.rows.at(-1)[1], "₹50");
});

const sheet = load("@/lib/faculty-research-import.ts");

await test("titles, DOIs and patent numbers are compared without case, spaces or punctuation", () => {
  const a = model.duplicateKeys("publication", {
    title: "Green Synthesis of Nano-particles!",
    doi: "https://doi.org/10.1000/XYZ123",
    type: "Journal article",
  });
  const b = model.duplicateKeys("publication", {
    title: "green synthesis of nanoparticles",
    doi: "10.1000/xyz123",
    type: "Journal article",
  });
  assert.equal(a.title, b.title);
  assert.equal(a.doi, b.doi);
  assert.equal(a.patent, "", "no patent key for an article");
  const patent = model.duplicateKeys("publication", {
    title: "A sensor",
    type: "Patent",
    patentNumber: "IN 2024/41-0012",
  });
  assert.equal(patent.patent, "in2024410012");
  const proposal = model.duplicateKeys("proposal", { projectTitle: "Water  Quality" });
  assert.deepEqual(proposal, { title: "waterquality", doi: "", patent: "" });
  assert.equal(model.duplicateField("proposal", "title"), "projectTitle");
  assert.equal(model.duplicateField("publication", "patent"), "patentNumber");
});

await test("the saved personal details are the seven identity fields only", () => {
  const identity = model.identityOf({ ...article });
  assert.deepEqual(
    Object.keys(identity),
    model.identityFields.map((field) => field.key),
  );
  assert.equal(identity.title, undefined);
});

await test("sheet dates in the usual Indian forms are read, birth years in the 1900s", () => {
  assert.equal(sheet.sheetDate("10-03-2026"), "2026-03-10");
  assert.equal(sheet.sheetDate("10/3/26"), "2026-03-10");
  assert.equal(sheet.sheetDate("10 Mar 2026"), "2026-03-10");
  assert.equal(sheet.sheetDate("2026-03-10"), "2026-03-10");
  assert.equal(sheet.sheetDate("15/06/85", true), "1985-06-15");
  assert.deepEqual(
    sheet.sheetInstalments("4,00,000 on 01-07-2025; 250000 @ 2025-12-01"),
    [
      { amount: "400000", receivedOn: "2025-07-01" },
      { amount: "250000", receivedOn: "2025-12-01" },
    ],
  );
});

await test("a sheet with the blank-sheet headings becomes valid records", () => {
  const headers = sheet.templateHeaders("publication");
  const map = sheet.columnMap("publication", headers);
  assert.equal(
    map.size,
    headers.length,
    "every heading of the blank sheet is understood",
  );
  const label = (key) =>
    headers[model.allFields("publication").findIndex((f) => f.key === key)];
  const row = {
    [label("facultyName")]: "Dr. A. Kumar",
    [label("designation")]: "assistant professor",
    [label("department")]: "Chemistry",
    [label("school")]: model.schoolNames[0],
    [label("campus")]: "muttom",
    [label("mobile")]: "98765 43210",
    [label("dob")]: "15/06/1985",
    [label("type")]: "journal article",
    [label("title")]: "Green synthesis",
    [label("source")]: "Journal of Materials",
    [label("indexing")]: "Scopus; web of science",
    [label("authorRole")]: "First author",
    [label("authorPosition")]: "1",
    [label("authorCount")]: "3",
    [label("publishedOn")]: "10-03-2026",
  };
  const values = sheet.rowValues("publication", row, map);
  assert.equal(values.year, "2026", "year taken from the date");
  assert.deepEqual(values.indexing, ["Scopus", "Web of Science"]);
  const checked = model.cleanValues("publication", values, today);
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  assert.equal(checked.values.designation, "Assistant Professor");
  assert.equal(checked.values.dob, "1985-06-15");
});

await test("the office's own headings are understood (Faculty name, Journal name, DOB)", () => {
  const map = sheet.columnMap("publication", [
    "S.No",
    "Faculty Name",
    "Journal Name",
    "DOB",
    "Mobile No",
    "Indexed in",
  ]);
  assert.equal(map.get("facultyName"), "Faculty Name");
  assert.equal(map.get("source"), "Journal Name");
  assert.equal(map.get("dob"), "DOB");
  assert.equal(map.get("mobile"), "Mobile No");
  assert.equal(map.get("indexing"), "Indexed in");
  assert.ok(![...map.values()].includes("S.No"));
});

await test("an office sign-in uploads only with the Upload right; the administrator always", () => {
  assert.ok(
    access.actionsForMenu("/admin/faculty-publications", "staff").includes("upload"),
  );
  const staff = {
    role: "staff",
    identifier: "s",
    menus: ["/admin/faculty-publications", "/rights#v2"],
  };
  assert.equal(
    access.canMenuAction(staff, "/admin/faculty-publications", "upload"),
    false,
  );
  const granted = {
    ...staff,
    menus: [...staff.menus, "/admin/faculty-publications#upload"],
  };
  assert.equal(
    access.canMenuAction(granted, "/admin/faculty-publications", "upload"),
    true,
  );
});

const lists = load("@/lib/checklists.ts");
const evidence = load("@/lib/faculty-evidence.ts");
const incentives = load("@/lib/faculty-incentives.ts");

await test("checklists: until saved, the lists written in the code are used unchanged", () => {
  assert.equal(
    lists.checklistItems("admission").length,
    lists.checklistCatalog.admission.defaults.length,
  );
  assert.ok(lists.checklistTitles("synopsis").includes("Fees are paid"));
  assert.ok(lists.checklistItems("application").every((item) => item.title));
});

await test("checklists: the administrator adds, renames, makes optional and deletes items", () => {
  const base = lists.checklistCatalog.admission.defaults;
  const edited = [
    { ...base[0], title: "Photographs (5)" },
    { ...base[1], required: false },
    { id: "", title: "Aadhaar card", required: true },
  ];
  const check = lists.cleanChecklist("admission", edited);
  assert.equal(check.ok, true, check.message);
  assert.equal(check.items[0].id, base[0].id, "renaming keeps the id");
  assert.equal(check.items[1].required, false);
  assert.equal(check.items[2].id, "aadhaar-card");
  lists.applyChecklists({ admission: check.items });
  assert.equal(lists.checklistItems("admission").length, 3);
  lists.applyChecklists({});
  assert.equal(
    lists.checklistItems("admission").length,
    base.length,
    "back to the list in the code",
  );
});

await test("checklists: empty titles, repeats and removing an item the ERP reads are refused", () => {
  assert.equal(lists.cleanChecklist("admission", [{ title: "" }]).ok, false);
  assert.equal(
    lists.cleanChecklist("admission", [{ title: "A" }, { title: "a" }]).ok,
    false,
  );
  assert.equal(lists.cleanChecklist("admission", []).ok, false);
  const defaults = lists.checklistCatalog.synopsis.defaults;
  const refused = lists.cleanChecklist(
    "synopsis",
    defaults.filter((item) => !item.locked),
  );
  assert.equal(refused.ok, false);
  assert.match(refused.message, /cannot be removed/);
  const optional = defaults.map((item) => ({ ...item, required: false }));
  assert.equal(
    lists.cleanChecklist("synopsis", optional).ok,
    true,
    "it may be made optional",
  );
});

await test("checklists: plagiarism completeness needs only the mandatory items", () => {
  const items = lists.checklistCatalog.thesis.defaults.map((item, at) => ({
    ...item,
    required: at < 2,
  }));
  lists.applyChecklists({ thesis: items });
  assert.deepEqual(
    lists.checklistTitles("thesis", true),
    items.slice(0, 2).map((item) => item.title),
  );
  lists.applyChecklists({});
});

const evidenceRef =
  "/api/files/research/2026-11/0b1d2c3e-1111-4222-8333-944445555666.pdf";

await test("evidence: the files asked for follow the type or status; mandatory ones must be uploaded", () => {
  const items = lists.checklistCatalog["publication-evidence"].defaults;
  const journal = { type: "Journal article" };
  assert.deepEqual(
    evidence.evidenceItemsFor("publication", journal, items).map((item) => item.id),
    ["first-page", "indexing-proof"],
  );
  assert.deepEqual(evidence.missingEvidence("publication", journal, items), [
    "First page of the publication",
  ]);
  const done = { ...journal, evidence: { "first-page": evidenceRef } };
  assert.deepEqual(evidence.missingEvidence("publication", done, items), []);
  assert.deepEqual(evidence.missingEvidence("publication", { type: "Patent" }, items), [
    "Patent filing receipt or grant certificate",
  ]);
  const proposalItems = lists.checklistCatalog["proposal-evidence"].defaults;
  assert.equal(
    evidence.missingEvidence("proposal", { status: "Accepted" }, proposalItems).length,
    2,
  );
  assert.equal(
    evidence.missingEvidence("proposal", { status: "Submitted" }, proposalItems).length,
    1,
  );
});

await test("evidence: only references to files stored by the ERP are kept with a record", () => {
  const kept = model.evidenceOf({
    evidence: {
      "first-page": evidenceRef,
      bad: "https://evil.example/x.pdf",
      other: evidenceRef.replace("/research/", "/applications/"),
      "Bad Id": evidenceRef,
    },
  });
  assert.deepEqual(kept, { "first-page": evidenceRef });
  const withFile = { ...article, evidence: { "first-page": evidenceRef } };
  const cleaned = model.cleanValues("publication", withFile, today);
  assert.deepEqual(cleaned.values.evidence, { "first-page": evidenceRef });
  assert.ok(
    model
      .describeChanges("publication", article, withFile)
      .includes("Evidence first-page: uploaded"),
  );
});

const pub = (values) => ({
  id: "r1",
  kind: "publication",
  createdAt: "",
  updatedAt: "",
  source: "",
  ownerRole: "",
  ownerIdentifier: "",
  values,
});

await test("incentives: the academic year runs from June to May", () => {
  assert.equal(incentives.academicYearOf("2026-06-01"), "2026-27");
  assert.equal(incentives.academicYearOf("2026-05-31"), "2025-26");
  assert.equal(incentives.academicYearOf("1999-12-01"), "1999-00");
  assert.equal(incentives.nextAcademicYear("2026-27"), "2027-28");
  assert.ok(incentives.isAcademicYear("2026-27"));
  assert.ok(!incentives.isAcademicYear("2026-28"));
});

await test("incentives: policy amounts for SCI (by impact factor), Scopus, books and patents", () => {
  const rules = incentives.policyRules;
  const amount = (values) => incentives.computeIncentive(pub(values), rules).amount;
  const sci = (position, impactFactor) =>
    amount({
      type: "Journal article",
      indexing: ["Web of Science", "Scopus"],
      impactFactor,
      authorPosition: String(position),
    });
  assert.equal(sci(1, "4.5"), 10000);
  assert.equal(sci(2, "3"), 6000);
  assert.equal(sci(4, "1.2"), 2000);
  assert.equal(sci(1, "0.8"), 2500, "below IF 1 the Scopus rate applies");
  assert.equal(
    amount({ type: "Book chapter", indexing: ["Scopus"], authorPosition: "3" }),
    1500,
  );
  assert.equal(
    amount({ type: "Journal article", indexing: ["Scopus"], authorPosition: "5" }),
    0,
  );
  assert.equal(
    amount({ type: "Journal article", indexing: ["UGC-CARE"], authorPosition: "1" }),
    0,
  );
  assert.equal(amount({ type: "Book", isbnIssn: "978-1" }), 5000);
  assert.equal(amount({ type: "Patent", patentStatus: "Filed" }), 0);
  assert.equal(amount({ type: "Patent", patentStatus: "Granted" }), 5000);
  assert.equal(
    amount({ type: "Conference proceedings", indexing: ["Scopus"], authorPosition: "1" }),
    0,
  );
});

await test("incentives: a patent counts in the year of its grant, a paper in its publication year", () => {
  assert.equal(
    incentives.incentiveDate({
      type: "Patent",
      grantedOn: "2027-01-10",
      filedOn: "2025-01-01",
    }),
    "2027-01-10",
  );
  assert.equal(
    incentives.incentiveDate({ type: "Journal article", publishedOn: "2026-07-01" }),
    "2026-07-01",
  );
});

await test("incentives: approval stops at the yearly ceiling of the cadre", () => {
  assert.deepEqual(incentives.approvable(5000, 20000, 0), {
    amount: 5000,
    remaining: 20000,
    capped: false,
  });
  assert.deepEqual(incentives.approvable(5000, 20000, 18000), {
    amount: 2000,
    remaining: 2000,
    capped: true,
  });
  assert.equal(incentives.approvable(5000, 20000, 20000).amount, 0);
  assert.equal(
    incentives.approvable(5000, 0, 0).amount,
    0,
    "no ceiling set: nothing approved",
  );
});

await test("incentives: saved rules are cleaned and every cell is present", () => {
  const rules = incentives.cleanRules({
    sci: [[1, 2]],
    scopus: ["-5", "abc"],
    ceilings: { Professor: "30000", Hacker: 1 },
  });
  assert.equal(rules.sci.length, 4);
  assert.equal(rules.sci[0][0], 1);
  assert.equal(rules.sci[0][2], 5000, "missing cells take the policy rate");
  assert.equal(rules.scopus[0], 0, "negative or unreadable amounts become 0");
  assert.equal(rules.ceilings.Professor, 30000);
  assert.equal(rules.ceilings.Hacker, undefined);
  assert.equal(rules.ceilings["Assistant Professor"], 0);
});

await test("the Dean corrects records and processes incentives; Checklists stays with the administrator", () => {
  const dean = server.researchAccess(
    { role: "dean", identifier: "d", menus: ["/admin/dashboard"] },
    "publication",
  );
  assert.deepEqual(dean, { scope: "all", edit: true });
  const menus = access.resolvedMenus({
    role: "dean",
    identifier: "d",
    menus: ["/admin/dashboard"],
  });
  assert.ok(menus.includes("/admin/faculty-incentives"));
  const hrefs = (role) =>
    portalGroups[role].flatMap((group) => group.items.map((item) => item.href));
  assert.ok(!hrefs("dean").includes("/admin/checklists"));
  assert.ok(hrefs("admin").includes("/admin/checklists"));
});

const groupOf = (role, href) =>
  portalGroups[role].find((group) => group.items.some((item) => item.href === href))
    ?.heading;

await test("menus: the RAC sits under Doctoral progress, first, for the office and the supervisor", () => {
  assert.equal(groupOf("admin", "/admin/rac"), "Doctoral progress");
  assert.equal(groupOf("supervisor", "/supervisor/rac"), "Doctoral progress");
  assert.equal(groupOf("scholar", "/scholar/rac"), "Doctoral progress");
  const doctoral = portalGroups.admin.find(
    (group) => group.heading === "Doctoral progress",
  );
  assert.equal(doctoral.items[0].href, "/admin/rac");
  const supervision = portalGroups.admin.find((group) => group.heading === "Supervision");
  assert.ok(!supervision.items.some((item) => item.href === "/admin/rac"));
});

await test("menus: office modules follow the work, admission first and administration last", () => {
  const order = portalGroups.admin.map((group) => group.heading).filter(Boolean);
  const at = (heading) => order.indexOf(heading);
  assert.ok(at("Admissions") < at("Registers"));
  assert.ok(at("Registers") < at("Supervision"));
  assert.ok(at("Examination") < at("Doctoral progress"));
  assert.ok(at("Doctoral progress") < at("Requests"));
  assert.equal(order.at(-1), "Administration");
  const admissions = portalGroups.admin.find((group) => group.heading === "Admissions");
  const hrefs = admissions.items.map((item) => item.href);
  assert.ok(
    hrefs.indexOf("/admin/entrance-invigilation") < hrefs.indexOf("/admin/admission"),
  );
});

await test("menus: every office menu is still there once, after the reorder", () => {
  const hrefs = portalGroups.admin.flatMap((group) =>
    group.items.map((item) => item.href),
  );
  assert.equal(new Set(hrefs).size, hrefs.length, "no menu twice");
  for (const href of [
    "/admin/rac",
    "/admin/allocations",
    "/admin/promotions",
    "/admin/helpdesk",
  ])
    assert.ok(hrefs.includes(href), href);
});

await test("Scholar register: Scholar information (search) and Scholar list (with entering)", () => {
  const { menuSections } = load("@/data/menu-sections.ts");
  assert.deepEqual(menuSections["/admin/register"], [
    { id: "register", label: "Scholar information" },
    { id: "entry", label: "Scholar list" },
  ]);
});

await test("joining SJU: work dated before the joining date is refused", () => {
  const before = model.cleanValues(
    "publication",
    { ...article, joinedOn: "2026-04-01", publishedOn: "2026-03-10", year: "2026" },
    today,
  );
  assert.equal(before.ok, false);
  assert.match(
    before.errors.publishedOn,
    /Before your date of joining SJU \(01-04-2026\)/,
  );
  const after = model.cleanValues(
    "publication",
    { ...article, joinedOn: "2020-06-01" },
    today,
  );
  assert.equal(after.ok, true, JSON.stringify(after.errors));
  const proposalBefore = model.cleanValues(
    "proposal",
    { ...proposal, joinedOn: "2025-05-01" },
    today,
  );
  assert.match(proposalBefore.errors.submittedOn, /Before your date of joining/);
  const future = model.cleanValues(
    "publication",
    { ...article, joinedOn: "2027-01-01" },
    today,
  );
  assert.match(future.errors.joinedOn, /future/);
});

await test("faculty must give the joining date and confirm the university affiliation", () => {
  const missing = model.facultyChecks("publication", { ...article });
  assert.ok(missing.joinedOn && missing.sjuAffiliation);
  const done = model.facultyChecks("publication", {
    ...article,
    joinedOn: "2020-06-01",
    sjuAffiliation: "Yes",
    email: "kumar@sju.ac.in",
  });
  assert.deepEqual(done, {});
  assert.equal(
    model.facultyChecks("proposal", { ...proposal, joinedOn: "2020-01-01" })
      .sjuAffiliation,
    undefined,
  );
  const ticked = model.cleanValues(
    "publication",
    { ...article, sjuAffiliation: "true" },
    today,
  );
  assert.equal(ticked.values.sjuAffiliation, "Yes");
  const unticked = model.cleanValues(
    "publication",
    { ...article, sjuAffiliation: "no" },
    today,
  );
  assert.equal(unticked.values.sjuAffiliation, "");
});

await test("the sheet upload reads the joining date and the affiliation", () => {
  const map = sheet.columnMap("publication", ["DOJ", "Affiliation"]);
  assert.equal(map.get("joinedOn"), "DOJ");
  assert.equal(map.get("sjuAffiliation"), "Affiliation");
  const values = sheet.rowValues(
    "publication",
    { DOJ: "01-06-2015", Affiliation: "yes" },
    map,
  );
  assert.equal(values.joinedOn, "2015-06-01");
  assert.equal(values.sjuAffiliation, "Yes");
});

const dashboard = load("@/lib/faculty-dashboard.ts");
const rec2 = (kind, values, approvedAt = null) => ({
  id: Math.random().toString(36),
  kind,
  createdAt: "",
  updatedAt: "",
  source: "public",
  ownerRole: "public",
  ownerIdentifier: "",
  values,
  approvedAt,
});

await test("faculty page: counts by year and by kind, and filters that show the records behind them", () => {
  const records = [
    rec2(
      "publication",
      { type: "Journal article", year: "2025", indexing: ["Scopus"] },
      "2026-01-01",
    ),
    rec2("publication", {
      type: "Journal article",
      year: "2026",
      indexing: ["Scopus", "Web of Science"],
    }),
    rec2("publication", { type: "Patent", year: "2026" }),
    rec2("proposal", {
      submittedOn: "2026-02-01",
      status: "Accepted",
      amountSanctioned: "500000",
    }),
  ];
  const summary = dashboard.facultySummary(records);
  assert.equal(summary.publications, 3);
  assert.equal(summary.proposals, 1);
  assert.equal(summary.sanctioned, 500000);
  assert.equal(summary.approved, 1);
  assert.equal(summary.waiting, 3);
  assert.deepEqual(
    summary.bars.map((bar) => [bar.year, bar.total]),
    [
      ["2025", 1],
      ["2026", 3],
    ],
  );
  assert.equal(summary.busiest, 3);
  assert.equal(summary.byIndexing.find((item) => item.label === "Scopus").count, 2);
  const scopus2026 = dashboard.filterRecords(records, {
    year: "2026",
    category: { kind: "indexing", value: "Scopus" },
  });
  assert.equal(scopus2026.length, 1);
  assert.equal(
    dashboard.filterRecords(records, { year: "", category: { kind: "approved" } }).length,
    1,
  );
  assert.equal(
    dashboard.filterRecords(records, { year: "", category: { kind: "proposals" } })
      .length,
    1,
  );
  assert.equal(dashboard.filterRecords(records, dashboard.allRecords).length, 4);
});

await test("approval: a record shows Checked & Approved once the Dean or the administrator approves it", () => {
  assert.equal(model.approvedLabel, "Checked & Approved");
  assert.equal(model.isApproved({ approvedAt: "2026-11-03T10:00:00Z" }), true);
  assert.equal(model.isApproved({ approvedAt: null }), false);
  const copy = server.publicCopy(
    rec2("publication", { title: "x" }, "2026-11-03T10:00:00Z"),
  );
  assert.equal(copy.approvedAt, "2026-11-03T10:00:00Z", "faculty see the approval");
});

const linkCheck = load("@/lib/link-check.ts");

await test("link check: the server never follows a link to its own or a private network", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(linkCheck.isPrivateAddress(address), true, address);
  for (const address of ["8.8.8.8", "142.250.183.14", "2606:4700:4700::1111"])
    assert.equal(linkCheck.isPrivateAddress(address), false, address);
});

await test("link check: malformed links and DOIs are refused without going online", async () => {
  assert.equal((await linkCheck.checkLink("ftp://example.org/x")).status, "missing");
  assert.equal((await linkCheck.checkLink("http://localhost/admin")).status, "missing");
  assert.equal((await linkCheck.checkLink("http://192.168.0.1/")).status, "missing");
  assert.equal(
    (await linkCheck.checkLink("https://user:pw@example.org/")).status,
    "missing",
  );
  assert.equal(
    (await linkCheck.checkLink("https://example.org:8080/")).status,
    "missing",
  );
  assert.equal((await linkCheck.checkDoi("not-a-doi")).status, "missing");
});

await test("home page speed: an office save of the window or the news clears the public cache", () => {
  const { touchesPublicSite } = load("@/lib/public-site.ts");
  assert.equal(touchesPublicSite("rest/v1/site_settings", {}), true);
  assert.equal(touchesPublicSite("/rest/v1/news_board/", {}), true);
  assert.equal(
    touchesPublicSite("rest/v1/rpc/save_json_blob", { p_table: "news_board" }),
    true,
  );
  assert.equal(
    touchesPublicSite("rest/v1/rpc/save_json_blob", { p_table: "exam_office" }),
    false,
  );
  assert.equal(touchesPublicSite("rest/v1/scholar_records", {}), false);
});

await test("HTTPS only: live answers carry HSTS and plain-http requests are sent to https", async () => {
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const config = load("@/next.config.ts").default;
  const headers = (await config.headers())[0].headers;
  const hsts = headers.find((item) => item.key === "Strict-Transport-Security");
  assert.ok(
    hsts && /max-age=63072000/.test(hsts.value) && /includeSubDomains/.test(hsts.value),
  );
  const redirect = (await config.redirects()).find((item) =>
    item.destination.startsWith("https://"),
  );
  assert.ok(redirect, "an http → https redirect exists");
  assert.equal(redirect.permanent, true);
  assert.ok(
    redirect.has.some(
      (item) => item.key === "x-forwarded-proto" && item.value === "http",
    ),
  );
  const host = new RegExp(`^${redirect.has.find((item) => item.type === "host").value}$`);
  assert.ok(host.test("research.sju.ac.in"));
  assert.ok(host.test("research-erp-roan.vercel.app"));
  assert.ok(!host.test("localhost"), "a local computer keeps http");
  assert.ok(!host.test("127.0.0.1"));
  process.env.NODE_ENV = before;
});

await test("uploads may lack the date of birth or the mobile, if the email or the mobile is there", () => {
  const base = { ...article };
  delete base.dob;
  delete base.mobile;
  delete base.designation;
  const withEmail = model.cleanValues(
    "publication",
    { ...base, email: "Kumar@SJU.ac.in" },
    today,
    { upload: true },
  );
  assert.equal(withEmail.ok, true, JSON.stringify(withEmail.errors));
  assert.equal(withEmail.values.email, "kumar@sju.ac.in", "email kept in small letters");
  const neither = model.cleanValues("publication", base, today, { upload: true });
  assert.equal(neither.ok, false);
  assert.match(neither.errors.mobile, /email or the mobile/);
  const onForm = model.cleanValues(
    "publication",
    { ...base, email: "k@sju.ac.in" },
    today,
  );
  assert.equal(onForm.ok, false, "the form still needs the mobile and the date of birth");
  assert.equal(model.isEmail("a@b.co"), true);
  assert.equal(
    model.isEmail("a,b@c.co"),
    false,
    "no commas (kept out of the database filter)",
  );
  assert.equal(model.isEmail("a@b"), false);
});

await test("sign-in matching: an uploaded record joins the faculty member by email", () => {
  const who = { mobile: "9876543210", dob: "1985-06-15", email: "kumar@sju.ac.in" };
  const uploaded = (values) => ({
    ...rec2("publication", { title: "x", ...values }),
    source: "import",
  });
  assert.equal(server.canLink(uploaded({ email: "kumar@sju.ac.in" }), who), true);
  assert.equal(
    server.canLink(uploaded({ email: "kumar@sju.ac.in", mobile: "9876543210" }), who),
    true,
    "email and mobile match, no date of birth",
  );
  assert.equal(
    server.canLink(uploaded({ email: "kumar@sju.ac.in", mobile: "9000000000" }), who),
    false,
    "another mobile: not this person",
  );
  assert.equal(
    server.canLink(uploaded({ email: "kumar@sju.ac.in", dob: "1990-01-01" }), who),
    false,
    "another date of birth: not this person",
  );
  assert.equal(server.canLink(uploaded({ email: "other@sju.ac.in" }), who), false);
  assert.equal(
    server.canLink(uploaded({ mobile: "9876543210" }), who),
    false,
    "no email: no link",
  );
  assert.equal(
    server.canLink(
      uploaded({ email: "kumar@sju.ac.in", mobile: "9876543210", dob: "1985-06-15" }),
      who,
    ),
    false,
    "already complete: found the normal way",
  );
});

await test("review: Rejected stays apart from waiting, and shows its reason", () => {
  const rejected = {
    approvedAt: null,
    rejectedAt: "2026-11-03T10:00:00Z",
    reviewNote: "No DOI",
  };
  assert.equal(model.reviewLabel(rejected), "Rejected");
  assert.equal(model.isRejected(rejected), true);
  assert.equal(
    model.reviewLabel({ approvedAt: "2026-11-03", rejectedAt: null }),
    "Checked & Approved",
  );
  assert.equal(
    model.reviewLabel({ approvedAt: null, rejectedAt: null }),
    "Waiting for approval",
  );
  const records = [
    rec2("publication", { type: "Journal article", year: "2026" }),
    { ...rec2("publication", { type: "Book", year: "2026" }), rejectedAt: "2026-11-01" },
  ];
  const summary = dashboard.facultySummary(records);
  assert.equal(summary.waiting, 1);
  assert.equal(summary.rejected, 1);
  assert.equal(
    dashboard.filterRecords(records, { year: "", category: { kind: "rejected" } }).length,
    1,
  );
});

await test("faculty page: records in sections by type, year, status and indexing", () => {
  const records = [
    rec2("publication", {
      type: "Journal article",
      year: "2025",
      indexing: ["Scopus", "PubMed"],
    }),
    rec2("publication", { type: "Patent", year: "2026" }, "2026-10-01"),
    rec2("proposal", { submittedOn: "2026-02-01" }),
  ];
  const labels = (by) => dashboard.groupRecords(records, by).map((group) => group.label);
  assert.deepEqual(labels("type"), ["Journal article", "Patent", "Project proposals"]);
  assert.deepEqual(labels("year"), ["2026", "2025"], "newest year first");
  assert.deepEqual(labels("status"), ["Waiting for approval", "Checked & Approved"]);
  assert.deepEqual(labels("indexing"), [
    "Scopus",
    "PubMed",
    "Not indexed",
    "Project proposals",
  ]);
  const scopus = dashboard
    .groupRecords(records, "indexing")
    .find((group) => group.label === "Scopus");
  assert.equal(scopus.records.length, 1);
});

await test("faculty page: project money overall and year by year", () => {
  const records = [
    rec2("proposal", {
      submittedOn: "2025-03-01",
      status: "Accepted",
      amountProposed: "1000000",
      amountSanctioned: "800000",
      instalments: [{ amount: "300000", receivedOn: "2025-06-01" }],
    }),
    rec2("proposal", {
      submittedOn: "2026-01-10",
      status: "Rejected",
      amountProposed: "500000",
      amountSanctioned: "500000",
    }),
    rec2("proposal", {
      submittedOn: "2026-02-10",
      status: "Submitted",
      amountProposed: "200000",
    }),
  ];
  const summary = dashboard.facultySummary(records);
  assert.equal(summary.proposed, 1700000);
  assert.equal(summary.sanctioned, 800000, "only accepted projects count as sanctioned");
  assert.equal(summary.received, 300000);
  assert.deepEqual(
    summary.funding.map((item) => [
      item.year,
      item.count,
      item.proposed,
      item.sanctioned,
      item.received,
    ]),
    [
      ["2025", 1, 1000000, 800000, 300000],
      ["2026", 2, 700000, 0, 0],
    ],
  );
  assert.equal(summary.largestYear, 1000000);
});

const bank = load("@/lib/faculty-bank.ts");

await test("bank account for incentives: checked, and shown back masked", () => {
  const good = bank.cleanBank({
    holderName: " Dr. A. Kumar ",
    accountNo: "1234 5678 9012",
    ifsc: "sbin0001234",
    bankName: "State Bank of India",
  });
  assert.equal(good.ok, true, JSON.stringify(good.errors));
  assert.equal(good.value.accountNo, "123456789012");
  assert.equal(good.value.ifsc, "SBIN0001234");
  const masked = bank.maskedBank(good.value);
  assert.ok(masked.accountNo.endsWith("9012") && !masked.accountNo.includes("5678"));
  const bad = bank.cleanBank({
    holderName: "",
    accountNo: "12ab",
    ifsc: "SBIN123",
    bankName: "",
  });
  assert.equal(bad.ok, false);
  assert.ok(
    bad.errors.holderName &&
      bad.errors.accountNo &&
      bad.errors.ifsc &&
      bad.errors.bankName,
  );
});

const toppersLib = load("@/lib/faculty-toppers.ts");

await test("toppers: approved work ranked, equal counts share a rank, department toppers apart", () => {
  const row = (mobile, name, department) => ({
    mobile,
    faculty_name: name,
    details: { department },
  });
  const records = [
    row("9000000001", "Asha", "Chemistry"),
    row("9000000001", "Asha", "Chemistry"),
    row("9000000001", "Asha", "Chemistry"),
    row("9000000002", "Bala", "Physics"),
    row("9000000002", "Bala", "Physics"),
    row("9000000003", "Chitra", "Chemistry"),
    row("9000000003", "Chitra", "Chemistry"),
    row("9000000004", "Devi", "Physics"),
    row("9000000005", "Elan", "Commerce"),
  ];
  const board = toppersLib.buildToppers(records);
  assert.deepEqual(
    board.overall.map((person) => [person.name, person.rank]),
    [
      ["Asha", 1],
      ["Bala", 2],
      ["Chitra", 2],
    ],
    "equal counts share rank 2; nobody is third",
  );
  const physics = board.departments.find((item) => item.department === "Physics");
  assert.deepEqual(
    physics.toppers.map((person) => [person.name, person.rank]),
    [
      ["Bala", 1],
      ["Devi", 2],
    ],
  );
  const chitra = toppersLib.standingOf(board, "9000000003");
  assert.deepEqual(
    {
      overall: chitra.overall,
      department: chitra.department,
      count: chitra.count,
      of: chitra.of,
    },
    { overall: 2, department: 2, count: 2, of: 5 },
  );
  assert.equal(toppersLib.standingOf(board, "9999999999"), null);
  const shown = JSON.stringify(toppersLib.publicToppers(board));
  assert.ok(!shown.includes("9000000001"), "no mobile numbers on the open page");
});

summary("faculty research");
