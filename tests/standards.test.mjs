// Run: node tests/standards.test.mjs
// A checklist for an educational-institution ERP (student information system, admissions,
// examinations, fees, faculty, communication, administration), applied to this ERP and website.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { load, root, summary, test } from "./helpers.mjs";

const portal = load("@/data/portal.ts");
const groups = portal.portalGroups;
const labelsOf = (role) => groups[role].flatMap((g) => g.items.map((i) => i.label));
const headingsOf = (role) => groups[role].map((g) => g.heading).filter(Boolean);

const walk = (dir, name) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, name));
    else if (entry.name === name) out.push(full);
  }
  return out;
};

function walkAll(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAll(full));
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

/* ----------------------------------- structure of the ERP ------------------------------- */
await test("every role starts at a Dashboard, and no menu label is repeated inside a role", () => {
  for (const role of Object.keys(groups)) {
    assert.equal(groups[role][0].items[0].label, "Dashboard", role);
    const labels = labelsOf(role);
    assert.equal(
      new Set(labels).size,
      labels.length,
      `${role}: a menu label is repeated`,
    );
    const heads = headingsOf(role);
    assert.equal(
      new Set(heads).size,
      heads.length,
      `${role}: a module heading is repeated`,
    );
  }
});

await test("the office ERP covers the standard modules of an educational ERP", () => {
  const heads = headingsOf("admin");
  for (const area of [
    "Admissions", // enquiry, application, selection
    "Registers", // student and faculty records
    "Supervision", // faculty allocation
    "Examination", // course registration, timetable, hall tickets, invigilation, results
    "Doctoral progress", // academic progress
    "Fees", // fee collection and verification
    "Letters & reports", // certificates and MIS reports
    "Website", // notices and public information
    "Administration", // users, rights, settings
  ]) {
    assert.ok(heads.includes(area), `missing module: ${area}`);
  }
});

await test("a scholar (student) portal has profile, course registration, hall ticket, results, fees and documents", () => {
  const labels = labelsOf("scholar").join("|");
  for (const word of [
    "My details",
    "Registration",
    "Hall ticket",
    "Results",
    "Fee",
    "Approved documents",
    "Forms",
  ]) {
    assert.ok(labels.includes(word), `scholar menu lacks ${word}`);
  }
});

await test("a supervisor (faculty) portal has scholars, approvals, details and documents", () => {
  const labels = labelsOf("supervisor").join("|");
  for (const word of [
    "My scholars",
    "Scholar requests",
    "My details",
    "Approved documents",
  ]) {
    assert.ok(labels.includes(word), `supervisor menu lacks ${word}`);
  }
});

await test("separate desks for Accounts, the COE and the verifier, and the Vice Chancellor", () => {
  assert.ok(labelsOf("accounts").some((l) => /fee/i.test(l)));
  assert.ok(labelsOf("coe").includes("Marks entry"));
  assert.ok(labelsOf("coeverify").includes("Verify & freeze marks"));
  assert.ok(labelsOf("vc").includes("Thesis evaluators"));
});

await test("menu labels read in a consistent style (sentence case, no trailing punctuation)", () => {
  const bad = [];
  for (const role of Object.keys(groups)) {
    for (const label of labelsOf(role)) {
      if (/[.:;]$/.test(label) || label !== label.trim() || /\s{2,}/.test(label))
        bad.push(label);
      const words = label.split(" ");
      if (
        words
          .slice(1)
          .some(
            (w) =>
              /^[A-Z][a-z]+$/.test(w) &&
              !/^(Ph|Dean|COE|VC|ABC|RAC|ERP|Selection|Thesis|Dr|Hall|Excel|Dashboard)/.test(
                w,
              ) &&
              words.length > 1 &&
              /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/.test(label),
          )
      ) {
        bad.push(label);
      }
    }
  }
  assert.deepEqual(bad, []);
});

/* ---------------------------------- pages: professional basics -------------------------- */
await test("every signed-in page has a title and is kept out of search engines", () => {
  const missing = [];
  for (const file of walk(path.join(root, "app/(portal)"), "page.tsx")) {
    const text = fs.readFileSync(file, "utf8");
    if (/redirect\(/.test(text)) continue; // a redirect page shows nothing
    if (!/title:/.test(text) && !/generateMetadata/.test(text))
      missing.push(`${file}: title`);
    if (!/robots:\s*\{\s*index:\s*false/.test(text) && !/generateMetadata/.test(text))
      missing.push(`${file}: noindex`);
  }
  assert.deepEqual(
    missing.map((m) => path.relative(root, m)),
    [],
  );
});

await test("every public page has a title and a description, and appears in the sitemap", () => {
  const sitemap = fs.readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
  const gaps = [];
  for (const file of walk(path.join(root, "app/(public)"), "page.tsx")) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path
      .relative(path.join(root, "app/(public)"), path.dirname(file))
      .replace(/\\/g, "/");
    if (!/title:/.test(text) && !/generateMetadata/.test(text))
      gaps.push(`${rel}: no title`);
    if (!/description/.test(text) && !/generateMetadata/.test(text) && rel !== "")
      gaps.push(`${rel}: no description`);
    const dynamic = /\[/.test(rel) || /apply|status|login|reset/.test(rel);
    if (rel && !dynamic && !sitemap.includes(`/${rel}`))
      gaps.push(`${rel}: not in the sitemap`);
  }
  assert.deepEqual(gaps, []);
});

await test("the site address is https and the layout is responsive (viewport set)", () => {
  const constants = fs.readFileSync(path.join(root, "lib/constants.ts"), "utf8");
  assert.match(constants, /siteUrl:\s*"https:\/\//);
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /<html lang="en"/);
});

await test("security headers are configured, with HSTS and https upgrade on the live site", () => {
  const config = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "upgrade-insecure-requests",
  ]) {
    assert.ok(config.includes(header), header);
  }
  const session = fs.readFileSync(path.join(root, "lib/session.ts"), "utf8");
  assert.match(
    fs.readFileSync(path.join(root, "app/api/auth/login/route.ts"), "utf8"),
    /secure:\s*process\.env\.NODE_ENV === "production"/,
  );
  assert.ok(session.length > 0);
});

await test("dashboards: count cards only for the administrator and the Dean; everyone is welcomed by name", () => {
  const home = fs.readFileSync(
    path.join(root, "components/portal/DashboardHome.tsx"),
    "utf8",
  );
  assert.match(home, /role === "admin" \|\| role === "dean"/);
  const member = fs.readFileSync(
    path.join(root, "components/portal/MemberDashboard.tsx"),
    "utf8",
  );
  assert.ok(
    !/<Tile/.test(member),
    "scholar and supervisor dashboards have no count cards",
  );
  assert.ok(member.includes("WelcomeBanner") && home.includes("WelcomeBanner"));
  assert.match(
    fs.readFileSync(path.join(root, "components/portal/WelcomeBanner.tsx"), "utf8"),
    /Welcome, \$\{name\}/,
  );
});

await test("a dashboard does not repeat the side menu as a second set of buttons", () => {
  const home = fs.readFileSync(
    path.join(root, "components/portal/DashboardHome.tsx"),
    "utf8",
  );
  assert.ok(
    !/shownLinks\.map/.test(home),
    "the office dashboard has no copy of the side menu",
  );
  const member = fs.readFileSync(
    path.join(root, "components/portal/MemberDashboard.tsx"),
    "utf8",
  );
  assert.ok(
    !/<Actions/.test(member),
    "the member dashboards have no copy of the side menu",
  );
});

await test("the invigilation page has no button that repeats another", () => {
  const text = fs.readFileSync(
    path.join(root, "components/portal/InvigilationDesk.tsx"),
    "utf8",
  );
  assert.ok(!/Add supervisors from the register/.test(text));
  const ui = fs.readFileSync(
    path.join(root, "components/auth/ChangePasswordDialog.tsx"),
    "utf8",
  );
  assert.ok(
    !/DeskModal title="Change password" size="md" onClose=\{onClose\}>\s*<form/.test(ui),
    "the form dialog has one Cancel",
  );
});

await test("typed boxes are wired correctly (the rule is spread on the box, not called inside onChange)", () => {
  const bad = [];
  for (const dir of ["components", "app"]) {
    for (const file of [
      ...walk(path.join(root, dir), "page.tsx"),
      ...walkAll(path.join(root, dir)),
    ]) {
      const text = fs.readFileSync(file, "utf8");
      if (/onChange=\{\([^)]*\) =>\s*typed\(/.test(text))
        bad.push(path.relative(root, file));
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

await test("the Our Team page is served from a short-lived cache with photographs as small image addresses", () => {
  const page = fs.readFileSync(path.join(root, "app/(public)/our-team/page.tsx"), "utf8");
  assert.match(page, /publicTeam/);
  assert.ok(!/loadTeam/.test(page), "the page does not ask the database on each visit");
  const lib = fs.readFileSync(path.join(root, "lib/public-team.ts"), "utf8");
  assert.match(lib, /"use cache"/);
  assert.match(lib, /\/team\/photo\//);
  const route = fs.readFileSync(path.join(root, "app/team/photo/[id]/route.ts"), "utf8");
  assert.match(route, /max-age=86400/);
});

await test("one sign-in at a time is built in, with its migration, a guessing limit and an idle sign-out", () => {
  assert.ok(
    fs.existsSync(
      path.join(root, "supabase/migrations/20261027100000_single_sign_in.sql"),
    ),
  );
  const login = fs.readFileSync(path.join(root, "app/api/auth/login/route.ts"), "utf8");
  assert.match(login, /startSignIn/);
  assert.match(login, /loginBlocked/);
  const api = fs.readFileSync(path.join(root, "lib/api-session.ts"), "utf8");
  assert.match(api, /signInIsCurrent/);
  const shell = fs.readFileSync(
    path.join(root, "components/layout/PortalShell.tsx"),
    "utf8",
  );
  assert.match(shell, /useSignInWatch\(\)/);
});

summary("standards");
