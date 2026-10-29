// Run: node --env-file=.env.local tests/applications.test.mjs   (needs the app running)
// Submits one Ph.D. application through the real API and one supervisor-recognition
// application through the real database path, checks that the office sees them, and removes
// both. The Ph.D. window is opened for the test and put back exactly as it was.
import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { summary, test } from "./helpers.mjs";

const base = process.env.TEST_BASE || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.log("FAIL the database keys are missing; run with --env-file=.env.local");
  process.exit(1);
}
const db = createClient(url, service, { auth: { persistSession: false } });
// A visitor's browser reaches the database only through the site's own /api/db.
const publicDb = createClient(`${base}/api/db`, "browser", {
  auth: { persistSession: false },
});

const settingsBefore = (
  await db.from("site_settings").select("*").eq("id", "office").single()
).data;
const month = String(settingsBefore.admission_session).split(" ")[0];
const created = { phd: [], supervisor: [] };
// Issuing a number moves a counter; it is put back at the end so no numbers are skipped.
const countersBefore = (await db.from("application_counters").select("*")).data ?? [];
const stamp = Date.now();

const post = (body) =>
  fetch(base + "/api/apply/phd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const phdBody = (suffix = "") => ({
  dateOfBirth: "1994-05-05",
  applicantName: `Test Applicant ${stamp}${suffix}`,
  email: `test-applicant-${stamp}${suffix}@example.invalid`,
  studyMode: "Full time",
  session: month,
  payload: { title: "Ms", specialization: "Physics", studyMode: "Full time" },
});

try {
  await test("the Ph.D. application is refused while the window is closed", async () => {
    await db.from("site_settings").update({ phd_open: false }).eq("id", "office");
    const response = await post(phdBody("-closed"));
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /closed/i);
  });

  await test("a broken request is refused", async () => {
    const response = await fetch(base + "/api/apply/phd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    assert.equal(response.status, 400);
  });

  await db.from("site_settings").update({ phd_open: true }).eq("id", "office");

  await test("an upload that is not a PDF/JPG/PNG is refused", async () => {
    const body = phdBody("-bad");
    body.payload.files = {
      ug: { fileName: "x.exe", fileData: "data:application/x-msdownload;base64,AAAA" },
    };
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /not an accepted type/i);
  });

  let applicationNo = "";
  await test("a Ph.D. application is accepted, numbered, saved and announced to the office", async () => {
    const response = await post(phdBody());
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.ok, true);
    applicationNo = result.applicationNo;
    created.phd.push(applicationNo);
    assert.match(applicationNo, /^SJU\/PHD\//);
    const row = await db
      .from("phd_applications")
      .select("*")
      .eq("application_no", applicationNo)
      .single();
    assert.equal(row.data.status, "Acknowledgement sent");
    assert.equal(row.data.email.toLowerCase(), phdBody().email.toLowerCase());
    const notice = await db
      .from("portal_notices")
      .select("id")
      .ilike("detail", `%${applicationNo}%`);
    assert.ok((notice.data?.length ?? 0) >= 1, "the research office got a notice");
    created.notice = notice.data.map((item) => item.id);
  });

  await test("a second application gets the next number (numbers never repeat)", async () => {
    const response = await post(phdBody("-2"));
    const result = await response.json();
    assert.equal(result.ok, true, JSON.stringify(result));
    created.phd.push(result.applicationNo);
    assert.notEqual(result.applicationNo, applicationNo);
  });

  await test("the application is then visible to the office list (Applications menu source)", async () => {
    const rows = await db
      .from("phd_applications")
      .select("application_no")
      .in("application_no", created.phd);
    assert.equal(rows.data.length, created.phd.length);
  });

  await test("a supervisor-recognition application is saved through the same path the form uses", async () => {
    const issued = await publicDb.rpc("issue_application_number", {
      p_kind: "supervisor",
      p_year: "2026",
      p_code: "10",
    });
    assert.ok(!issued.error, issued.error?.message);
    const no = issued.data;
    assert.match(no, /SUP/i);
    const inserted = await publicDb.from("supervisor_applications").insert({
      application_no: no,
      date_of_birth: "1980-02-02",
      applicant_name: `Test Supervisor ${stamp}`,
      email: `test-supervisor-${stamp}@example.invalid`,
      status: "Acknowledgement sent",
      payload: { designation: "Assistant Professor", department: "Physics" },
    });
    assert.ok(!inserted.error, inserted.error?.message);
    created.supervisor.push(no);
    const row = await db
      .from("supervisor_applications")
      .select("status")
      .eq("application_no", no)
      .single();
    assert.equal(row.data.status, "Acknowledgement sent");
  });

  await test("the status look-up needs the application number and the date of birth together", async () => {
    const no = created.supervisor[0];
    const ok = await publicDb
      .from("supervisor_applications")
      .select("status")
      .eq("application_no", no)
      .eq("date_of_birth", "1980-02-02");
    assert.equal(ok.data?.length, 1);
    const wrong = await publicDb
      .from("supervisor_applications")
      .select("status")
      .eq("application_no", no)
      .eq("date_of_birth", "1999-09-09");
    assert.equal(wrong.data?.length ?? 0, 0);
  });
} finally {
  await db
    .from("site_settings")
    .update({
      phd_open: settingsBefore.phd_open,
      admission_session: settingsBefore.admission_session,
    })
    .eq("id", "office");
  if (created.phd.length)
    await db.from("phd_applications").delete().in("application_no", created.phd);
  if (created.supervisor.length)
    await db
      .from("supervisor_applications")
      .delete()
      .in("application_no", created.supervisor);
  const strays = await db
    .from("phd_applications")
    .select("application_no")
    .ilike("email", `%${stamp}%`);
  if (strays.data?.length) {
    await db
      .from("phd_applications")
      .delete()
      .in(
        "application_no",
        strays.data.map((row) => row.application_no),
      );
  }
  const counters = await db.from("application_counters").select("*");
  for (const row of counters.data ?? []) {
    const before = countersBefore.find((item) => item.key === row.key);
    if (!before) await db.from("application_counters").delete().eq("key", row.key);
    else if (before.last_value !== row.last_value) {
      await db
        .from("application_counters")
        .update({ last_value: before.last_value })
        .eq("key", row.key);
    }
  }
  await db
    .from("portal_notices")
    .delete()
    .ilike("title", `New Ph.D. application · Test Applicant ${stamp}%`);
  if (created.notice?.length)
    await db.from("portal_notices").delete().in("id", created.notice);
  const after = (
    await db
      .from("site_settings")
      .select("phd_open, admission_session")
      .eq("id", "office")
      .single()
  ).data;
  const left = await db
    .from("phd_applications")
    .select("id", { count: "exact", head: true })
    .ilike("email", `%${stamp}%`);
  console.log(
    `cleanup: window ${after.phd_open === settingsBefore.phd_open ? "restored" : "NOT RESTORED"}, test applications left: ${left.count ?? 0}`,
  );
}

summary("applications");
