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

async function signInAs(role, identifier, name, rights) {
  const menus = rights ?? portal.portalGroups[role].flatMap((g) => g.items.map((i) => i.href));
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
    "/admin/register?tab=entry",
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

  await test("admin: Scholar information also holds the fee paid and the RAC of each scholar", async () => {
    await send("Page.navigate", { url: base + "/admin/register?tab=entry" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const state = JSON.parse(
      (await evaluate(`(async () => {
        for (let i = 0; i < 100; i += 1) {
          if (document.querySelector("main tbody tr td button")) break;
          await new Promise((r) => setTimeout(r, 200));
        }
        const heads = [...document.querySelectorAll("main thead th")].map((h) => h.textContent.trim());
        const buttons = [...document.querySelectorAll("main tbody button")].map((b) => b.textContent.trim());
        const first = [...document.querySelectorAll("main tbody tr")][0]?.innerText ?? "";
        return JSON.stringify({ heads, buttons, first });
      })()`)) ?? "{}",
    );
    assert.ok(state.heads.includes("Fee · RAC"), "no Fee · RAC column: " + state.heads.join("|"));
    assert.ok(/Fee:/.test(state.first) && /RAC:/.test(state.first), "row lacks fee and RAC: " + state.first);
    assert.ok(
      state.buttons.some((label) => label === "Fee paid") ||
        state.buttons.some((label) => label === "Enter RAC"),
      "no Fee paid / Enter RAC button among: " + [...new Set(state.buttons)].join(", "),
    );
  });

  await test("admin: Scholar information finds a scholar by name and shows the portal information tab by tab", async () => {
    seedRegister();
    const register = load("@/data/research-register");
    const named = register.researchRegister.scholars.find((s) => /^[A-Za-z]{4}/.test(s.name.trim()));
    assert.ok(named, "the test register has a scholar");
    const word = named.name.trim().slice(0, 4);
    await send("Page.navigate", { url: base + "/admin/register?tab=information" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const state = JSON.parse(
      (await evaluate(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const setValue = (el, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        let input = null;
        for (let i = 0; i < 100 && !input; i += 1) {
          input = document.querySelector('input[aria-label="Scholar name"]');
          if (!input) await wait(200);
        }
        if (!input) return JSON.stringify({ step: "no search box" });
        input.focus();
        setValue(input, ${JSON.stringify(word)});
        let option = null;
        for (let i = 0; i < 50 && !option; i += 1) {
          option = document.querySelector('[role="option"]');
          if (!option) await wait(200);
        }
        if (!option) return JSON.stringify({ step: "no match listed" });
        const headers = [...document.querySelectorAll('[role="listbox"] th')].map((h) => h.textContent.trim());
        option.click();
        await wait(1200);
        const tabs = [...document.querySelectorAll('nav[aria-label="Scholar information"] button')].map((b) => b.textContent.trim());
        const text = {};
        for (const label of ["Fee details", "RAC", "Course work & results", "Doctoral committees", "Publications", "Synopsis, thesis & viva"]) {
          const button = [...document.querySelectorAll('nav[aria-label="Scholar information"] button')].find((b) => b.textContent.trim() === label);
          button?.click();
          await wait(500);
          text[label] = document.querySelector("main")?.innerText ?? "";
        }
        return JSON.stringify({ step: "done", headers, tabs, text });
      })()`)) ?? "{}",
    );
    assert.equal(state.step, "done", JSON.stringify(state).slice(0, 300));
    for (const want of ["Scholar", "Registration No.", "Batch", "Department", "Guide", "Mode", "Status"]) {
      assert.ok(state.headers.includes(want), `the list lacks "${want}"`);
    }
    for (const want of ["Personal details", "Fee details", "RAC", "Course work & results", "Doctoral committees", "Six-month reports", "Colloquium attendance", "Publications", "Synopsis, thesis & viva"]) {
      assert.ok(state.tabs.includes(want), `no tab "${want}"`);
    }
    assert.match(state.text["Fee details"], /Fee year/);
    assert.match(state.text["RAC"], /RAC:/);
    assert.match(state.text["Course work & results"], /Semester/);
    assert.match(state.text["Doctoral committees"], /First doctoral committee/);
    assert.match(state.text["Publications"], /Indexed in/);
    assert.match(state.text["Synopsis, thesis & viva"], /Plagiarism:/);
  });

  await test("admin: Supervisor information finds a supervisor by name and shows the portal information tab by tab", async () => {
    seedRegister();
    const register = load("@/data/research-register");
    const named = register.researchRegister.supervisors.find((s) => /^[A-Za-z]{4}/.test(s.name.trim()));
    assert.ok(named, "the test register has a supervisor");
    const word = named.name.trim().slice(0, 4);
    await send("Page.navigate", { url: base + "/admin/supervisors?tab=information" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const state = JSON.parse(
      (await evaluate(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const setValue = (el, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        let input = null;
        for (let i = 0; i < 100 && !input; i += 1) {
          input = document.querySelector('input[aria-label="Supervisor name"]');
          if (!input) await wait(200);
        }
        if (!input) return JSON.stringify({ step: "no search box" });
        input.focus();
        setValue(input, ${JSON.stringify(word)});
        let option = null;
        for (let i = 0; i < 50 && !option; i += 1) {
          option = document.querySelector('[role="option"]');
          if (!option) await wait(200);
        }
        if (!option) return JSON.stringify({ step: "no match listed" });
        const headers = [...document.querySelectorAll('[role="listbox"] th')].map((h) => h.textContent.trim());
        option.click();
        await wait(1200);
        const nav = () => [...document.querySelectorAll('nav[aria-label="Supervisor information"] button')];
        const tabs = nav().map((b) => b.textContent.trim());
        const text = {};
        for (const label of ["Scholars", "RAC", "Recommendations", "Colloquium attendance", "Public profile"]) {
          nav().find((b) => b.textContent.trim() === label)?.click();
          await wait(500);
          text[label] = document.querySelector("main")?.innerText ?? "";
        }
        return JSON.stringify({ step: "done", headers, tabs, text });
      })()`)) ?? "{}",
    );
    assert.equal(state.step, "done", JSON.stringify(state).slice(0, 300));
    for (const want of ["Supervisor", "Supervisor ID", "Designation", "Department", "Campus", "Scholars", "Status"]) {
      assert.ok(state.headers.includes(want), `the list lacks "${want}"`);
    }
    for (const want of ["Personal details", "Scholars", "RAC", "Recommendations", "Colloquium attendance", "Public profile"]) {
      assert.ok(state.tabs.includes(want), `no tab "${want}"`);
    }
    assert.match(state.text["Scholars"], /Registration No\./);
    assert.match(state.text["Recommendations"], /Supervisor's step/);
    assert.match(state.text["Public profile"], /Shown on the public Supervisors page/);
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

// Staff enter the fee a scholar already paid: with the Add / edit right alone (no Approve right).
if (roles.includes("admin")) {
  const access = load("@/lib/access.ts");
  const feeRights = (...extra) => [
    "/admin/register",
    "/admin/fee",
    ...extra,
    access.rightsMarker,
  ];
  /** Opens the first scholar's "Fee paid" dialog on Scholar information, fills it and records it. */
  const enterFee = (reference) => `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, value) => {
      const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    let opener = null;
    for (let i = 0; i < 100 && !opener; i += 1) {
      opener = [...document.querySelectorAll("main tbody button")].find((b) => b.textContent.trim() === "Fee paid");
      if (!opener) await wait(200);
    }
    if (!opener) return JSON.stringify({ step: "no Fee paid button" });
    const row = opener.closest("tr");
    const scholar = row.querySelector("td p")?.textContent.trim() ?? "";
    opener.click();
    await wait(600);
    const box = document.querySelector('[role="dialog"]');
    if (!box) return JSON.stringify({ step: "dialog did not open", scholar });
    const ticks = [...box.querySelectorAll('input[type=checkbox]')];
    if (ticks[0] && !ticks[0].checked && !ticks[0].disabled) { ticks[0].click(); await wait(200); }
    const amount = box.querySelector('input[aria-label^="Amount for Year"]');
    const typed = amount && !amount.readOnly;
    if (typed) { setValue(amount, "1"); await wait(100); }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    setValue(box.querySelector("#mark-date"), yesterday);
    setValue(box.querySelector("#mark-ref"), ${JSON.stringify(reference)});
    await wait(200);
    const submit = [...box.querySelectorAll("button")].find((b) => b.type === "submit");
    const label = submit?.textContent.trim();
    submit.click();
    await wait(2500);
    return JSON.stringify({
      step: "submitted",
      scholar,
      label,
      lastInstalmentPrefilled: Boolean(amount?.readOnly) && Boolean(amount?.value),
      page: document.body.innerText.slice(0, 6000),
      dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
    });
  })()`;

  await test("staff with the Add / edit right alone can enter the fee a scholar already paid", async () => {
    const reference = "TEST-STAFF-ENTRY-" + Date.now();
    const code = enterFee(reference);
    await signInAs("staff", "staff-fee@test.invalid", "Test Staff", feeRights("/admin/register#edit", "/admin/fee#edit"));
    await send("Page.navigate", { url: base + "/admin/register?tab=entry" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    try {
      const result = JSON.parse((await evaluate(code)) ?? "{}");
      assert.equal(result.step, "submitted", JSON.stringify(result).slice(0, 300));
      assert.equal(result.label, "Record payment");
      assert.ok(!/not permitted to/i.test(result.page), "blocked by the menu rights: " + result.page.slice(0, 300));
      // A part payment leaves a balance, so the dialog opens again for the next instalment.
      assert.match(result.page, /Year \d+: ₹1 saved/, "no confirmation: " + result.page.slice(0, 400));
      const saved = await db
        .from("scholar_records")
        .select("id, status, payload")
        .eq("kind", "payment")
        .filter("payload->>transactionNumber", "eq", reference);
      assert.equal(saved.data?.length, 1, "the payment was not saved");
      assert.equal(saved.data[0].status, "Approved");
      assert.equal(saved.data[0].payload.recordedBy, "Test Staff");
    } finally {
      await db
        .from("scholar_records")
        .delete()
        .eq("kind", "payment")
        .filter("payload->>transactionNumber", "eq", reference);
      await db.from("audit_log").delete().ilike("actor_identifier", "%@test.invalid");
    }
  });

  await test("without the Add / edit right the same entry is refused, and says why", async () => {
    const code = enterFee("TEST-STAFF-NO-RIGHT");
    await signInAs("staff", "staff-fee2@test.invalid", "Test Staff", feeRights());
    await send("Page.navigate", { url: base + "/admin/register?tab=entry" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const result = JSON.parse((await evaluate(code)) ?? "{}");
    assert.equal(result.step, "submitted", JSON.stringify(result).slice(0, 300));
    assert.match(result.page, /not permitted to add \/ edit/i);
    const saved = await db
      .from("scholar_records")
      .select("id")
      .eq("kind", "payment")
      .filter("payload->>transactionNumber", "eq", "TEST-STAFF-NO-RIGHT");
    assert.equal(saved.data?.length, 0, "a payment was saved without the right");
  });

  await test("the fee screens name their entry buttons as data entry, not as an approval", async () => {
    const access = load("@/lib/access.ts");
    for (const label of [
      "Record payment",
      "Record selected as paid (3)",
      "Record as paid in full",
      "Fee paid",
      "Enter RAC",
      "Review & lock",
    ]) {
      assert.notEqual(access.actionForLabel(label), "approve", `"${label}" reads as an approval`);
    }
  });
}

// Basic information and profile: read-only for scholars and supervisors; the audit trail for the administrator.
if (roles.includes("admin")) {
  await signInAs("scholar", ...identities.scholar);
  await test("scholar: what is filled in the personal details cannot be changed; only empty details are typed in", async () => {
    await send("Page.navigate", { url: base + "/scholar/records/personal-details" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const state = JSON.parse(
      (await evaluate(`(async () => {
        await new Promise((r) => setTimeout(r, 1500));
        const main = document.querySelector("main");
        const opener = [...(main?.querySelectorAll("button") ?? [])].find((b) => /^(Add|Update) /.test(b.textContent.trim()));
        let dialog = null;
        if (opener) {
          opener.click();
          await new Promise((r) => setTimeout(r, 600));
          const box = document.querySelector('[role="dialog"]');
          dialog = box
            ? [...box.querySelectorAll("input:not([type=file]):not([type=hidden]), textarea, select")].map((el) => ({
                id: el.id,
                filled: (el.value || "").trim() !== "",
                locked: el.readOnly === true || el.disabled === true,
              }))
            : [];
        }
        return JSON.stringify({ text: main ? main.innerText : "", hasOpener: Boolean(opener), dialog });
      })()`)) ?? "{}",
    );
    assert.match(state.text, /Your details are complete|Fill in the details that are empty|verified and locked/);
    if (state.hasOpener) {
      assert.ok(state.dialog.length > 0, "the form did not open");
      const open = state.dialog.filter((field) => field.filled && !field.locked);
      assert.deepEqual(open.map((field) => field.id), [], "a filled field can still be changed");
    } else {
      assert.match(state.text, /complete|locked/, "no form and no reason");
    }
  });

  await signInAs("supervisor", ...identities.supervisor);
  await test("supervisor: My details: filled details are read-only, empty ones can be filled", async () => {
    await send("Page.navigate", { url: base + "/supervisor/details" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const state = JSON.parse(
      (await evaluate(`(async () => {
        await new Promise((r) => setTimeout(r, 1500));
        const main = document.querySelector("main");
        const fields = [...(main?.querySelectorAll("input, textarea, select") ?? [])].map((el) => ({
          id: el.id,
          filled: (el.value || "").trim() !== "",
          locked: el.readOnly === true || el.disabled === true,
        }));
        return JSON.stringify({
          text: main ? main.innerText : "",
          fields,
          save: [...(main?.querySelectorAll("button") ?? [])].some((b) => /^Save/.test(b.textContent.trim())),
        });
      })()`)) ?? "{}",
    );
    assert.ok(state.fields.length > 0 || /not on the register/.test(state.text), "no details shown");
    const open = state.fields.filter((field) => field.filled && !field.locked);
    assert.deepEqual(open.map((field) => field.id), [], "a filled detail can still be changed");
    const empty = state.fields.filter((field) => !field.filled);
    assert.equal(state.save, empty.length > 0, "the Save button shows only while something is empty");
  });

  await signInAs("admin", "admin", "Administrator");
  await test("admin: the audit trail opens with its filters, tabs and export", async () => {
    await send("Page.navigate", { url: base + "/admin/audit" });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(settle);
    const state = JSON.parse(
      (await evaluate(`(async () => {
        for (let i = 0; i < 100; i += 1) {
          if (!/Reading the audit trail/.test(document.querySelector("main")?.innerText ?? "")) break;
          await new Promise((r) => setTimeout(r, 200));
        }
        const main = document.querySelector("main");
        return JSON.stringify({
          text: main ? main.innerText : "",
          buttons: [...(main?.querySelectorAll("button") ?? [])].map((b) => b.textContent.trim()),
        });
      })()`)) ?? "{}",
    );
    for (const want of ["Audit trail", "Person", "Activity log", "By user"]) {
      assert.ok(state.text.includes(want), `no "${want}": ` + state.text.slice(0, 300));
    }
    assert.ok(state.buttons.includes("Export PDF"), "no Export PDF");
    assert.ok(!/could not be read/.test(state.text), "the audit trail could not be read");
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
