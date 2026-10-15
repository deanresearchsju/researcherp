import { admissionSessions, admissionYear, storageKeys } from "@/lib/constants";
import { clientToday } from "@/lib/dates";
import { createSupabase } from "@/lib/supabase/client";

export type ScholarSubmission = {
  applicationNo: string;
  dateOfBirth: string;
  name: string;
  email: string;
  status: string;
};

export type IssueApplicationOptions = {
  session?: string;
  year?: string;
  issuedOn?: string;
};

function nextSerial(key: string) {
  const current = Number(window.localStorage.getItem(key) || "0");
  const next = Number.isFinite(current) ? current + 1 : 1;
  window.localStorage.setItem(key, String(next));
  return next;
}

export function phdSessionCode(session: string) {
  const value = session.trim().toLowerCase();
  if (value.startsWith("jan")) return "Jan";
  if (value.startsWith("jul")) return "Jul";
  if (value.startsWith("jun")) return "Jun";
  return "";
}

export function isPhdApplicationNo(value: string) {
  const number = value.trim();
  return (
    /^SJU\/PHD\/\d{4}\/(Jan|Jul|Jun)\/\d{4}$/i.test(number) ||
    /^SJU\/PHD\/\d{4}\/\d{4}$/.test(number)
  );
}

export function formatPhdApplicationNo(year: string, session: string, serial: number) {
  const code = phdSessionCode(session) || "Jan";
  return `SJU/PHD/${year}/${code}/${String(serial).padStart(4, "0")}`;
}

export function formatSupervisorApplicationNo(issuedOn: string, serial: number) {
  const day = issuedOn.trim().slice(0, 10);
  const year = day.slice(0, 4) || admissionYear;
  const month = day.slice(5, 7) || "01";
  return `SJU/PHD/SUP.App/${month}/${year.slice(-2)}/${String(serial).padStart(3, "0")}`;
}

export function issueScholarNumber(
  session: string = admissionSessions[0],
  year = admissionYear,
) {
  const code = phdSessionCode(session) || "Jan";
  const serial = nextSerial(`${storageKeys.scholarSeq}:${year}:${code}`);
  return formatPhdApplicationNo(year, session, serial);
}

export function issueSupervisorNumber(issuedOn = clientToday()) {
  const day = issuedOn.trim().slice(0, 10);
  const year = day.slice(0, 4) || admissionYear;
  const month = day.slice(5, 7) || "01";
  const serial = nextSerial(`${storageKeys.supervisorSeq}:${month}:${year.slice(-2)}`);
  return formatSupervisorApplicationNo(day, serial);
}

export async function issueApplicationNo(
  kind: "phd" | "supervisor",
  options: IssueApplicationOptions = {},
) {
  const year = options.year?.trim() || admissionYear;
  const supabase = createSupabase();
  if (kind === "phd") {
    const session = options.session?.trim() || admissionSessions[0];
    const code = phdSessionCode(session) || "Jan";
    if (supabase) {
      const issued = await supabase.rpc("issue_application_number", {
        p_kind: kind,
        p_year: year,
        p_code: code,
      });
      if (!issued.error && typeof issued.data === "string" && issued.data.trim()) {
        return issued.data.trim();
      }
    }
    return issueScholarNumber(session, year);
  }
  const issuedOn = options.issuedOn?.trim() || clientToday();
  const month = issuedOn.slice(5, 7) || "01";
  if (supabase) {
    const issued = await supabase.rpc("issue_application_number", {
      p_kind: kind,
      p_year: issuedOn.slice(0, 4) || year,
      p_code: month,
    });
    if (!issued.error && typeof issued.data === "string" && issued.data.trim()) {
      return issued.data.trim();
    }
  }
  return issueSupervisorNumber(issuedOn);
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
