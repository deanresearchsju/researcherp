import type { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Clearing of the data entered while the ERP is being tested. Server side only, for the principal
 * administrator, and only while ALLOW_TEST_DATA_RESET=true is set. Each area names what it
 * clears and keeps the set-up (fees, subjects, windows, campuses, supervisors, profiles).
 */
type Db = NonNullable<ReturnType<typeof createAdminSupabase>>;

export const resetPhrase = "DELETE TEST DATA";

type Area = {
  id: string;
  label: string;
  description: string;
  warning?: string;
  count: (db: Db) => Promise<number>;
  snapshot: (db: Db) => Promise<unknown>;
  clear: (db: Db) => Promise<void>;
};

type Table =
  | "phd_applications"
  | "phd_drafts"
  | "supervisor_applications"
  | "scholar_records"
  | "rac_proposals"
  | "scholar_allocations"
  | "thesis_evaluation"
  | "helpdesk_messages"
  | "portal_notices"
  | "audit_log"
  | "application_counters";

type Blob = "admission_office" | "doctoral_office" | "exam_office" | "research_register";

async function rowsOf(db: Db, table: Table, filter?: (query: never) => never) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 200) {
    const query = db
      .from(table)
      .select("*")
      .range(from, from + 199);
    const { data, error } = await (filter ? filter(query as never) : query);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < 200) break;
  }
  return rows;
}

async function countOf(db: Db, table: Table) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function emptyTable(db: Db, table: Table, column: string) {
  // A filter that matches every row: the API refuses a delete with no filter at all.
  const { error } = await db.from(table).delete().not(column, "is", null);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function getBlob(db: Db, table: Blob, id: string) {
  const { data, error } = await db
    .from(table)
    .select("payload")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  const payload = data?.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

async function putBlob(
  db: Db,
  table: Blob,
  id: string,
  payload: Record<string, unknown>,
) {
  const { error } = await db
    .from(table)
    .upsert({ id, payload: payload as Json, updated_at: new Date().toISOString() });
  if (error) throw new Error(`${table}: ${error.message}`);
}

function sizeOf(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

/** An area that empties some keys of one JSON record and leaves the rest as it is. */
function blobArea(
  id: string,
  label: string,
  description: string,
  table: Blob,
  rowId: string,
  keys: Record<string, "list" | "map" | "drop">,
  warning?: string,
): Area {
  return {
    id,
    label,
    description,
    warning,
    count: async (db) => {
      const payload = await getBlob(db, table, rowId);
      return Object.keys(keys).reduce((sum, key) => sum + sizeOf(payload?.[key]), 0);
    },
    snapshot: async (db) => {
      const payload = await getBlob(db, table, rowId);
      return Object.fromEntries(
        Object.keys(keys).map((key) => [key, payload?.[key] ?? null]),
      );
    },
    clear: async (db) => {
      const payload = await getBlob(db, table, rowId);
      if (!payload) return;
      const next = { ...payload };
      for (const [key, kind] of Object.entries(keys)) {
        if (kind === "drop") delete next[key];
        else next[key] = kind === "list" ? [] : {};
      }
      await putBlob(db, table, rowId, next);
    },
  };
}

function tableArea(
  id: string,
  label: string,
  description: string,
  tables: { table: Table; column: string }[],
  warning?: string,
): Area {
  return {
    id,
    label,
    description,
    warning,
    count: async (db) => {
      let total = 0;
      for (const item of tables) total += await countOf(db, item.table);
      return total;
    },
    snapshot: async (db) => {
      const out: Record<string, unknown> = {};
      for (const item of tables) out[item.table] = await rowsOf(db, item.table);
      return out;
    },
    clear: async (db) => {
      for (const item of tables) await emptyTable(db, item.table, item.column);
    },
  };
}

const guideHistoryArea: Area = {
  id: "guide-history",
  label: "Guide history",
  description: "The record of allotments, changes and transfers of guides.",
  count: async (db) => {
    const { data } = await db
      .from("admission_office")
      .select("payload")
      .eq("id", "guide_history")
      .maybeSingle();
    const list = (data?.payload as { changes?: unknown } | null)?.changes;
    return Array.isArray(list) ? list.length : 0;
  },
  snapshot: async (db) => {
    const { data } = await db
      .from("admission_office")
      .select("payload")
      .eq("id", "guide_history")
      .maybeSingle();
    return data?.payload ?? null;
  },
  clear: async (db) => {
    const { error } = await db
      .from("admission_office")
      .delete()
      .eq("id", "guide_history");
    if (error) throw new Error(`guide history: ${error.message}`);
  },
};

const scholarUsersArea: Area = {
  id: "scholar-users",
  label: "Scholar sign-ins",
  description:
    "The sign-in accounts of scholars (admitted through Selection or added under Users).",
  warning:
    "Removes every scholar account, including those of scholars already on the register, who then have no sign-in until the office issues one again. Supervisor, Dean, Accounts and administrator sign-ins are never removed.",
  count: async (db) => {
    const { count, error } = await db
      .from("portal_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "scholar");
    if (error) throw new Error(`portal_users: ${error.message}`);
    return count ?? 0;
  },
  snapshot: async (db) => {
    const { data, error } = await db
      .from("portal_users")
      .select("id, role, name, identifier, must_reset")
      .eq("role", "scholar");
    if (error) throw new Error(`portal_users: ${error.message}`);
    return data ?? [];
  },
  clear: async (db) => {
    const { error } = await db.from("portal_users").delete().eq("role", "scholar");
    if (error) throw new Error(`portal_users: ${error.message}`);
  },
};

export const testDataAreas: Area[] = [
  tableArea(
    "applications",
    "Ph.D. applications",
    "Submitted applications, saved drafts and the application-number counters (numbering starts again).",
    [
      { table: "phd_applications", column: "id" },
      { table: "phd_drafts", column: "mobile" },
      { table: "application_counters", column: "key" },
    ],
  ),
  tableArea(
    "supervisor-applications",
    "Supervisor recognition applications",
    "Applications of faculty for recognition as supervisors.",
    [{ table: "supervisor_applications", column: "id" }],
  ),
  blobArea(
    "selection",
    "Selection desk",
    "Shortlists, entrance marks, merit lists, letters issued, the archive and the progress of the steps (back to Step 1). The letter set-up is kept.",
    "admission_office",
    "office",
    { cases: "list", entranceScores: "list", archived: "list", progress: "drop" },
  ),
  tableArea(
    "scholar-records",
    "Scholar requests and records",
    "Fee receipts, leave, extension, supervisor change, six-month reports and the other records scholars submit; RAC proposals; thesis evaluator nominations; guide allotments.",
    [
      { table: "scholar_records", column: "id" },
      { table: "rac_proposals", column: "id" },
      { table: "scholar_allocations", column: "id" },
      { table: "thesis_evaluation", column: "scholar_key" },
    ],
  ),
  guideHistoryArea,
  blobArea(
    "doctoral",
    "Course work, committees, synopsis and thesis",
    "Course enrolments, registrations and results, semester standings, committee reports, colloquium, synopsis, thesis, plagiarism certificates, examiner reports, viva, completions and letters. The batches, registration windows and subject list are kept.",
    "doctoral_office",
    "office",
    {
      enrollments: "list",
      standings: "list",
      registrations: "list",
      results: "list",
      committees: "list",
      colloquia: "list",
      synopses: "list",
      theses: "list",
      access: "list",
      plagiarism: "list",
      examinerReports: "list",
      vivas: "list",
      completions: "list",
      letters: "list",
    },
  ),
  blobArea(
    "exam",
    "Examination records",
    "Hall tickets, seating, attendance, marks, result files and the passing board decisions. Campuses, timetable and grades are kept.",
    "exam_office",
    "office",
    { tickets: "list", attendance: "map", attendanceLocks: "map", files: "list" },
  ),
  blobArea(
    "invigilation",
    "Invigilation duty",
    "The invigilators list and the duty plans of the entrance test and the course-work examination.",
    "exam_office",
    "invigilation",
    { pool: "list", plans: "drop" },
  ),
  blobArea(
    "register-entries",
    "Entries made in the register",
    "Registration numbers recorded in the ERP, attendance sheets, supervisor exits, the passed-out list and fee reminders. The register itself, supervisor profiles, quotas and corrections are kept.",
    "research_register",
    "register",
    {
      allotments: "list",
      attendance: "list",
      exits: "list",
      passedOut: "list",
      reminders: "list",
    },
    "Registration numbers are permanent in normal use. Clear them only for test scholars.",
  ),
  scholarUsersArea,
  tableArea(
    "messages",
    "Helpdesk messages and notices",
    "Messages to the helpdesk and the notices shown to office and supervisors.",
    [
      { table: "helpdesk_messages", column: "id" },
      { table: "portal_notices", column: "id" },
    ],
  ),
  tableArea(
    "audit",
    "Audit trail",
    "The log of who did what.",
    [{ table: "audit_log", column: "id" }],
    "The audit trail is a record of accountability. Clear it only before the real work begins.",
  ),
];
