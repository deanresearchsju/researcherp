// Run: node tests/menu-context.test.mjs
// The line under the title of every PDF report: module › menu › sub-menu (lib/menu-context.ts).
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const { menuContext } = load("@/lib/menu-context.ts");

await test("a menu with sub-menus names the sub-menu chosen in the side bar", () => {
  const line = menuContext("/admin/course-work", "arrears");
  assert.match(line, /Examination › Course registrations/);
  assert.match(line, /Arrears/);
  assert.ok(line.indexOf("Examination") < line.indexOf("Arrears"));
});

await test("a menu without a sub-menu names the module and the menu only", () => {
  const line = menuContext("/admin/register", "information");
  assert.ok(line.length > 0);
  assert.ok(!line.endsWith("›"));
});

await test("a tab shown on the screen is used when the address names none", () => {
  const line = menuContext("/admin/colloquium", null, "Scholar-wise");
  assert.match(line, /Scholar-wise$/);
});

await test("an unknown address gives an empty line, never a wrong one", () => {
  assert.equal(menuContext("/nowhere/at-all", null), "");
});

await test("the menu is not repeated when it is also the module", () => {
  const parts = menuContext("/admin/dashboard", null).split(" › ");
  assert.equal(new Set(parts).size, parts.length);
});

const access = load("@/lib/access.ts");

await test("rights given for the old Scholar information menu move to the Scholar register", () => {
  const moved = access.parseMenuRights([
    "/admin/scholar-info",
    "/admin/scholar-info#edit",
    "/admin/fee",
    access.rightsMarker,
    access.sectionsMarker,
  ]);
  assert.ok(moved.includes("/admin/register"));
  assert.ok(moved.includes("/admin/register#edit"));
  assert.ok(!moved.some((item) => item.startsWith("/admin/scholar-info")));
  for (const id of ["register", "information", "entry"]) {
    assert.ok(moved.includes(`/admin/register#tab:${id}`), id);
  }
});

await test("a sign-in that had only the Scholar register keeps its register sub-menu", () => {
  const moved = access.parseMenuRights([
    "/admin/register",
    access.rightsMarker,
    access.sectionsMarker,
  ]);
  assert.ok(moved.includes("/admin/register#tab:register"));
  assert.ok(!moved.includes("/admin/register#tab:information"));
  assert.equal(access.canOpenSection(moved, "/admin/register", "register"), true);
  assert.equal(access.canOpenSection(moved, "/admin/register", "information"), false);
});

summary();
