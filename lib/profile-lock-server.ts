import { isOfficeRole } from "@/lib/access";
import { exactPattern, type DbActor } from "@/lib/db-policy";
import { changedFilledFields, supervisorRegisterViolation } from "@/lib/profile-lock";
import {
  personalDetailsFromRegister,
  supervisorBySignIn,
  supervisorEditKey,
} from "@/lib/register";

type Request = {
  /** The path after /api/db, for example "rest/v1/scholar_records". */
  path: string;
  method: string;
  /** The query that will be sent on (with the rules' own filters). */
  query: URLSearchParams;
  body: unknown;
  actor: DbActor;
  /** The name on the sign-in, for a supervisor not yet on the register. */
  name: string;
  url: string;
  serviceKey: string;
};

async function read(
  request: Request,
  table: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>[] | null> {
  const query = new URLSearchParams(params).toString();
  try {
    const response = await fetch(
      `${request.url.replace(/\/+$/, "")}/rest/v1/${table}?${query}`,
      {
        headers: {
          apikey: request.serviceKey,
          Authorization: `Bearer ${request.serviceKey}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) return null;
    const rows: unknown = await response.json();
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

const unreadable = "Your details could not be checked just now. Try again.";

function payloadOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * The rule that what is already filled in cannot be changed by the person it belongs to, kept
 * on the server. Returns the reason to refuse the request, or null to let it through.
 */
export async function profileLockRefusal(request: Request): Promise<string | null> {
  const { actor } = request;
  if (!actor) return null;
  const path = request.path.replace(/^\/+|\/+$/g, "");

  if (actor.role === "scholar" && path === "rest/v1/scholar_records") {
    if (request.method === "POST") {
      const rows = Array.isArray(request.body) ? request.body : [request.body];
      for (const row of rows.map(payloadOf)) {
        if (row.kind !== "personal_details") continue;
        const found = await read(request, "scholar_records", {
          select: "id",
          kind: "eq.personal_details",
          scholar_identifier: `ilike.${exactPattern(actor.identifier)}`,
          limit: "1",
        });
        if (found === null) return unreadable;
        if (found.length > 0) {
          return "Your details are already on file. Fill what is empty by updating them.";
        }
        const fixed = personalDetailsFromRegister(actor.identifier, "");
        const changed = changedFilledFields(fixed, payloadOf(row.payload));
        if (changed.length > 0) {
          return "What is already filled in cannot be changed. Ask the research office.";
        }
      }
      return null;
    }
    if (request.method === "PATCH") {
      const params: Record<string, string> = { select: "kind,payload,status" };
      for (const [name, value] of request.query) {
        if (name !== "select") params[name] = value;
      }
      const rows = await read(request, "scholar_records", params);
      if (rows === null) return unreadable;
      const body = payloadOf(request.body);
      for (const row of rows) {
        if (row.kind !== "personal_details") continue;
        if (row.status === "Approved") {
          return "Your details are verified and locked. Ask the research office to change them.";
        }
        if (body.payload === undefined) continue;
        const changed = changedFilledFields(payloadOf(row.payload), payloadOf(body.payload));
        if (changed.length > 0) {
          return "What is already filled in cannot be changed. Ask the research office.";
        }
      }
      return null;
    }
    return null;
  }

  if (actor.role === "supervisor" && path === "rest/v1/rpc/save_json_blob") {
    const body = payloadOf(request.body);
    if (body.p_table !== "research_register") return null;
    const rows = await read(request, "research_register", {
      select: "payload",
      id: "eq.register",
    });
    if (rows === null) return unreadable;
    const supervisor = supervisorBySignIn(actor.identifier);
    const violation = supervisorRegisterViolation(rows[0]?.payload ?? {}, body.p_payload, {
      keys: [
        actor.identifier,
        ...(supervisor
          ? [supervisorEditKey(supervisor), supervisor.supervisorId, supervisor.email]
          : []),
      ],
      emails: [actor.identifier, ...(supervisor ? [supervisor.email] : [])],
      names: [request.name, ...(supervisor ? [supervisor.name] : [])],
    });
    return violation;
  }

  if (
    !isOfficeRole(actor.role) &&
    path === "rest/v1/profile_photos" &&
    request.method === "POST"
  ) {
    // A photo is set once by the person; the research office changes it afterwards.
    const rows = Array.isArray(request.body) ? request.body : [request.body];
    for (const row of rows.map(payloadOf)) {
      if (typeof row.id !== "string") continue;
      const found = await read(request, "profile_photos", {
        select: "id",
        id: `eq.${row.id}`,
        limit: "1",
      });
      if (found === null) return unreadable;
      if (found.length > 0) {
        return "The profile photo is already set. The research office changes it.";
      }
    }
  }
  return null;
}
