import { admissionYear, storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";

export type ScholarSubmission = {
  applicationNo: string;
  dateOfBirth: string;
  name: string;
  email: string;
  status: string;
};

function nextSerial(key: string) {
  const current = Number(window.localStorage.getItem(key) || "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  window.localStorage.setItem(key, String(next));
  return next;
}

export function issueScholarNumber() {
  const serial = String(nextSerial(storageKeys.scholarSeq)).padStart(4, "0");
  return `SJU/PHD/${admissionYear}/${serial}`;
}

export function issueSupervisorNumber() {
  const serial = String(nextSerial(storageKeys.supervisorSeq)).padStart(3, "0");
  return `SJU/SUP/PHD/${admissionYear}/${serial}`;
}

export async function issueApplicationNo(kind: "phd" | "supervisor") {
  const supabase = createSupabase();
  if (supabase) {
    const issued = await supabase.rpc("issue_application_no", {
      p_kind: kind,
      p_year: admissionYear,
    });
    if (!issued.error && typeof issued.data === "string" && issued.data.trim()) {
      return issued.data.trim();
    }
  }
  return kind === "phd" ? issueScholarNumber() : issueSupervisorNumber();
}

export function readSubmissions(): ScholarSubmission[] {
  try {
    const raw = window.localStorage.getItem(storageKeys.scholarSubmissions);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScholarSubmission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSubmission(entry: ScholarSubmission) {
  const existing = readSubmissions().filter(
    (item) => item.applicationNo !== entry.applicationNo,
  );
  window.localStorage.setItem(
    storageKeys.scholarSubmissions,
    JSON.stringify([entry, ...existing]),
  );
}
