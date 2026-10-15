import {
  admissionChecklist,
  defaultLetter,
  interviewMax,
  writtenMax,
} from "@/data/admission";
import { schools } from "@/data/schools";
import { pushNotice, recordAudit } from "@/lib/audit";
import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { saveJsonBlob } from "@/lib/json-lock";
import { toJson, type StoredApplication } from "@/lib/records";
import { scholarBySignIn } from "@/lib/register";
import type { Json } from "@/types/database";
import type { Vacancy } from "@/lib/vacancies";

export const admissionMigrationHint =
  "Open the Supabase SQL editor and run supabase/migrations/20261013200000_admission_selection.sql. Until then, the admission file stays in this browser.";

export const paymentMarks = ["Pending", "Approved", "Returned"] as const;
export const attendanceMarks = ["Present", "Absent"] as const;
export const checkMarks = ["Received", "Missing", "Submitted", "Not applicable"] as const;

export type PaymentMark = (typeof paymentMarks)[number];
export type AttendanceMark = (typeof attendanceMarks)[number] | "";
export type CheckMark = (typeof checkMarks)[number];

export type LetterConfig = typeof defaultLetter;

export type AdmissionCase = {
  applicationId: string;
  applicationNo: string;
  title: string;
  name: string;
  email: string;
  department: string;
  studyMode: string;
  payment: PaymentMark;
  shortlisted: boolean;
  attendance: AttendanceMark;
  written: number | null;
  interview: number | null;
  selected: boolean;
  guideName: string;
  guideIdentifier: string;
  verification: "Pending" | "Approved";
  checks: Partial<Record<string, CheckMark>>;
  uploads: Partial<Record<string, { fileName: string; fileData: string }>>;
  feeReference: string;
  feeAmount: string;
  feeReceiptName: string | null;
  feeReceiptData: string | null;
};

export type EntranceScore = {
  key: string;
  written: number | null;
  interview: number | null;
};

export type AdmissionState = {
  cases: AdmissionCase[];
  letter: LetterConfig;
  entranceScores: EntranceScore[];
  updatedAt: string | null;
  detail: string | null;
};

const empty: AdmissionState = {
  cases: [],
  letter: defaultLetter,
  entranceScores: [],
  updatedAt: null,
  detail: null,
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function payloadText(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return text(payload[key]);
}

export function departmentOf(application: StoredApplication) {
  const specialization = payloadText(application.payload, "specialization");
  const school = payloadText(application.payload, "school");
  return specialization || school || "—";
}

export function blankCase(application: StoredApplication): AdmissionCase {
  return {
    applicationId: application.id,
    applicationNo: application.applicationNo,
    title: payloadText(application.payload, "title"),
    name: application.applicantName,
    email: application.email,
    department: departmentOf(application),
    studyMode:
      application.studyMode || payloadText(application.payload, "studyMode") || "—",
    payment: "Pending",
    shortlisted: false,
    attendance: "",
    written: null,
    interview: null,
    selected: false,
    guideName: "",
    guideIdentifier: "",
    verification: "Pending",
    checks: {},
    uploads: {},
    feeReference: "",
    feeAmount: "",
    feeReceiptName: null,
    feeReceiptData: null,
  };
}

export function mergeApplications(
  cases: AdmissionCase[],
  applications: StoredApplication[],
) {
  const merged = applications.map((application) => {
    const existing = cases.find(
      (item) =>
        item.applicationId === application.id ||
        item.applicationNo === application.applicationNo,
    );
    const fresh = blankCase(application);
    if (!existing) return fresh;
    return {
      ...existing,
      applicationId: fresh.applicationId,
      applicationNo: fresh.applicationNo,
      title: fresh.title || existing.title,
      name: fresh.name,
      email: fresh.email,
      department: existing.department || fresh.department,
      studyMode: fresh.studyMode || existing.studyMode,
    };
  });
  const known = new Set(merged.map((item) => item.applicationNo));
  return [...merged, ...cases.filter((item) => !known.has(item.applicationNo))];
}

export function sameDepartment(left: string, right: string) {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!a || !b || a === "—" || b === "—") return false;
  return a === b;
}

export function schoolNameFromLabel(label: string) {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "—") return "";
  const byName = schools.find((item) => sameDepartment(item.name, trimmed));
  if (byName) return byName.name;
  const byArea = schools.find((item) =>
    item.areas.some((area) => sameDepartment(area, trimmed)),
  );
  return byArea?.name ?? "";
}

export function admissionCaseForIdentifier(
  identifier: string,
  cases: readonly AdmissionCase[],
) {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  const scholar = scholarBySignIn(identifier);
  if (scholar) return admissionCaseForScholar(scholar, cases);
  return (
    cases.find((row) => row.applicationNo.trim().toLowerCase() === id) ??
    cases.find((row) => row.email.trim().toLowerCase() === id) ??
    null
  );
}

export function scholarIsAdmitted(
  identifier: string,
  cases?: readonly AdmissionCase[] | null,
) {
  if (!identifier.trim()) return false;
  if (scholarBySignIn(identifier)) return true;
  const list = cases ?? currentAdmission()?.cases;
  if (!list) return false;
  return admissionCaseForIdentifier(identifier, list)?.verification === "Approved";
}

export function scholarSchoolName(identifier: string, extra?: string) {
  const candidates = [
    extra,
    scholarBySignIn(identifier)?.department,
    admissionCaseForIdentifier(identifier, currentAdmission()?.cases ?? [])?.department,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const named = schoolNameFromLabel(candidate);
    if (named) return named;
  }
  return extra?.trim() || scholarBySignIn(identifier)?.department || "";
}

export function sameSubject(candidateDepartment: string, vacancyDepartment: string) {
  const school = schools.find((item) => sameDepartment(item.name, candidateDepartment));
  const names = school && school.areas.length > 0 ? school.areas : [candidateDepartment];
  return names.some((name) => sameDepartment(name, vacancyDepartment));
}

export function seatsFor(department: string, vacancies: readonly Vacancy[]) {
  return vacancies
    .filter((row) => sameSubject(department, row.department))
    .reduce((sum, row) => sum + row.vacancyCount, 0);
}

export function totalMarks(row: Pick<AdmissionCase, "written" | "interview">) {
  if (row.written === null || row.interview === null) return null;
  return row.written + row.interview;
}

export function applyVacancySelection(
  cases: AdmissionCase[],
  vacancies: readonly Vacancy[],
) {
  const chosen = new Set<string>();
  const departments = [...new Set(cases.map((item) => item.department))];
  for (const department of departments) {
    const seats = seatsFor(department, vacancies);
    const ranked = cases
      .filter(
        (item) =>
          item.department === department &&
          item.shortlisted &&
          item.attendance === "Present" &&
          item.written !== null &&
          item.interview !== null,
      )
      .sort(
        (a, b) =>
          (totalMarks(b) ?? 0) - (totalMarks(a) ?? 0) || a.name.localeCompare(b.name),
      );
    ranked.slice(0, seats).forEach((item) => chosen.add(item.applicationId));
  }
  return cases.map((item) => ({
    ...item,
    selected: chosen.has(item.applicationId),
    guideName: chosen.has(item.applicationId) ? item.guideName : "",
    guideIdentifier: chosen.has(item.applicationId) ? item.guideIdentifier : "",
    verification: chosen.has(item.applicationId) ? item.verification : "Pending",
  }));
}

export function attendanceOrder(cases: readonly AdmissionCase[]) {
  return cases
    .filter((item) => item.shortlisted)
    .slice()
    .sort(
      (a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name),
    );
}

export function provisionalOrder(cases: readonly AdmissionCase[]) {
  return cases
    .filter((item) => item.selected)
    .slice()
    .sort(
      (a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name),
    );
}

export function displayName(row: Pick<AdmissionCase, "title" | "name">) {
  return [row.title, row.name].filter(Boolean).join(" ");
}

export function modeLabel(studyMode: string) {
  if (studyMode === "Full-Time" || studyMode === "Full Time") return "Full time";
  if (studyMode === "Part-Time" || studyMode === "Part Time") return "Part time";
  return studyMode;
}

export function missingItems(row: AdmissionCase) {
  return admissionChecklist.filter((item) => row.checks[item.id] === "Missing");
}

export function verificationBlock(row: AdmissionCase) {
  if (!row.selected) return "Select the candidate before certificate verification.";
  if (!row.guideName) return "Allot a guide on the provisional list first.";
  if (!row.feeReceiptData) return "The tuition fee receipt has not been uploaded.";
  const open = admissionChecklist.filter((item) => {
    const mark = row.checks[item.id];
    if (item.required) return mark !== "Received";
    return mark !== "Received" && mark !== "Not applicable";
  });
  if (open.length > 0) {
    return "Mark every certificate. Required items must be Received, and the others Received or Not applicable.";
  }
  return null;
}

function numberOrNull(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

function parseCheck(value: unknown): CheckMark | undefined {
  return checkMarks.find((item) => item === value);
}

function parseCase(value: unknown): AdmissionCase | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const applicationNo = text(row.applicationNo);
  const name = text(row.name);
  if (!applicationNo || !name) return null;
  const payment = paymentMarks.find((item) => item === row.payment) ?? "Pending";
  const attendance = attendanceMarks.find((item) => item === row.attendance) ?? "";
  const gatedAttendance =
    row.shortlisted === true && payment === "Approved" ? attendance : "";
  const written =
    gatedAttendance === "Present" ? numberOrNull(row.written, writtenMax) : null;
  const interview =
    gatedAttendance === "Present" ? numberOrNull(row.interview, interviewMax) : null;
  const selected = row.selected === true && written !== null && interview !== null;
  const checks: AdmissionCase["checks"] = {};
  if (row.checks && typeof row.checks === "object") {
    for (const [key, mark] of Object.entries(row.checks)) {
      const parsed = parseCheck(mark);
      if (parsed) checks[key] = parsed;
    }
  }
  const uploads: AdmissionCase["uploads"] = {};
  if (row.uploads && typeof row.uploads === "object") {
    for (const [key, file] of Object.entries(row.uploads)) {
      if (!file || typeof file !== "object") continue;
      const stored = file as Record<string, unknown>;
      const fileName = text(stored.fileName);
      const fileData = text(stored.fileData);
      if (fileName && fileData) uploads[key] = { fileName, fileData };
    }
  }
  return {
    applicationId: text(row.applicationId) || applicationNo,
    applicationNo,
    title: text(row.title),
    name,
    email: text(row.email),
    department: text(row.department) || "—",
    studyMode: text(row.studyMode) || "—",
    payment,
    shortlisted: row.shortlisted === true && payment === "Approved",
    attendance: gatedAttendance,
    written,
    interview,
    selected,
    guideName: selected ? text(row.guideName) : "",
    guideIdentifier: selected ? text(row.guideIdentifier) : "",
    verification: selected && row.verification === "Approved" ? "Approved" : "Pending",
    checks,
    uploads,
    feeReference: text(row.feeReference),
    feeAmount: text(row.feeAmount),
    feeReceiptName: text(row.feeReceiptName) || null,
    feeReceiptData: text(row.feeReceiptData) || null,
  };
}

function parseLetter(value: unknown): LetterConfig {
  const row =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...defaultLetter };
  (Object.keys(defaultLetter) as (keyof LetterConfig)[]).forEach((key) => {
    const stored = text(row[key]);
    if (stored) next[key] = stored;
  });
  return next;
}

function parseScore(value: unknown): EntranceScore | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const key = text(row.key);
  if (!key) return null;
  return {
    key,
    written: numberOrNull(row.written, writtenMax),
    interview: numberOrNull(row.interview, interviewMax),
  };
}

function parseStored(value: unknown): {
  cases: AdmissionCase[];
  letter: LetterConfig;
  entranceScores: EntranceScore[];
} {
  if (!value || typeof value !== "object") {
    return { cases: [], letter: defaultLetter, entranceScores: [] };
  }
  const row = value as Record<string, unknown>;
  const cases = Array.isArray(row.cases)
    ? row.cases.flatMap((item) => {
        const parsed = parseCase(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const entranceScores = Array.isArray(row.entranceScores)
    ? row.entranceScores.flatMap((item) => {
        const parsed = parseScore(item);
        return parsed ? [parsed] : [];
      })
    : [];
  return { cases, letter: parseLetter(row.letter), entranceScores };
}

let memory: AdmissionState | null = null;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: AdmissionState) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function currentAdmission() {
  return memory;
}

export async function ensureAdmission() {
  if (memory) return memory;
  const value = await loadAdmission();
  publish(value);
  return value;
}

export function subscribeAdmission(onChange: () => void) {
  listeners.add(onChange);
  if (!loading) {
    loading = true;
    void loadAdmission().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

function readBrowser(): {
  cases: AdmissionCase[];
  letter: LetterConfig;
  entranceScores: EntranceScore[];
} {
  if (typeof window === "undefined") {
    return { cases: [], letter: defaultLetter, entranceScores: [] };
  }
  try {
    const raw = window.localStorage.getItem(storageKeys.admission);
    return raw
      ? parseStored(JSON.parse(raw) as unknown)
      : { cases: [], letter: defaultLetter, entranceScores: [] };
  } catch {
    return { cases: [], letter: defaultLetter, entranceScores: [] };
  }
}

function mergeScores(local: EntranceScore[], remote: EntranceScore[]) {
  const seen = new Set(remote.map((item) => item.key));
  return [...local.filter((item) => !seen.has(item.key)), ...remote];
}

async function loadAdmission(): Promise<AdmissionState> {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) return { ...browser, updatedAt: null, detail: null };
  const { data, error } = await supabase
    .from("admission_office")
    .select("payload, updated_at")
    .eq("id", "office")
    .maybeSingle();
  if (error) return { ...browser, updatedAt: null, detail: admissionMigrationHint };
  if (!data?.payload) return { ...browser, updatedAt: null, detail: null };
  const remote = parseStored(data.payload);
  const seen = new Set(remote.cases.map((item) => item.applicationNo));
  return {
    cases: [
      ...browser.cases.filter((item) => !seen.has(item.applicationNo)),
      ...remote.cases,
    ],
    letter: remote.letter,
    entranceScores: mergeScores(browser.entranceScores, remote.entranceScores),
    updatedAt: data.updated_at ?? null,
    detail: null,
  };
}

export async function saveAdmission(
  next: Pick<AdmissionState, "cases" | "letter"> & {
    entranceScores?: EntranceScore[];
    updatedAt?: string | null;
  },
) {
  const stored = {
    cases: next.cases,
    letter: next.letter,
    entranceScores: next.entranceScores ?? memory?.entranceScores ?? [],
  };
  const stamp = next.updatedAt ?? memory?.updatedAt ?? null;
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const saved = await saveJsonBlob("admission_office", "office", toJson(stored), stamp);
    if (saved.ok) {
      publish({ ...stored, updatedAt: saved.updatedAt, detail: null });
      return { ok: true as const };
    }
    if (saved.conflict) return { ok: false as const, message: saved.message };
  }
  try {
    window.localStorage.setItem(storageKeys.admission, JSON.stringify(stored));
  } catch {
    return {
      ok: false as const,
      message:
        "This browser cannot store the admission file. Run the SQL migration, then try again.",
    };
  }
  publish({
    ...stored,
    updatedAt: memory?.updatedAt ?? null,
    detail: memory?.detail ?? admissionMigrationHint,
  });
  return { ok: true as const };
}

export function marksError(written: string, interview: string) {
  const writtenNo = Number(written);
  const interviewNo = Number(interview);
  if (
    written.trim() === "" ||
    !Number.isInteger(writtenNo) ||
    writtenNo < 0 ||
    writtenNo > writtenMax
  ) {
    return `The written test is marked out of ${writtenMax}.`;
  }
  if (
    interview.trim() === "" ||
    !Number.isInteger(interviewNo) ||
    interviewNo < 0 ||
    interviewNo > interviewMax
  ) {
    return `The interview is marked out of ${interviewMax}.`;
  }
  return null;
}

export function marksDraftError(written: string, interview: string) {
  if (written.trim() === "" && interview.trim() === "") return null;
  return marksError(written, interview);
}

export function scoreFor(scores: readonly EntranceScore[], key: string) {
  return scores.find((item) => item.key === key) ?? null;
}

export function admissionCaseForScholar(
  scholar: { email: string; applicationNumber: string },
  cases: readonly AdmissionCase[],
) {
  const email = scholar.email.trim().toLowerCase();
  const application = scholar.applicationNumber.trim().toLowerCase();
  return (
    cases.find((row) => row.applicationNo.trim().toLowerCase() === application) ??
    (email ? cases.find((row) => row.email.trim().toLowerCase() === email) : undefined) ??
    null
  );
}

export async function saveEntrancePage(
  patches: readonly {
    key: string;
    applicationId: string;
    written: string;
    interview: string;
  }[],
) {
  const current = memory ?? (await ensureAdmission());
  const scores = [...current.entranceScores];
  let cases = current.cases;
  for (const patch of patches) {
    const error = marksDraftError(patch.written, patch.interview);
    if (error) return { ok: false as const, message: error };
    const written = patch.written.trim() === "" ? null : Number(patch.written);
    const interview = patch.interview.trim() === "" ? null : Number(patch.interview);
    const nextScore: EntranceScore = { key: patch.key, written, interview };
    const index = scores.findIndex((item) => item.key === patch.key);
    if (index >= 0) scores[index] = nextScore;
    else scores.push(nextScore);
    if (patch.applicationId && written !== null && interview !== null) {
      cases = cases.map((row) =>
        row.applicationId === patch.applicationId && row.attendance === "Present"
          ? { ...row, written, interview }
          : row,
      );
    }
  }
  const saved = await saveAdmission({
    cases,
    letter: current.letter,
    entranceScores: scores,
  });
  if (!saved.ok) return saved;
  return { ok: true as const };
}

export async function setApplicationFee(applicationId: string, payment: PaymentMark) {
  const current = memory ?? (await ensureAdmission());
  const row = current.cases.find((item) => item.applicationId === applicationId);
  if (!row) {
    return { ok: false as const, message: "That application was not found." };
  }
  const nextRow: AdmissionCase = {
    ...row,
    payment,
    shortlisted: payment === "Approved" && row.shortlisted,
  };
  const cases = current.cases.map((item) =>
    item.applicationId === applicationId ? nextRow : item,
  );
  const saved = await saveAdmission({
    cases,
    letter: current.letter,
    entranceScores: current.entranceScores,
  });
  if (!saved.ok) return saved;
  await recordAudit({
    action: `payment:${payment}`,
    subject: `application-fee:${applicationId}`,
    detail: `${row.name} · application fee`,
  });
  if (row.email) {
    await pushNotice({
      role: "scholar",
      identifier: row.email,
      title: `Application fee ${payment}`,
      detail: `The research office marked the application fee ${payment}.`,
    });
  }
  return { ok: true as const };
}
