// Run: node tests/profile-lock.test.mjs
// Basic information and profile: a scholar or supervisor fills what is empty and cannot change
// what is there (lib/profile-lock.ts, checked again by the server in lib/profile-lock-server.ts).
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const { changedFilledFields, supervisorRegisterViolation } = load("@/lib/profile-lock.ts");

await test("filled fields are kept; empty ones may be filled", () => {
  const stored = { fullName: "Asha K", mobile: "9876543210", city: "", fatherName: " " };
  assert.deepEqual(
    changedFilledFields(stored, { fullName: "Asha K", mobile: "9876543210", city: "Madurai" }),
    [],
  );
  assert.deepEqual(changedFilledFields(stored, { fullName: "Asha", mobile: "9876543210" }), [
    "fullName",
  ]);
  // Emptying a filled field is a change too.
  assert.deepEqual(changedFilledFields(stored, { fullName: "Asha K", mobile: "" }), ["mobile"]);
  // Spaces around a value are not a change.
  assert.deepEqual(changedFilledFields(stored, { fullName: " Asha K ", mobile: "9876543210" }), []);
});

const own = {
  keys: ["guide@sju.org", "SUP-7"],
  emails: ["guide@sju.org"],
  names: ["Dr. Guide One"],
};
const register = () => ({
  quotas: [{ name: "Dr. Guide One", quota: 4 }],
  standings: [],
  scholarEdits: [{ key: "s1", fields: { phone: "1" } }],
  supervisorEdits: [
    { key: "SUP-9", fields: { phone: "999" }, editedBy: "Staff" },
    { key: "SUP-7", fields: { campus: "Palanjur" }, editedBy: "Staff" },
  ],
  addedSupervisors: [{ name: "Dr. Other", email: "other@sju.org", phone: "5" }],
  profiles: [
    { key: "sup-9", researchArea: "Networks", bio: "", vidwan: "", published: true },
    { key: "sup-7", researchArea: "", bio: "", vidwan: "", published: false },
  ],
});

await test("a supervisor fills own empty details and nothing else changes", () => {
  const next = register();
  next.profiles[1].bio = "A short biography.";
  next.profiles[1].vidwan = "V123";
  next.supervisorEdits[1].fields.phone = "9876543210";
  next.supervisorEdits[1].editedBy = "Dr. Guide One";
  assert.equal(supervisorRegisterViolation(register(), next, own), null);
});

await test("a supervisor cannot change what is already filled in", () => {
  const next = register();
  next.supervisorEdits[1].fields.campus = "Elsewhere";
  assert.match(supervisorRegisterViolation(register(), next, own), /already filled/);
  const area = register();
  area.profiles[1].researchArea = "x";
  const filled = register();
  filled.profiles[1].researchArea = "Cloud";
  assert.match(supervisorRegisterViolation(filled, area, own), /already filled/);
});

await test("a supervisor cannot touch another supervisor, the scholars or the rest of the register", () => {
  const other = register();
  other.supervisorEdits[0].fields.phone = "1";
  assert.match(supervisorRegisterViolation(register(), other, own), /own details/);
  const profile = register();
  profile.profiles[0].bio = "rewritten";
  assert.match(supervisorRegisterViolation(register(), profile, own), /own details/);
  const added = register();
  added.addedSupervisors[0].phone = "1";
  assert.match(supervisorRegisterViolation(register(), added, own), /own details/);
  const scholars = register();
  scholars.scholarEdits[0].fields.phone = "2";
  assert.match(supervisorRegisterViolation(register(), scholars, own), /research office/);
  const quota = register();
  quota.quotas[0].quota = 40;
  assert.match(supervisorRegisterViolation(register(), quota, own), /research office/);
  const removed = register();
  removed.profiles = removed.profiles.slice(1);
  assert.match(supervisorRegisterViolation(register(), removed, own), /own details/);
});

await test("a supervisor cannot show a profile to the public or move it off the vacancy list", () => {
  const shown = register();
  shown.profiles[1].published = true;
  assert.match(supervisorRegisterViolation(register(), shown, own), /empty details/);
  const fresh = register();
  fresh.profiles = fresh.profiles.slice(0, 1);
  const first = register();
  first.profiles = [first.profiles[0], { key: "sup-7", researchArea: "AI", published: true }];
  assert.match(supervisorRegisterViolation(fresh, first, own), /public/);
  const vacancy = register();
  vacancy.supervisorEdits[1].onVacancyList = false;
  assert.match(supervisorRegisterViolation(register(), vacancy, own), /empty details/);
});

await test("a supervisor not yet on the register is matched by e-mail or name", () => {
  const start = register();
  const next = register();
  next.addedSupervisors.push({ name: "Dr. Guide One", email: "guide@sju.org", phone: "9" });
  assert.equal(supervisorRegisterViolation(start, next, own), null);
});

summary("profile-lock");
