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
  for (const path of [
    "/",
    "/admission",
    "/supervisors",
    "/contact",
    "/privacy",
    "/terms",
  ]) {
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

  const cookie = await cookieFor("staff", identifier, "Password Test");
  const change = (body) =>
    fetch(base + "/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  const login = (password) =>
    fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "staff", identifier, password }),
    }).then((response) => response.json());

  await test("the user signs in with the first password", async () => {
    assert.equal((await login(first)).ok, true);
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

summary("http");
