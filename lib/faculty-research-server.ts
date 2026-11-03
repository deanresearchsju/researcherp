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
  isEmail,
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
type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

const baseColumns =
  "id, kind, created_at, updated_at, source, owner_role, owner_identifier, faculty_name, mobile, dob, record_date, record_year, details, approved_at, approved_by";
const newerColumns = "rejected_at, review_note, email";
const columns =
  "id, kind, created_at, updated_at, source, owner_role, owner_identifier, faculty_name, mobile, dob, record_date, record_year, details, approved_at, approved_by, rejected_at, review_note, email";

/**
 * Until migration 20261103140000 is run, the table has no email, rejected_at or review_note
 * columns. The server looks once every five minutes and leaves them out while they are missing,
 * so the pages keep working; rejecting and matching by email wait for the migration.
 */
let newerSchema: { ok: boolean; at: number } | null = null;

export async function hasNewerColumns(supabase: Admin) {
  if (newerSchema && Date.now() - newerSchema.at < 5 * 60_000) return newerSchema.ok;
  const { error } = await supabase.from(table).select(newerColumns).limit(1);
  const ok = !error || error.code !== "42703";
  newerSchema = { ok, at: Date.now() };
  return ok;
}

async function columnsFor(supabase: Admin) {
  // Read the same way either way: missing columns come back empty (toRecord fills them in).
  return (await hasNewerColumns(supabase)) ? columns : (baseColumns as typeof columns);
}

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
    rejectedAt: row.rejected_at ?? null,
    reviewNote: row.review_note ?? "",
  };
}

/** The copy shown to somebody who looked records up on the public page. */
export function publicCopy(record: ResearchRecord): ResearchRecord {
  const values = { ...record.values };
  const account = valueText(values, "bankAccountNo");
  if (account) values.bankAccountNo = maskAccount(account);
  return { ...record, ownerIdentifier: "", ownerRole: "", values };
}

function columnsOf(kind: ResearchKind, values: ResearchValues, newer = true) {
  const keys = duplicateKeys(kind, values);
  const year = Number(recordYear(kind, values));
  return {
    faculty_name: valueText(values, "facultyName"),
    mobile: valueText(values, "mobile"),
    ...(newer ? { email: valueText(values, "email").toLowerCase() } : {}),
    dob: valueText(values, "dob") || null,
    record_date: recordDate(kind, values) || null,
    record_year: Number.isFinite(year) && year > 0 ? year : null,
    details: values as unknown as Json,
    title_key: keys.title,
    doi_key: keys.doi,
    patent_key: keys.patent,
  };
}

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
  let query = supabase
    .from(table)
    .select(await columnsFor(supabase))
    .eq("kind", kind);
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
    .select(await columnsFor(supabase))
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
 * Records saved without the date of birth or the mobile (uploaded by the office) belong to a
 * faculty member when the email matches and whatever the record does have (the mobile, the
 * date of birth) matches too.
 */
export function canLink(
  record: ResearchRecord,
  who: { mobile: string; dob: string; email: string },
) {
  const email = valueText(record.values, "email").toLowerCase();
  const mobile = valueText(record.values, "mobile");
  const dob = valueText(record.values, "dob");
  if (!who.email || email !== who.email) return false;
  if (mobile && mobile !== who.mobile) return false;
  if (dob && dob !== who.dob) return false;
  return Boolean(!mobile || !dob);
}

/**
 * Everything a faculty member has saved, both kinds, found by the mobile number and date of
 * birth; records the office uploaded without them are found by the email (canLink) and are then
 * completed with the mobile number, the date of birth and the email, so they stay with the
 * faculty member. The personal details of the latest record come back as the profile, so they
 * need not be typed again. `otherBirthDate` is true when the mobile number is saved with a
 * different date of birth, so that a second person cannot add records under the same number.
 */
export async function facultyFile(
  mobile: string,
  dob: string,
  email = "",
): Promise<
  Result<{
    records: ResearchRecord[];
    profile: ResearchValues | null;
    otherBirthDate: boolean;
    linked: number;
  }>
> {
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unreadable };
  const who = { mobile, dob, email: email.toLowerCase() };
  // The email is checked by isEmail before it gets here, so it is safe inside the filter.
  const newer = await hasNewerColumns(supabase);
  const filter =
    newer && who.email && isEmail(who.email)
      ? `mobile.eq.${mobile},email.eq.${who.email}`
      : `mobile.eq.${mobile}`;
  const { data, error } = await supabase
    .from(table)
    .select(await columnsFor(supabase))
    .or(filter)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error(error);
    return { ok: false, status: 500, message: unreadable };
  }
  const rows = (data ?? []).map((row) => toRecord(row as Row));
  const own = rows.filter(
    (record) =>
      valueText(record.values, "mobile") === mobile &&
      valueText(record.values, "dob") === dob,
  );
  const linkable = rows.filter((record) => !own.includes(record) && canLink(record, who));
  let linked = 0;
  for (const record of linkable) {
    const values: ResearchValues = {
      ...record.values,
      mobile,
      dob,
      email: valueText(record.values, "email") || who.email,
    };
    const { error: linkError } = await supabase
      .from(table)
      .update({
        mobile,
        dob,
        ...(newer ? { email: who.email } : {}),
        owner_identifier: record.ownerIdentifier || mobile,
        details: values as unknown as Json,
      })
      .eq("id", record.id);
    if (linkError) {
      console.error(linkError);
      continue;
    }
    linked += 1;
    record.values = values;
    own.push(record);
    await auditServer({
      actorRole: "public",
      actorIdentifier: mobile,
      action: actionName(record.kind, "linked"),
      subject: record.id,
      detail: `Uploaded record "${recordTitle(record.kind, values)}" linked to ${valueText(values, "facultyName")} at sign-in (email ${who.email})`,
    });
  }
  const records = own
    .map(publicCopy)
    .sort((a, b) =>
      recordDate(b.kind, b.values).localeCompare(recordDate(a.kind, a.values)),
    );
  // The profile: the latest record the faculty member added, else the latest uploaded one.
  const profileSource =
    own.find((record) => record.source === "public") ?? own[0] ?? null;
  const profile = profileSource ? identityOf(profileSource.values) : null;
  if (profile && !valueText(profile, "email") && who.email) profile.email = who.email;
  const otherBirthDate =
    own.length === 0 &&
    rows.some(
      (record) =>
        valueText(record.values, "mobile") === mobile && valueText(record.values, "dob"),
    );
  return { ok: true, value: { records, profile, otherBirthDate, linked } };
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
      ...columnsOf(kind, cleaned.values, await hasNewerColumns(supabase)),
    })
    .select(await columnsFor(supabase))
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
  /**
   * A faculty member changing their own record: who owns it (the open page checks the mobile and
   * the date of birth), and the evidence checklist. An approved record cannot be changed; a
   * rejected one goes back to waiting for review.
   */
  faculty?: {
    owns?: (record: ResearchRecord) => boolean;
    evidence: readonly ChecklistItem[];
  },
): Promise<Result<ResearchRecord>> {
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return { ok: false, status: 400, message: "Unknown record." };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const { data: found, error: readError } = await supabase
    .from(table)
    .select(await columnsFor(supabase))
    .eq("id", id)
    .eq("kind", kind)
    .maybeSingle();
  if (readError) {
    console.error(readError);
    return { ok: false, status: 500, message: unsaved };
  }
  if (!found) return { ok: false, status: 404, message: "The record was not found." };
  const before = toRecord(found as Row);
  // The open page shows the bank account masked (••••1234); sent back unchanged, it keeps the
  // number saved.
  const sentValues =
    input && typeof input === "object" && !Array.isArray(input)
      ? { ...(input as Record<string, unknown>) }
      : {};
  if (
    typeof sentValues.bankAccountNo === "string" &&
    sentValues.bankAccountNo.includes("•")
  )
    sentValues.bankAccountNo = valueText(before.values, "bankAccountNo");
  // The office may correct an uploaded record that has no date of birth or mobile yet.
  const cleaned = cleanValues(kind, sentValues, indiaToday(), { upload: !faculty });
  if (!cleaned.ok)
    return {
      ok: false,
      status: 400,
      message: "Check the highlighted fields.",
      errors: cleaned.errors,
    };
  if (
    ownerOnly &&
    (before.ownerRole !== ownerOnly.role ||
      before.ownerIdentifier.trim().toLowerCase() !==
        ownerOnly.identifier.trim().toLowerCase())
  ) {
    return { ok: false, status: 403, message: "You can change only your own records." };
  }
  if (faculty) {
    if (faculty.owns && !faculty.owns(before))
      return { ok: false, status: 403, message: "You can change only your own records." };
    if (before.approvedAt)
      return {
        ok: false,
        status: 409,
        message: "This record is Checked & Approved and can no longer be changed.",
      };
    const problems = {
      ...facultyChecks(kind, cleaned.values),
      ...(await verifyLinks(cleaned.values)),
    };
    const missing = missingEvidence(kind, cleaned.values, faculty.evidence);
    if (missing.length > 0) problems.evidence = `Upload: ${missing.join(", ")}.`;
    if (Object.keys(problems).length > 0)
      return {
        ok: false,
        status: 400,
        message: Object.values(problems)[0],
        errors: problems,
      };
  }
  const changes = describeChanges(kind, before.values, cleaned.values);
  if (changes.length === 0) return { ok: true, value: before };
  const duplicates = await findDuplicates(supabase, kind, cleaned.values, id);
  if (!duplicates) return { ok: false, status: 500, message: unsaved };
  if (Object.keys(duplicates).length > 0) return duplicateFailure(duplicates);
  const { data, error } = await supabase
    .from(table)
    .update({
      ...columnsOf(kind, cleaned.values, await hasNewerColumns(supabase)),
      updated_at: new Date().toISOString(),
      // A rejected record changed by the faculty member is reviewed again.
      ...(faculty && before.rejectedAt && (await hasNewerColumns(supabase))
        ? { rejected_at: null, review_note: "" }
        : {}),
    })
    .eq("id", id)
    .select(await columnsFor(supabase))
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
    // Uploaded rows may lack the date of birth or the mobile; the email then matches them.
    const cleaned = cleanValues(kind, values, today, { upload: true });
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
    const mobile =
      valueText(cleaned.values, "mobile") || valueText(cleaned.values, "email");
    const { data, error } = await supabase
      .from(table)
      .insert({
        kind,
        source: "import",
        owner_role: "public",
        owner_identifier: mobile,
        ...columnsOf(kind, cleaned.values, await hasNewerColumns(supabase)),
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

export type ReviewAction = "approve" | "reject" | "reset";

/**
 * The Dean or the administrator reviews records: approves them ("Checked & Approved"), rejects
 * them with the reason, or sets them back to waiting. A rejected record frees its title, DOI and
 * patent number so that a corrected record can be added; approving or resetting takes them back
 * (refused if a newer record has them now). Each change is written to the audit trail.
 */
export async function setReview(
  kind: ResearchKind,
  ids: readonly unknown[],
  action: ReviewAction,
  note: string,
  actor: Actor,
): Promise<Result<number>> {
  const valid = ids.filter(
    (id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
  );
  if (valid.length === 0 || valid.length > 500)
    return { ok: false, status: 400, message: "Choose the records first." };
  const reason = note.trim().slice(0, 1000);
  if (action === "reject" && reason.length < 3)
    return { ok: false, status: 400, message: "Give the reason for rejecting." };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const newer = await hasNewerColumns(supabase);
  if (!newer && action === "reject")
    return {
      ok: false,
      status: 503,
      message: "Rejecting needs the database update 20261103140000 to be run first.",
    };
  const { data: rows, error: readError } = await supabase
    .from(table)
    .select(await columnsFor(supabase))
    .eq("kind", kind)
    .in("id", valid);
  if (readError) {
    console.error(readError);
    return { ok: false, status: 500, message: unsaved };
  }
  const now = new Date().toISOString();
  const audit: {
    actor_role: string;
    actor_identifier: string;
    action: string;
    subject: string;
    detail: string;
  }[] = [];
  let done = 0;
  for (const row of rows ?? []) {
    const record = toRecord(row as Row);
    const keys = duplicateKeys(kind, record.values);
    const change =
      action === "approve"
        ? {
            approved_at: now,
            approved_by: actor.name,
            rejected_at: null,
            review_note: reason,
            title_key: keys.title,
            doi_key: keys.doi,
            patent_key: keys.patent,
          }
        : action === "reject"
          ? {
              approved_at: null,
              approved_by: "",
              rejected_at: now,
              review_note: reason,
              title_key: "",
              doi_key: "",
              patent_key: "",
            }
          : {
              approved_at: null,
              approved_by: "",
              rejected_at: null,
              review_note: "",
              title_key: keys.title,
              doi_key: keys.doi,
              patent_key: keys.patent,
            };
    // Before the database update, the rejection columns are left out.
    const { rejected_at: _rejected, review_note: _note, ...older } = change;
    void _rejected;
    void _note;
    const { error } = await supabase
      .from(table)
      .update(newer ? change : older)
      .eq("id", record.id);
    if (isUniqueViolation(error))
      return {
        ok: false,
        status: 409,
        message: `"${recordTitle(kind, record.values)}" is saved again in a newer record; review that one instead.`,
      };
    if (error) {
      console.error(error);
      return { ok: false, status: 500, message: unsaved };
    }
    done += 1;
    const verb =
      action === "approve"
        ? "checked and approved"
        : action === "reject"
          ? "rejected"
          : "set back to waiting";
    audit.push({
      actor_role: actor.role.slice(0, 40),
      actor_identifier: actor.identifier.slice(0, 200),
      action: actionName(
        kind,
        action === "approve"
          ? "approved"
          : action === "reject"
            ? "rejected"
            : "review-reset",
      ),
      subject: record.id,
      detail:
        `${actor.name} ${verb} "${recordTitle(kind, record.values)}"${reason ? `: ${reason}` : ""}`.slice(
          0,
          2000,
        ),
    });
  }
  if (audit.length > 0) {
    const { error } = await supabase.from("audit_log").insert(audit);
    if (error) console.error(error);
  }
  return { ok: true, value: done };
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
          : line.action.endsWith(":rejected")
            ? "Rejected"
            : line.action.endsWith(":approval-withdrawn") ||
                line.action.endsWith(":review-reset")
              ? "Set back to waiting"
              : "Changed",
      detail: line.detail,
    })),
  };
}
