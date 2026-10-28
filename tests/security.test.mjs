// Run: node --env-file=.env.local tests/security.test.mjs
// Sign-in security: guessing limits, signed cookies and the one-sign-in-at-a-time id.
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

process.env.SESSION_SECRET ??= "test-only-secret-for-the-cookie-checks";

const guard = load("@/lib/login-guard.ts");
const session = load("@/lib/session.ts");
const watch = load("@/lib/use-sign-in-watch.ts");

await test("after 8 wrong passwords for one sign-in, further tries are refused for a while", () => {
  const now = Date.now();
  for (let i = 0; i < guard.loginLimit - 1; i += 1)
    guard.loginFailed("1.1.1.1", "A@x.org", now);
  assert.equal(
    guard.loginBlocked("1.1.1.1", "a@x.org", now),
    0,
    "still allowed before the limit",
  );
  guard.loginFailed("1.1.1.1", "a@x.org", now);
  assert.ok(
    guard.loginBlocked("1.1.1.1", "A@X.ORG", now) > 0,
    "blocked, whatever the capital letters",
  );
  assert.equal(
    guard.loginBlocked("2.2.2.2", "a@x.org", now),
    0,
    "another address is not blocked",
  );
  assert.equal(
    guard.loginBlocked("1.1.1.1", "b@x.org", now),
    0,
    "another user is not blocked",
  );
  assert.equal(
    guard.loginBlocked("1.1.1.1", "a@x.org", now + 16 * 60_000),
    0,
    "free again after 15 minutes",
  );
});

await test("a right password clears the count", () => {
  const now = Date.now();
  for (let i = 0; i < 5; i += 1) guard.loginFailed("3.3.3.3", "c@x.org", now);
  guard.loginSucceeded("3.3.3.3", "c@x.org");
  for (let i = 0; i < 5; i += 1) guard.loginFailed("3.3.3.3", "c@x.org", now);
  assert.equal(guard.loginBlocked("3.3.3.3", "c@x.org", now), 0);
});

await test("the signed cookie carries the sign-in id, and any change to it is refused", async () => {
  const base = {
    role: "staff",
    identifier: "s@x.org",
    name: "S",
    mustReset: false,
    menus: [],
  };
  const token = await session.encodeSessionCookie({ ...base, sid: "sid-one" }, false);
  assert.equal((await session.decodeSessionCookie(token)).sid, "sid-one");
  const [body, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(body, "base64url").toString()),
      sid: "sid-two",
    }),
  ).toString("base64url");
  assert.equal(
    await session.decodeSessionCookie(`${forged}.${signature}`),
    null,
    "a changed sid breaks the signature",
  );
  const plain = await session.encodeSessionCookie(base, false);
  assert.equal(
    (await session.decodeSessionCookie(plain)).sid,
    undefined,
    "a cookie without an id still reads",
  );
});

await test("an expired or empty cookie is refused", async () => {
  assert.equal(await session.decodeSessionCookie(undefined), null);
  assert.equal(await session.decodeSessionCookie("abc.def"), null);
});

await test("the browser signs out after 30 minutes of no activity, with a clear message", () => {
  assert.equal(watch.idleLimitMinutes, 30);
  for (const reason of ["replaced", "expired", "idle"])
    assert.ok(watch.signOutReasons[reason].length > 20, reason);
  assert.match(watch.signOutReasons.replaced, /another device or browser/);
});

summary("security");
