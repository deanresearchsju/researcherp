import { issueApplicationNo } from "@/lib/applications";
import { adminActionBlock } from "@/lib/access";
import { fileToDataUrl } from "@/lib/files";
import { createSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

export const applicationStatuses = [
  "Acknowledgement sent",
  "Under review",
  "Shortlisted",
  "Selected",
  "Not selected",
] as const;

export const supervisorReviewStatuses = [
  "Acknowledgement sent",
  "Under review",
  "Accepted",
  "Approved",
  "Rejected",
] as const;

export type SupervisorReviewStatus = (typeof supervisorReviewStatuses)[number];

const applicationTransitions: Record<string, readonly string[]> = {
  "Acknowledgement sent": ["Under review"],
  "Under review": ["Shortlisted", "Not selected"],
  Shortlisted: ["Selected", "Not selected"],
  Selected: [],
  "Not selected": [],
};

export function canChangeApplicationStatus(from: string, to: string) {
  if (from === to) return true;
  const allowed = applicationTransitions[from];
  return Boolean(allowed?.includes(to));
}

export type ApplicationKind = "phd" | "supervisor";

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
    const fileData = await fileToDataUrl(slot.file).catch(() => "");
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

async function insertApplication(
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
    if (!error) return { ok: true, applicationNo };
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
    .select("application_no, applicant_name, email, date_of_birth, status")
    .ilike("application_no", applicationNo.trim())
    .eq("date_of_birth", dateOfBirth)
    .maybeSingle();
  if (error || !data) return null;
  return {
    applicationNo: data.application_no,
    name: data.applicant_name,
    email: data.email,
    dateOfBirth: data.date_of_birth,
    status: data.status,
  };
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
  if (!canChangeApplicationStatus(current.data.status, status)) return false;
  const { error } = await supabase
    .from(table)
    .update({ status })
    .eq("id", id)
    .eq("status", current.data.status);
  return !error;
}

function rememberApplication(id: string, patch: Partial<StoredApplication>) {
  if (!applicationMemory) return;
  applicationMemory = applicationMemory.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
  notifyApplications();
}

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

export async function reviewSupervisorApplication(
  id: string,
  payload: Json,
  status: "Accepted" | "Approved" | "Rejected",
  remarks: string,
  approvedQuota?: number,
) {
  const supabase = createSupabase();
  if (!supabase) return false;
  const current =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const nextPayload = toJson({
    ...current,
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

export async function deleteApplication(kind: ApplicationKind, id: string) {
  const supabase = createSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from(applicationTable(kind)).delete().eq("id", id);
  return !error;
}
