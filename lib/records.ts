import { issueScholarNumber, issueSupervisorNumber } from "@/lib/applications";
import { createSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

export const applicationStatuses = [
  "Acknowledgement sent",
  "Under review",
  "Shortlisted",
  "Selected",
  "Not selected",
] as const;

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

const saveError =
  "The application could not be saved. Please try again, or email the Center for Research.";

export function attachmentNames(
  files: Record<string, { file: File } | null | undefined>,
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(files).map(([key, value]) => [key, value?.file.name ?? null]),
  );
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
  },
): Promise<SaveResult> {
  const supabase = createSupabase();
  if (!supabase) return { ok: false, message: saveError };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const applicationNo = kind === "phd" ? issueScholarNumber() : issueSupervisorNumber();
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
    .eq("application_no", applicationNo.trim().toUpperCase())
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
  const { error } = await supabase
    .from(applicationTable(kind))
    .update({ status })
    .eq("id", id);
  return !error;
}

export async function deleteApplication(kind: ApplicationKind, id: string) {
  const supabase = createSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from(applicationTable(kind)).delete().eq("id", id);
  return !error;
}
