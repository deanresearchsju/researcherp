import {
  recordStatuses,
  scholarRecordKinds,
  type RecordStatus,
  type ScholarRecordKind,
  type ScholarRecordMenu,
} from "@/data/scholar-records";
import { storageKeys } from "@/lib/constants";
import { isValidIsoDate } from "@/lib/dates";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";
import type { Json } from "@/types/database";
import { z } from "zod";

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
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013173000_scholar_records.sql, then supabase/migrations/20261013180000_office_controls.sql. Until then, uploads stay in this browser.";

const officeSqlHint =
  "Run supabase/migrations/20261013180000_office_controls.sql so this record is stored in the database. A copy is kept in this browser.";

function writeLocalScholarRecord(draft: RecordDraft, existingId?: string) {
  const all = readBrowserRecords();
  const next: ScholarRecord = {
    id: existingId ?? `local-${crypto.randomUUID()}`,
    kind: draft.kind,
    scholarIdentifier: draft.scholarIdentifier,
    scholarName: draft.scholarName,
    status: "Submitted",
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
    loading.add(kind);
    void loadScholarRecords(kind).then((value) => {
      caches.set(kind, value);
      loading.delete(kind);
      notify(kind);
    });
  }
  return () => set.delete(onChange);
}

export function currentScholarRecords(kind: ScholarRecordKind) {
  return caches.get(kind) ?? null;
}

function publish(kind: ScholarRecordKind, next: ScholarRecordLoad) {
  caches.set(kind, next);
  notify(kind);
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

export async function loadScholarRecords(
  kind: ScholarRecordKind,
): Promise<ScholarRecordLoad> {
  const supabase = createSupabase();
  if (!supabase) {
    return {
      records: readBrowserRecords().filter((record) => record.kind === kind),
      source: "browser",
      detail: null,
    };
  }

  const extended = await supabase
    .from("scholar_records")
    .select(
      "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at, supervisor_identifier, supervisor_name",
    )
    .eq("kind", kind)
    .order("created_at", { ascending: false });

  const fallback =
    extended.error || !extended.data
      ? await supabase
          .from("scholar_records")
          .select(
            "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at",
          )
          .eq("kind", kind)
          .order("created_at", { ascending: false })
      : null;

  const data = extended.data ?? fallback?.data ?? null;
  const missingTable = Boolean(extended.error && fallback?.error);

  if (missingTable || !data) {
    return {
      records: readBrowserRecords().filter((record) => record.kind === kind),
      source: "browser",
      detail: extended.error
        ? "The scholar record table is not in the database yet."
        : null,
    };
  }

  const remote = data.flatMap((row) => {
    const record = mapRow(row);
    return record ? [record] : [];
  });
  const remoteIds = new Set(remote.map((record) => record.id));
  const localExtras = readBrowserRecords().filter(
    (record) =>
      record.kind === kind &&
      record.id.startsWith("local-") &&
      !remoteIds.has(record.id),
  );
  return {
    records: [...localExtras, ...remote],
    source: "database",
    detail: extended.error ? officeSqlHint : null,
  };
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
};

export async function saveScholarRecord(draft: RecordDraft, existingId?: string) {
  const cached = caches.get(draft.kind);
  const source = cached?.source ?? "browser";

  if (source === "database") {
    const supabase = createSupabase();
    if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
    const columns = {
      scholar_name: draft.scholarName,
      status: "Submitted" as const,
      payload: toJson({
        ...draft.payload,
        supervisorIdentifier: draft.supervisorIdentifier ?? "",
        supervisorName: draft.supervisorName ?? "",
      }),
      file_name: draft.fileName,
      file_data: draft.fileData,
      supervisor_identifier: draft.supervisorIdentifier ?? "",
      supervisor_name: draft.supervisorName ?? "",
    };
    const query = existingId
      ? supabase
          .from("scholar_records")
          .update(columns)
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
    return { ok: true as const };
  }

  const all = readBrowserRecords();
  const next: ScholarRecord = {
    id: existingId ?? `local-${crypto.randomUUID()}`,
    kind: draft.kind,
    scholarIdentifier: draft.scholarIdentifier,
    scholarName: draft.scholarName,
    status: "Submitted",
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
  return { ok: true as const };
}

export async function setScholarRecordStatus(
  record: ScholarRecord,
  status: RecordStatus,
) {
  const cached = caches.get(record.kind);
  if (cached?.source === "database" && !record.id.startsWith("local-")) {
    const supabase = createSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from("scholar_records")
      .update({ status })
      .eq("id", record.id);
    if (error) return false;
  } else {
    const records = readBrowserRecords().map((item) =>
      item.id === record.id ? { ...item, status } : item,
    );
    writeBrowserRecords(records);
  }
  if (cached) {
    publish(record.kind, {
      ...cached,
      records: cached.records.map((item) =>
        item.id === record.id ? { ...item, status } : item,
      ),
    });
  }
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
      shape[field.name] = z.string().trim().email("Enter a valid email address.");
      continue;
    }
    if (field.kind === "tel") {
      shape[field.name] = z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number.");
      continue;
    }
    if (field.kind === "date") {
      shape[field.name] = z.string().trim().refine(isValidIsoDate, "Enter a valid date.");
      continue;
    }
    if (field.kind === "amount") {
      shape[field.name] = z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/, "Enter the amount.");
      continue;
    }
    if (field.kind === "select") {
      const options = field.options ?? [];
      shape[field.name] = z
        .string()
        .trim()
        .refine(
          (value) => options.includes(value),
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
