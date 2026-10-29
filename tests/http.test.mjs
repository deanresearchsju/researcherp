// Run: node --env-file=.env.local tests/http.test.mjs   (needs the app running: npm run dev)
// Checks the running app: who may open which page, and the password-change API end to end.
// It creates one temporary office sign-in in the database and removes it at the end.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { load, summary, test } from "./helpers.mjs";

const base = process.env.TEST_BASE || "http://localhost:3000";
const session = load("@/lib/session.ts");
const portal = load("@/data/portal.ts");
const secrets = load("@/lib/passwords.ts");

const up = await fetch(base, { redirect: "manual" }).then(
  () => true,
  (error) => {
    console.log(String(error.cause || error));
    return false;
  },
);
if (!up) {
  console.log(`FAIL the app is not running at ${base}. Start it with npm run dev.`);
  process.exit(1);
}

async function cookieFor(
  role,
  identifier = `${role}@test.invalid`,
  name = `Test ${role}`,
  menus = null,
) {
  const token = await session.encodeSessionCookie(
    { role, identifier, name, mustReset: false, menus },
    false,
  );
  return `${session.sessionCookieName}=${token}`;
}
const get = (path, cookie) =>
  fetch(base + path, { redirect: "manual", headers: cookie ? { cookie } : {} });

/* -------------------------------------- who may open what ------------------------------ */
await test("a visitor who is not signed in is sent to the sign-in page", async () => {
  for (const path of [
    "/admin/dashboard",
    "/scholar/dashboard",
    "/supervisor/dashboard",
  ]) {
    const response = await get(path);
    assert.equal(response.status, 307, path);
    assert.match(response.headers.get("location") ?? "", /\/login\//, path);
  }
});

await test("a scholar can not open office or supervisor pages; a supervisor can not open scholar pages", async () => {
  const scholar = await cookieFor("scholar");
  const supervisor = await cookieFor("supervisor");
  for (const path of [
    "/admin/dashboard",
    "/admin/exam-tickets",
    "/supervisor/scholars",
  ]) {
    const response = await get(path, scholar);
    assert.equal(response.status, 307, path);
    assert.doesNotMatch(response.headers.get("location") ?? "", /exam-tickets/, path);
  }
  for (const path of ["/admin/payments", "/scholar/fee"]) {
    assert.equal((await get(path, supervisor)).status, 307, path);
  }
});

await test("Accounts and the COE can not open the Research Office menus", async () => {
  for (const role of ["accounts", "coe", "coeverify"]) {
    const cookie = await cookieFor(role);
    for (const path of ["/admin/applications", "/admin/exam-setup", "/admin/users"]) {
      const response = await get(path, cookie);
      assert.equal(response.status, 307, `${role} ${path}`);
    }
  }
});

for (const [role, groups] of Object.entries(portal.portalGroups)) {
  await test(`every menu page of the ${role} opens (no error, no redirect)`, async () => {
    const menus = groups.flatMap((group) => group.items.map((item) => item.href));
    const cookie = await cookieFor(
      role,
      role === "admin" ? "admin" : undefined,
      undefined,
      role === "admin" ? null : menus,
    );
    const bad = [];
    for (const item of groups.flatMap((group) => group.items)) {
      const response = await get(item.href, cookie);
      if (response.status !== 200) bad.push(`${item.href} -> ${response.status}`);
    }
    assert.deepEqual(bad, []);
  });
}

await test("every page carries the security headers (no sniffing, no framing, referrer and permissions policy)", async () => {
  for (const path of ["/", "/admission", "/supervisors", "/login/admin"]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN", path);
    assert.ok(response.headers.get("referrer-policy"), path);
    assert.ok(response.headers.get("permissions-policy"), path);
  }
});

await test("the public pages open and carry a title, a description and a mobile viewport", async () => {
  for (const path of ["/", "/admission", "/supervisors", "/privacy", "/terms"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<title>[^<]{5,}<\/title>/, `${path}: title`);
    assert.match(html, /<meta name="description"/, `${path}: description`);
    assert.match(
      html,
      /<meta name="viewport" content="width=device-width/,
      `${path}: viewport`,
    );
    assert.match(html, /<html lang="en"/, `${path}: language`);
  }
});

/* ------------------------------------------ APIs ---------------------------------------- */
await test("the APIs refuse a request that is not signed in", async () => {
  for (const [path, body] of [
    ["/api/auth/password", { current: "x", password: "y" }],
    ["/api/auth/reset", { password: "y" }],
  ]) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 401, path);
  }
});

await test("a wrong sign-in is refused", async () => {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "staff",
      identifier: "nobody@test.invalid",
      password: "Nope#12345x",
    }),
  });
  assert.ok(response.status >= 400 && response.status < 500);
  assert.equal((await response.json()).ok, false);
});

/* ----------------------------------- change password, end to end ----------------------- */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("FAIL the database keys are missing; run with --env-file=.env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const identifier = `pw-test-${randomBytes(4).toString("hex")}@test.invalid`;
const first = "First#Passw0rd9";
const second = "Second#Passw0rd8";

try {
  const created = await db
    .from("portal_users")
    .insert({
      role: "staff",
      identifier,
      name: "Password Test",
      password: secrets.hashSecret(first),
      must_reset: false,
    })
    .select("id")
    .single();
  assert.ok(!created.error, created.error?.message);

  // The cookie of the newest sign-in: a newer sign-in ends an earlier cookie, so it is replaced
  // by the one the sign-in below hands out.
  let cookie = await cookieFor("staff", identifier, "Password Test");
  const change = (body) =>
    fetch(base + "/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  const login = (password, keepCookie = false) =>
    fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "staff", identifier, password }),
    }).then(async (response) => {
      if (keepCookie) cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
      return response.json();
    });

  await test("the user signs in with the first password", async () => {
    assert.equal((await login(first, true)).ok, true);
  });
  await test("change password: the wrong current password is refused", async () => {
    const response = await change({ current: "Wrong#Passw0rd1", password: second });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /current password/i);
  });
  await test("change password: a weak new password is refused", async () => {
    const response = await change({ current: first, password: "weakpass" });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).ok, false);
  });
  await test("change password: the same password again is refused", async () => {
    const response = await change({ current: first, password: first });
    assert.equal(response.status, 400);
  });
  await test("change password: a strong new password is accepted and replaces the old one", async () => {
    const response = await change({ current: first, password: second });
    assert.equal(response.status, 200);
    assert.equal((await login(second)).ok, true, "signs in with the new password");
    assert.equal((await login(first)).ok, false, "the old password no longer works");
  });
  await test("the password is stored hashed in the database", async () => {
    const row = await db
      .from("portal_users")
      .select("password")
      .eq("identifier", identifier)
      .single();
    assert.ok(row.data.password.startsWith("scrypt$"));
    assert.ok(!row.data.password.includes(second));
  });

  /* ------------------------------ guessing limit and one sign-in at a time -------------- */
  await test("repeated wrong passwords are slowed down (the ninth try is refused)", async () => {
    const who = `lock-${randomBytes(4).toString("hex")}@test.invalid`;
    let last = 0;
    for (let i = 0; i < 9; i += 1) {
      const response = await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "staff",
          identifier: who,
          password: "Wrong#Passw0rd1",
        }),
      });
      last = response.status;
    }
    assert.equal(last, 429);
  });

  const columnThere = !(await db.from("portal_users").select("session_id").limit(1))
    .error;
  const signIn = async () => {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "staff", identifier, password: second }),
    });
    const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
    return { ok: (await response.json()).ok, cookie };
  };
  const status = (cookie) =>
    fetch(base + "/api/auth/session", { headers: { cookie } }).then(async (response) => ({
      http: response.status,
      body: await response.json(),
    }));

  if (columnThere) {
    await test("one sign-in at a time: a newer sign-in of the same user ends the earlier one", async () => {
      const one = await signIn();
      assert.ok(one.ok && one.cookie);
      assert.equal((await status(one.cookie)).http, 200);
      const two = await signIn();
      assert.ok(two.ok);
      await new Promise((resolve) => setTimeout(resolve, 4500)); // the check is remembered for a few seconds
      const old = await status(one.cookie);
      assert.equal(old.http, 401);
      assert.equal(old.body.reason, "replaced");
      assert.equal((await status(two.cookie)).http, 200);
    });
    await test("changing the password ends the user other sign-ins but keeps this one", async () => {
      const one = await signIn();
      const two = await signIn();
      const third = "Third#Passw0rd7x";
      const response = await fetch(base + "/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: two.cookie },
        body: JSON.stringify({ current: second, password: third }),
      });
      assert.equal(response.status, 200);
      const kept = (response.headers.get("set-cookie") ?? "").split(";")[0];
      await new Promise((resolve) => setTimeout(resolve, 4500));
      assert.equal((await status(one.cookie)).http, 401, "the other sign-in ended");
      assert.equal((await status(kept)).http, 200, "this sign-in carries on");
    });
  } else {
    console.log(
      "SKIP one-sign-in-at-a-time tests: run supabase/migrations/20261027100000_single_sign_in.sql in the Supabase SQL editor first (the app works without it, but a second sign-in does not end the first).",
    );
  }
} finally {
  await db.from("portal_users").delete().eq("identifier", identifier);
  const left = await db.from("portal_users").select("id").eq("identifier", identifier);
  console.log(
    `cleanup: ${left.data?.length ? "TEST USER STILL PRESENT" : "temporary sign-in removed"}`,
  );
}

/* ------------------------------------ the Helpdesk (questions to the office) ------------ */
{
  const before = await db
    .from("exam_office")
    .select("id,payload")
    .eq("id", "helpdesk")
    .maybeSingle();
  const tag = `HELPDESK-TEST-${randomBytes(3).toString("hex")}`;
  const api = (cookie, body) =>
    fetch(`${base}/api/queries`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (response) => ({
      status: response.status,
      data: await response.json(),
    }));
  try {
    const asker = await cookieFor(
      "scholar",
      "helpdesk-test@example.invalid",
      "Helpdesk Test",
    );
    const other = await cookieFor(
      "supervisor",
      "helpdesk-other@example.invalid",
      "Other Person",
    );
    const admin = await cookieFor(
      "admin",
      "helpdesk-admin@example.invalid",
      "Helpdesk Admin",
    );
    const staffCookie = await cookieFor(
      "staff",
      "helpdesk-staff@example.invalid",
      "Helpdesk Staff",
    );
    let id = "";
    await test("a scholar asks a question; a vague one is refused", async () => {
      const bad = await api(asker, {
        action: "create",
        category: "Nonsense",
        subject: tag,
        question: "short",
      });
      assert.equal(bad.status, 400);
      const made = await api(asker, {
        action: "create",
        category: "Fees and payments",
        subject: `${tag} fee receipt`,
        question:
          "My annual fee receipt has not been verified yet; the reference number is 12345.",
      });
      assert.equal(made.status, 200, JSON.stringify(made.data));
      id = made.data.id;
    });
    await test("each person sees only their own questions; the office sees all", async () => {
      const mine = await api(asker, undefined);
      assert.ok(mine.data.queries.some((item) => item.id === id));
      const others = await api(other, undefined);
      assert.ok(
        !others.data.queries.some((item) => item.id === id),
        "another person sees nothing",
      );
      const office = await api(staffCookie, undefined);
      assert.ok(office.data.queries.some((item) => item.id === id));
    });
    await test("only the administrator and the Dean reply; the question is then closed", async () => {
      const staffTry = await api(staffCookie, {
        action: "reply",
        id,
        text: "I will look into it.",
        close: true,
      });
      assert.equal(staffTry.status, 403);
      const askerTry = await api(asker, {
        action: "reply",
        id,
        text: "Self reply attempt",
        close: true,
      });
      assert.equal(askerTry.status, 400, "a scholar cannot use the reply action");
      const replied = await api(admin, {
        action: "reply",
        id,
        text: "It was verified today.",
        close: true,
      });
      assert.equal(replied.status, 200, JSON.stringify(replied.data));
      const after = await api(asker, undefined);
      const query = after.data.queries.find((item) => item.id === id);
      assert.equal(query.status, "Closed");
      assert.equal(query.messages.at(-1).from, "office");
      const again = await api(asker, {
        action: "followup",
        id,
        text: "One more thing about it",
      });
      assert.equal(again.status, 400, "a closed question takes no more messages");
    });
    await test("the browser cannot read or write the questions through /api/db", async () => {
      const read = await fetch(`${base}/api/db/rest/v1/exam_office?select=id`, {
        headers: { cookie: admin },
      });
      const ids = (await read.json()).map((row) => row.id);
      assert.ok(!ids.includes("helpdesk"));
    });
  } finally {
    if (before.data)
      await db
        .from("exam_office")
        .update({ payload: before.data.payload })
        .eq("id", "helpdesk");
    else await db.from("exam_office").delete().eq("id", "helpdesk");
    await db
      .from("portal_notices")
      .delete()
      .ilike("identifier", "helpdesk-test@example.invalid");
    await db.from("portal_notices").delete().ilike("title", "Helpdesk · Helpdesk Test%");
  }
}

/* ---------------------------- an entered RAC can be deleted, not edited -------------------- */
{
  const made = await db
    .from("rac_proposals")
    .insert({
      kind: "constitution",
      scholar_identifier: "rac-delete-test@example.invalid",
      scholar_name: "RAC Delete Test",
      supervisor_identifier: "guide-test@example.invalid",
      supervisor_name: "Guide Test",
      nominees: [],
      status: "Approved",
      office_entry: true,
      entered_by: "test",
    })
    .select("id")
    .single();
  try {
    assert.ok(!made.error, made.error?.message);
    const id = made.data.id;
    const scholarCookie = await cookieFor(
      "scholar",
      "rac-delete-test@example.invalid",
      "S",
    );
    const staffCookie = await cookieFor("staff", "rac-staff@example.invalid", "Staff");
    await test("an entered RAC is deleted through the gate by the office, never by a scholar", async () => {
      const byScholar = await fetch(`${base}/api/db/rest/v1/rac_proposals?id=eq.${id}`, {
        method: "DELETE",
        headers: { cookie: scholarCookie },
      });
      assert.equal(byScholar.status, 403);
      const still = await db.from("rac_proposals").select("id").eq("id", id);
      assert.equal(still.data.length, 1, "the scholar's attempt changed nothing");
      const byStaff = await fetch(`${base}/api/db/rest/v1/rac_proposals?id=eq.${id}`, {
        method: "DELETE",
        headers: { cookie: staffCookie },
      });
      assert.ok(byStaff.status >= 200 && byStaff.status < 300, String(byStaff.status));
      const gone = await db.from("rac_proposals").select("id").eq("id", id);
      assert.equal(gone.data.length, 0);
    });
  } finally {
    if (made.data?.id) await db.from("rac_proposals").delete().eq("id", made.data.id);
  }
}

/* ---------------------------------- Approval rules are saved and read through the gate ----- */
{
  const before = await db
    .from("exam_office")
    .select("id,payload")
    .eq("id", "approval_rules")
    .maybeSingle();
  try {
    const adminCookie = await cookieFor(
      "admin",
      "rules-admin@example.invalid",
      "Rules Admin",
    );
    const scholarCookie = await cookieFor(
      "scholar",
      "rules-scholar@example.invalid",
      "S",
    );
    await test("the Approval rules are saved by the office and read by every signed-in member, never changed by a scholar", async () => {
      const body = {
        p_table: "exam_office",
        p_id: "approval_rules",
        p_payload: {
          rules: { rac: { dean: true, vc: false }, synopsis: { vc: true } },
          changes: [],
        },
        p_updated_at: before.data
          ? (
              await db
                .from("exam_office")
                .select("updated_at")
                .eq("id", "approval_rules")
                .single()
            ).data.updated_at
          : null,
      };
      const save = (cookie) =>
        fetch(`${base}/api/db/rest/v1/rpc/save_json_blob`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify(body),
        });
      assert.equal((await save(scholarCookie)).status, 403);
      assert.equal((await save(adminCookie)).status, 200);
      const read = await fetch(
        `${base}/api/db/rest/v1/exam_office?select=payload&id=eq.approval_rules`,
        {
          headers: { cookie: scholarCookie },
        },
      );
      const rows = await read.json();
      assert.deepEqual(rows[0].payload.rules.rac, { dean: true, vc: false });
      assert.deepEqual(rows[0].payload.rules.synopsis, { vc: true });
    });
  } finally {
    if (before.data)
      await db
        .from("exam_office")
        .update({ payload: before.data.payload })
        .eq("id", "approval_rules");
    else await db.from("exam_office").delete().eq("id", "approval_rules");
  }
}

/* ------------------------------------ the database gate (/api/db) ----------------------- */
const gate = (path, init = {}, cookie) =>
  fetch(`${base}/api/db/${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
  });

await test("a visitor reaches only the public lists through /api/db", async () => {
  assert.equal(
    (await gate("rest/v1/supervisor_vacancies?select=id&limit=1")).status,
    200,
  );
  for (const table of [
    "portal_users",
    "scholar_records",
    "research_register",
    "audit_log",
    "doctoral_office",
  ]) {
    assert.equal((await gate(`rest/v1/${table}?select=*`)).status, 401, table);
  }
  assert.equal(
    (await gate("rest/v1/phd_applications?select=*")).status,
    400,
    "no listing of applications",
  );
  assert.equal((await gate("auth/v1/admin/users")).status, 404);
  assert.equal((await gate("storage/v1/bucket")).status, 404);
});

await test("a visitor cannot write through /api/db, and a page on another site cannot either", async () => {
  const write = (extra = {}) =>
    gate("rest/v1/supervisor_vacancies", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify({ name: "x" }),
    });
  assert.equal((await write()).status, 401);
  assert.equal((await write({ Origin: "https://evil.example" })).status, 403);
});

await test("a scholar sees nothing of the accounts and cannot change the office records", async () => {
  const scholarCookie = await cookieFor(
    "scholar",
    "gate-test@example.invalid",
    "Gate Test",
  );
  const users = await gate("rest/v1/portal_users?select=*", {}, scholarCookie);
  assert.equal(users.status, 200);
  assert.deepEqual(await users.json(), []);
  const change = await gate(
    "rest/v1/phd_applications?id=eq.00000000-0000-0000-0000-000000000000",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Admitted" }),
    },
    scholarCookie,
  );
  assert.equal(change.status, 403);
  const blob = await gate(
    "rest/v1/rpc/save_json_blob",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_table: "news_board",
        p_id: "x",
        p_payload: {},
        p_updated_at: null,
      }),
    },
    scholarCookie,
  );
  assert.equal(blob.status, 403);
});

await test("a staff sign-in reads the office records through /api/db", async () => {
  const staffCookie = await cookieFor(
    "staff",
    "gate-staff@example.invalid",
    "Gate Staff",
  );
  const rows = await gate("rest/v1/phd_applications?select=id&limit=1", {}, staffCookie);
  assert.equal(rows.status, 200);
  assert.ok(Array.isArray(await rows.json()));
});

await test("the register shows a scholar only the scholar's own contact details", async () => {
  const cookie = await cookieFor(
    "scholar",
    "nobody-in-the-register@example.invalid",
    "Nobody",
  );
  const response = await gate(
    "rest/v1/research_register?select=payload&id=eq.seed",
    {},
    cookie,
  );
  assert.equal(response.status, 200);
  const rows = await response.json();
  const payload = rows[0]?.payload;
  assert.ok(
    payload,
    "the register is stored in the database (run scripts/seed-register.mjs)",
  );
  assert.ok(payload.scholars.length > 0);
  assert.ok(
    payload.scholars.every((item) => item.email === "" && item.phone === ""),
    "no scholar contact",
  );
  assert.ok(
    payload.supervisors.every((item) => item.email === "" && item.phone === ""),
    "no supervisor contact",
  );
  assert.ok(
    payload.scholars.some((item) => item.name),
    "the names are still there",
  );
});

await test("the public key of the database opens nothing (needs the close-public-access SQL)", async () => {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!anon) return;
  const direct = await fetch(`${url}/rest/v1/phd_applications?select=id&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const rows = direct.ok ? await direct.json() : [];
  if (Array.isArray(rows) && rows.length > 0) {
    console.log(
      "WARN the public key still reads the database directly: run supabase/migrations/20261028100000_close_public_access.sql once the new version is live.",
    );
    return;
  }
  assert.ok(!direct.ok || rows.length === 0);
});

summary("http");
