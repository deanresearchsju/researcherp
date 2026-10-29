// Run: node --env-file=.env.local tests/browser.test.mjs   (needs the app running: npm start)
// A real Chrome (headless) opens the pages signed in as each role and checks that every page
// loads its data (no "Loading…" left), shows no error, and logs no script error. It measures how
// long each page takes. Set CHROME to the browser path if Chrome is not in the usual place.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { load, seedRegister, summary, test } from "./helpers.mjs";

const base = process.env.TEST_BASE || "http://localhost:3000";
const portal = load("@/data/portal.ts");
const session = load("@/lib/session.ts");

const candidates = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = candidates.find((file) => fs.existsSync(file));
if (!chrome) {
  console.log("FAIL no Chrome or Edge found; set CHROME to its path");
  process.exit(1);
}
const up = await fetch(base).then(
  () => true,
  () => false,
);
if (!up) {
  console.log(`FAIL the app is not running at ${base}`);
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "erp-chrome-"));
const port = 9300 + Math.floor(Math.random() * 500);
const child = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "--window-size=1366,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function endpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
      const page = list.find((item) => item.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Chrome did not start");
}

const socket = new WebSocket(await endpoint());
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 1;
const waiting = new Map();
const problems = [];
const refused = [];
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    waiting.get(message.id)(message);
    waiting.delete(message.id);
  } else if (
    message.method === "Network.responseReceived" &&
    message.params.response.status >= 400
  ) {
    refused.push(
      `${message.params.response.status} ${message.params.response.url.replace(/https:\/\/[^/]+/, "").slice(0, 60)}`,
    );
  } else if (message.method === "Network.requestWillBeSent" && process.env.NETLOG) {
    const u = message.params.request.url;
    if (/supabase|\/api\//.test(u))
      console.log(
        "   >>",
        message.params.request.method,
        u.replace(/https:\/\/[^/]+/, "").slice(0, 90),
      );
  } else if (
    message.method === "Network.responseReceived" &&
    process.env.NETLOG &&
    /supabase|\/api\//.test(message.params.response.url)
  ) {
    console.log(
      "   <<",
      message.params.response.status,
      message.params.response.url.replace(/https:\/\/[^/]+/, "").slice(0, 70),
    );
  } else if (message.method === "Network.loadingFailed") {
    refused.push(`failed ${message.params.errorText}`);
  } else if (message.method === "Runtime.exceptionThrown") {
    problems.push(
      message.params.exceptionDetails.exception?.description?.split("\n")[0] ??
        message.params.exceptionDetails.text,
    );
  } else if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params.type === "error"
  ) {
    problems.push(
      message.params.args
        .map((a) => a.value ?? a.description ?? "")
        .join(" ")
        .slice(0, 200),
    );
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const evaluate = async (expression) => {
  const result = await Promise.race([
    send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }),
    new Promise((resolve) => setTimeout(() => resolve(null), 25000)),
  ]);
  return result?.result?.result?.value;
};

async function signInAs(role, identifier, name) {
  const menus = portal.portalGroups[role].flatMap((g) => g.items.map((i) => i.href));
  // A real person may be signed in as this user: the cookie then carries that sign-in's id, or
  // the server (one sign-in at a time) would treat the test's cookie as replaced.
  const stored = await db
    .from("portal_users")
    .select("session_id")
    .eq("role", role)
    .ilike("identifier", identifier)
    .maybeSingle();
  const sid = stored.data?.session_id || undefined;
  const token = await session.encodeSessionCookie(
    {
      role,
      identifier,
      name,
      mustReset: false,
      menus: role === "admin" ? null : menus,
      sid,
    },
    false,
  );
  const origin = new URL(base);
  await send("Network.setCookie", {
    name: session.sessionCookieName,
    value: token,
    domain: origin.hostname,
    path: "/",
  });
  await send("Page.navigate", {
    url: `${base}/login/${role === "admin" ? "admin" : role}`,
  });
  await new Promise((r) => setTimeout(r, 800));
  await evaluate(
    `localStorage.setItem("sju-research-session", ${JSON.stringify(JSON.stringify({ role, identifier, name, mustReset: false, menus: role === "admin" ? null : menus }))}); true`,
  );
}

const settle = `(async () => {
  const started = performance.now();
  for (let i = 0; i < 160; i += 1) {
    const main = document.querySelector("main");
    const text = main ? main.innerText : "";
    const hydrated = (() => { const b = document.querySelector("header button, aside a"); return !!b && Object.keys(b).some((k) => k.startsWith("__react")); })();
    if (hydrated && text.length > 15 && !/^Loading/.test(text.trim())) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const main = document.querySelector("main");
  const text = main ? main.innerText : "";
  const b = document.querySelector("header button, aside a");
  return JSON.stringify({
    ms: Math.round(performance.now()),
    hydrated: !!b && Object.keys(b).some((k) => k.startsWith("__react")),
    loading: /^Loading/.test(text.trim()) || text.length <= 15,
    broken: /Application error|Something went wrong|Unhandled Runtime Error/i.test(document.body.innerText),
    length: text.length,
    path: location.pathname,
  });
})()`;

// A scholar who is not admitted yet sees only the dashboard, so the scholar pages are opened as a
// real, admitted scholar and the supervisor pages as a real supervisor (read only: nothing is saved).
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);
const real = async (role) => {
  const rows =
    (await db.from("portal_users").select("identifier,name").eq("role", role).limit(200))
      .data ?? [];
  return rows;
};

const slowMs = Number(process.env.SLOW_MS || 8000);
const report = [];
const identities = {
  admin: ["admin", "Administrator"],
  scholar: ["scholar@test.invalid", "Test Scholar"],
  supervisor: ["supervisor@test.invalid", "Test Supervisor"],
};
if (process.env.SCHOLAR) identities.scholar = [process.env.SCHOLAR, "Scholar"];
else {
  const scholars = await real("scholar");
  seedRegister();
  const register = load("@/data/research-register");
  const known = new Set(
    register.researchRegister.scholars
      .map((s) => s.email.trim().toLowerCase())
      .filter(Boolean),
  );
  const pick =
    scholars.find((u) => known.has(u.identifier.trim().toLowerCase())) ?? scholars[0];
  if (pick) identities.scholar = [pick.identifier, pick.name];
}
const roles = (process.env.ROLES || "admin,scholar,supervisor").split(",");

for (const role of roles) {
  const [identifier, name] = identities[role] ?? [`${role}@test.invalid`, `Test ${role}`];
  await signInAs(role, identifier, name);
  const hrefs = portal.portalGroups[role]
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => !process.env.ONLY || process.env.ONLY.split(",").includes(href));
  await test(`${role}: every menu page loads its data, hydrates and shows no error (${hrefs.length} pages)`, async () => {
    const bad = [];
    for (const href of hrefs) {
      problems.length = 0;
      refused.length = 0;
      await send("Page.navigate", { url: base + href });
      await new Promise((r) => setTimeout(r, 300));
      // A page that sends the visitor elsewhere (a scholar not yet admitted is sent to the
      // dashboard) destroys the page being measured, so the measure is asked again.
      let measured = await evaluate(settle);
      if (!measured) {
        await new Promise((r) => setTimeout(r, 1200));
        measured = await evaluate(settle);
      }
      const result = JSON.parse(measured ?? "{}");
      report.push({ role, href, ...result });
      console.log(
        `  ${role} ${href} ${result.ms}ms ${result.hydrated ? "" : "NOT-HYDRATED "}${result.loading ? "LOADING " : ""}${result.broken ? "ERROR" : ""}`,
      );
      if (result.path && result.path !== href && !result.path.startsWith(href)) {
        console.log(`    (sent to ${result.path})`);
      }
      if (!result.hydrated) bad.push(`${href}: never hydrated`);
      else if (result.loading) bad.push(`${href}: still loading after ${result.ms} ms`);
      else if (result.broken) bad.push(`${href}: shows an error`);
      else if (result.ms > slowMs) bad.push(`${href}: slow, ${result.ms} ms`);
      if (process.env.PROBE) console.log("   probe:", await evaluate(process.env.PROBE));
      if (process.env.SHOW || result.loading)
        console.log(
          "   refused:",
          JSON.stringify(refused.slice(0, 4)),
          "page said:",
          await evaluate(
            "location.pathname + ' | ' + (document.querySelector('main')?.innerText.slice(0,120) || document.body.innerText.slice(0,160))",
          ),
          "| errors:",
          JSON.stringify(problems).slice(0, 400),
        );
      const own = problems.filter((p) => !/Failed to load resource|favicon|401/.test(p));
      if (own.length) bad.push(`${href}: script error: ${own[0]}`);
    }
    assert.deepEqual(bad, []);
  });
}

// Scholar lists: department, campus, guide and mode as filters; publications as CSV.
if (roles.includes("admin")) {
  await signInAs("admin", "admin", "Administrator");
  const lists = [
    "/admin/scholar-info",
    "/admin/course-work",
    "/admin/results",
    "/admin/payments?tab=course-work",
    "/admin/records/publications",
    "/admin/reports",
    "/admin/allocations",
    "/admin/rac",
    "/admin/evaluators",
    "/admin/passed-out",
    "/admin/erp-reports",
  ];
  await test("admin: scholar lists offer department, campus, guide and mode as filters", async () => {
    const bad = [];
    for (const href of lists) {
      await send("Page.navigate", { url: base + href });
      await new Promise((r) => setTimeout(r, 300));
      await evaluate(settle);
      // Wait for the filter box: it appears once the scholar reports are read.
      const legends = JSON.parse(
        (await evaluate(`(async () => {
          for (let i = 0; i < 100; i += 1) {
            const box = document.querySelector('main [aria-label="Filter"]');
            if (box) {
              box.click();
              await new Promise((r) => setTimeout(r, 200));
              const names = [...document.querySelectorAll('[aria-label="Choose filters"] legend')].map(
                (l) => l.childNodes[0].textContent.trim(),
              );
              if (names.includes("Department")) return JSON.stringify(names);
              box.click();
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          return JSON.stringify([...document.querySelectorAll('[aria-label="Choose filters"] legend')].map((l) => l.childNodes[0].textContent.trim()));
        })()`)) ?? "[]",
      );
      for (const want of ["Department", "Campus", "Mode"]) {
        if (!legends.includes(want)) bad.push(`${href}: no ${want} filter (has ${legends.join(", ")})`);
      }
      if (!legends.some((name) => /guide|supervisor/i.test(name)))
        bad.push(`${href}: no guide filter`);
    }
    assert.deepEqual(bad, []);
  });

  await test("admin: the publications list exports every detail as a CSV with the scholar's department, campus, guide and mode", async () => {
    await send("Page.navigate", { url: base + "/admin/records/publications" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const csv = await evaluate(`(async () => {
      const blobs = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => { blobs.push(blob); return make(blob); };
      let button = null;
      for (let i = 0; i < 100 && !button; i += 1) {
        button = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export CSV");
        if (!button) await new Promise((r) => setTimeout(r, 200));
      }
      if (!button) return "NO BUTTON";
      button.click();
      await new Promise((r) => setTimeout(r, 500));
      return blobs.length ? await blobs[0].text() : "NO FILE";
    })()`);
    assert.ok(!/^NO /.test(csv ?? "NO"), csv);
    const head = csv.replace(/^\uFEFF/, "").split(/\r?\n/)[0];
    for (const want of [
      "Scholar", "Registration No.", "Department", "Campus", "Guide", "Mode",
      "Publication type", "Title of paper", "Authors", "Journal / book / conference",
      "Volume", "Issue", "Pages", "ISSN", "Indexed in", "Impact factor", "DOI", "Year", "Status",
    ]) {
      assert.ok(head.split(",").includes(want), `column ${want} is missing: ${head}`);
    }
  });
}

// Sub-menus: the sections of a menu are in the side bar, and each one shows its own content.
{
  const sections = load("@/data/menu-sections.ts");
  await signInAs("admin", "admin", "Administrator");
  await test("admin: the sections of a menu are sub-menus in the side bar, each showing its own content", async () => {
    const bad = [];
    for (const [href, list] of Object.entries(sections.menuSections)) {
      if (sections.sequentialMenus.has(href)) continue;
      const seen = new Map();
      for (const section of list) {
        await send("Page.navigate", { url: `${base}${href}?tab=${section.id}` });
        await new Promise((r) => setTimeout(r, 300));
        const result = JSON.parse((await evaluate(settle)) ?? "{}");
        if (!result.hydrated || result.loading) {
          bad.push(`${href}?tab=${section.id}: did not load`);
          continue;
        }
        const state = JSON.parse(
          (await evaluate(`JSON.stringify({
            text: (document.querySelector("main")?.innerText || "").slice(0, 20000),
            sub: [...document.querySelectorAll("aside a[aria-current]")].map((a) => a.textContent.trim()),
            sidebar: [...document.querySelectorAll("aside a")].map((a) => a.textContent.trim()),
            tabbar: [...document.querySelectorAll("main .border-b.border-border > button[type=button]")].map((b) => b.textContent.trim()),
          })`)) ?? "{}",
        );
        if (!state.sidebar.some((label) => label.startsWith(section.label)))
          bad.push(`${href}: no sub-menu "${section.label}"`);
        if (!state.sub.some((label) => label.startsWith(section.label)))
          bad.push(`${href}?tab=${section.id}: sub-menu not marked as current`);
        // A tab bar that repeats the sections is a leftover; a filter bar (status, kind) is not.
        if (
          state.tabbar.some((label) => list.some((item) => label.startsWith(item.label)))
        )
          bad.push(`${href}: a tab bar is still drawn`);
        if (seen.has(state.text))
          bad.push(
            `${href}: "${section.label}" shows the same as "${seen.get(state.text)}"`,
          );
        seen.set(state.text, section.label);
      }
    }
    assert.deepEqual(bad, []);
  });
}

const times = report.filter((item) => item.ms).sort((a, b) => b.ms - a.ms);
console.log(
  `slowest: ${times
    .slice(0, 5)
    .map((item) => `${item.href} ${item.ms}ms`)
    .join(
      ", ",
    )}; median ${times.length ? times[Math.floor(times.length / 2)].ms : 0}ms over ${times.length} pages`,
);

socket.close();
child.kill();
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch {
  /* the browser may still hold files */
}
summary("browser");
process.exit(process.exitCode ?? 0);
