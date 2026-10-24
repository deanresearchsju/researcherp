import { issueApplicationNo } from "@/lib/applications";
import { adminActionBlock, officeWriteBlock } from "@/lib/access";
import { sendMailEvent } from "@/lib/mail-client";
import { createSupabase } from "@/lib/supabase/client";
import { assertPhdUploads } from "@/lib/upload-guard";
import type { Json } from "@/types/database";
import { isFileValue } from "@/lib/file-ref";
import { storeFile } from "@/lib/file-store";

export const applicationStatuses = [
  "Acknowledgement sent",
  "Under review",
  "Shortlisted",
  "Selected",
  "Waiting list",
  "Not selected",
  "Not reported",
  "Admitted",
] as const;

export const supervisorReviewStatuses = [
  "Acknowledgement sent",
  "Under review",
  "Accepted",
  "Approved",
  "Rejected",
] as const;

export type SupervisorReviewStatus = (typeof supervisorReviewStatuses)[number];

/** The admission path: review → shortlist → select → admit (documents verified). */
const applicationTransitions: Record<string, readonly string[]> = {
  "Acknowledgement sent": ["Under review", "Shortlisted", "Not selected"],
  "Under review": ["Shortlisted", "Not selected"],
  Shortlisted: ["Selected", "Waiting list", "Not selected", "Under review"],
  Selected: ["Admitted", "Not selected", "Waiting list", "Not reported"],
  "Waiting list": ["Selected", "Not selected", "Shortlisted"],
  "Not selected": ["Under review", "Shortlisted", "Selected", "Waiting list"],
  "Not reported": ["Selected"],
  Admitted: [],
};

export function canChangeApplicationStatus(from: string, to: string) {
  if (from === to) return true;
  const allowed = applicationTransitions[from];
  return Boolean(allowed?.includes(to));
}

const phdProgress: Record<string, string> = {
  "Acknowledgement sent": "Under review",
  "Under review": "Shortlisted",
  Shortlisted: "Selected",
  Selected: "Admitted",
};

const phdReject: Record<string, string> = {
  "Under review": "Not selected",
  Shortlisted: "Not selected",
};

const supervisorProgress: Record<string, string> = {
  "Acknowledgement sent": "Under review",
  "Under review": "Accepted",
  Accepted: "Approved",
};

const supervisorTransitions: Record<string, readonly SupervisorReviewStatus[]> = {
  "Acknowledgement sent": ["Under review", "Accepted", "Rejected"],
  "Under review": ["Accepted", "Rejected"],
  Accepted: ["Approved", "Rejected"],
  Approved: [],
  Rejected: [],
};

export function canChangeSupervisorStatus(from: string, to: string) {
  if (from === to) return true;
  return Boolean(supervisorTransitions[from]?.includes(to as SupervisorReviewStatus));
}

export type ApplicationKind = "phd" | "supervisor";

export function canAdvanceApplication(kind: ApplicationKind, from: string, to: string) {
  return kind === "supervisor"
    ? canChangeSupervisorStatus(from, to)
    : canChangeApplicationStatus(from, to);
}

export function nextApplicationStage(kind: ApplicationKind, status: string) {
  const next = kind === "supervisor" ? supervisorProgress[status] : phdProgress[status];
  if (!next) return null;
  return canAdvanceApplication(kind, status, next) ? next : null;
}

export function approveApplicationStage(kind: ApplicationKind, status: string) {
  const next = kind === "supervisor" ? "Approved" : "Selected";
  return canAdvanceApplication(kind, status, next) ? next : null;
}

export function rejectApplicationStage(kind: ApplicationKind, status: string) {
  if (kind === "supervisor") {
    return canChangeSupervisorStatus(status, "Rejected") ? "Rejected" : null;
  }
  const next = phdReject[status];
  return next && canChangeApplicationStatus(status, next) ? next : null;
}

export type StoredApplication = {
  id: string;
  kind: ApplicationKind;
  applicationNo: string;
  applicantName: string;
  email: string;
  dateOfBirth: string;
  studyMode: string | null;
  status: string;
  createdAt: string;
  payload: Json;
};

export type SaveResult =
  { ok: true; applicationNo: string } | { ok: false; message: string };

export function isStoredApplication(id: string) {
  return !id.startsWith("register:");
}

const saveError =
  "The application could not be saved. Please try again, or email the Center for Research.";

export function attachmentNames(
  files: Record<string, { file: File } | null | undefined>,
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, value?.file.name ?? null]),
  );
}

export async function attachmentFiles(
  files: Record<string, { file: File } | null | undefined>,
) {
  const stored: Record<string, { fileName: string; fileData: string }> = {};
  for (const [key, slot] of Object.entries(files)) {
    if (!slot?.file) continue;
    const fileData = await storeFile(slot.file, "applications").catch(() => "");
    if (!fileData) continue;
    stored[key] = { fileName: slot.file.name, fileData };
  }
  return stored;
}

export function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => toJson(item));
  if (typeof value === "object") {
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = toJson(item);
    }
    return result;
  }
  return null;
}

/** Lets the research office know a website application arrived. */
async function announceApplication(kind: ApplicationKind, applicationNo: string) {
  if (typeof window === "undefined") return;
  await fetch("/api/notices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "application", kind, applicationNo }),
  }).catch(() => null);
}

/** Stores the application, then sends the acknowledgement mail (never blocks the applicant). */
async function insertApplication(
  kind: ApplicationKind,
  values: Parameters<typeof insertApplicationRecord>[1],
): Promise<SaveResult> {
  const saved = await insertApplicationRecord(kind, values);
  if (saved.ok) {
    void sendMailEvent({
      event: "ack",
      kind,
      applicationNo: saved.applicationNo,
      dateOfBirth: values.dateOfBirth,
    });
  }
  return saved;
}

async function insertApplicationRecord(
  kind: ApplicationKind,
  values: {
    dateOfBirth: string;
    applicantName: string;
    email: string;
    studyMode?: string;
    payload: Json;
    session?: string;
    year?: string;
  },
): Promise<SaveResult> {
  if (kind === "phd") {
    const uploads = assertPhdUploads(values.payload);
    if (!uploads.ok) return uploads;
    try {
      const response = await fetch("/api/apply/phd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: unknown = await response.json().catch(() => null);
      if (
        data &&
        typeof data === "object" &&
        "ok" in data &&
        data.ok === true &&
        "applicationNo" in data &&
        typeof data.applicationNo === "string"
      ) {
        return { ok: true, applicationNo: data.applicationNo };
      }
      if (
        data &&
        typeof data === "object" &&
        "ok" in data &&
        data.ok === false &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return { ok: false, message: data.message };
      }
    } catch {
      // Fall through to the client insert path if the route is unavailable.
    }
  }

  const supabase = createSupabase();
  if (!supabase) return { ok: false, message: saveError };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const applicationNo = await issueApplicationNo(kind, {
      session: values.session,
      year: values.year,
    });
    const shared = {
      application_no: applicationNo,
      date_of_birth: values.dateOfBirth,
      applicant_name: values.applicantName,
      email: values.email,
      status: "Acknowledgement sent",
      payload: values.payload,
    };
    const { error } =
      kind === "phd"
        ? await supabase
            .from("phd_applications")
            .insert({ ...shared, study_mode: values.studyMode ?? "" })
        : await supabase.from("supervisor_applications").insert(shared);
    if (!error) {
      await announceApplication(kind, applicationNo);
      return { ok: true, applicationNo };
    }
    if (error.code !== "23505") return { ok: false, message: saveError };
  }

  return { ok: false, message: saveError };
}

export function savePhdApplication(values: {
  dateOfBirth: string;
  applicantName: string;
  email: string;
  studyMode: string;
  session: string;
  year: string;
  payload: unknown;
}) {
  return insertApplication("phd", { ...values, payload: toJson(values.payload) });
}

export function saveSupervisorApplication(values: {
  dateOfBirth: string;
  applicantName: string;
  email: string;
  payload: unknown;
}) {
  return insertApplication("supervisor", { ...values, payload: toJson(values.payload) });
}

export async function lookupPhdApplication(applicationNo: string, dateOfBirth: string) {
  const supabase = createSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("phd_applications")
    .select(
      "id, application_no, applicant_name, email, date_of_birth, status, payload, created_at",
    )
    .ilike("application_no", applicationNo.trim())
    .eq("date_of_birth", dateOfBirth)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    applicationNo: data.application_no,
    name: data.applicant_name,
    email: data.email,
    dateOfBirth: data.date_of_birth,
    status: data.status,
    payload: data.payload,
    createdAt: data.created_at,
  };
}

export async function lookupSupervisorApplication(
  applicationNo: string,
  dateOfBirth: string,
) {
  const supabase = createSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("supervisor_applications")
    .select(
      "id, application_no, applicant_name, email, date_of_birth, status, payload, created_at",
    )
    .ilike("application_no", applicationNo.trim())
    .eq("date_of_birth", dateOfBirth)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    kind: "supervisor" as const,
    applicationNo: data.application_no,
    applicantName: data.applicant_name,
    email: data.email,
    dateOfBirth: data.date_of_birth,
    studyMode: null,
    status: data.status,
    payload: data.payload,
    createdAt: data.created_at,
  } satisfies StoredApplication;
}

export async function loadStoredApplications(): Promise<{
  records: StoredApplication[];
  detail: string | null;
}> {
  const supabase = createSupabase();
  if (!supabase) {
    return { records: [], detail: "Supabase is not configured." };
  }

  const [phd, supervisor] = await Promise.all([
    supabase
      .from("phd_applications")
      .select(
        "id, application_no, date_of_birth, applicant_name, email, study_mode, status, payload, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("supervisor_applications")
      .select(
        "id, application_no, date_of_birth, applicant_name, email, status, payload, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (phd.error || supervisor.error) {
    return {
      records: [],
      detail:
        "Application tables are not available yet. Run the SQL migration, then submit a form again.",
    };
  }

  const records: StoredApplication[] = [
    ...(phd.data ?? []).map((row) => ({
      id: row.id,
      kind: "phd" as const,
      applicationNo: row.application_no,
      applicantName: row.applicant_name,
      email: row.email,
      dateOfBirth: row.date_of_birth,
      studyMode: row.study_mode,
      status: row.status,
      createdAt: row.created_at,
      payload: row.payload,
    })),
    ...(supervisor.data ?? []).map((row) => ({
      id: row.id,
      kind: "supervisor" as const,
      applicationNo: row.application_no,
      applicantName: row.applicant_name,
      email: row.email,
      dateOfBirth: row.date_of_birth,
      studyMode: null,
      status: row.status,
      createdAt: row.created_at,
      payload: row.payload,
    })),
  ];

  return { records, detail: null };
}

let applicationMemory: StoredApplication[] | null = null;
let applicationStarted = false;
const applicationListeners = new Set<() => void>();

function notifyApplications() {
  applicationListeners.forEach((listener) => listener());
}

export function currentApplications() {
  return applicationMemory;
}

/** Drops deleted applications from every list on screen. */
export function forgetApplications(ids: readonly string[]) {
  if (!applicationMemory) return;
  const gone = new Set(ids);
  applicationMemory = applicationMemory.filter((item) => !gone.has(item.id));
  notifyApplications();
}

export function subscribeApplications(onChange: () => void) {
  applicationListeners.add(onChange);
  if (!applicationStarted) {
    applicationStarted = true;
    void loadStoredApplications().then((loaded) => {
      applicationMemory = loaded.records;
      notifyApplications();
    });
  }
  return () => {
    applicationListeners.delete(onChange);
  };
}

function applicationTable(kind: ApplicationKind) {
  return kind === "phd" ? "phd_applications" : "supervisor_applications";
}

export async function updateApplicationStatus(
  kind: ApplicationKind,
  id: string,
  status: string,
) {
  const supabase = createSupabase();
  if (!supabase) return false;
  const table = applicationTable(kind);
  const current = await supabase.from(table).select("status").eq("id", id).maybeSingle();
  if (current.error || !current.data) return false;
  if (!canAdvanceApplication(kind, current.data.status, status)) return false;
  const { error } = await supabase
    .from(table)
    .update({ status })
    .eq("id", id)
    .eq("status", current.data.status);
  if (error) return false;
  rememberApplication(id, { status });
  return true;
}

function rememberApplication(id: string, patch: Partial<StoredApplication>) {
  if (!applicationMemory) return;
  applicationMemory = applicationMemory.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
  notifyApplications();
}

export async function reviewSupervisorApplication(
  id: string,
  payload: Json,
  status: "Accepted" | "Approved" | "Rejected",
  remarks: string,
  approvedQuota?: number,
  extra: Record<string, unknown> = {},
) {
  const supabase = createSupabase();
  if (!supabase) return false;
  const current =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const nextPayload = toJson({
    ...current,
    ...extra,
    officeDecision: status,
    officeRemarks: remarks.trim(),
    ...(status === "Accepted" ? { acceptedRemarks: remarks.trim() } : {}),
    ...(status === "Approved" && approvedQuota !== undefined ? { approvedQuota } : {}),
  });
  const { error } = await supabase
    .from("supervisor_applications")
    .update({
      status,
      payload: nextPayload,
    })
    .eq("id", id);
  if (error) return false;
  rememberApplication(id, { status, payload: nextPayload });
  if (status === "Approved" && approvedQuota !== undefined) {
    // An approved supervisor goes straight onto the vacancy list, which drives the public
    // vacancy page and scholar allotment.
    const field = (key: string) => {
      const value = (current as Record<string, unknown>)[key];
      return typeof value === "string" ? value.trim() : "";
    };
    const { addApprovedSupervisorVacancy } = await import("@/lib/vacancies");
    await addApprovedSupervisorVacancy({
      name: field("name"),
      designation: field("designation"),
      school: field("faculty"),
      department: field("subject") || field("proposedDepartment") || field("department"),
      researchArea: field("expertise"),
      quota: approvedQuota,
    });
  }
  return true;
}

export async function decideSupervisorApplication(
  id: string,
  payload: Json,
  status: "Approved" | "Rejected",
  remarks: string,
  approvedQuota?: number,
) {
  return reviewSupervisorApplication(id, payload, status, remarks, approvedQuota);
}

export async function updateApplicationDetails(
  kind: ApplicationKind,
  id: string,
  next: { applicantName: string; email: string; payload: Json },
) {
  const blocked = adminActionBlock();
  if (blocked) return { ok: false as const, message: blocked.message };
  if (!isStoredApplication(id)) {
    return { ok: false as const, message: saveError };
  }
  const supabase = createSupabase();
  if (!supabase) return { ok: false as const, message: saveError };
  const shared = {
    applicant_name: next.applicantName,
    email: next.email,
    payload: next.payload,
  };
  const studyMode =
    kind === "phd" &&
    next.payload &&
    typeof next.payload === "object" &&
    !Array.isArray(next.payload) &&
    typeof next.payload.studyMode === "string"
      ? next.payload.studyMode
      : undefined;
  const { error } =
    kind === "phd"
      ? await supabase
          .from("phd_applications")
          .update(studyMode !== undefined ? { ...shared, study_mode: studyMode } : shared)
          .eq("id", id)
      : await supabase.from("supervisor_applications").update(shared).eq("id", id);
  if (error) return { ok: false as const, message: saveError };
  rememberApplication(id, {
    applicantName: next.applicantName,
    email: next.email,
    payload: next.payload,
    ...(studyMode !== undefined ? { studyMode } : {}),
  });
  return { ok: true as const };
}

/**
 * Stores a copy of an enclosure (or the photo / signature) uploaded by the research office for
 * an application whose file was not saved at submission.
 */
export async function attachApplicationFile(
  kind: ApplicationKind,
  id: string,
  slot: string,
  fileName: string,
  fileData: string,
) {
  const blocked = officeWriteBlock();
  if (blocked) return { ok: false as const, message: blocked.message };
  if (!isStoredApplication(id) || !isFileValue(fileData)) {
    return { ok: false as const, message: saveError };
  }
  const supabase = createSupabase();
  if (!supabase) return { ok: false as const, message: saveError };
  const table = applicationTable(kind);
  const current = await supabase.from(table).select("payload").eq("id", id).maybeSingle();
  if (current.error || !current.data) return { ok: false as const, message: saveError };
  const record = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json | undefined>)
      : {};
  const payload = record(current.data.payload);
  const next: Record<string, Json | undefined> = {
    ...payload,
    files: { ...record(payload.files), [slot]: { fileName, fileData } },
    attachments: { ...record(payload.attachments), [slot]: fileName },
  };
  if (slot === "photo" || slot === "signature") {
    next.images = { ...record(payload.images), [slot]: fileData };
  }
  const nextPayload = toJson(next);
  const { error } = await supabase
    .from(table)
    .update({ payload: nextPayload })
    .eq("id", id);
  if (error) return { ok: false as const, message: saveError };
  rememberApplication(id, { payload: nextPayload });
  return { ok: true as const, payload: nextPayload };
}

export async function deleteApplication(kind: ApplicationKind, id: string) {
  const supabase = createSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from(applicationTable(kind)).delete().eq("id", id);
  return !error;
}
