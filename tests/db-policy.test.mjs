// Run: node tests/db-policy.test.mjs
// The rules for what the browser may ask of the database (lib/db-policy.ts) and the counter
// that slows floods (lib/rate-limit.ts).
import assert from "node:assert/strict";

import { load, summary, test } from "./helpers.mjs";

const { decideDbRequest, exactPattern } = load("@/lib/db-policy.ts");
const limiter = load("@/lib/rate-limit.ts");

const visitor = null;
const scholar = { role: "scholar", identifier: "Asha@Example.org" };
const supervisor = { role: "supervisor", identifier: "guide@example.org" };
const staff = { role: "staff", identifier: "staff@example.org" };
const admin = { role: "admin", identifier: "admin" };

function ask(actor, method, path, query = "", body, prefer = "") {
  return decideDbRequest({
    method,
    path,
    query: new URLSearchParams(query),
    prefer,
    actor,
    body,
  });
}
const denied = (decision) => decision.action === "deny";
const forwarded = (decision) => decision.action === "forward";

await test("a visitor reads the public lists and nothing else", () => {
  for (const table of [
    "supervisor_vacancies",
    "research_areas",
    "news_board",
    "site_settings",
  ]) {
    assert.ok(forwarded(ask(visitor, "GET", `rest/v1/${table}`, "select=*")), table);
  }
  for (const table of [
    "portal_users",
    "scholar_records",
    "research_register",
    "doctoral_office",
    "admission_office",
    "audit_log",
    "helpdesk_messages",
    "phd_drafts",
    "rac_proposals",
    "profile_photos",
    "research_team",
  ]) {
    const decision = ask(visitor, "GET", `rest/v1/${table}`, "select=*");
    assert.ok(denied(decision) && decision.status === 401, `${table} stays closed`);
  }
});

await test("a visitor cannot write a public list, call office functions, or reach other services", () => {
  assert.ok(denied(ask(visitor, "POST", "rest/v1/supervisor_vacancies", "", { a: 1 })));
  assert.ok(
    denied(
      ask(visitor, "PATCH", "rest/v1/site_settings", "id=eq.office", { phd_open: true }),
    ),
  );
  assert.ok(denied(ask(visitor, "DELETE", "rest/v1/supervisor_vacancies", "id=eq.1")));
  assert.ok(denied(ask(visitor, "POST", "rest/v1/rpc/list_phd_drafts", "", {})));
  assert.ok(
    denied(
      ask(visitor, "POST", "rest/v1/rpc/save_json_blob", "", { p_table: "news_board" }),
    ),
  );
  assert.ok(denied(ask(visitor, "POST", "rest/v1/rpc/drop_everything", "", {})));
  assert.ok(denied(ask(visitor, "GET", "auth/v1/admin/users")));
  assert.ok(denied(ask(visitor, "GET", "storage/v1/object/list/portal-private")));
  assert.ok(denied(ask(visitor, "GET", "graphql/v1")));
  assert.ok(denied(ask(visitor, "GET", "rest/v1/")));
  assert.ok(denied(ask(visitor, "PUT", "rest/v1/news_board", "", {})));
});

await test("a visitor can look up an application only by its number with the date of birth", () => {
  const ok = ask(
    visitor,
    "GET",
    "rest/v1/phd_applications",
    "select=id&application_no=ilike.SJU/PHD/Jan27/0001&date_of_birth=eq.1999-05-04",
  );
  assert.ok(forwarded(ok));
  assert.equal(ok.query.get("limit"), "20", "a few rows at most");
  for (const query of [
    "select=*",
    "select=*&date_of_birth=eq.1999-05-04",
    "select=*&application_no=ilike.*",
    "select=*&application_no=ilike.%25&date_of_birth=eq.1999-05-04",
    "select=*&application_no=ilike.SJU_PHD&date_of_birth=gte.1990-01-01",
    "select=*&application_no=ilike.SJU/PHD/Jan27/0001",
  ]) {
    assert.ok(denied(ask(visitor, "GET", "rest/v1/phd_applications", query)), query);
  }
  assert.ok(
    denied(ask(visitor, "HEAD", "rest/v1/phd_applications", "select=id")),
    "no counting",
  );
});

await test("a visitor can find a draft or submission by mobile number together with the e-mail", () => {
  assert.ok(
    forwarded(
      ask(
        visitor,
        "GET",
        "rest/v1/phd_applications",
        "select=id&payload-%3E%3Emobile=eq.9876543210&email=ilike.asha%40example.org",
      ),
    ),
  );
  const query = new URLSearchParams();
  query.set("payload->>mobile", "eq.9876543210");
  assert.ok(
    denied(
      decideDbRequest({
        method: "GET",
        path: "rest/v1/phd_applications",
        query,
        prefer: "",
        actor: null,
      }),
    ),
    "the mobile number alone is refused",
  );
});

await test("a visitor can send a supervisor application but only in the proper shape", () => {
  const row = {
    application_no: "SJU/PHD/SUP.App/01/27/001",
    date_of_birth: "1980-01-01",
    applicant_name: "A Guide",
    email: "guide@example.org",
    status: "Acknowledgement sent",
    payload: {},
  };
  assert.ok(forwarded(ask(visitor, "POST", "rest/v1/supervisor_applications", "", row)));
  assert.ok(
    denied(
      ask(visitor, "POST", "rest/v1/supervisor_applications", "", {
        ...row,
        status: "Approved",
      }),
    ),
  );
  assert.ok(
    denied(
      ask(visitor, "POST", "rest/v1/supervisor_applications", "", { ...row, id: "x" }),
    ),
  );
  assert.ok(
    denied(ask(visitor, "POST", "rest/v1/supervisor_applications", "", [row, row])),
  );
  assert.ok(
    denied(
      ask(visitor, "POST", "rest/v1/supervisor_applications", "on_conflict=id", row),
    ),
    "no overwriting",
  );
  assert.ok(
    denied(
      ask(
        visitor,
        "POST",
        "rest/v1/supervisor_applications",
        "",
        row,
        "resolution=merge-duplicates",
      ),
    ),
  );
  assert.ok(
    denied(ask(visitor, "POST", "rest/v1/phd_applications", "", row)),
    "Ph.D. goes through /api/apply/phd",
  );
  assert.ok(
    denied(
      ask(visitor, "PATCH", "rest/v1/supervisor_applications", "id=eq.1", {
        status: "Approved",
      }),
    ),
  );
});

await test("only the functions of the public form are open to a visitor", () => {
  for (const name of [
    "issue_application_number",
    "upsert_phd_draft",
    "get_phd_draft",
    "delete_phd_draft",
  ]) {
    assert.ok(forwarded(ask(visitor, "POST", `rest/v1/rpc/${name}`, "", {})), name);
  }
  for (const name of [
    "list_phd_drafts",
    "update_phd_draft_follow",
    "delete_phd_draft_office",
    "submit_phd_application",
  ]) {
    assert.ok(denied(ask(visitor, "POST", `rest/v1/rpc/${name}`, "", {})), name);
  }
});

await test("nobody reaches the sign-in accounts, counters, notices or forms from the browser", () => {
  for (const actor of [visitor, scholar, supervisor, staff, admin]) {
    for (const table of [
      "portal_users",
      "application_counters",
      "phd_drafts",
      "portal_notices",
      "portal_forms",
      "thesis_evaluation",
      "helpdesk_messages",
    ]) {
      const read = ask(actor, "GET", `rest/v1/${table}`, "select=*");
      assert.ok(read.action === "empty" || denied(read), `${actor?.role} reads ${table}`);
      assert.ok(
        denied(ask(actor, "POST", `rest/v1/${table}`, "", {})),
        `${actor?.role} writes ${table}`,
      );
      assert.ok(
        denied(ask(actor, "PATCH", `rest/v1/${table}`, "id=eq.1", {})),
        `${actor?.role} changes ${table}`,
      );
      assert.ok(
        denied(ask(actor, "DELETE", `rest/v1/${table}`, "id=eq.1")),
        `${actor?.role} deletes ${table}`,
      );
    }
  }
});

await test("a closed table answers a signed-in reader with nothing, so the screens still open", () => {
  assert.equal(ask(scholar, "GET", "rest/v1/portal_users", "select=*").action, "empty");
  assert.equal(
    ask(supervisor, "HEAD", "rest/v1/phd_applications", "select=id").action,
    "empty",
  );
  assert.equal(
    ask(scholar, "HEAD", "rest/v1/supervisor_applications", "select=id").action,
    "empty",
  );
});

await test("a scholar sees only the scholar's own application and own records can be changed", () => {
  const own = ask(scholar, "GET", "rest/v1/phd_applications", "select=*");
  assert.ok(forwarded(own));
  assert.deepEqual(
    own.query.getAll("email"),
    ["ilike.Asha@Example.org"],
    "the e-mail filter is added by the server",
  );
  assert.ok(
    denied(
      ask(scholar, "PATCH", "rest/v1/phd_applications", "id=eq.1", {
        status: "Admitted",
      }),
    ),
  );
  assert.ok(denied(ask(scholar, "DELETE", "rest/v1/phd_applications", "id=eq.1")));

  const change = ask(scholar, "PATCH", "rest/v1/scholar_records", "id=eq.5", {
    status: "Submitted",
    payload: {},
  });
  assert.ok(forwarded(change));
  assert.deepEqual(change.query.getAll("scholar_identifier"), ["ilike.Asha@Example.org"]);
  assert.ok(
    denied(
      ask(scholar, "PATCH", "rest/v1/scholar_records", "id=eq.5", { status: "Approved" }),
    ),
    "a scholar cannot approve",
  );
  assert.ok(
    denied(
      ask(scholar, "PATCH", "rest/v1/scholar_records", "id=eq.5", {
        scholar_identifier: "other@x.org",
      }),
    ),
    "cannot hand a record to someone else",
  );
  assert.ok(
    forwarded(
      ask(scholar, "POST", "rest/v1/scholar_records", "", {
        scholar_identifier: "asha@example.org",
        status: "Submitted",
        kind: "x",
      }),
    ),
  );
  assert.ok(
    denied(
      ask(scholar, "POST", "rest/v1/scholar_records", "", {
        scholar_identifier: "other@x.org",
        status: "Submitted",
        kind: "x",
      }),
    ),
    "cannot file under another scholar",
  );
});

await test("a scholar who signs in with a number can still open the scholar's own application by its number", () => {
  const byNumber = {
    role: "scholar",
    identifier: "SJU/2026/007",
    applicationNumbers: ["SJU/PHD/Jul26/0007"],
  };
  const own = ask(
    byNumber,
    "GET",
    "rest/v1/phd_applications",
    "select=*&application_no=eq.SJU/PHD/Jul26/0007",
  );
  assert.ok(forwarded(own));
  assert.deepEqual(
    own.query.getAll("email"),
    [],
    "no e-mail filter is needed for the scholar's own number",
  );
  const other = ask(
    byNumber,
    "GET",
    "rest/v1/phd_applications",
    "select=*&application_no=eq.SJU/PHD/Jul26/0008",
  );
  assert.ok(forwarded(other));
  assert.equal(
    other.query.getAll("email").length,
    1,
    "another number is still held to the e-mail filter",
  );
});

await test("a supervisor passes on or returns a record but does not approve it finally", () => {
  assert.ok(
    forwarded(
      ask(supervisor, "PATCH", "rest/v1/scholar_records", "id=eq.5", {
        status: "Supervisor approved",
        payload: {},
      }),
    ),
  );
  assert.ok(
    forwarded(
      ask(supervisor, "PATCH", "rest/v1/scholar_records", "id=eq.5", {
        status: "Returned",
      }),
    ),
  );
  assert.ok(
    denied(
      ask(supervisor, "PATCH", "rest/v1/scholar_records", "id=eq.5", {
        status: "Approved",
      }),
    ),
  );
  assert.ok(denied(ask(supervisor, "DELETE", "rest/v1/scholar_records", "id=eq.5")));
  assert.ok(forwarded(ask(supervisor, "POST", "rest/v1/rac_proposals", "", { a: 1 })));
  assert.ok(
    denied(
      ask(supervisor, "PATCH", "rest/v1/rac_proposals", "id=eq.1&status=eq.Submitted", {
        status: "Approved",
      }),
    ),
  );
  assert.ok(
    denied(
      ask(supervisor, "PATCH", "rest/v1/rac_proposals", "id=eq.1", { nominees: [] }),
    ),
    "only while waiting",
  );
  assert.ok(
    forwarded(
      ask(supervisor, "PATCH", "rest/v1/rac_proposals", "id=eq.1&status=eq.Submitted", {
        nominees: [],
        reason: "x",
      }),
    ),
  );
  assert.ok(
    denied(
      ask(scholar, "PATCH", "rest/v1/rac_proposals", "id=eq.1&status=eq.Submitted", {
        nominees: [],
      }),
    ),
  );
  assert.ok(
    forwarded(ask(supervisor, "GET", "rest/v1/supervisor_applications", "select=*")),
  );
});

await test("scholars and supervisors cannot change the public site or the office lists", () => {
  for (const actor of [scholar, supervisor]) {
    for (const table of [
      "supervisor_vacancies",
      "site_settings",
      "research_team",
      "scholar_allocations",
    ]) {
      assert.ok(
        denied(ask(actor, "POST", `rest/v1/${table}`, "", { a: 1 })),
        `${actor.role} adds to ${table}`,
      );
      assert.ok(
        denied(ask(actor, "PATCH", `rest/v1/${table}`, "id=eq.1", { a: 1 })),
        `${actor.role} changes ${table}`,
      );
      assert.ok(
        denied(ask(actor, "DELETE", `rest/v1/${table}`, "id=eq.1")),
        `${actor.role} deletes from ${table}`,
      );
    }
    for (const table of [
      "news_board",
      "research_areas",
      "exam_office",
      "thesis_panels",
    ]) {
      assert.ok(
        denied(
          ask(actor, "POST", "rest/v1/rpc/save_json_blob", "", {
            p_table: table,
            p_id: "x",
            p_payload: {},
          }),
        ),
        `${actor.role} saves ${table}`,
      );
    }
    assert.ok(denied(ask(actor, "POST", "rest/v1/rpc/list_phd_drafts", "", {})));
  }
  assert.ok(
    forwarded(
      ask(scholar, "POST", "rest/v1/rpc/save_json_blob", "", {
        p_table: "doctoral_office",
        p_id: "office",
        p_payload: {},
      }),
    ),
  );
  assert.ok(
    denied(
      ask(scholar, "POST", "rest/v1/rpc/save_json_blob", "", {
        p_table: "admission_office",
      }),
    ) === false,
  );
});

await test("staff and the administrator can run the office", () => {
  for (const actor of [staff, admin]) {
    assert.ok(forwarded(ask(actor, "GET", "rest/v1/phd_applications", "select=*")));
    assert.ok(
      forwarded(
        ask(actor, "PATCH", "rest/v1/phd_applications", "id=eq.1", {
          status: "Admitted",
        }),
      ),
    );
    assert.ok(
      forwarded(ask(actor, "POST", "rest/v1/supervisor_vacancies", "", { a: 1 })),
    );
    assert.ok(
      forwarded(
        ask(
          actor,
          "POST",
          "rest/v1/supervisor_vacancies",
          "on_conflict=id",
          [{ a: 1 }],
          "resolution=merge-duplicates",
        ),
      ),
    );
    assert.ok(
      forwarded(
        ask(actor, "POST", "rest/v1/rpc/save_json_blob", "", { p_table: "exam_office" }),
      ),
    );
    assert.ok(forwarded(ask(actor, "POST", "rest/v1/rpc/list_phd_drafts", "", {})));
  }
});

await test("the audit trail can be added to by anyone signed in, read only by the administrator, never changed", () => {
  assert.ok(forwarded(ask(scholar, "POST", "rest/v1/audit_log", "", { action: "x" })));
  assert.ok(denied(ask(visitor, "POST", "rest/v1/audit_log", "", { action: "x" })));
  assert.ok(forwarded(ask(admin, "GET", "rest/v1/audit_log", "select=*")));
  assert.equal(ask(staff, "GET", "rest/v1/audit_log", "select=*").action, "empty");
  for (const actor of [staff, admin]) {
    assert.ok(
      denied(ask(actor, "PATCH", "rest/v1/audit_log", "id=eq.1", { action: "y" })),
    );
    assert.ok(denied(ask(actor, "DELETE", "rest/v1/audit_log", "id=eq.1")));
  }
});

await test("photos: a member may change only the member's own", () => {
  assert.ok(
    forwarded(
      ask(
        scholar,
        "POST",
        "rest/v1/profile_photos",
        "on_conflict=id",
        { id: "scholar:asha@example.org", photo: "data:" },
        "resolution=merge-duplicates",
      ),
    ),
  );
  assert.ok(
    denied(
      ask(
        scholar,
        "POST",
        "rest/v1/profile_photos",
        "on_conflict=id",
        { id: "supervisor:guide@example.org", photo: "data:" },
        "resolution=merge-duplicates",
      ),
    ),
  );
  assert.ok(
    forwarded(
      ask(staff, "POST", "rest/v1/profile_photos", "", {
        id: "supervisor:guide@example.org",
        photo: "data:",
      }),
    ),
  );
});

await test("the Helpdesk questions kept in the examination table are out of the browser's reach", () => {
  for (const actor of [scholar, supervisor, staff, admin]) {
    const read = ask(actor, "GET", "rest/v1/exam_office", "select=payload&id=eq.office");
    assert.ok(forwarded(read));
    assert.deepEqual(read.query.getAll("id"), ["eq.office", "neq.helpdesk"]);
    assert.ok(
      denied(
        ask(actor, "POST", "rest/v1/rpc/save_json_blob", "", {
          p_table: "exam_office",
          p_id: "helpdesk",
          p_payload: {},
          p_updated_at: null,
        }),
      ),
      `${actor.role} cannot write the questions`,
    );
  }
});

await test("a query cannot reach into another table through an embedded select", () => {
  assert.ok(
    denied(ask(admin, "GET", "rest/v1/scholar_records", "select=*,phd_applications(*)")),
  );
});

await test("the exact pattern keeps text and wildcards apart", () => {
  assert.equal(exactPattern(" a_b%c@x.org "), "a\\_b\\%c@x.org");
  assert.equal(exactPattern("a*b"), "a\\%b", "a star is never a wildcard");
});

await test("the counter refuses the request after the limit and frees it after the window", () => {
  limiter.resetRateLimits();
  const start = 1_000_000;
  for (let i = 0; i < 3; i += 1)
    assert.ok(limiter.rateLimit("k", 3, 1000, start).allowed);
  const refused = limiter.rateLimit("k", 3, 1000, start + 10);
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds >= 1);
  assert.ok(
    limiter.rateLimit("other", 3, 1000, start + 10).allowed,
    "another key is free",
  );
  assert.ok(
    limiter.rateLimit("k", 3, 1000, start + 1500).allowed,
    "free after the window",
  );
});

summary("db-policy");
