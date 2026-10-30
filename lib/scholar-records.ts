import {
  recordStatuses,
  scholarRecordKinds,
  scholarRecordMenus,
  type RecordStatus,
  type ScholarRecordKind,
  type ScholarRecordMenu,
} from "@/data/scholar-records";
import { notifyOffice, recordAudit, pushNotice } from "@/lib/audit";
import { recordHref, recordLabel } from "@/lib/notice-links";
import { officeViewWriteBlock } from "@/lib/office-view";
import { storageKeys } from "@/lib/constants";
import { isValidIsoDate } from "@/lib/dates";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";
import type { Json } from "@/types/database";
import { z } from "zod";
import { isOfficeRole } from "@/lib/access";
import { mayAct, nextStage, stageNames, type ApprovalStage } from "@/lib/approval-rules";
import { recordStages } from "@/lib/approval-flow";
import { readPreviewSession } from "@/lib/auth";
import { currentDoctoral, latestCommittee, synopsisSubmitted } from "@/lib/doctoral";
import { reloadPersonalDetails } from "@/lib/register";
import { isFileRef } from "@/lib/file-ref";

export type ScholarRecord = {
  id: string;
  kind: ScholarRecordKind;
  scholarIdentifier: string;
  scholarName: string;
  status: RecordStatus;
  payload: Record<string, string>;
  fileName: string | null;
  fileData: string | null;
  supervisorIdentifier: string;
  supervisorName: string;
  createdAt: string;
};

export type ScholarRecordLoad = {
  records: ScholarRecord[];
  source: "database" | "browser";
  detail: string | null;
};

export const scholarRecordMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013173000_scholar_records.sql, then supabase/migrations/20261013180000_office_controls.sql, then supabase/migrations/20261014050000_lifecycle.sql. Until then, uploads stay in this browser.";

const officeSqlHint =
  "Run supabase/migrations/20261013180000_office_controls.sql so this record is stored in the database. A copy is kept in this browser.";

function writeLocalScholarRecord(draft: RecordDraft, existingId?: string) {
  const all = readBrowserRecords();
  const next: ScholarRecord = {
    id: existingId ?? `local-${crypto.randomUUID()}`,
    kind: draft.kind,
    scholarIdentifier: draft.scholarIdentifier,
    scholarName: draft.scholarName,
    status: draft.status ?? "Submitted",
    payload: draft.payload,
    fileName: draft.fileName,
    fileData: draft.fileData,
    supervisorIdentifier: draft.supervisorIdentifier ?? "",
    supervisorName: draft.supervisorName ?? "",
    createdAt:
      all.find((record) => record.id === existingId)?.createdAt ??
      new Date().toISOString(),
  };
  const records = existingId
    ? all.map((record) => (record.id === existingId ? next : record))
    : [next, ...all];
  try {
    writeBrowserRecords(records);
  } catch {
    return {
      ok: false as const,
      message:
        "This browser cannot store that file. Run the SQL migration, then upload again.",
    };
  }
  return { ok: true as const, record: next };
}

const caches = new Map<ScholarRecordKind, ScholarRecordLoad>();
const loading = new Set<ScholarRecordKind>();
const listeners = new Map<ScholarRecordKind, Set<() => void>>();

function notify(kind: ScholarRecordKind) {
  listeners.get(kind)?.forEach((listener) => listener());
}

export function subscribeScholarRecords(kind: ScholarRecordKind, onChange: () => void) {
  const set = listeners.get(kind) ?? new Set<() => void>();
  set.add(onChange);
  listeners.set(kind, set);
  if (!caches.has(kind) && !loading.has(kind)) {
    // One request fills every kind, so the next page opens without waiting.
    const pending = scholarRecordKinds.filter(
      (item) => !caches.has(item) && !loading.has(item),
    );
    pending.forEach((item) => loading.add(item));
    void loadAllScholarRecords().then((loads) => {
      pending.forEach((item) => {
        loading.delete(item);
        if (!caches.has(item)) caches.set(item, loads.get(item)!);
        notify(item);
      });
    });
  }
  return () => set.delete(onChange);
}

/** Starts loading every record kind; used to warm the portal after sign-in. */
export function preloadScholarRecords() {
  const missing = scholarRecordKinds.find(
    (kind) => !caches.has(kind) && !loading.has(kind),
  );
  if (!missing) return;
  const unsubscribe = subscribeScholarRecords(missing, () => undefined);
  unsubscribe();
}

export function currentScholarRecords(kind: ScholarRecordKind) {
  return caches.get(kind) ?? null;
}

function publish(kind: ScholarRecordKind, next: ScholarRecordLoad) {
  caches.set(kind, next);
  notify(kind);
  // Scholar information changes the register everywhere, so the register reads it again.
  if (kind === "personal_details") void reloadPersonalDetails();
}

function isKind(value: string): value is ScholarRecordKind {
  return (scholarRecordKinds as readonly string[]).includes(value);
}

function isStatus(value: string): value is RecordStatus {
  return (recordStatuses as readonly string[]).includes(value);
}

function payloadOf(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") result[key] = item;
  }
  return result;
}

function readBrowserRecords(): ScholarRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKeys.scholarRecords);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Partial<ScholarRecord>;
      if (
        !record.id ||
        !record.kind ||
        !isKind(record.kind) ||
        !record.scholarIdentifier
      ) {
        return [];
      }
      return [
        {
          id: record.id,
          kind: record.kind,
          scholarIdentifier: record.scholarIdentifier,
          scholarName: record.scholarName ?? "",
          status: record.status && isStatus(record.status) ? record.status : "Submitted",
          payload: record.payload ?? {},
          fileName: record.fileName ?? null,
          fileData: record.fileData ?? null,
          supervisorIdentifier: record.supervisorIdentifier ?? "",
          supervisorName: record.supervisorName ?? "",
          createdAt: record.createdAt ?? new Date().toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeBrowserRecords(records: ScholarRecord[]) {
  window.localStorage.setItem(storageKeys.scholarRecords, JSON.stringify(records));
}

type RecordRow = {
  id: string;
  kind: string;
  scholar_identifier: string;
  scholar_name: string;
  status: string;
  payload: Json;
  file_name: string | null;
  created_at: string;
  supervisor_identifier?: string | null;
  supervisor_name?: string | null;
};

function mapRow(row: RecordRow): ScholarRecord | null {
  if (!isKind(row.kind) || !isStatus(row.status)) return null;
  return {
    id: row.id,
    kind: row.kind,
    scholarIdentifier: row.scholar_identifier,
    scholarName: row.scholar_name,
    status: row.status,
    payload: payloadOf(row.payload),
    fileName: row.file_name,
    fileData: null,
    supervisorIdentifier:
      row.supervisor_identifier || payloadOf(row.payload).supervisorIdentifier || "",
    supervisorName: row.supervisor_name || payloadOf(row.payload).supervisorName || "",
    createdAt: row.created_at,
  };
}

const pageSize = 1000;

/** Every record kind in one request (files are fetched only when opened). */
async function loadAllScholarRecords(): Promise<
  Map<ScholarRecordKind, ScholarRecordLoad>
> {
  const browserRecords = readBrowserRecords();
  const byKind = (
    records: readonly ScholarRecord[],
    source: ScholarRecordLoad["source"],
    detail: string | null,
  ) =>
    new Map(
      scholarRecordKinds.map((kind) => [
        kind,
        { records: records.filter((record) => record.kind === kind), source, detail },
      ]),
    );
  const supabase = createSupabase();
  if (!supabase) return byKind(browserRecords, "browser", null);

  // The database returns at most 1,000 rows a request, so read page by page.
  async function readPages(columns: string) {
    const rows: RecordRow[] = [];
    for (let from = 0; ; from += pageSize) {
      const page = await supabase!
        .from("scholar_records")
        .select(columns)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + pageSize - 1)
        .returns<RecordRow[]>();
      if (page.error) return { data: null, error: page.error };
      rows.push(...(page.data ?? []));
      if ((page.data ?? []).length < pageSize) return { data: rows, error: null };
    }
  }

  const extended = await readPages(
    "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at, supervisor_identifier, supervisor_name",
  );

  const fallback =
    extended.error || !extended.data
      ? await readPages(
          "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at",
        )
      : null;

  const data = extended.data ?? fallback?.data ?? null;
  const missingTable = Boolean(extended.error && fallback?.error);

  if (missingTable || !data) {
    return byKind(
      browserRecords,
      "browser",
      extended.error ? "The scholar record table is not in the database yet." : null,
    );
  }

  const remote = data.flatMap((row) => {
    const record = mapRow(row);
    return record ? [record] : [];
  });
  const remoteIds = new Set(remote.map((record) => record.id));
  const localExtras = browserRecords.filter(
    (record) => record.id.startsWith("local-") && !remoteIds.has(record.id),
  );
  return byKind(
    [...localExtras, ...remote],
    "database",
    extended.error ? officeSqlHint : null,
  );
}

export type RecordDraft = {
  kind: ScholarRecordKind;
  scholarIdentifier: string;
  scholarName: string;
  payload: Record<string, string>;
  fileName: string | null;
  fileData: string | null;
  supervisorIdentifier?: string;
  supervisorName?: string;
  /** Office entries (such as fees paid before the ERP) can be saved already approved. */
  status?: "Submitted" | "Approved";
};

function recordById(kind: ScholarRecordKind, id: string) {
  return (
    caches.get(kind)?.records.find((item) => item.id === id) ??
    readBrowserRecords().find((item) => item.id === id)
  );
}

const lockedMessage =
  "This record is approved and locked. Only the administrator can correct it.";

/** A scholar's new submission goes to the supervisor first when the menu needs one. */
async function announceSubmission(draft: RecordDraft, resubmitted: boolean) {
  const signer = readPreviewSession();
  const byOffice = Boolean(signer && isOfficeRole(signer.role));
  await recordAudit({
    action: byOffice
      ? resubmitted
        ? "record:corrected-by-office"
        : "record:entered-by-office"
      : resubmitted
        ? "record:resubmitted"
        : "record:submitted",
    subject: `${draft.kind}:${draft.scholarIdentifier}`,
    detail: `${draft.scholarName} (${draft.scholarIdentifier}) · ${draft.kind}`,
  });
  if (draft.status === "Approved") return;
  if (byOffice) return;
  const menu = scholarRecordMenus.find((item) => item.kind === draft.kind);
  const label = recordLabel(draft.kind);
  const verb = resubmitted ? "Updated" : "New";
  if (menu?.needsSupervisor && draft.supervisorIdentifier?.trim()) {
    await pushNotice({
      role: "supervisor",
      identifier: draft.supervisorIdentifier,
      title: `${verb} ${label.toLowerCase()} to recommend`,
      detail: `${draft.scholarName} sent a ${label.toLowerCase()}.`,
      href: recordHref("supervisor", draft.kind),
    });
    return;
  }
  await notifyOffice({
    title: `${verb} ${label.toLowerCase()} · ${draft.scholarName}`,
    detail: `Waiting for the research office.`,
    href: recordHref("admin", draft.kind),
  });
}

/** Tells the scholar (and the office, after a supervisor's recommendation) of a decision. */
async function announceStatus(
  record: ScholarRecord,
  status: RecordStatus,
  remarks: string,
) {
  const label = recordLabel(record.kind);
  if (status === "Supervisor approved") {
    await notifyOffice({
      title: `${label} recommended · ${record.scholarName}`,
      detail: `${record.supervisorName || "The supervisor"} recommended it. Waiting for the research office.`,
      href: recordHref("admin", record.kind),
    });
  }
  await pushNotice({
    role: "scholar",
    identifier: record.scholarIdentifier,
    title: `${label}: ${status === "Supervisor approved" ? "recommended by your supervisor" : status.toLowerCase()}`,
    detail: remarks.trim() || `Your ${label.toLowerCase()} is ${status.toLowerCase()}.`,
    href: recordHref("scholar", record.kind),
  });
}

export async function saveScholarRecord(draft: RecordDraft, existingId?: string) {
  const blocked = officeViewWriteBlock();
  if (blocked) return blocked;
  if (draft.status === "Approved") {
    const signer = readPreviewSession();
    if (!signer || !isOfficeRole(signer.role)) {
      return { ok: false as const, message: "Only the research office can record this." };
    }
  }
  if (existingId && recordById(draft.kind, existingId)?.status === "Approved") {
    // A locked record changes only by the administrator's correction. The personal details are
    // kept by the research office, so the office staff correct those too.
    const signer = readPreviewSession();
    const mayCorrect =
      signer?.role === "admin" ||
      (draft.kind === "personal_details" && signer?.role === "staff");
    if (!mayCorrect) return { ok: false as const, message: lockedMessage };
  }
  if (draft.kind === "title_change") {
    const doctoral = currentDoctoral();
    if (doctoral && synopsisSubmitted(doctoral, draft.scholarIdentifier)) {
      return {
        ok: false as const,
        message: "The synopsis is submitted, so the research title cannot be changed.",
      };
    }
    if (
      doctoral &&
      latestCommittee(doctoral, "second", draft.scholarIdentifier)?.status !== "Approved"
    ) {
      return {
        ok: false as const,
        message:
          "The title is finalised at the second doctoral committee. Propose the final title in that report.",
      };
    }
  }
  const cached = caches.get(draft.kind);
  const source = cached?.source ?? "browser";

  if (source === "database") {
    const supabase = createSupabase();
    if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
    const columns = {
      scholar_name: draft.scholarName,
      status: draft.status ?? ("Submitted" as const),
      payload: toJson({
        ...draft.payload,
        ...(draft.status === "Approved" ? decisionStamp("Approved", "Submitted") : {}),
        supervisorIdentifier: draft.supervisorIdentifier ?? "",
        supervisorName: draft.supervisorName ?? "",
      }),
      file_name: draft.fileName,
      file_data: draft.fileData,
      supervisor_identifier: draft.supervisorIdentifier ?? "",
      supervisor_name: draft.supervisorName ?? "",
    };
    // Lists load without file contents, so an edit with no new file keeps the stored one.
    const { file_name: _keptName, file_data: _keptData, ...withoutFile } = columns;
    void _keptName;
    void _keptData;
    const query = existingId
      ? supabase
          .from("scholar_records")
          .update(draft.fileData ? columns : withoutFile)
          .eq("id", existingId)
          .select(
            "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at, supervisor_identifier, supervisor_name",
          )
      : supabase
          .from("scholar_records")
          .insert({
            ...columns,
            kind: draft.kind,
            scholar_identifier: draft.scholarIdentifier,
          })
          .select(
            "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at, supervisor_identifier, supervisor_name",
          );
    const { data, error } = await query.single();
    if (error || !data) {
      const local = writeLocalScholarRecord(draft, existingId);
      if (!local.ok) return local;
      if (cached) {
        publish(draft.kind, {
          ...cached,
          records: existingId
            ? cached.records.map((record) =>
                record.id === existingId ? local.record : record,
              )
            : [local.record, ...cached.records],
          detail: officeSqlHint,
        });
      }
      return { ok: true as const };
    }
    const mapped = mapRow(data);
    if (!mapped || !cached)
      return { ok: false as const, message: "That record could not be saved." };
    const records = existingId
      ? cached.records.map((record) => (record.id === existingId ? mapped : record))
      : [mapped, ...cached.records];
    publish(draft.kind, { ...cached, records });
    await announceSubmission(draft, Boolean(existingId));
    return { ok: true as const };
  }

  const all = readBrowserRecords();
  const next: ScholarRecord = {
    id: existingId ?? `local-${crypto.randomUUID()}`,
    kind: draft.kind,
    scholarIdentifier: draft.scholarIdentifier,
    scholarName: draft.scholarName,
    status: draft.status ?? "Submitted",
    payload: draft.payload,
    fileName: draft.fileName,
    fileData: draft.fileData,
    supervisorIdentifier: draft.supervisorIdentifier ?? "",
    supervisorName: draft.supervisorName ?? "",
    createdAt: new Date().toISOString(),
  };
  const records = existingId
    ? all.map((record) =>
        record.id === existingId ? { ...next, createdAt: record.createdAt } : record,
      )
    : [next, ...all];
  try {
    writeBrowserRecords(records);
  } catch {
    return {
      ok: false as const,
      message:
        "This browser cannot store that file. Run the SQL migration, then upload again.",
    };
  }
  publish(draft.kind, {
    records: records.filter((record) => record.kind === draft.kind),
    source: "browser",
    detail: cached?.detail ?? null,
  });
  await announceSubmission(draft, Boolean(existingId));
  return { ok: true as const };
}

/** Who acted and when, kept on the record so approved copies can show it. */
function decisionStamp(
  status: RecordStatus | undefined,
  current: RecordStatus,
): Record<string, string> {
  if (!status || status === current) return {};
  const signer = readPreviewSession();
  const by = signer ? signer.name.trim() || signer.identifier : "";
  const at = new Date().toISOString();
  const on = at.slice(0, 10);
  if (status === "Approved") return { approvedOn: on, approvedAt: at, approvedBy: by };
  if (status === "Supervisor approved") {
    return { supervisorOn: on, supervisorAt: at, supervisorBy: by };
  }
  if (status === "Returned") {
    return {
      returnedOn: on,
      returnedAt: at,
      returnedBy: by,
      returnedByRole: signer?.role ?? "",
    };
  }
  return {};
}

/**
 * What a decision on a request that goes through approval steps does. The steps are the ones
 * stored with the request (see Approval rules): the guide's, the Dean's, the Vice Chancellor's.
 * The step it waits at is the first not yet done; only that step's role may decide. The last
 * step approves the request; a step before it only recommends (the request moves on); a
 * return, at any step, sends it back to the scholar.
 */
function decisionPlan(
  record: ScholarRecord,
  requested: RecordStatus | undefined,
): {
  block: string | null;
  status: RecordStatus | undefined;
  stamp: Record<string, string>;
} {
  const plain = {
    block: null,
    status: requested,
    stamp: decisionStamp(requested, record.status),
  };
  if (!requested || requested === record.status) return { ...plain, stamp: {} };
  const menu = scholarRecordMenus.find((item) => item.kind === record.kind);
  if (!menu?.needsSupervisor) return plain;
  const role = readPreviewSession()?.role;
  const withGuide = Boolean(record.supervisorIdentifier?.trim());
  const stages = recordStages(record, withGuide);
  const isDone = (stage: ApprovalStage) =>
    Boolean(record.payload[stage === "supervisor" ? "supervisorOn" : `${stage}On`]);
  const pointer = nextStage(
    stages,
    stages.filter((stage) => isDone(stage)),
  );
  const fail = (block: string) => ({ block, status: requested, stamp: {} });
  if (requested === "Supervisor approved") {
    return pointer === "supervisor" && mayAct(role, "supervisor")
      ? plain
      : fail("Only the supervisor can approve this first.");
  }
  if (!pointer) return fail("This request is not waiting for a decision.");
  if (requested === "Returned") {
    if (!mayAct(role, pointer)) {
      return fail(
        pointer === "supervisor"
          ? "Only a request waiting for the supervisor can be decided here."
          : `This is waiting for the ${stageNames[pointer]}.`,
      );
    }
    return { ...plain, stamp: { ...plain.stamp, returnedByRole: pointer } };
  }
  // Approved.
  if (role === "admin" && pointer === "supervisor") return plain;
  if (pointer === "supervisor") return fail("The supervisor has to approve first.");
  if (!mayAct(role, pointer))
    return fail(`This is waiting for the ${stageNames[pointer]}.`);
  if (pointer === stages[stages.length - 1] || role === "admin") return plain;
  // A step before the last one: it recommends, and the request stays where it is.
  const signer = readPreviewSession();
  const at = new Date().toISOString();
  return {
    block: null,
    status: record.status,
    stamp: {
      [`${pointer}On`]: at.slice(0, 10),
      [`${pointer}At`]: at,
      [`${pointer}By`]: signer ? signer.name.trim() || signer.identifier : "",
    },
  };
}

export async function annotateScholarRecord(
  record: ScholarRecord,
  patch: { status?: RecordStatus; extra?: Record<string, string> },
) {
  if (officeViewWriteBlock()) return false;
  if (record.status === "Approved") return false;
  const plan = decisionPlan(record, patch.status);
  if (plan.block) return false;
  if (patch.status === "Returned" && (patch.extra?.remarks ?? "").trim().length < 2) {
    return false;
  }
  const next: ScholarRecord = {
    ...record,
    status: plan.status ?? record.status,
    payload: {
      ...record.payload,
      ...patch.extra,
      ...plan.stamp,
    },
  };
  const cached = caches.get(record.kind);
  if (cached?.source === "database" && !record.id.startsWith("local-")) {
    const supabase = createSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from("scholar_records")
      .update({ status: next.status, payload: toJson(next.payload) })
      .eq("id", record.id);
    if (error) return false;
  } else {
    const records = readBrowserRecords().map((item) =>
      item.id === record.id ? next : item,
    );
    writeBrowserRecords(records);
  }
  if (cached) {
    publish(record.kind, {
      ...cached,
      records: cached.records.map((item) => (item.id === record.id ? next : item)),
    });
  }
  if (patch.status && patch.status !== record.status) {
    const settled = next.status !== record.status;
    await recordAudit({
      action: settled ? `record:${patch.status}` : "record:recommended",
      subject: `${record.kind}:${record.id}`,
      detail: `${record.scholarName} (${record.scholarIdentifier}) · ${record.kind}`,
    });
    if (settled) await announceStatus(record, patch.status, patch.extra?.remarks ?? "");
  }
  return true;
}

export async function setScholarRecordStatus(
  record: ScholarRecord,
  status: RecordStatus,
  remarks = "",
) {
  if (officeViewWriteBlock()) return false;
  if (record.status === "Approved") return false;
  const plan = decisionPlan(record, status);
  if (plan.block) return false;
  if (status === "Returned" && remarks.trim().length < 2) return false;
  if (record.kind === "title_change" && status !== "Returned") {
    // The title is locked once the synopsis is submitted.
    const doctoral = currentDoctoral();
    if (doctoral && synopsisSubmitted(doctoral, record.scholarIdentifier)) return false;
  }
  const payload = {
    ...(remarks.trim().length > 0
      ? { ...record.payload, remarks: remarks.trim() }
      : record.payload),
    ...plan.stamp,
  };
  // A step before the last only recommends: the status stays as it was.
  const newStatus = plan.status ?? status;
  const next = { ...record, status: newStatus, payload };
  const cached = caches.get(record.kind);
  if (cached?.source === "database" && !record.id.startsWith("local-")) {
    const supabase = createSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from("scholar_records")
      .update({ status: newStatus, payload: toJson(payload) })
      .eq("id", record.id);
    if (error) return false;
  } else {
    const records = readBrowserRecords().map((item) =>
      item.id === record.id ? next : item,
    );
    writeBrowserRecords(records);
  }
  if (cached) {
    publish(record.kind, {
      ...cached,
      records: cached.records.map((item) => (item.id === record.id ? next : item)),
    });
  }
  await recordAudit({
    action: newStatus === record.status ? "record:recommended" : `record:${status}`,
    subject: `${record.kind}:${record.id}`,
    detail: `${record.scholarName} (${record.scholarIdentifier}) · ${record.kind}`,
  });
  if (newStatus !== record.status) await announceStatus(record, status, remarks);
  return true;
}

export async function loadRecordFile(record: ScholarRecord) {
  if (record.fileData) return record.fileData;
  if (record.id.startsWith("local-")) {
    return readBrowserRecords().find((item) => item.id === record.id)?.fileData ?? null;
  }
  const supabase = createSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("scholar_records")
    .select("file_data")
    .eq("id", record.id)
    .maybeSingle();
  if (error || !data?.file_data) return null;
  return data.file_data;
}

export function recordSchema(menu: ScholarRecordMenu) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of menu.fields) {
    if (field.kind === "email") {
      shape[field.name] = field.required
        ? z.string().trim().email("Enter a valid email address.")
        : z
            .string()
            .trim()
            .refine(
              (value) => value === "" || z.string().email().safeParse(value).success,
              "Enter a valid email address.",
            );
      continue;
    }
    if (field.kind === "tel") {
      shape[field.name] = field.required
        ? z
            .string()
            .trim()
            .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number.")
        : z
            .string()
            .trim()
            .refine(
              (value) => value === "" || /^[6-9]\d{9}$/.test(value),
              "Enter a 10-digit mobile number.",
            );
      continue;
    }
    if (field.kind === "date") {
      shape[field.name] = field.required
        ? z.string().trim().refine(isValidIsoDate, "Enter a valid date.")
        : z
            .string()
            .trim()
            .refine(
              (value) => value === "" || isValidIsoDate(value),
              "Enter a valid date.",
            );
      continue;
    }
    if (field.kind === "amount") {
      shape[field.name] = z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/, "Enter the amount.");
      continue;
    }
    if (field.name === "year") {
      shape[field.name] = z
        .string()
        .trim()
        .regex(/^20\d{2}$/, "Enter a year such as 2026.");
      continue;
    }
    if (field.kind === "doi") {
      shape[field.name] = z
        .string()
        .trim()
        .refine(
          (value) => value === "" || /^10\.\d{4,9}\/\S+$/.test(value),
          "Enter a DOI such as 10.1000/journal.1.",
        );
      continue;
    }
    if (field.kind === "select") {
      const options = field.options ?? [];
      shape[field.name] = z
        .string()
        .trim()
        .refine(
          (value) => options.includes(value) || (!field.required && value === ""),
          `Select ${field.label.toLowerCase()}.`,
        );
      continue;
    }
    const minimum = field.minLength ?? (field.required ? 1 : 0);
    shape[field.name] = field.required
      ? z.string().trim().min(minimum, `Enter ${field.label.toLowerCase()}.`)
      : z.string().trim();
  }
  return z.object(shape);
}

export function downloadStoredFile(filename: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

export function blobFromDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(5, comma);
  const body = dataUrl.slice(comma + 1);
  const parts = header.split(";").filter(Boolean);
  const mime = parts[0] || "application/octet-stream";
  const base64 = parts.some((part) => part.trim().toLowerCase() === "base64");
  try {
    const binary = base64 ? atob(body) : decodeURIComponent(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function openStoredFile(filename: string, dataUrl: string) {
  // A file kept in storage opens straight from its address.
  if (isFileRef(dataUrl)) {
    window.open(dataUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = blobFromDataUrl(dataUrl);
  if (!blob) {
    downloadStoredFile(filename, dataUrl);
    return;
  }
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    downloadStoredFile(filename, dataUrl);
    URL.revokeObjectURL(url);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
