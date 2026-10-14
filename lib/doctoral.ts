import {
  courseSemesters,
  courseWorkFee,
  isStrongIndex,
  reportTargets,
  schoolNeedsIndexedPair,
  thesisWindowMonths,
} from "@/data/doctoral";
import { pushNotice, recordAudit } from "@/lib/audit";
import {
  admissionSessions,
  isPartTimeMode,
  referenceDate,
  storageKeys,
} from "@/lib/constants";
import { clientToday } from "@/lib/dates";
import { saveJsonBlob } from "@/lib/json-lock";
import { sameId } from "@/lib/office";
import { officeViewWriteBlock } from "@/lib/office-view";
import { toJson } from "@/lib/records";
import { createSupabase } from "@/lib/supabase/client";

export type StoredAdmissionSession = (typeof admissionSessions)[number] | "June";

export function parseAdmissionSession(value: string): StoredAdmissionSession {
  if (value === "January" || value === "July" || value === "June") return value;
  return admissionSessions[0];
}

export const doctoralMigrationHint =
  "Open the Supabase SQL editor and run supabase/migrations/20261013190000_doctoral_progress.sql. Until then, course work and committee records stay in this browser.";

export type CourseBatch = {
  id: string;
  name: string;
  session: StoredAdmissionSession;
  year: string;
  enabled: boolean;
  openSemester: number;
};

export type CourseSubject = {
  id: string;
  batchId: string;
  semester: number;
  code: string;
  name: string;
  credits: string;
  syllabusName: string | null;
  syllabusData: string | null;
};

export type CourseEnrollment = {
  id: string;
  batchId: string;
  scholarIdentifier: string;
  scholarName: string;
  studyMode: string;
  school: string;
};

export type CourseWindow = {
  batchId: string;
  enabled: boolean;
  semester: number;
  lastDate: string;
};

export type CourseRegistration = {
  id: string;
  batchId: string;
  subjectId: string;
  scholarIdentifier: string;
  scholarName: string;
  semester: number;
  code: string;
  name: string;
  amount: number;
  paymentMode: string;
  paymentReference: string;
  paymentDate: string;
  receiptName: string | null;
  receiptData: string | null;
};

export type CourseResult = {
  id: string;
  registrationId: string;
  outcome: "Pass" | "Fail";
  attendance: "Present" | "Absent" | "";
  publishedOn: string;
};

export type CommitteeKind = "second" | "third" | "fourth";

export type CommitteeReport = {
  id: string;
  kind: CommitteeKind;
  scholarIdentifier: string;
  scholarName: string;
  status: "Submitted" | "Approved" | "Rejected";
  fileName: string;
  fileData: string | null;
  remarks: string;
  agenda: string;
  attendance: string;
  minutes: string;
  decidedOn: string;
  createdAt: string;
};

export type Colloquium = {
  id: string;
  name: string;
  sitting: "May" | "November";
  year: string;
  issuedOn: string;
  scholars: { identifier: string; name: string }[];
  supervisors: { identifier: string; name: string }[];
};

export type SynopsisSubmission = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  checks: string[];
  fileName: string;
  fileData: string | null;
  status: "Submitted" | "Approved" | "Rejected";
  remarks: string;
  decidedOn: string;
  createdAt: string;
};

export type ThesisEvaluator = {
  name: string;
  institution: string;
  email: string;
};

export type ThesisVersion = {
  version: number;
  fileName: string;
  uploadedAt: string;
};

export type ThesisSubmission = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  title: string;
  domain: string;
  checks: string[];
  fileName: string;
  fileData: string | null;
  version: number;
  versions: ThesisVersion[];
  local: ThesisEvaluator[];
  indian: ThesisEvaluator[];
  foreign: ThesisEvaluator[];
  status: "Submitted" | "Approved" | "Rejected";
  remarks: string;
  decidedOn: string;
  createdAt: string;
};

export type PlagiarismCertificate = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  similarity: string;
  fileName: string;
  fileData: string | null;
  status: "Submitted" | "Approved" | "Rejected";
  remarks: string;
  decidedOn: string;
  createdAt: string;
};

export type ExaminerOutcome = "Recommended" | "Revision" | "Rejected";

export type ExaminerReport = {
  id: string;
  thesisId: string;
  scholarIdentifier: string;
  scholarName: string;
  examinerName: string;
  group: "local" | "indian" | "foreign";
  version: number;
  outcome: ExaminerOutcome;
  remarks: string;
  fileName: string;
  fileData: string | null;
  createdAt: string;
};

export type VivaRecord = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  scheduledOn: string;
  venue: string;
  panel: string;
  status: "Scheduled" | "Passed" | "Failed";
  minutes: string;
  remarks: string;
  createdAt: string;
};

export type CompletionRecord = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  kind: "Provisional" | "Degree";
  issuedOn: string;
  remarks: string;
  createdAt: string;
};

export type ReportAccess = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  period: string;
  status: "Requested" | "Granted" | "Rejected";
  remarks: string;
  createdAt: string;
};

export type DoctoralState = {
  batches: CourseBatch[];
  windows: CourseWindow[];
  subjects: CourseSubject[];
  enrollments: CourseEnrollment[];
  registrations: CourseRegistration[];
  results: CourseResult[];
  committees: CommitteeReport[];
  colloquia: Colloquium[];
  synopses: SynopsisSubmission[];
  theses: ThesisSubmission[];
  access: ReportAccess[];
  plagiarism: PlagiarismCertificate[];
  examinerReports: ExaminerReport[];
  vivas: VivaRecord[];
  completions: CompletionRecord[];
  detail: string | null;
};

const empty: Omit<DoctoralState, "detail"> = {
  batches: [],
  windows: [],
  subjects: [],
  enrollments: [],
  registrations: [],
  results: [],
  committees: [],
  colloquia: [],
  synopses: [],
  theses: [],
  access: [],
  plagiarism: [],
  examinerReports: [],
  vivas: [],
  completions: [],
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function objectRow(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function evaluators(value: unknown): ThesisEvaluator[] {
  return list(value).flatMap((item) => {
    const row = objectRow(item);
    if (!row || !text(row.name)) return [];
    return [
      {
        name: text(row.name),
        institution: text(row.institution),
        email: text(row.email),
      },
    ];
  });
}

function parseStored(value: unknown): Omit<DoctoralState, "detail"> {
  const row = objectRow(value);
  if (!row) return empty;
  return {
    batches: list(row.batches).flatMap((item) => {
      const batch = objectRow(item);
      if (!batch || !text(batch.id)) return [];
      return [
        {
          id: text(batch.id),
          name: text(batch.name),
          session: parseAdmissionSession(text(batch.session)),
          year: text(batch.year),
          enabled: Boolean(batch.enabled),
          openSemester: Number(batch.openSemester) || 0,
        },
      ];
    }),
    windows: list(row.windows).flatMap((item) => {
      const window = objectRow(item);
      const semester = Number(window?.semester);
      if (!window || !text(window.batchId)) return [];
      if (!courseSemesters.includes(semester as (typeof courseSemesters)[number]))
        return [];
      return [
        {
          batchId: text(window.batchId),
          enabled: Boolean(window.enabled),
          semester,
          lastDate: text(window.lastDate),
        },
      ];
    }),
    subjects: list(row.subjects).flatMap((item) => {
      const subject = objectRow(item);
      if (!subject || !text(subject.id)) return [];
      return [
        {
          id: text(subject.id),
          batchId: text(subject.batchId),
          semester: Number(subject.semester) || 1,
          code: text(subject.code),
          name: text(subject.name),
          credits: text(subject.credits),
          syllabusName: text(subject.syllabusName) || null,
          syllabusData: text(subject.syllabusData) || null,
        },
      ];
    }),
    enrollments: list(row.enrollments).flatMap((item) => {
      const enrollment = objectRow(item);
      if (!enrollment || !text(enrollment.scholarIdentifier)) return [];
      return [
        {
          id: text(enrollment.id),
          batchId: text(enrollment.batchId),
          scholarIdentifier: text(enrollment.scholarIdentifier),
          scholarName: text(enrollment.scholarName),
          studyMode: text(enrollment.studyMode) || "Full time",
          school: text(enrollment.school),
        },
      ];
    }),
    registrations: list(row.registrations).flatMap((item) => {
      const registration = objectRow(item);
      if (!registration || !text(registration.id)) return [];
      return [
        {
          id: text(registration.id),
          batchId: text(registration.batchId),
          subjectId: text(registration.subjectId),
          scholarIdentifier: text(registration.scholarIdentifier),
          scholarName: text(registration.scholarName),
          semester: Number(registration.semester) || 1,
          code: text(registration.code),
          name: text(registration.name),
          amount: Number(registration.amount) || 0,
          paymentMode: text(registration.paymentMode),
          paymentReference: text(registration.paymentReference),
          paymentDate: text(registration.paymentDate),
          receiptName: text(registration.receiptName) || null,
          receiptData: text(registration.receiptData) || null,
        },
      ];
    }),
    results: list(row.results).flatMap((item) => {
      const result = objectRow(item);
      if (!result || !text(result.registrationId)) return [];
      return [
        {
          id: text(result.id),
          registrationId: text(result.registrationId),
          outcome: text(result.outcome) === "Fail" ? "Fail" : "Pass",
          attendance:
            text(result.attendance) === "Absent"
              ? "Absent"
              : text(result.attendance) === "Present"
                ? "Present"
                : "",
          publishedOn: text(result.publishedOn),
        },
      ];
    }),
    committees: list(row.committees).flatMap((item) => {
      const report = objectRow(item);
      const kind = text(report?.kind);
      if (!report || !text(report.id)) return [];
      if (kind !== "second" && kind !== "third" && kind !== "fourth") return [];
      const status = text(report.status);
      return [
        {
          id: text(report.id),
          kind,
          scholarIdentifier: text(report.scholarIdentifier),
          scholarName: text(report.scholarName),
          status: status === "Approved" || status === "Rejected" ? status : "Submitted",
          fileName: text(report.fileName),
          fileData: text(report.fileData) || null,
          remarks: text(report.remarks),
          agenda: text(report.agenda),
          attendance: text(report.attendance),
          minutes: text(report.minutes),
          decidedOn: text(report.decidedOn),
          createdAt: text(report.createdAt),
        },
      ];
    }),
    colloquia: list(row.colloquia).flatMap((item) => {
      const sitting = objectRow(item);
      if (!sitting || !text(sitting.id)) return [];
      const people = (key: string) =>
        list(sitting[key]).flatMap((person) => {
          const entry = objectRow(person);
          if (!entry || !text(entry.identifier)) return [];
          return [{ identifier: text(entry.identifier), name: text(entry.name) }];
        });
      return [
        {
          id: text(sitting.id),
          name: text(sitting.name),
          sitting: text(sitting.sitting) === "November" ? "November" : "May",
          year: text(sitting.year),
          issuedOn: text(sitting.issuedOn),
          scholars: people("scholars"),
          supervisors: people("supervisors"),
        },
      ];
    }),
    synopses: list(row.synopses).flatMap((item) => {
      const synopsis = objectRow(item);
      if (!synopsis || !text(synopsis.id)) return [];
      const status = text(synopsis.status);
      return [
        {
          id: text(synopsis.id),
          scholarIdentifier: text(synopsis.scholarIdentifier),
          scholarName: text(synopsis.scholarName),
          checks: list(synopsis.checks).flatMap((check) =>
            typeof check === "string" ? [check] : [],
          ),
          fileName: text(synopsis.fileName),
          fileData: text(synopsis.fileData) || null,
          status: status === "Approved" || status === "Rejected" ? status : "Submitted",
          remarks: text(synopsis.remarks),
          decidedOn: text(synopsis.decidedOn),
          createdAt: text(synopsis.createdAt),
        },
      ];
    }),
    theses: list(row.theses).flatMap((item) => {
      const thesis = objectRow(item);
      if (!thesis || !text(thesis.id)) return [];
      const status = text(thesis.status);
      return [
        {
          id: text(thesis.id),
          scholarIdentifier: text(thesis.scholarIdentifier),
          scholarName: text(thesis.scholarName),
          title: text(thesis.title),
          domain: text(thesis.domain),
          checks: list(thesis.checks).flatMap((check) =>
            typeof check === "string" ? [check] : [],
          ),
          fileName: text(thesis.fileName),
          fileData: text(thesis.fileData) || null,
          version: Number(thesis.version) || 1,
          versions: (() => {
            const parsed = list(thesis.versions).flatMap((item) => {
              const row = objectRow(item);
              const version = Number(row?.version);
              if (!row || !version) return [];
              return [
                {
                  version,
                  fileName: text(row.fileName),
                  uploadedAt: text(row.uploadedAt),
                },
              ];
            });
            if (parsed.length > 0) return parsed;
            return [
              {
                version: Number(thesis.version) || 1,
                fileName: text(thesis.fileName),
                uploadedAt: text(thesis.createdAt),
              },
            ];
          })(),
          local: evaluators(thesis.local),
          indian: evaluators(thesis.indian),
          foreign: evaluators(thesis.foreign),
          status: status === "Approved" || status === "Rejected" ? status : "Submitted",
          remarks: text(thesis.remarks),
          decidedOn: text(thesis.decidedOn),
          createdAt: text(thesis.createdAt),
        },
      ];
    }),
    access: list(row.access).flatMap((item) => {
      const request = objectRow(item);
      if (!request || !text(request.id)) return [];
      const status = text(request.status);
      return [
        {
          id: text(request.id),
          scholarIdentifier: text(request.scholarIdentifier),
          scholarName: text(request.scholarName),
          period: text(request.period),
          status: status === "Granted" || status === "Rejected" ? status : "Requested",
          remarks: text(request.remarks),
          createdAt: text(request.createdAt),
        },
      ];
    }),
    plagiarism: list(row.plagiarism).flatMap((item) => {
      const certificate = objectRow(item);
      if (!certificate || !text(certificate.id)) return [];
      const status = text(certificate.status);
      return [
        {
          id: text(certificate.id),
          scholarIdentifier: text(certificate.scholarIdentifier),
          scholarName: text(certificate.scholarName),
          similarity: text(certificate.similarity),
          fileName: text(certificate.fileName),
          fileData: text(certificate.fileData) || null,
          status: status === "Approved" || status === "Rejected" ? status : "Submitted",
          remarks: text(certificate.remarks),
          decidedOn: text(certificate.decidedOn),
          createdAt: text(certificate.createdAt),
        },
      ];
    }),
    examinerReports: list(row.examinerReports).flatMap((item) => {
      const report = objectRow(item);
      if (!report || !text(report.id) || !text(report.thesisId)) return [];
      const group = text(report.group);
      const outcome = text(report.outcome);
      if (group !== "local" && group !== "indian" && group !== "foreign") return [];
      if (outcome !== "Recommended" && outcome !== "Revision" && outcome !== "Rejected") {
        return [];
      }
      return [
        {
          id: text(report.id),
          thesisId: text(report.thesisId),
          scholarIdentifier: text(report.scholarIdentifier),
          scholarName: text(report.scholarName),
          examinerName: text(report.examinerName),
          group,
          version: Number(report.version) || 1,
          outcome,
          remarks: text(report.remarks),
          fileName: text(report.fileName),
          fileData: text(report.fileData) || null,
          createdAt: text(report.createdAt),
        },
      ];
    }),
    vivas: list(row.vivas).flatMap((item) => {
      const viva = objectRow(item);
      if (!viva || !text(viva.id)) return [];
      const status = text(viva.status);
      return [
        {
          id: text(viva.id),
          scholarIdentifier: text(viva.scholarIdentifier),
          scholarName: text(viva.scholarName),
          scheduledOn: text(viva.scheduledOn),
          venue: text(viva.venue),
          panel: text(viva.panel),
          status:
            status === "Passed" || status === "Failed" || status === "Scheduled"
              ? status
              : "Scheduled",
          minutes: text(viva.minutes),
          remarks: text(viva.remarks),
          createdAt: text(viva.createdAt),
        },
      ];
    }),
    completions: list(row.completions).flatMap((item) => {
      const completion = objectRow(item);
      if (!completion || !text(completion.id)) return [];
      const kind = text(completion.kind);
      if (kind !== "Provisional" && kind !== "Degree") return [];
      return [
        {
          id: text(completion.id),
          scholarIdentifier: text(completion.scholarIdentifier),
          scholarName: text(completion.scholarName),
          kind,
          issuedOn: text(completion.issuedOn),
          remarks: text(completion.remarks),
          createdAt: text(completion.createdAt),
        },
      ];
    }),
  };
}

let memory: DoctoralState | null = null;
let doctoralStamp: string | null = null;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: DoctoralState) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function currentDoctoral() {
  return memory;
}

export function subscribeDoctoral(onChange: () => void) {
  listeners.add(onChange);
  if (!loading) {
    loading = true;
    void loadDoctoral().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

function readBrowser() {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(storageKeys.doctoral);
    return raw ? parseStored(JSON.parse(raw) as unknown) : empty;
  } catch {
    return empty;
  }
}

async function loadDoctoral(): Promise<DoctoralState> {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) return { ...browser, detail: null };
  const { data, error } = await supabase
    .from("doctoral_office")
    .select("payload, updated_at")
    .eq("id", "office")
    .maybeSingle();
  if (error) return { ...browser, detail: doctoralMigrationHint };
  if (!data?.payload) return { ...browser, detail: null };
  doctoralStamp = data.updated_at ?? null;
  const remote = parseStored(data.payload);
  const payload =
    data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
      ? (data.payload as Record<string, unknown>)
      : null;
  const keep = <T extends { id: string }>(local: T[], saved: T[]) => {
    const seen = new Set(saved.map((item) => item.id));
    return [
      ...local.filter((item) => item.id.startsWith("local-") && !seen.has(item.id)),
      ...saved,
    ];
  };
  return {
    batches: keep(browser.batches, remote.batches),
    windows: payload && "windows" in payload ? remote.windows : browser.windows,
    subjects: keep(browser.subjects, remote.subjects),
    enrollments: keep(browser.enrollments, remote.enrollments),
    registrations: keep(browser.registrations, remote.registrations),
    results: keep(browser.results, remote.results),
    committees: keep(browser.committees, remote.committees),
    colloquia: keep(browser.colloquia, remote.colloquia),
    synopses: keep(browser.synopses, remote.synopses),
    theses: keep(browser.theses, remote.theses),
    access: keep(browser.access, remote.access),
    plagiarism: keep(browser.plagiarism, remote.plagiarism),
    examinerReports: keep(browser.examinerReports, remote.examinerReports),
    vivas: keep(browser.vivas, remote.vivas),
    completions: keep(browser.completions, remote.completions),
    detail: null,
  };
}

async function saveDoctoral(next: Omit<DoctoralState, "detail">) {
  const blocked = officeViewWriteBlock();
  if (blocked) return blocked;
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const saved = await saveJsonBlob(
      "doctoral_office",
      "office",
      toJson(next),
      doctoralStamp,
    );
    if (saved.ok) {
      doctoralStamp = saved.updatedAt;
      publish({ ...next, detail: null });
      return { ok: true as const };
    }
    if (saved.conflict) return { ok: false as const, message: saved.message };
  }
  try {
    window.localStorage.setItem(storageKeys.doctoral, JSON.stringify(next));
  } catch {
    return {
      ok: false as const,
      message:
        "This browser cannot store that file. Run the SQL migration, then upload again.",
    };
  }
  publish({ ...next, detail: memory?.detail ?? doctoralMigrationHint });
  return { ok: true as const };
}

function snapshot(): Omit<DoctoralState, "detail"> {
  const current = memory ?? { ...empty, detail: null };
  return {
    batches: current.batches,
    windows: current.windows,
    subjects: current.subjects,
    enrollments: current.enrollments,
    registrations: current.registrations,
    results: current.results,
    committees: current.committees,
    colloquia: current.colloquia,
    synopses: current.synopses,
    theses: current.theses,
    access: current.access,
    plagiarism: current.plagiarism ?? [],
    examinerReports: current.examinerReports ?? [],
    vivas: current.vivas ?? [],
    completions: current.completions ?? [],
  };
}

function localId() {
  return `local-${crypto.randomUUID()}`;
}

export async function saveBatch(
  batch: Omit<CourseBatch, "id" | "enabled" | "openSemester">,
) {
  const next = snapshot();
  next.batches = [
    { ...batch, id: localId(), enabled: false, openSemester: 0 },
    ...next.batches,
  ];
  return saveDoctoral(next);
}

export async function setBatch(
  batchId: string,
  patch: Partial<Pick<CourseBatch, "enabled" | "openSemester">>,
) {
  const next = snapshot();
  next.batches = next.batches.map((batch) =>
    batch.id === batchId ? { ...batch, ...patch } : batch,
  );
  return saveDoctoral(next);
}

export async function saveSubject(subject: Omit<CourseSubject, "id">) {
  const next = snapshot();
  next.subjects = [{ ...subject, id: localId() }, ...next.subjects];
  return saveDoctoral(next);
}

export async function saveEnrollment(enrollment: Omit<CourseEnrollment, "id">) {
  const next = snapshot();
  next.enrollments = next.enrollments.filter(
    (item) => !sameId(item.scholarIdentifier, enrollment.scholarIdentifier),
  );
  next.enrollments.unshift({ ...enrollment, id: localId() });
  return saveDoctoral(next);
}

export async function saveCourseWindow(window: CourseWindow) {
  const next = snapshot();
  next.windows = [
    window,
    ...next.windows.filter((item) => item.batchId !== window.batchId),
  ];
  return saveDoctoral(next);
}

export async function registerSubject(
  registration: Omit<
    CourseRegistration,
    | "id"
    | "code"
    | "name"
    | "amount"
    | "paymentMode"
    | "paymentReference"
    | "paymentDate"
    | "receiptName"
    | "receiptData"
  > & { code?: string; name?: string },
) {
  const next = snapshot();
  const exists = next.registrations.some(
    (item) =>
      sameId(item.scholarIdentifier, registration.scholarIdentifier) &&
      item.subjectId.length > 0 &&
      item.subjectId === registration.subjectId,
  );
  if (exists) return { ok: false as const, message: "That paper is already registered." };
  const taken = next.registrations.filter(
    (item) =>
      sameId(item.scholarIdentifier, registration.scholarIdentifier) &&
      item.semester === registration.semester,
  );
  if (taken.length >= 2) {
    return {
      ok: false as const,
      message: "Two papers are already registered for this semester.",
    };
  }
  next.registrations.unshift({
    ...registration,
    id: localId(),
    code: registration.code ?? "",
    name: registration.name ?? "",
    amount: 0,
    paymentMode: "",
    paymentReference: "",
    paymentDate: "",
    receiptName: null,
    receiptData: null,
  });
  return saveDoctoral(next);
}

export async function registerCoursePapers(input: {
  scholarIdentifier: string;
  scholarName: string;
  batchId: string;
  semester: number;
  subjects: { code: string; name: string }[];
  paymentMode: string;
  paymentReference: string;
  paymentDate: string;
  receiptName: string;
  receiptData: string;
}) {
  const next = snapshot();
  const window = next.windows.find((item) => item.batchId === input.batchId);
  if (!window?.enabled || window.semester !== input.semester) {
    return { ok: false as const, message: "Registration is not open for this semester." };
  }
  if (!window.lastDate || window.lastDate < clientToday()) {
    return { ok: false as const, message: "The last date for registration has passed." };
  }
  if (input.semester > 2 && !hasArrear(next, input.scholarIdentifier)) {
    return {
      ok: false as const,
      message: "Semester 3 and semester 4 are open to scholars with an arrear.",
    };
  }
  if (input.subjects.length < 1) {
    return { ok: false as const, message: "Add a subject." };
  }
  const existing = next.registrations.filter(
    (item) =>
      sameId(item.scholarIdentifier, input.scholarIdentifier) &&
      item.semester === input.semester,
  );
  if (existing.length + input.subjects.length > 2) {
    return {
      ok: false as const,
      message: "Two papers are the limit for this semester.",
    };
  }
  const codes = input.subjects.map((subject) => subject.code.trim().toLowerCase());
  if (new Set(codes).size !== codes.length) {
    return { ok: false as const, message: "Each subject code can be entered once." };
  }
  if (
    codes.some((code) =>
      existing.some((item) => item.code.trim().toLowerCase() === code && code.length > 0),
    )
  ) {
    return { ok: false as const, message: "That subject is already registered." };
  }
  for (const subject of input.subjects) {
    next.registrations.unshift({
      id: localId(),
      batchId: input.batchId,
      subjectId: "",
      scholarIdentifier: input.scholarIdentifier,
      scholarName: input.scholarName,
      semester: input.semester,
      code: subject.code.trim(),
      name: subject.name.trim(),
      amount: courseWorkFee,
      paymentMode: input.paymentMode,
      paymentReference: input.paymentReference.trim(),
      paymentDate: input.paymentDate,
      receiptName: input.receiptName,
      receiptData: input.receiptData,
    });
  }
  return saveDoctoral(next);
}

export async function publishResult(
  registrationId: string,
  outcome: "Pass" | "Fail",
  publishedOn: string,
  attendance: "Present" | "Absent" | "" = "Present",
) {
  const next = snapshot();
  const recorded: CourseResult = {
    id: localId(),
    registrationId,
    outcome: attendance === "Absent" ? "Fail" : outcome,
    attendance,
    publishedOn,
  };
  const existing = next.results.find((item) => item.registrationId === registrationId);
  next.results = existing
    ? next.results.map((item) =>
        item.registrationId === registrationId ? { ...item, ...recorded, id: item.id } : item,
      )
    : [recorded, ...next.results];
  return saveDoctoral(next);
}

export function committeeBlocked(
  state: Pick<DoctoralState, "committees" | "synopses" | "registrations" | "results">,
  kind: CommitteeKind,
  identifier: string,
) {
  if (kind === "second") {
    return confirmationReady(state, identifier)
      ? null
      : "Semester 1 and semester 2 results have to be published first. That is four papers.";
  }
  if (kind === "third") {
    return latestCommittee(state, "second", identifier)?.status === "Approved"
      ? null
      : "The second doctoral committee has to be approved first.";
  }
  return latestSynopsis(state, identifier)?.status === "Approved"
    ? null
    : "The synopsis has to be approved first.";
}

export function thesisBlocked(
  state: Pick<DoctoralState, "committees" | "synopses">,
  identifier: string,
) {
  const fourth = latestCommittee(state, "fourth", identifier);
  const synopsis = latestSynopsis(state, identifier);
  if (fourth?.status !== "Approved") {
    return "The fourth doctoral committee has to be approved before the thesis opens.";
  }
  if (synopsis?.status !== "Approved" || !synopsis.decidedOn) {
    return "The synopsis has to be approved first.";
  }
  const deadline = thesisDeadline(synopsis.decidedOn);
  if (clientToday() > deadline) return `The thesis window closed on ${deadline}.`;
  return null;
}

export async function saveCommittee(
  report: Omit<
    CommitteeReport,
    | "id"
    | "status"
    | "remarks"
    | "decidedOn"
    | "createdAt"
    | "agenda"
    | "attendance"
    | "minutes"
  >,
) {
  const next = snapshot();
  const blocked = committeeBlocked(next, report.kind, report.scholarIdentifier);
  if (blocked) return { ok: false as const, message: blocked };
  next.committees = next.committees.filter(
    (item) =>
      !(
        item.kind === report.kind &&
        sameId(item.scholarIdentifier, report.scholarIdentifier) &&
        item.status !== "Rejected"
      ),
  );
  next.committees.unshift({
    ...report,
    id: localId(),
    status: "Submitted",
    remarks: "",
    agenda: "",
    attendance: "",
    minutes: "",
    decidedOn: "",
    createdAt: new Date().toISOString(),
  });
  return saveDoctoral(next);
}

export async function decideCommittee(
  id: string,
  decision: {
    status: "Approved" | "Rejected";
    remarks: string;
    decidedOn: string;
    agenda?: string;
    attendance?: string;
    minutes?: string;
  },
) {
  const next = snapshot();
  const current = next.committees.find((item) => item.id === id);
  if (current?.status === "Approved") {
    return { ok: false as const, message: "This report is approved and cannot be changed." };
  }
  if (decision.status === "Approved" && (decision.minutes ?? "").trim().length < 2) {
    return { ok: false as const, message: "Enter the minutes before approving." };
  }
  next.committees = next.committees.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok && current) {
    await recordAudit({
      action: `committee:${decision.status}`,
      subject: id,
      detail: `${current.scholarName} · ${current.kind}`,
    });
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title: `Doctoral committee ${decision.status}`,
      detail: decision.remarks || `The committee report was ${decision.status.toLowerCase()}.`,
    });
  }
  return saved;
}

export async function issueColloquium(colloquium: Omit<Colloquium, "id" | "issuedOn">) {
  const next = snapshot();
  next.colloquia.unshift({
    ...colloquium,
    id: localId(),
    issuedOn: new Date().toISOString(),
  });
  return saveDoctoral(next);
}

export async function saveSynopsis(
  synopsis: Omit<
    SynopsisSubmission,
    "id" | "status" | "remarks" | "decidedOn" | "createdAt"
  >,
) {
  const next = snapshot();
  if (latestCommittee(next, "third", synopsis.scholarIdentifier)?.status !== "Approved") {
    return {
      ok: false as const,
      message: "The third doctoral committee has to be approved first.",
    };
  }
  next.synopses = next.synopses.filter(
    (item) =>
      !(
        sameId(item.scholarIdentifier, synopsis.scholarIdentifier) &&
        item.status !== "Rejected"
      ),
  );
  next.synopses.unshift({
    ...synopsis,
    id: localId(),
    status: "Submitted",
    remarks: "",
    decidedOn: "",
    createdAt: new Date().toISOString(),
  });
  return saveDoctoral(next);
}

export async function decideSynopsis(
  id: string,
  decision: { status: "Approved" | "Rejected"; remarks: string; decidedOn: string },
) {
  const next = snapshot();
  const current = next.synopses.find((item) => item.id === id);
  if (current?.status === "Approved") {
    return { ok: false as const, message: "This synopsis is approved and cannot be changed." };
  }
  next.synopses = next.synopses.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok && current) {
    await recordAudit({
      action: `synopsis:${decision.status}`,
      subject: id,
      detail: current.scholarName,
    });
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title: `Synopsis ${decision.status}`,
      detail: decision.remarks || `The synopsis was ${decision.status.toLowerCase()}.`,
    });
  }
  return saved;
}

export async function saveThesis(
  thesis: Omit<
    ThesisSubmission,
    "id" | "status" | "remarks" | "decidedOn" | "createdAt" | "version" | "versions"
  >,
) {
  const next = snapshot();
  const blocked = thesisBlocked(next, thesis.scholarIdentifier);
  if (blocked) return { ok: false as const, message: blocked };
  if (latestThesis(next, thesis.scholarIdentifier)?.status === "Approved") {
    return {
      ok: false as const,
      message: "This thesis is approved and cannot be replaced.",
    };
  }
  next.theses = next.theses.filter(
    (item) =>
      !(
        sameId(item.scholarIdentifier, thesis.scholarIdentifier) &&
        item.status !== "Rejected"
      ),
  );
  const createdAt = new Date().toISOString();
  next.theses.unshift({
    ...thesis,
    id: localId(),
    version: 1,
    versions: [{ version: 1, fileName: thesis.fileName, uploadedAt: createdAt }],
    status: "Submitted",
    remarks: "",
    decidedOn: "",
    createdAt,
  });
  return saveDoctoral(next);
}

export async function decideThesis(
  id: string,
  decision: { status: "Approved" | "Rejected"; remarks: string; decidedOn: string },
) {
  const next = snapshot();
  const current = next.theses.find((item) => item.id === id);
  if (current?.status === "Approved") {
    return { ok: false as const, message: "This thesis is approved and cannot be changed." };
  }
  if (decision.status === "Approved") {
    const certificate = latestPlagiarism(next, current?.scholarIdentifier ?? "");
    if (certificate?.status !== "Approved") {
      return {
        ok: false as const,
        message: "The plagiarism certificate has to be approved first.",
      };
    }
  }
  if (decision.status === "Rejected" && decision.remarks.trim().length < 2) {
    return { ok: false as const, message: "Enter the remarks." };
  }
  next.theses = next.theses.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok && current) {
    await recordAudit({
      action: `thesis:${decision.status}`,
      subject: id,
      detail: current.scholarName,
    });
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title: `Thesis ${decision.status}`,
      detail: decision.remarks || `The thesis was ${decision.status.toLowerCase()}.`,
    });
  }
  return saved;
}

export function latestPlagiarism(
  state: Pick<DoctoralState, "plagiarism">,
  identifier: string,
) {
  return (
    state.plagiarism
      .filter((item) => sameId(item.scholarIdentifier, identifier))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function latestThesis(state: Pick<DoctoralState, "theses">, identifier: string) {
  return (
    state.theses
      .filter((item) => sameId(item.scholarIdentifier, identifier))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function latestViva(state: Pick<DoctoralState, "vivas">, identifier: string) {
  return (
    state.vivas
      .filter((item) => sameId(item.scholarIdentifier, identifier))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function plagiarismBlocked(
  state: Pick<DoctoralState, "theses">,
  identifier: string,
) {
  const thesis = latestThesis(state, identifier);
  if (!thesis || thesis.status === "Rejected") {
    return "The thesis has to be submitted first.";
  }
  return null;
}

export function reportsReady(
  state: Pick<DoctoralState, "examinerReports">,
  thesis: ThesisSubmission,
) {
  const current = state.examinerReports.filter(
    (item) => item.thesisId === thesis.id && item.version === thesis.version,
  );
  if (current.some((item) => item.outcome === "Rejected" || item.outcome === "Revision")) {
    return false;
  }
  return (["local", "indian", "foreign"] as const).every((group) =>
    current.some((item) => item.group === group && item.outcome === "Recommended"),
  );
}

export function revisionNeeded(
  state: Pick<DoctoralState, "theses" | "examinerReports">,
  thesis: ThesisSubmission,
) {
  return state.examinerReports.some(
    (item) =>
      item.thesisId === thesis.id &&
      item.version === thesis.version &&
      item.outcome === "Revision",
  );
}

export function vivaBlocked(
  state: Pick<DoctoralState, "theses" | "plagiarism" | "examinerReports">,
  identifier: string,
) {
  const thesis = latestThesis(state, identifier);
  if (thesis?.status !== "Approved") {
    return "The thesis examiners have to be recorded first.";
  }
  if (latestPlagiarism(state, identifier)?.status !== "Approved") {
    return "The plagiarism certificate has to be approved first.";
  }
  if (!reportsReady(state, thesis)) {
    return "All three examiner reports have to recommend the thesis on the current version.";
  }
  return null;
}

export function completionBlocked(
  state: Pick<DoctoralState, "vivas">,
  identifier: string,
) {
  return latestViva(state, identifier)?.status === "Passed"
    ? null
    : "The viva has to be recorded as passed first.";
}

export async function savePlagiarism(
  certificate: Omit<
    PlagiarismCertificate,
    "id" | "status" | "remarks" | "decidedOn" | "createdAt"
  >,
) {
  const next = snapshot();
  const blocked = plagiarismBlocked(next, certificate.scholarIdentifier);
  if (blocked) return { ok: false as const, message: blocked };
  if (latestPlagiarism(next, certificate.scholarIdentifier)?.status === "Approved") {
    return {
      ok: false as const,
      message: "This certificate is approved and cannot be changed.",
    };
  }
  next.plagiarism = next.plagiarism.filter(
    (item) =>
      !(
        sameId(item.scholarIdentifier, certificate.scholarIdentifier) &&
        item.status !== "Rejected"
      ),
  );
  next.plagiarism.unshift({
    ...certificate,
    id: localId(),
    status: "Submitted",
    remarks: "",
    decidedOn: "",
    createdAt: new Date().toISOString(),
  });
  return saveDoctoral(next);
}

export async function decidePlagiarism(
  id: string,
  decision: { status: "Approved" | "Rejected"; remarks: string; decidedOn: string },
) {
  const next = snapshot();
  const current = next.plagiarism.find((item) => item.id === id);
  if (current?.status === "Approved") {
    return {
      ok: false as const,
      message: "This certificate is approved and cannot be changed.",
    };
  }
  if (decision.status === "Rejected" && decision.remarks.trim().length < 2) {
    return { ok: false as const, message: "Enter the remarks." };
  }
  next.plagiarism = next.plagiarism.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok && current) {
    await recordAudit({
      action: `plagiarism:${decision.status}`,
      subject: id,
      detail: current.scholarName,
    });
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title: `Plagiarism ${decision.status}`,
      detail: decision.remarks || `The plagiarism certificate was ${decision.status.toLowerCase()}.`,
    });
  }
  return saved;
}

export async function saveExaminerReport(
  report: Omit<ExaminerReport, "id" | "createdAt">,
) {
  const next = snapshot();
  const thesis = next.theses.find((item) => item.id === report.thesisId);
  if (thesis?.status !== "Approved") {
    return { ok: false as const, message: "Record the examiners on the thesis first." };
  }
  if (latestPlagiarism(next, report.scholarIdentifier)?.status !== "Approved") {
    return {
      ok: false as const,
      message: "The plagiarism certificate has to be approved first.",
    };
  }
  next.examinerReports = next.examinerReports.filter(
    (item) =>
      !(
        item.thesisId === report.thesisId &&
        item.group === report.group &&
        item.version === report.version
      ),
  );
  next.examinerReports.unshift({
    ...report,
    id: localId(),
    createdAt: new Date().toISOString(),
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `examiner:${report.outcome}`,
      subject: report.thesisId,
      detail: `${report.scholarName} · ${report.examinerName}`,
    });
    await pushNotice({
      role: "scholar",
      identifier: report.scholarIdentifier,
      title: `Examiner report: ${report.outcome}`,
      detail: report.remarks || `${report.examinerName} recorded ${report.outcome}.`,
    });
  }
  return saved;
}

export async function reviseThesis(
  thesisId: string,
  file: { fileName: string; fileData: string | null },
) {
  const next = snapshot();
  const current = next.theses.find((item) => item.id === thesisId);
  if (!current || current.status !== "Approved") {
    return { ok: false as const, message: "The thesis examiners have to be recorded first." };
  }
  if (!revisionNeeded(next, current)) {
    return { ok: false as const, message: "No examiner has asked for a revision." };
  }
  const version = current.version + 1;
  const uploadedAt = new Date().toISOString();
  next.theses = next.theses.map((item) =>
    item.id === thesisId
      ? {
          ...item,
          fileName: file.fileName,
          fileData: file.fileData,
          version,
          versions: [
            ...item.versions,
            { version, fileName: file.fileName, uploadedAt },
          ],
        }
      : item,
  );
  return saveDoctoral(next);
}

export async function saveViva(
  viva: Omit<VivaRecord, "id" | "status" | "minutes" | "remarks" | "createdAt">,
) {
  const next = snapshot();
  const blocked = vivaBlocked(next, viva.scholarIdentifier);
  if (blocked) return { ok: false as const, message: blocked };
  if (latestViva(next, viva.scholarIdentifier)?.status === "Passed") {
    return { ok: false as const, message: "This viva is already decided." };
  }
  next.vivas = next.vivas.filter(
    (item) =>
      !(
        sameId(item.scholarIdentifier, viva.scholarIdentifier) &&
        item.status === "Scheduled"
      ),
  );
  next.vivas.unshift({
    ...viva,
    id: localId(),
    status: "Scheduled",
    minutes: "",
    remarks: "",
    createdAt: new Date().toISOString(),
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: "viva:scheduled",
      subject: viva.scholarIdentifier,
      detail: `${viva.scholarName} · ${viva.scheduledOn}`,
    });
    await pushNotice({
      role: "scholar",
      identifier: viva.scholarIdentifier,
      title: "Viva scheduled",
      detail: `${viva.scheduledOn} · ${viva.venue}`,
    });
  }
  return saved;
}

export async function decideViva(
  id: string,
  decision: { status: "Passed" | "Failed"; minutes: string; remarks: string },
) {
  const next = snapshot();
  const current = next.vivas.find((item) => item.id === id);
  if (!current) return { ok: false as const, message: "That viva could not be updated." };
  if (current.status !== "Scheduled") {
    return { ok: false as const, message: "This viva is already decided." };
  }
  if (decision.minutes.trim().length < 2) {
    return { ok: false as const, message: "Enter the minutes." };
  }
  next.vivas = next.vivas.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `viva:${decision.status}`,
      subject: id,
      detail: current.scholarName,
    });
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title: `Viva ${decision.status}`,
      detail: decision.remarks || `The viva was ${decision.status.toLowerCase()}.`,
    });
  }
  return saved;
}

export async function saveCompletion(
  completion: Omit<CompletionRecord, "id" | "createdAt">,
) {
  const next = snapshot();
  const blocked = completionBlocked(next, completion.scholarIdentifier);
  if (blocked) return { ok: false as const, message: blocked };
  next.completions.unshift({
    ...completion,
    id: localId(),
    createdAt: new Date().toISOString(),
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `completion:${completion.kind}`,
      subject: completion.scholarIdentifier,
      detail: completion.scholarName,
    });
    await pushNotice({
      role: "scholar",
      identifier: completion.scholarIdentifier,
      title: `${completion.kind} issued`,
      detail: completion.remarks || `The ${completion.kind.toLowerCase()} is on the portal.`,
    });
  }
  return saved;
}

export async function saveAccess(
  request: Omit<ReportAccess, "id" | "status" | "remarks" | "createdAt">,
) {
  const next = snapshot();
  next.access.unshift({
    ...request,
    id: localId(),
    status: "Requested",
    remarks: "",
    createdAt: new Date().toISOString(),
  });
  return saveDoctoral(next);
}

export async function decideAccess(
  id: string,
  decision: { status: "Granted" | "Rejected"; remarks: string },
) {
  const next = snapshot();
  next.access = next.access.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  return saveDoctoral(next);
}

export function enrollmentFor(state: DoctoralState, identifier: string) {
  return (
    state.enrollments.find((item) => sameId(item.scholarIdentifier, identifier)) ?? null
  );
}

export function resultFor(state: DoctoralState, registrationId: string) {
  return state.results.find((item) => item.registrationId === registrationId) ?? null;
}

export function paperOf(
  state: Pick<DoctoralState, "subjects">,
  registration: Pick<CourseRegistration, "subjectId" | "code" | "name">,
) {
  const subject = state.subjects.find((item) => item.id === registration.subjectId);
  return {
    code: registration.code || subject?.code || "",
    name: registration.name || subject?.name || "",
  };
}

export function hasArrear(
  state: Pick<DoctoralState, "registrations" | "results">,
  identifier: string,
) {
  return state.registrations.some(
    (item) =>
      sameId(item.scholarIdentifier, identifier) &&
      state.results.some(
        (result) => result.registrationId === item.id && result.outcome === "Fail",
      ),
  );
}

export function confirmationReady(
  state: Pick<DoctoralState, "registrations" | "results">,
  identifier: string,
) {
  const own = state.registrations.filter((item) =>
    sameId(item.scholarIdentifier, identifier),
  );
  return [1, 2].every((semester) => {
    const papers = own.filter((item) => item.semester === semester);
    return (
      papers.length >= 2 &&
      papers.every((item) =>
        state.results.some((result) => result.registrationId === item.id),
      )
    );
  });
}

export function latestCommittee(
  state: Pick<DoctoralState, "committees">,
  kind: CommitteeKind,
  identifier: string,
) {
  return (
    state.committees
      .filter((item) => item.kind === kind && sameId(item.scholarIdentifier, identifier))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function latestSynopsis(state: Pick<DoctoralState, "synopses">, identifier: string) {
  return (
    state.synopses
      .filter((item) => sameId(item.scholarIdentifier, identifier))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function reportPeriods(session: StoredAdmissionSession, startYear: number) {
  const periods: { label: string; due: string }[] = [];
  if (session === "July") {
    let year = startYear + 1;
    let month: "January" | "July" = "January";
    for (let index = 0; index < 8; index += 1) {
      periods.push({
        label: `${month} ${year}`,
        due: month === "January" ? `${year}-01-31` : `${year}-07-31`,
      });
      if (month === "January") month = "July";
      else {
        month = "January";
        year += 1;
      }
    }
    return periods;
  }
  let year = startYear;
  let month: "June" | "December" = session === "June" ? "December" : "June";
  for (let index = 0; index < 8; index += 1) {
    periods.push({
      label: `${month} ${year}`,
      due: month === "June" ? `${year}-06-30` : `${year}-12-31`,
    });
    if (month === "June") month = "December";
    else {
      month = "June";
      year += 1;
    }
  }
  return periods;
}

export function periodState(due: string) {
  if (due > referenceDate) return "upcoming" as const;
  return "due" as const;
}

export function addMonths(iso: string, count: number) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1 + count, day));
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

export function thesisDeadline(approvedOn: string) {
  return addMonths(approvedOn.slice(0, 10), thesisWindowMonths);
}

export function publicationEligibility(
  school: string,
  papers: { indexing: string; status: string }[],
) {
  const approved = papers.filter((paper) => paper.status === "Approved");
  if (schoolNeedsIndexedPair(school)) {
    const indexed = approved.filter((paper) => isStrongIndex(paper.indexing)).length;
    const scopus = approved.filter((paper) => paper.indexing === "Scopus").length;
    return {
      met: indexed >= 1 && scopus >= 1,
      detail: "One SCI, SCIE, WOS, or SEI paper and one Scopus paper.",
    };
  }
  const scopus = approved.filter((paper) => paper.indexing === "Scopus").length;
  return { met: scopus >= 2, detail: "Two Scopus papers." };
}

export function reportTarget(studyMode: string) {
  return isPartTimeMode(studyMode)
    ? reportTargets["Part-Time"]
    : reportTargets["Full-Time"];
}

export { courseSemesters };
