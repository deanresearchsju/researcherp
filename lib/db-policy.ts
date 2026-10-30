import { isOfficeRole } from "@/lib/access";
import type { Role } from "@/types";

/**
 * Which database requests the browser may make. Every browser request to the database passes
 * through /api/db, which asks this module before forwarding it with the server's own key. The
 * database itself is closed to the public key, so a visitor who has the public key (it is
 * visible in the browser) still reaches nothing, and a signed-in member reaches only what the
 * rules below give that role.
 *
 * Anything not listed is refused.
 */

export type DbActor = {
  role: Role;
  identifier: string;
  /** The application numbers that belong to this scholar (from the register), read by the server. */
  applicationNumbers?: readonly string[];
} | null;

export type DbRequest = {
  method: string;
  /** The part of the path after /api/db/, such as "rest/v1/phd_applications". */
  path: string;
  query: URLSearchParams;
  /** The lower-cased Prefer header of the request. */
  prefer: string;
  actor: DbActor;
  /** The parsed JSON body of a write, when there is one. */
  body?: unknown;
};

export type DbDecision =
  | {
      action: "forward";
      /** The query to send on (a rule may add filters or a row limit). */
      query: URLSearchParams;
      /** The slice of the rate limit this request counts against. */
      rate: { key: string; limit: number; windowMs: number };
      /** The answer is trimmed to what this member may see (the register's contact details). */
      project?: "register";
    }
  /** Answered as an empty result, the way a closed table would answer a reader: nothing to see. */
  | { action: "empty" }
  | { action: "deny"; status: number; message: string };

type Group = "anon" | "signedIn" | "office" | "scholar" | "supervisor";
type Op = "read" | "insert" | "update" | "delete";

type Context = {
  request: DbRequest;
  op: Op;
  table: string;
  actor: DbActor;
  query: URLSearchParams;
};

type TableRule = Partial<Record<Op, readonly Group[]>> & {
  /** Returns a reason when this request must be refused although the role may use the table. */
  guard?: (context: Context) => string | null;
  /** Filters added to the request so that a role reaches only its own rows. */
  scope?: (context: Context) => Array<[string, string]>;
};

const minute = 60_000;
const hour = 60 * minute;

/** `ilike` pattern for an exact, case-blind match of a text. */
export function exactPattern(value: string) {
  return value.trim().replace(/[\\%_*]/g, (char) => `\\${char === "*" ? "%" : char}`);
}

const everyone: readonly Group[] = ["anon", "signedIn"];
const office: readonly Group[] = ["office"];

/** A caller who may name only an application by its number and date of birth, or by mobile and mail. */
function applicationLookup(context: Context) {
  if (context.actor && isOfficeRole(context.actor.role)) return null;
  // A scholar (or supervisor) reads their own application through a filter added below.
  if (context.actor?.role === ownApplicationReader[context.table]) return null;
  const { query } = context;
  if (context.request.method === "HEAD") return "Counting applications is not allowed.";
  const number = query.get("application_no") ?? "";
  const birth = query.get("date_of_birth") ?? "";
  const mobile = query.get("payload->>mobile") ?? "";
  const email = query.get("email") ?? "";
  const exactNumber = /^(ilike|eq)\.[A-Za-z0-9/.\- ]{4,40}$/.test(number);
  const exactBirth = /^eq\.\d{4}-\d{2}-\d{2}$/.test(birth);
  const exactMobile = /^eq\.[0-9+\- ]{6,20}$/.test(mobile);
  const exactEmail =
    /^eq\.[^*%\s]{5,120}$/.test(email) || /^ilike\.[^*%\s]{5,120}$/.test(email);
  if ((exactNumber && exactBirth) || (exactMobile && exactEmail)) return null;
  return "Name the application number with the date of birth, or the mobile number with the e-mail address.";
}

const ownApplicationReader: Record<string, Role> = {
  phd_applications: "scholar",
  supervisor_applications: "supervisor",
};

const supervisorApplicationColumns = new Set([
  "application_no",
  "date_of_birth",
  "applicant_name",
  "email",
  "status",
  "payload",
]);

function singleObject(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function insertShape(context: Context) {
  const row = singleObject(context.request.body);
  if (!row) return "Send one record at a time.";
  if (context.query.has("on_conflict") || /resolution=/.test(context.request.prefer)) {
    return "Overwriting is not allowed.";
  }
  if (!Object.keys(row).every((key) => supervisorApplicationColumns.has(key))) {
    return "That record has a field that is not allowed.";
  }
  if (row.status !== "Acknowledgement sent")
    return "A new application starts as just sent.";
  for (const key of ["application_no", "date_of_birth", "applicant_name", "email"]) {
    if (typeof row[key] !== "string" || !(row[key] as string).trim()) {
      return "The application is incomplete.";
    }
  }
  return null;
}

/** An update may change only the named columns. */
function onlyColumns(context: Context, allowed: readonly string[]) {
  const row = singleObject(context.request.body);
  if (!row) return "Send one change at a time.";
  return Object.keys(row).every((key) => allowed.includes(key))
    ? null
    : "That change touches a field that is not allowed.";
}

const recordColumns = [
  "scholar_name",
  "status",
  "payload",
  "file_name",
  "file_data",
  "supervisor_identifier",
  "supervisor_name",
] as const;

/** A scholar only submits; a supervisor only passes a record on or returns it; the office decides. */
function recordStatus(context: Context, status: unknown) {
  if (status === undefined) return null;
  const role = context.actor?.role;
  if (role === "scholar") {
    return status === "Submitted" ? null : "A scholar can only submit a record.";
  }
  if (role === "supervisor") {
    return status === "Supervisor approved" ||
      status === "Returned" ||
      status === "Submitted"
      ? null
      : "A supervisor can only pass on or return a record.";
  }
  return null;
}

const tables: Record<string, TableRule> = {
  // Shown on the public site.
  supervisor_vacancies: {
    read: everyone,
    insert: office,
    update: office,
    delete: office,
  },
  site_settings: { read: everyone, insert: office, update: office },
  // Read through the lock-protected save function; the table itself is read by everyone.
  research_areas: { read: everyone },
  news_board: { read: everyone },

  research_team: { read: ["signedIn"], insert: office, update: office, delete: office },
  profile_photos: {
    read: ["signedIn"],
    insert: ["signedIn"],
    update: ["signedIn"],
    guard: (context) => {
      if (context.op === "read" || !context.actor) return null;
      if (isOfficeRole(context.actor.role)) return null;
      // A person sets the own photo once (/api/db checks there is none); the office replaces it.
      if (context.op !== "insert") return "The profile photo is changed by the research office.";
      const rows = Array.isArray(context.request.body)
        ? context.request.body
        : [context.request.body];
      const own = `${context.actor.role}:${context.actor.identifier}`.toLowerCase();
      const ok = rows.every((row) => {
        const id = singleObject(row)?.id;
        return typeof id === "string" && id.toLowerCase() === own;
      });
      return ok ? null : "You can set only your own photo.";
    },
  },

  // One-row office records. Members read them; scholars and supervisors save the two they work in.
  research_register: { read: ["signedIn"] },
  admission_office: { read: ["signedIn"] },
  doctoral_office: { read: ["signedIn"] },
  exam_office: {
    read: ["signedIn"],
    // The Helpdesk questions are kept in this table; they pass only through /api/queries.
    scope: (context) => (context.op === "read" ? [["id", "neq.helpdesk"]] : []),
  },
  thesis_panels: { read: ["signedIn"] },

  scholar_allocations: {
    read: ["signedIn"],
    insert: office,
    update: office,
    delete: office,
  },
  rac_proposals: {
    read: ["signedIn"],
    insert: ["office", "supervisor"],
    update: ["office", "supervisor"],
    delete: office,
    guard: (context) => {
      if (context.op !== "update" || !context.actor || isOfficeRole(context.actor.role))
        return null;
      // A supervisor may rewrite the names in a proposal that is still waiting; nothing else.
      if (context.query.get("status") !== "eq.Submitted") {
        return "Only a proposal that is still waiting can be changed.";
      }
      return onlyColumns(context, ["nominees", "reason"]);
    },
  },
  scholar_records: {
    read: ["signedIn"],
    insert: ["office", "scholar"],
    update: ["office", "scholar", "supervisor"],
    delete: ["office", "scholar"],
    scope: (context) => {
      // A scholar changes or deletes only the records filed under the scholar's own sign-in.
      // The personal details are never deleted by the scholar, and are changed only to fill
      // what is empty (/api/db checks that).
      if (context.actor?.role === "scholar" && context.op !== "read") {
        return [
          ["scholar_identifier", `ilike.${exactPattern(context.actor.identifier)}`],
          ...(context.op === "delete"
            ? [["kind", "neq.personal_details"] as [string, string]]
            : []),
        ];
      }
      if (context.actor?.role === "supervisor" && context.op !== "read") {
        return [["kind", "neq.personal_details"]];
      }
      return [];
    },
    guard: (context) => {
      if (!context.actor || isOfficeRole(context.actor.role)) return null;
      if (context.op === "insert") {
        const rows = Array.isArray(context.request.body)
          ? context.request.body
          : [context.request.body];
        const own = context.actor.identifier.trim().toLowerCase();
        const ok =
          context.actor.role === "scholar" &&
          rows.every((row) => {
            const id = singleObject(row)?.scholar_identifier;
            return typeof id === "string" && id.trim().toLowerCase() === own;
          });
        if (!ok) return "You can file records only under your own sign-in.";
        for (const row of rows) {
          const bad = recordStatus(context, singleObject(row)?.status);
          if (bad) return bad;
        }
        return null;
      }
      if (context.op === "update") {
        const columns = onlyColumns(context, recordColumns);
        if (columns) return columns;
        return recordStatus(context, singleObject(context.request.body)?.status);
      }
      return null;
    },
  },

  phd_applications: {
    read: ["anon", "scholar", "office"],
    update: office,
    delete: office,
    insert: office,
    guard: (context) => (context.op === "read" ? applicationLookup(context) : null),
    scope: (context) => {
      const actor = context.actor;
      if (context.op !== "read" || actor?.role !== "scholar") return [];
      // Asking for the scholar's own application by its number needs no further filter.
      const asked = context.query.get("application_no") ?? "";
      const own = (actor.applicationNumbers ?? []).map((item) =>
        item.trim().toLowerCase(),
      );
      if (asked.startsWith("eq.") && own.includes(asked.slice(3).trim().toLowerCase()))
        return [];
      return [["email", `ilike.${exactPattern(actor.identifier)}`]];
    },
  },
  supervisor_applications: {
    read: ["anon", "supervisor", "office"],
    insert: ["anon", "office"],
    update: office,
    delete: office,
    guard: (context) => {
      if (context.op === "read") return applicationLookup(context);
      if (context.op === "insert" && !context.actor) return insertShape(context);
      return null;
    },
    scope: (context) =>
      context.op === "read" && context.actor?.role === "supervisor"
        ? [["email", `ilike.${exactPattern(context.actor.identifier)}`]]
        : [],
  },

  // The journal of actions: anybody signed in may add a line; only the administrator reads it;
  // nobody changes or deletes a line.
  audit_log: {
    insert: ["signedIn"],
    guard: (context) => {
      if (context.op === "read" && context.actor?.role !== "admin")
        return "Only the administrator reads the audit trail.";
      return null;
    },
    read: ["signedIn"],
  },
};

/** Tables that nobody reaches from the browser: they are read and written by the server only. */
const serverOnly = new Set([
  "portal_users",
  "application_counters",
  "phd_drafts",
  "helpdesk_messages",
  "portal_notices",
  "portal_forms",
  "thesis_evaluation",
  "file_storage",
]);

const jsonBlobTables: Record<string, readonly Group[]> = {
  doctoral_office: ["office", "scholar", "supervisor"],
  // The register (basic information and profiles) is kept by the research office. A supervisor
  // saves it only to fill the supervisor's own empty details: /api/db checks that (lib/profile-lock).
  research_register: ["office", "supervisor"],
  admission_office: ["office", "scholar"],
  exam_office: ["office"],
  news_board: office,
  research_areas: office,
  thesis_panels: office,
};

function groupsOf(actor: DbActor): Set<Group> {
  // What a visitor may do, a signed-in member may do as well.
  const groups = new Set<Group>(["anon"]);
  if (!actor) return groups;
  groups.add("signedIn");
  if (isOfficeRole(actor.role)) groups.add("office");
  if (actor.role === "scholar") groups.add("scholar");
  if (actor.role === "supervisor") groups.add("supervisor");
  return groups;
}

function allowed(rule: readonly Group[] | undefined, groups: Set<Group>) {
  return Boolean(rule?.some((group) => groups.has(group)));
}

function opOf(method: string): Op | null {
  switch (method) {
    case "GET":
    case "HEAD":
      return "read";
    case "POST":
      return "insert";
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return null;
  }
}

const refuse = (status: number, message: string): DbDecision => ({
  action: "deny",
  status,
  message,
});

function who(actor: DbActor, address: string) {
  return actor ? `${actor.role}:${actor.identifier.toLowerCase()}` : `anon:${address}`;
}

/** Functions of the database a visitor who is not signed in may call, with how often. */
const publicFunctions: Record<string, { limit: number; windowMs: number }> = {
  issue_application_number: { limit: 12, windowMs: 10 * minute },
  upsert_phd_draft: { limit: 120, windowMs: 10 * minute },
  get_phd_draft: { limit: 40, windowMs: 10 * minute },
  delete_phd_draft: { limit: 20, windowMs: 10 * minute },
};

const officeFunctions = new Set([
  "list_phd_drafts",
  "update_phd_draft_follow",
  "delete_phd_draft_office",
]);

function decideFunction(request: DbRequest, name: string, address: string): DbDecision {
  const { actor } = request;
  if (request.method !== "POST") return refuse(405, "Not allowed.");
  const groups = groupsOf(actor);
  const key = who(actor, address);

  if (name === "save_json_blob") {
    if (!actor) return refuse(401, "Sign in first.");
    const body = singleObject(request.body);
    const table = typeof body?.p_table === "string" ? body.p_table : "";
    if (!allowed(jsonBlobTables[table], groups)) {
      return refuse(403, "You may not save that record.");
    }
    // The Helpdesk questions are written only by the server (/api/queries).
    if (body?.p_id === "helpdesk") return refuse(403, "You may not save that record.");
    // The stored register that came with the ERP is set only by the server's own tool.
    if (table === "research_register" && body?.p_id !== "register") {
      return refuse(403, "You may not save that record.");
    }
    return {
      action: "forward",
      query: request.query,
      rate: { key: `${key}:db`, limit: 1500, windowMs: minute },
    };
  }
  if (officeFunctions.has(name)) {
    if (!allowed(office, groups)) return refuse(actor ? 403 : 401, "Not allowed.");
    return {
      action: "forward",
      query: request.query,
      rate: { key: `${key}:db`, limit: 1500, windowMs: minute },
    };
  }
  const limited = publicFunctions[name];
  if (limited) {
    return {
      action: "forward",
      query: request.query,
      rate: {
        key: `${key}:fn:${name}`,
        limit: limited.limit,
        windowMs: limited.windowMs,
      },
    };
  }
  return refuse(404, "Not found.");
}

/** Decides what becomes of one browser request to the database. */
export function decideDbRequest(request: DbRequest, address = "unknown"): DbDecision {
  const path = request.path.replace(/^\/+|\/+$/g, "");
  const rpc = /^rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
  if (rpc) return decideFunction(request, rpc[1], address);
  const match = /^rest\/v1\/([a-z_]+)$/.exec(path);
  if (!match || match[1] === "rpc") return refuse(404, "Not found.");
  const name = match[1];
  // A query that reaches into other tables (select=*,other(*)) is never needed here.
  if ((request.query.get("select") ?? "").includes("(")) {
    return refuse(400, "That query is not allowed.");
  }

  const { actor } = request;
  const op = opOf(request.method);
  if (!op) return refuse(405, "Not allowed.");
  const groups = groupsOf(actor);
  const key = who(actor, address);

  const rule = serverOnly.has(name) ? undefined : tables[name];
  if (!rule) {
    // A closed table answers a reader with nothing and refuses a writer.
    if (op === "read" && actor) return { action: "empty" };
    return refuse(actor ? 403 : 401, actor ? "Not allowed." : "Sign in first.");
  }

  if (!allowed(rule[op], groups)) {
    if (op === "read" && actor) return { action: "empty" };
    return refuse(actor ? 403 : 401, actor ? "Not allowed." : "Sign in first.");
  }

  // A plain write only: no upsert from the browser for the tables that hold applications.
  if (
    op === "insert" &&
    (request.query.has("on_conflict") || /resolution=/.test(request.prefer))
  ) {
    if (!allowed(office, groups) && name !== "profile_photos") {
      return refuse(403, "Overwriting is not allowed.");
    }
  }

  const context: Context = { request, op, table: name, actor, query: request.query };
  const reason = rule.guard?.(context);
  if (reason) {
    if (op === "read" && actor) return { action: "empty" };
    return refuse(actor ? 403 : 400, reason);
  }

  const query = new URLSearchParams(request.query);
  for (const [field, value] of rule.scope?.(context) ?? []) query.append(field, value);

  if (!actor) {
    // A visitor who is not signed in sees a few rows at a time.
    const asked = Number(query.get("limit"));
    const cap = name === "supervisor_vacancies" || name === "research_areas" ? 500 : 20;
    if (op === "read" && (!Number.isFinite(asked) || asked <= 0 || asked > cap)) {
      query.set("limit", String(cap));
    }
  }

  const rate = !actor
    ? name.endsWith("_applications")
      ? {
          key: `${key}:applications:${op}`,
          limit: op === "read" ? 30 : 6,
          windowMs: op === "read" ? 10 * minute : hour,
        }
      : { key: `${key}:db`, limit: 240, windowMs: minute }
    : { key: `${key}:db`, limit: 1500, windowMs: minute };

  const project =
    name === "research_register" && op === "read" && !allowed(office, groups)
      ? ("register" as const)
      : undefined;
  return { action: "forward", query, rate, ...(project ? { project } : {}) };
}
