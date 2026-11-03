import { canMenuAction, canOpenMenu, isOfficeRole, resolvedMenus } from "@/lib/access";
import { auditServer } from "@/lib/audit-server";
import {
  cleanValues,
  describeChanges,
  duplicateField,
  duplicateKeys,
  duplicateMessages,
  facultyChecks,
  identityOf,
  maskAccount,
  recordDate,
  recordTitle,
  recordYear,
  researchMenus,
  valueText,
  type DuplicateKey,
  type ResearchKind,
  type ResearchRecord,
  type ResearchValues,
} from "@/lib/faculty-research";
import type { ChecklistItem } from "@/lib/checklists";
import { missingEvidence } from "@/lib/faculty-evidence";
import { checkDoi, checkLink } from "@/lib/link-check";
import type { CookieSession } from "@/lib/session";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type Row = Database["public"]["Tables"]["faculty_research_records"]["Row"];

const table = "faculty_research_records";
const columns =
  "id, kind, created_at, updated_at, source, owner_role, owner_identifier, faculty_name, mobile, dob, record_date, record_year, details, approved_at, approved_by";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string; errors?: Record<string, string> };

const unreadable = "The records could not be read. Try again.";
const unsaved = "The record could not be saved. Try again.";

/** Today in India, the date every check is made against. */
export function indiaToday(now = Date.now()) {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

export function isResearchKind(value: unknown): value is ResearchKind {
  return value === "publication" || value === "proposal";
}

export type ResearchAccess = { scope: "all" | "own" | null; edit: boolean };

/**
 * What a signed-in person may do with one kind of record. The administrator and the Dean see
 * every record and may correct any of them; another office sign-in sees them when given the menu
 * and edits them with its Add / edit right. Scholars and supervisors see and change only their own.
 */
export function researchAccess(
  session: Pick<CookieSession, "role" | "identifier" | "menus"> | null,
  kind: ResearchKind,
): ResearchAccess {
  if (!session) return { scope: null, edit: false };
  if (session.role === "supervisor") return { scope: "own", edit: true };
  if (!isOfficeRole(session.role)) return { scope: null, edit: false };
  const href = researchMenus[kind].adminHref;
  const menus = resolvedMenus(session);
  const opens =
    session.role === "admin" ||
    session.role === "dean" ||
    canOpenMenu(href, session.role, menus);
  if (!opens) return { scope: null, edit: false };
  return {
    scope: "all",
    // The administrator and the Dean may always correct a record.
    edit:
      session.role === "admin" ||
      session.role === "dean" ||
      canMenuAction(session, href, "edit"),
  };
}

function toRecord(row: Row): ResearchRecord {
  const details =
    row.details && typeof row.details === "object" && !Array.isArray(row.details)
      ? (row.details as ResearchValues)
      : {};
  return {
    id: row.id,
    kind: row.kind as ResearchKind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source,
    ownerRole: row.owner_role,
    ownerIdentifier: row.owner_identifier,
    values: details,
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? "",
  };
}

/** The copy shown to somebody who looked records up on the public page. */
export function publicCopy(record: ResearchRecord): ResearchRecord {
  const values = { ...record.values };
  const account = valueText(values, "bankAccountNo");
  if (account) values.bankAccountNo = maskAccount(account);
  return { ...record, ownerIdentifier: "", ownerRole: "", values };
}

function columnsOf(kind: ResearchKind, values: ResearchValues) {
  const keys = duplicateKeys(kind, values);
  const year = Number(recordYear(kind, values));
  return {
    faculty_name: valueText(values, "facultyName"),
    mobile: valueText(values, "mobile"),
    dob: valueText(values, "dob") || null,
    record_date: recordDate(kind, values) || null,
    record_year: Number.isFinite(year) && year > 0 ? year : null,
    details: values as unknown as Json,
    title_key: keys.title,
    doi_key: keys.doi,
    patent_key: keys.patent,
  };
}

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

/**
 * The fields of a record whose title, DOI or patent number is already saved (other than the
 * record itself when it is being changed), each with its message.
 */
export async function findDuplicates(
  supabase: Admin,
  kind: ResearchKind,
  values: ResearchValues,
  exceptId?: string,
): Promise<Record<string, string> | null> {
  const keys = duplicateKeys(kind, values);
  const errors: Record<string, string> = {};
  const checks: [DuplicateKey, string, string][] = [
    ["title", "title_key", keys.title],
    ["doi", "doi_key", keys.doi],
    ["patent", "patent_key", keys.patent],
  ];
  for (const [name, column, value] of checks) {
    if (!value) continue;
    let query = supabase
      .from(table)
      .select("id")
      .eq(column as "title_key", value);
    if (name === "title") query = query.eq("kind", kind);
    if (exceptId) query = query.neq("id", exceptId);
    const { data, error } = await query.limit(1);
    if (error) {
      console.error(error);
      return null;
    }
    if (data && data.length > 0)
      errors[duplicateField(kind, name)] = duplicateMessages[name];
  }
  return errors;
}

const duplicateFailure = (errors: Record<string, string>) => ({
  ok: false as const,
  status: 409,
  message: Object.values(errors)[0] ?? "This record is already saved.",
  errors,
});

const isUniqueViolation = (error: { code?: string } | null) => error?.code === "23505";

const actionName = (kind: ResearchKind, verb: string) =>
  `faculty-research:${kind}:${verb}`;

export async function listRecords(
  kind: ResearchKind,
  owner?: { role: string; identifier: string },
): Promise<Result<ResearchRecord[]>> {
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unreadable };
  let query = supabase.from(table).select(columns).eq("kind", kind);
  if (owner)
    query = query.eq("owner_role", owner.role).ilike(
      "owner_identifier",
      owner.identifier.replace(/[\\%_]/g, (c) => `\\${c}`),
    );
  const { data, error } = await query
    .order("record_date", { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: unreadable };
  }
  return { ok: true, value: (data ?? []).map((row) => toRecord(row as Row)) };
}

/** The records saved under a mobile number and date of birth (both must match). */
export async function lookupRecords(
  kind: ResearchKind,
  mobile: string,
  dob: string,
): Promise<Result<ResearchRecord[]>> {
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unreadable };
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("kind", kind)
    .eq("mobile", mobile)
    .eq("dob", dob)
    .order("record_date", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: unreadable };
  }
  return { ok: true, value: (data ?? []).map((row) => publicCopy(toRecord(row as Row))) };
}

/**
 * Everything saved under a mobile number and date of birth, both kinds, with the personal
 * details of the latest record (the profile shown back so the faculty member need not type it
 * again). `otherBirthDate` is true when the mobile number is saved with a different date of
 * birth, so that a second person cannot add records under the same number.
 */
export async function facultyFile(
  mobile: string,
  dob: string,
): Promise<
  Result<{
    records: ResearchRecord[];
    profile: ResearchValues | null;
    otherBirthDate: boolean;
  }>
> {
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unreadable };
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("mobile", mobile)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: unreadable };
  }
  const rows = (data ?? []).map((row) => toRecord(row as Row));
  const own = rows.filter((record) => valueText(record.values, "dob") === dob);
  const records = own
    .map(publicCopy)
    .sort((a, b) =>
      recordDate(b.kind, b.values).localeCompare(recordDate(a.kind, a.values)),
    );
  return {
    ok: true,
    value: {
      records,
      profile: own[0] ? identityOf(own[0].values) : null,
      otherBirthDate: own.length === 0 && rows.length > 0,
    },
  };
}

export type Actor = { role: string; identifier: string; name: string };

/**
 * The DOI and the web link of a record, checked online. A DOI doi.org does not know, or a link
 * that does not exist, is refused; when a site simply does not answer, the record is not held up.
 */
export async function verifyLinks(values: ResearchValues) {
  const errors: Record<string, string> = {};
  const doi = valueText(values, "doi");
  const link = valueText(values, "link");
  const [doiCheck, linkCheck] = await Promise.all([
    doi ? checkDoi(doi) : null,
    link ? checkLink(link) : null,
  ]);
  if (doiCheck?.status === "missing") errors.doi = doiCheck.message;
  if (linkCheck?.status === "missing") errors.link = linkCheck.message;
  return errors;
}

export async function createRecord(
  kind: ResearchKind,
  input: unknown,
  actor: Actor,
  owner: { role: string; identifier: string },
  /** The evidence checklist, when its mandatory files must be uploaded (website and faculty). */
  evidence?: readonly ChecklistItem[],
): Promise<Result<ResearchRecord>> {
  const cleaned = cleanValues(kind, input, indiaToday());
  if (!cleaned.ok)
    return {
      ok: false,
      status: 400,
      message: "Check the highlighted fields.",
      errors: cleaned.errors,
    };
  if (evidence) {
    // Faculty adding their own record: date of joining, the affiliation, a DOI that exists and a
    // link that opens.
    const rules = facultyChecks(kind, cleaned.values);
    const links = await verifyLinks(cleaned.values);
    const problems = { ...rules, ...links };
    if (Object.keys(problems).length > 0)
      return {
        ok: false,
        status: 400,
        message: Object.values(problems)[0],
        errors: problems,
      };
    const missing = missingEvidence(kind, cleaned.values, evidence);
    if (missing.length > 0)
      return {
        ok: false,
        status: 400,
        message: `Upload: ${missing.join(", ")}.`,
        errors: { evidence: `Upload: ${missing.join(", ")}.` },
      };
  }
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const duplicates = await findDuplicates(supabase, kind, cleaned.values);
  if (!duplicates) return { ok: false, status: 500, message: unsaved };
  if (Object.keys(duplicates).length > 0) return duplicateFailure(duplicates);
  const { data, error } = await supabase
    .from(table)
    .insert({
      kind,
      source: actor.role,
      owner_role: owner.role,
      owner_identifier: owner.identifier,
      ...columnsOf(kind, cleaned.values),
    })
    .select(columns)
    .single();
  if (isUniqueViolation(error))
    return duplicateFailure({
      [duplicateField(kind, "title")]: "This record is already saved.",
    });
  if (error || !data) {
    console.error(error);
    return { ok: false, status: 500, message: unsaved };
  }
  const record = toRecord(data as Row);
  await auditServer({
    actorRole: actor.role,
    actorIdentifier: actor.identifier,
    action: actionName(kind, "created"),
    subject: record.id,
    detail: `${actor.name} added "${recordTitle(kind, record.values)}" for ${valueText(record.values, "facultyName")}`,
  });
  return { ok: true, value: record };
}

/**
 * Saves a changed record. `ownerOnly` limits the change to the person's own record (scholars and
 * supervisors); the office passes null. Nothing is written when nothing changed.
 */
export async function updateRecord(
  kind: ResearchKind,
  id: string,
  input: unknown,
  actor: Actor,
  ownerOnly: { role: string; identifier: string } | null,
): Promise<Result<ResearchRecord>> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return { ok: false, status: 400, message: "Unknown record." };
  const cleaned = cleanValues(kind, input, indiaToday());
  if (!cleaned.ok)
    return {
      ok: false,
      status: 400,
      message: "Check the highlighted fields.",
      errors: cleaned.errors,
    };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const { data: found, error: readError } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .eq("kind", kind)
    .maybeSingle();
  if (readError) {
    console.error(readError);
    return { ok: false, status: 500, message: unsaved };
  }
  if (!found) return { ok: false, status: 404, message: "The record was not found." };
  const before = toRecord(found as Row);
  if (
    ownerOnly &&
    (before.ownerRole !== ownerOnly.role ||
      before.ownerIdentifier.trim().toLowerCase() !==
        ownerOnly.identifier.trim().toLowerCase())
  ) {
    return { ok: false, status: 403, message: "You can change only your own records." };
  }
  const changes = describeChanges(kind, before.values, cleaned.values);
  if (changes.length === 0) return { ok: true, value: before };
  const duplicates = await findDuplicates(supabase, kind, cleaned.values, id);
  if (!duplicates) return { ok: false, status: 500, message: unsaved };
  if (Object.keys(duplicates).length > 0) return duplicateFailure(duplicates);
  const { data, error } = await supabase
    .from(table)
    .update({ ...columnsOf(kind, cleaned.values), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(columns)
    .single();
  if (isUniqueViolation(error))
    return duplicateFailure({
      [duplicateField(kind, "title")]: "This record is already saved.",
    });
  if (error || !data) {
    console.error(error);
    return { ok: false, status: 500, message: unsaved };
  }
  const record = toRecord(data as Row);
  await auditServer({
    actorRole: actor.role,
    actorIdentifier: actor.identifier,
    action: actionName(kind, "updated"),
    subject: record.id,
    detail: `${actor.name} changed "${recordTitle(kind, record.values)}": ${changes.join("; ")}`,
  });
  return { ok: true, value: record };
}

export type ImportOutcome = {
  row: number;
  status: "added" | "duplicate" | "invalid";
  message: string;
};

export const importLimit = 200;

/**
 * Saves rows read from an uploaded sheet. Each row is checked like a form; a row whose title,
 * DOI or patent number is already saved (or appears earlier in the same sheet) is skipped, never
 * merged. Each item carries its sheet row number, for the messages.
 */
export async function importRecords(
  kind: ResearchKind,
  items: readonly unknown[],
  actor: Actor,
): Promise<Result<ImportOutcome[]>> {
  const rows = items.map((item, at) => {
    const entry =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const number = Number(entry.row);
    return {
      row: Number.isInteger(number) && number > 0 && number < 1_000_000 ? number : at + 2,
      values: entry.values,
    };
  });
  if (rows.length === 0 || rows.length > importLimit)
    return {
      ok: false,
      status: 400,
      message: `Send 1 to ${importLimit} rows at a time.`,
    };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const today = indiaToday();
  const outcomes: ImportOutcome[] = [];
  const seen = {
    title: new Set<string>(),
    doi: new Set<string>(),
    patent: new Set<string>(),
  };
  const audit: {
    actor_role: string;
    actor_identifier: string;
    action: string;
    subject: string;
    detail: string;
  }[] = [];
  for (let at = 0; at < rows.length; at += 1) {
    const { row, values } = rows[at];
    const cleaned = cleanValues(kind, values, today);
    if (!cleaned.ok) {
      const fields = Object.entries(cleaned.errors).map(
        ([field, message]) => `${field}: ${message}`,
      );
      outcomes.push({ row, status: "invalid", message: fields.join("; ").slice(0, 500) });
      continue;
    }
    const keys = duplicateKeys(kind, cleaned.values);
    const inSheet = (Object.keys(seen) as DuplicateKey[]).find(
      (name) => keys[name] && seen[name].has(keys[name]),
    );
    if (inSheet) {
      outcomes.push({
        row,
        status: "duplicate",
        message: `${duplicateMessages[inSheet]} (earlier in this sheet)`,
      });
      continue;
    }
    const duplicates = await findDuplicates(supabase, kind, cleaned.values);
    if (!duplicates) return { ok: false, status: 500, message: unsaved };
    if (Object.keys(duplicates).length > 0) {
      outcomes.push({ row, status: "duplicate", message: Object.values(duplicates)[0] });
      continue;
    }
    const mobile = valueText(cleaned.values, "mobile");
    const { data, error } = await supabase
      .from(table)
      .insert({
        kind,
        source: "import",
        owner_role: "public",
        owner_identifier: mobile,
        ...columnsOf(kind, cleaned.values),
      })
      .select("id")
      .single();
    if (isUniqueViolation(error)) {
      outcomes.push({
        row,
        status: "duplicate",
        message: "This record is already saved.",
      });
      continue;
    }
    if (error || !data) {
      console.error(error);
      outcomes.push({ row, status: "invalid", message: unsaved });
      continue;
    }
    for (const name of Object.keys(seen) as DuplicateKey[])
      if (keys[name]) seen[name].add(keys[name]);
    outcomes.push({ row, status: "added", message: "" });
    audit.push({
      actor_role: actor.role.slice(0, 40),
      actor_identifier: actor.identifier.slice(0, 200),
      action: actionName(kind, "created"),
      subject: data.id,
      detail:
        `${actor.name} imported "${recordTitle(kind, cleaned.values)}" for ${valueText(cleaned.values, "facultyName")} (sheet row ${row})`.slice(
          0,
          2000,
        ),
    });
  }
  if (audit.length > 0) {
    const { error } = await supabase.from("audit_log").insert(audit);
    if (error) console.error(error);
  }
  return { ok: true, value: outcomes };
}

/**
 * The Dean or the administrator approves records ("Checked & Approved"), or takes an approval
 * back. Each change is written to the audit trail.
 */
export async function setApproval(
  kind: ResearchKind,
  ids: readonly unknown[],
  approve: boolean,
  actor: Actor,
): Promise<Result<number>> {
  const valid = ids.filter(
    (id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
  );
  if (valid.length === 0 || valid.length > 500)
    return { ok: false, status: 400, message: "Choose the records first." };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const { data, error } = await supabase
    .from(table)
    .update(
      approve
        ? { approved_at: new Date().toISOString(), approved_by: actor.name }
        : { approved_at: null, approved_by: "" },
    )
    .eq("kind", kind)
    .in("id", valid)
    .select("id, details");
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: unsaved };
  }
  const rows = data ?? [];
  if (rows.length > 0) {
    const { error: auditError } = await supabase.from("audit_log").insert(
      rows.map((row) => ({
        actor_role: actor.role.slice(0, 40),
        actor_identifier: actor.identifier.slice(0, 200),
        action: actionName(kind, approve ? "approved" : "approval-withdrawn"),
        subject: row.id,
        detail:
          `${actor.name} ${approve ? "checked and approved" : "withdrew the approval of"} "${recordTitle(kind, (row.details ?? {}) as ResearchValues)}"`.slice(
            0,
            2000,
          ),
      })),
    );
    if (auditError) console.error(auditError);
  }
  return { ok: true, value: rows.length };
}

export type HistoryLine = { at: string; who: string; action: string; detail: string };

/** The audit-trail lines of one record, newest first. */
export async function recordHistory(id: string): Promise<Result<HistoryLine[]>> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return { ok: false, status: 400, message: "Unknown record." };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unreadable };
  const { data, error } = await supabase
    .from("audit_log")
    .select("at, actor_role, actor_identifier, action, detail")
    .eq("subject", id)
    .like("action", "faculty-research:%")
    .order("at", { ascending: false })
    .limit(100);
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: unreadable };
  }
  return {
    ok: true,
    value: (data ?? []).map((line) => ({
      at: line.at,
      who: `${line.actor_identifier} (${line.actor_role})`,
      action: line.action.endsWith(":created")
        ? "Added"
        : line.action.endsWith(":approved")
          ? "Checked & Approved"
          : line.action.endsWith(":approval-withdrawn")
            ? "Approval withdrawn"
            : "Changed",
      detail: line.detail,
    })),
  };
}
