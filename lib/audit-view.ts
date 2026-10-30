import type { AuditEntry } from "@/lib/audit";
import { createSupabase } from "@/lib/supabase/client";

/** What the administrator asks of the audit trail. Dates are "YYYY-MM-DD". */
export type AuditQuery = {
  from?: string;
  to?: string;
  /** Role of the person who acted. */
  role?: string;
  /** A name, sign-in or number: what the person did and what was done for them. */
  person?: string;
  /** The part of the ERP: the word before the first ":" of the action. */
  module?: string;
};

/** The module names shown to the administrator, by the first word of the action. */
export const auditModules: Record<string, string> = {
  auth: "Sign-in and passwords",
  record: "Scholar requests and records",
  rac: "RAC",
  committee: "Doctoral committees",
  synopsis: "Synopsis",
  thesis: "Thesis",
  viva: "Viva",
  completion: "Completion",
  plagiarism: "Plagiarism",
  examiner: "Examiner reports",
  evaluators: "Thesis evaluators",
  colloquium: "Colloquium",
  payment: "Fees",
  "fee-settings": "Fee settings",
  coursework: "Course work",
  nptel: "NPTEL",
  vidwan: "Vidwan ID",
  batch: "Course set-up",
  subject: "Course set-up",
  enrollment: "Course set-up",
  "course-window": "Course set-up",
  semester: "Semester promotion",
  exam: "Examination",
  invigilation: "Invigilation",
  letter: "Letters",
  admission: "Selection",
  registration: "Registration numbers",
  register: "Registers",
  profile: "Profiles",
  user: "Users",
  "approval-rules": "Approval rules",
  helpdesk: "Helpdesk",
  site: "Website",
  access: "Report access",
  "test-data": "Test data",
};

export function moduleOf(action: string) {
  return action.split(":")[0] ?? action;
}

export function moduleLabel(action: string) {
  const key = moduleOf(action);
  return auditModules[key] ?? key.replace(/-/g, " ");
}

/** "record:Supervisor approved" → "Record · Supervisor approved". */
export function actionLabel(action: string) {
  const [first, ...rest] = action.split(":");
  const words = (text: string) =>
    text.replace(/[-_]/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
  return [words(first ?? action), ...rest.map(words)].join(" · ");
}

export type AuditKind = "Submitted" | "Approved" | "Returned" | "Sign-in" | "Changed";

/** The kind of act, for the count of what each person has done. */
export function kindOf(action: string): AuditKind {
  const text = action.toLowerCase();
  if (text.startsWith("auth:")) return "Sign-in";
  if (/(returned|rejected|reject|turned-down|declined)/.test(text)) return "Returned";
  if (/(submitted|resubmitted|asked|followed-up|requested|registered|added)/.test(text))
    return "Submitted";
  if (/(approved|recommended|passed|verified|issued|published|frozen|selected|accepted|answered)/.test(text))
    return "Approved";
  return "Changed";
}

/** Keeps a typed word safe inside a database filter. */
function safeWord(value: string) {
  return value.replace(/[^\p{L}\p{N}@._ '-]/gu, "").trim().slice(0, 80);
}

export async function loadAuditTrail(query: AuditQuery, limit: number) {
  const supabase = createSupabase();
  if (!supabase) {
    return { ok: false as const, message: "The database is not set up." };
  }
  let request = supabase
    .from("audit_log")
    .select("id, at, actor_role, actor_identifier, action, subject, detail")
    .order("at", { ascending: false })
    .limit(limit + 1);
  if (query.from) request = request.gte("at", `${query.from}T00:00:00`);
  if (query.to) request = request.lte("at", `${query.to}T23:59:59.999`);
  if (query.role) request = request.eq("actor_role", query.role);
  if (query.module) request = request.ilike("action", `${safeWord(query.module)}:%`);
  const person = safeWord(query.person ?? "");
  if (person) {
    request = request.or(
      `actor_identifier.ilike.*${person}*,subject.ilike.*${person}*,detail.ilike.*${person}*`,
    );
  }
  const { data, error } = await request;
  if (error) {
    return {
      ok: false as const,
      message: "The audit trail could not be read. Only the administrator may read it.",
    };
  }
  const rows: AuditEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    at: row.at,
    actorRole: row.actor_role,
    actorIdentifier: row.actor_identifier,
    action: row.action,
    subject: row.subject,
    detail: row.detail,
  }));
  return {
    ok: true as const,
    rows: rows.slice(0, limit),
    more: rows.length > limit,
  };
}

/** "29 Oct 2026, 10:32 am" for a recorded moment. */
export function auditTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}
