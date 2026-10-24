import {
  courseSemesters,
  courseWorkFee,
  isCommonSchool,
  isStrongIndex,
  programmeSemesters,
  reportTargets,
  schoolNeedsIndexedPair,
  synopsisChecklist,
  thesisChecklist,
  thesisWindowMonths,
} from "@/data/doctoral";
import { officeActionCopy } from "@/data/office-actions";
import { researchRegister } from "@/data/research-register";
import { readPreviewSession } from "@/lib/auth";
import { scholarSchoolName } from "@/lib/admission";
import { notifyOffice, pushNotice, recordAudit } from "@/lib/audit";
import { committeeHref } from "@/lib/notice-links";
import { examOutcomes, type ExamOutcome } from "@/data/exams";
import { feeStatuses, type FeeStatus } from "@/data/payments";
import {
  admissionSessions,
  isPartTimeMode,
  months,
  referenceDate,
  storageKeys,
} from "@/lib/constants";
import { clientToday } from "@/lib/dates";
import { saveJsonBlob } from "@/lib/json-lock";
import { currentOffice, presentRac, sameId } from "@/lib/office";
import { scholarBySignIn, scholarSignInId, supervisorForGuide } from "@/lib/register";
import { adminActionBlock, officeWriteBlock } from "@/lib/access";
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
  school: string;
  code: string;
  name: string;
  credits: string;
  inChargeName: string;
  inChargeDesignation: string;
  inChargeEmail: string;
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

export type ScholarStanding = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  batchId: string;
  semester: number;
  updatedAt: string;
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
  paymentStatus: FeeStatus;
  /** Re-registration of a paper with an earlier RA or Absent result. */
  arrear: boolean;
  /** Sent to the Controller of Examinations for the hall ticket and results. */
  coeStatus: "" | "Forwarded";
  coeForwardedOn: string;
  /** The campus where the scholar will write this paper, chosen at registration. */
  examCentreId: string;
};

export type { FeeStatus };

export function parseFeeStatus(value: string): FeeStatus {
  return (feeStatuses as readonly string[]).includes(value)
    ? (value as FeeStatus)
    : "Pending";
}

export type CourseResult = {
  id: string;
  registrationId: string;
  outcome: ExamOutcome;
  /** Marks and grade, when the result came from the Controller of Examinations. */
  marks: number | null;
  grade: string;
  sessionMonth: string;
  sessionYear: string;
  publishedOn: string;
};

export function parseExamOutcome(value: string, attendance = ""): ExamOutcome {
  if (value === "AAA" || attendance === "Absent") return "AAA";
  if (value === "RA" || value === "Fail") return "RA";
  if ((examOutcomes as readonly string[]).includes(value)) return value as ExamOutcome;
  return "Pass";
}

export function examSessionLabel(
  result: Pick<CourseResult, "sessionMonth" | "sessionYear" | "publishedOn">,
) {
  if (result.sessionMonth && result.sessionYear) {
    return `${result.sessionMonth} ${result.sessionYear}`;
  }
  return result.publishedOn.slice(0, 7) || "";
}

export type CommitteeKind = "first" | "second" | "third" | "fourth";

function parseCommitteeKind(value: string): CommitteeKind | null {
  if (
    value === "first" ||
    value === "second" ||
    value === "third" ||
    value === "fourth"
  ) {
    return value;
  }
  return null;
}

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
  /** Date the committee met. */
  meetingOn: string;
  /** Guide's step before the Dean: empty until the guide acts. */
  supervisorStatus: "" | "Recommended" | "Returned";
  supervisorRemarks: string;
  supervisorOn: string;
  /** The exact moment (date and time) of the guide's decision. */
  supervisorAt: string;
  supervisorName: string;
  decidedBy: string;
  /** The exact moment (date and time) of the Dean's decision. */
  decidedAt: string;
  /** Recorded by the office for batches that met before the ERP (no upload, no guide step). */
  officeEntry: boolean;
  /** Research title: fixed at the first committee, finalised at the second. */
  researchTitle: string;
};

export type ColloquiumMark = "Present" | "Absent";

export type Colloquium = {
  id: string;
  name: string;
  sitting: "May" | "November";
  year: string;
  issuedOn: string;
  scholars: { identifier: string; name: string }[];
  supervisors: { identifier: string; name: string }[];
  /** Event details. */
  date: string;
  time: string;
  venue: string;
  mode: "Offline" | "Online" | "Hybrid";
  details: string;
  /** Attendance by `scholar:<id>` and `supervisor:<id>`; empty until marked after the event. */
  attendance: Record<string, ColloquiumMark>;
  markedOn: string;
  markedBy: string;
};

export const colloquiumModes = ["Offline", "Online", "Hybrid"] as const;

export function attendanceKey(role: "scholar" | "supervisor", identifier: string) {
  return `${role}:${identifier.trim().toLowerCase()}`;
}

export function colloquiumMarked(item: Pick<Colloquium, "markedOn">) {
  return Boolean(item.markedOn);
}

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
  /** The guide's step before the Dean, for work that needs it. */
  needsSupervisor: boolean;
  supervisorStatus: "" | "Recommended" | "Returned";
  supervisorRemarks: string;
  supervisorOn: string;
  /** The exact moment (date and time) of the guide's decision. */
  supervisorAt: string;
  supervisorName: string;
  decidedBy: string;
  /** The exact moment (date and time) of the Dean's decision. */
  decidedAt: string;
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
  /** The guide's step before the Dean, for work that needs it. */
  needsSupervisor: boolean;
  supervisorStatus: "" | "Recommended" | "Returned";
  supervisorRemarks: string;
  supervisorOn: string;
  /** The exact moment (date and time) of the guide's decision. */
  supervisorAt: string;
  supervisorName: string;
  decidedBy: string;
  /** The exact moment (date and time) of the Dean's decision. */
  decidedAt: string;
};

export type PlagiarismStage = "synopsis" | "thesis";

export type PlagiarismCertificate = {
  id: string;
  /** Synopsis or thesis: a certificate is issued before each submission. */
  stage: PlagiarismStage;
  scholarIdentifier: string;
  scholarName: string;
  /** Checklist items the office verified before issuing. */
  checks: string[];
  issuedBy: string;
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
  standings: ScholarStanding[];
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
  letters: IssuedLetter[];
  detail: string | null;
};

export const letterKinds = [
  "provisional",
  "confirmation",
  "recognition",
  "viva",
  "completion",
] as const;

export type LetterKind = (typeof letterKinds)[number];

export type LetterDetail = { label: string; value: string };

/** Everything printed on an official letter; edited by the office before it is issued. */
export type LetterDraft = {
  kind: LetterKind;
  /** The approval the letter is for: application, committee report or viva id. */
  sourceId: string;
  recipientRole: "scholar" | "supervisor";
  recipientIdentifier: string;
  recipientName: string;
  refNo: string;
  issuedOn: string;
  title: string;
  toLines: string[];
  subject: string;
  reference: string;
  details: LetterDetail[];
  /** Paragraphs; lines starting with "- " print as a list. */
  body: string[];
  closing: string;
  copyTo: string[];
};

export type IssuedLetter = LetterDraft & {
  id: string;
  issuedBy: string;
  createdAt: string;
};

const empty: Omit<DoctoralState, "detail"> = {
  batches: [],
  windows: [],
  subjects: [],
  enrollments: [],
  standings: [],
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
  letters: [],
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** The guide-then-Dean approval details of a submitted document. */
function parseChain(row: Record<string, unknown>) {
  const status = text(row.supervisorStatus);
  return {
    needsSupervisor: row.needsSupervisor === true,
    supervisorStatus: (status === "Recommended" || status === "Returned"
      ? status
      : "") as "" | "Recommended" | "Returned",
    supervisorRemarks: text(row.supervisorRemarks),
    supervisorOn: text(row.supervisorOn),
    supervisorAt: text(row.supervisorAt),
    supervisorName: text(row.supervisorName),
    decidedBy: text(row.decidedBy),
    decidedAt: text(row.decidedAt),
  };
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
          school: text(subject.school),
          code: text(subject.code),
          name: text(subject.name),
          credits: text(subject.credits),
          inChargeName: text(subject.inChargeName),
          inChargeDesignation: text(subject.inChargeDesignation),
          inChargeEmail: text(subject.inChargeEmail),
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
    standings: list(row.standings).flatMap((item) => {
      const standing = objectRow(item);
      const semester = Number(standing?.semester);
      if (!standing || !text(standing.scholarIdentifier)) return [];
      if (!programmeSemesters.includes(semester as (typeof programmeSemesters)[number])) {
        return [];
      }
      return [
        {
          id: text(standing.id) || text(standing.scholarIdentifier),
          scholarIdentifier: text(standing.scholarIdentifier),
          scholarName: text(standing.scholarName),
          batchId: text(standing.batchId),
          semester,
          updatedAt: text(standing.updatedAt),
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
          paymentStatus: parseFeeStatus(text(registration.paymentStatus)),
          arrear: registration.arrear === true,
          coeStatus: (text(registration.coeStatus) === "Forwarded"
            ? "Forwarded"
            : "") as CourseRegistration["coeStatus"],
          coeForwardedOn: text(registration.coeForwardedOn),
          examCentreId: text(registration.examCentreId),
        },
      ];
    }),
    results: list(row.results).flatMap((item) => {
      const result = objectRow(item);
      if (!result || !text(result.registrationId)) return [];
      const publishedOn = text(result.publishedOn);
      const [yearPart, monthPart] = publishedOn.split("-");
      const monthFromDate =
        monthPart && Number(monthPart) >= 1 && Number(monthPart) <= 12
          ? (months[Number(monthPart) - 1] ?? "")
          : "";
      return [
        {
          id: text(result.id),
          registrationId: text(result.registrationId),
          outcome: parseExamOutcome(text(result.outcome), text(result.attendance)),
          marks:
            typeof result.marks === "number" && Number.isFinite(result.marks)
              ? result.marks
              : null,
          grade: text(result.grade),
          sessionMonth: text(result.sessionMonth) || monthFromDate || "",
          sessionYear: text(result.sessionYear) || yearPart || "",
          publishedOn,
        },
      ];
    }),
    committees: list(row.committees).flatMap((item) => {
      const report = objectRow(item);
      const kind = parseCommitteeKind(text(report?.kind));
      if (!report || !text(report.id) || !kind) return [];
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
          meetingOn: text(report.meetingOn),
          supervisorStatus: (text(report.supervisorStatus) === "Recommended"
            ? "Recommended"
            : text(report.supervisorStatus) === "Returned"
              ? "Returned"
              : "") as CommitteeReport["supervisorStatus"],
          supervisorRemarks: text(report.supervisorRemarks),
          supervisorOn: text(report.supervisorOn),
          supervisorAt: text(report.supervisorAt),
          supervisorName: text(report.supervisorName),
          decidedBy: text(report.decidedBy),
          decidedAt: text(report.decidedAt),
          officeEntry: report.officeEntry === true,
          researchTitle: text(report.researchTitle),
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
      const marks = objectRow(sitting.attendance) ?? {};
      const attendance: Record<string, ColloquiumMark> = {};
      for (const [key, value] of Object.entries(marks)) {
        if (value === "Present" || value === "Absent") attendance[key] = value;
      }
      const mode = text(sitting.mode);
      return [
        {
          id: text(sitting.id),
          name: text(sitting.name),
          sitting: text(sitting.sitting) === "November" ? "November" : "May",
          year: text(sitting.year),
          issuedOn: text(sitting.issuedOn),
          scholars: people("scholars"),
          supervisors: people("supervisors"),
          date: text(sitting.date),
          time: text(sitting.time),
          venue: text(sitting.venue),
          mode: mode === "Online" || mode === "Hybrid" ? mode : "Offline",
          details: text(sitting.details),
          attendance,
          markedOn: text(sitting.markedOn),
          markedBy: text(sitting.markedBy),
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
          ...parseChain(synopsis),
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
          ...parseChain(thesis),
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
          stage: (text(certificate.stage) === "synopsis"
            ? "synopsis"
            : "thesis") as PlagiarismStage,
          scholarIdentifier: text(certificate.scholarIdentifier),
          scholarName: text(certificate.scholarName),
          checks: list(certificate.checks).filter(
            (entry): entry is string => typeof entry === "string",
          ),
          issuedBy: text(certificate.issuedBy),
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
    letters: list(row.letters).flatMap((item) => {
      const letter = objectRow(item);
      if (!letter || !text(letter.id)) return [];
      const kind = letterKinds.find((value) => value === text(letter.kind));
      if (!kind) return [];
      const lines = (key: string) =>
        list(letter[key]).flatMap((value) => (typeof value === "string" ? [value] : []));
      return [
        {
          id: text(letter.id),
          kind,
          sourceId: text(letter.sourceId),
          recipientRole: (text(letter.recipientRole) === "supervisor"
            ? "supervisor"
            : "scholar") as LetterDraft["recipientRole"],
          recipientIdentifier: text(letter.recipientIdentifier),
          recipientName: text(letter.recipientName),
          refNo: text(letter.refNo),
          issuedOn: text(letter.issuedOn),
          title: text(letter.title),
          toLines: lines("toLines"),
          subject: text(letter.subject),
          reference: text(letter.reference),
          details: list(letter.details).flatMap((entry) => {
            const detail = objectRow(entry);
            return detail
              ? [{ label: text(detail.label), value: text(detail.value) }]
              : [];
          }),
          body: lines("body"),
          closing: text(letter.closing),
          copyTo: lines("copyTo"),
          issuedBy: text(letter.issuedBy),
          createdAt: text(letter.createdAt),
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
    standings:
      payload && "standings" in payload
        ? keep(browser.standings, remote.standings)
        : browser.standings,
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
    letters: keep(browser.letters, remote.letters),
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
    standings: current.standings ?? [],
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
    letters: current.letters ?? [],
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

/**
 * Removes a scholar's course enrolment, semester standing and course registrations (with their
 * results). Used when an admission session is taken back, so nothing of the test remains.
 */
export async function removeScholarCourseRecords(identifiers: readonly string[]) {
  const keys = identifiers.map((item) => item.trim()).filter(Boolean);
  const mine = (identifier: string) => keys.some((key) => sameId(identifier, key));
  const next = snapshot();
  const gone = new Set(
    next.registrations
      .filter((item) => mine(item.scholarIdentifier))
      .map((item) => item.id),
  );
  next.enrollments = next.enrollments.filter((item) => !mine(item.scholarIdentifier));
  next.standings = next.standings.filter((item) => !mine(item.scholarIdentifier));
  next.registrations = next.registrations.filter((item) => !gone.has(item.id));
  next.results = next.results.filter((item) => !gone.has(item.registrationId));
  return saveDoctoral(next);
}

export function standingFor(standings: readonly ScholarStanding[], identifier: string) {
  const scholar = scholarBySignIn(identifier);
  const keys = scholar
    ? [
        identifier,
        scholarSignInId(scholar),
        scholar.email,
        scholar.registrationNumber,
        scholar.applicationNumber,
        scholar.fileNumber,
        scholar.id,
      ]
    : [identifier];
  return (
    standings.find((item) =>
      keys.some((key) => key.trim() && sameId(item.scholarIdentifier, key)),
    ) ?? null
  );
}

function semesterHeld(
  standings: readonly ScholarStanding[],
  registrations: readonly CourseRegistration[],
  identifier: string,
) {
  const standing = standingFor(standings, identifier);
  if (standing) return standing.semester;
  const semesters = registrations
    .filter((item) => sameId(item.scholarIdentifier, identifier))
    .map((item) => item.semester);
  return semesters.length > 0 ? Math.max(...semesters) : 0;
}

export function scholarSemester(
  state: Pick<DoctoralState, "standings" | "registrations">,
  identifier: string,
) {
  return semesterHeld(state.standings, state.registrations, identifier);
}

export function batchSemesterFloor(
  state: Pick<DoctoralState, "standings">,
  batchId: string,
) {
  const held = state.standings
    .filter((item) => item.batchId === batchId)
    .map((item) => item.semester);
  return held.length > 0 ? Math.min(...held) : 0;
}

function semesterClosed(held: number, semester: number) {
  return held > semester
    ? `This scholar has moved to semester ${held}. Semester ${semester} work is closed.`
    : null;
}

export async function promoteScholars(input: {
  batchId: string;
  semester: number;
  scholars: readonly { identifier: string; name: string }[];
  direction: "promote" | "demote";
}) {
  const blocked = adminActionBlock();
  if (blocked) return blocked;
  if (
    !programmeSemesters.includes(input.semester as (typeof programmeSemesters)[number])
  ) {
    return { ok: false as const, message: "Select a semester." };
  }
  if (input.scholars.length === 0) {
    return { ok: false as const, message: "Select at least one scholar." };
  }
  const next = snapshot();
  const eligible = input.scholars.filter((scholar) => {
    const current = semesterHeld(next.standings, next.registrations, scholar.identifier);
    return input.direction === "promote"
      ? current === 0
        ? input.semester > current
        : input.semester === current + 1
      : current > 0 && input.semester < current;
  });
  if (eligible.length === 0) {
    return {
      ok: false as const,
      message:
        input.direction === "promote"
          ? officeActionCopy.promotion.noneEligiblePromote
          : officeActionCopy.promotion.noneEligibleDemote,
    };
  }
  const stamp = new Date().toISOString();
  const remaining = next.standings.filter(
    (item) => !eligible.some((scholar) => standingFor([item], scholar.identifier)),
  );
  next.standings = [
    ...eligible.map((scholar) => {
      const current = standingFor(next.standings, scholar.identifier);
      return {
        id: current?.id ?? localId(),
        scholarIdentifier: scholar.identifier,
        scholarName: scholar.name,
        batchId: input.batchId,
        semester: input.semester,
        updatedAt: stamp,
      };
    }),
    ...remaining,
  ];
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `semester:${input.direction}`,
      subject: input.batchId,
      detail: `${eligible.length} scholar(s) · Semester ${input.semester}`,
    });
    for (const scholar of eligible) {
      await pushNotice({
        role: "scholar",
        identifier: scholar.identifier,
        title: input.direction === "promote" ? "Promoted" : "Demoted",
        detail:
          input.direction === "promote"
            ? `The research office promoted you to semester ${input.semester}.`
            : `The research office mapped you back to semester ${input.semester}.`,
      });
    }
  }
  if (!saved.ok) return saved;
  const skipped = input.scholars.length - eligible.length;
  if (skipped > 0) {
    return {
      ok: true as const,
      moved: eligible.length,
      skipped,
    };
  }
  return { ok: true as const, moved: eligible.length, skipped: 0 };
}

/**
 * Promotes many scholars in one save, each to the semester given, across batches. Used when
 * every batch is promoted before a new intake is admitted.
 */
export async function promoteBulk(
  entries: readonly { identifier: string; name: string; batchId: string; to: number }[],
) {
  const blocked = adminActionBlock();
  if (blocked) return blocked;
  if (entries.length === 0) {
    return { ok: false as const, message: "No scholar is to be promoted." };
  }
  const next = snapshot();
  const stamp = new Date().toISOString();
  const moved = new Set(entries.map((entry) => entry.identifier.toLowerCase()));
  next.standings = [
    ...entries.map((entry) => {
      const current = standingFor(next.standings, entry.identifier);
      return {
        id: current?.id ?? localId(),
        scholarIdentifier: entry.identifier,
        scholarName: entry.name,
        batchId: entry.batchId || current?.batchId || "",
        semester: entry.to,
        updatedAt: stamp,
      };
    }),
    ...next.standings.filter(
      (item) =>
        !moved.has(item.scholarIdentifier.toLowerCase()) &&
        !entries.some((entry) => standingFor([item], entry.identifier)),
    ),
  ];
  const saved = await saveDoctoral(next);
  if (!saved.ok) return saved;
  await recordAudit({
    action: "semester:promote-all",
    subject: "all-batches",
    detail: `${entries.length} scholar(s) promoted before the new intake`,
  });
  for (const entry of entries) {
    await pushNotice({
      role: "scholar",
      identifier: entry.identifier,
      title: "Promoted",
      detail: `The research office promoted you to semester ${entry.to}.`,
    });
  }
  return { ok: true as const, moved: entries.length };
}

/** A newly admitted scholar starts in semester 1 of the batch, without a manual promotion. */
export async function ensureSemesterOne(
  entries: readonly { identifier: string; name: string; batchId: string }[],
) {
  const next = snapshot();
  const missing = entries.filter(
    (entry) => !standingFor(next.standings, entry.identifier),
  );
  if (missing.length === 0) return { ok: true as const, added: 0 };
  const stamp = new Date().toISOString();
  next.standings = [
    ...missing.map((entry) => ({
      id: localId(),
      scholarIdentifier: entry.identifier,
      scholarName: entry.name,
      batchId: entry.batchId,
      semester: 1,
      updatedAt: stamp,
    })),
    ...next.standings,
  ];
  const saved = await saveDoctoral(next);
  return saved.ok ? { ok: true as const, added: missing.length } : saved;
}

export async function saveCourseWindow(window: CourseWindow) {
  const next = snapshot();
  const floor = batchSemesterFloor(next, window.batchId);
  if (window.enabled && window.semester < floor) {
    return {
      ok: false as const,
      message: `This batch has moved to semester ${floor}. Semester ${window.semester} registration cannot be reopened.`,
    };
  }
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
  const closed = semesterClosed(
    semesterHeld(next.standings, next.registrations, registration.scholarIdentifier),
    registration.semester,
  );
  if (closed) return { ok: false as const, message: closed };
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
    paymentStatus: "Pending",
    arrear: false,
    coeStatus: "",
    coeForwardedOn: "",
    examCentreId: "",
  });
  return saveDoctoral(next);
}

export type PaperStanding = {
  code: string;
  name: string;
  subjectId: string;
  semester: number;
  status: "Passed" | "Pending" | "Arrear";
  /** Latest result, when one is published. */
  outcome: ExamOutcome | null;
  attempts: number;
};

/**
 * Each course-work paper of a scholar, one row per subject code: passed, waiting for a result,
 * or an arrear (latest result RA or Absent) that can be registered again.
 */
export function paperStandings(
  state: Pick<DoctoralState, "registrations" | "results">,
  identifier: string,
): PaperStanding[] {
  const own = state.registrations.filter(
    (item) =>
      sameId(item.scholarIdentifier, identifier) && item.paymentStatus !== "Returned",
  );
  const byCode = new Map<string, CourseRegistration[]>();
  for (const row of own) {
    const key = (row.code || row.name).trim().toLowerCase();
    byCode.set(key, [...(byCode.get(key) ?? []), row]);
  }
  return [...byCode.values()].map((rows) => {
    const first = rows[0];
    const outcomes = rows.map((row) => resultFor(state, row.id)?.outcome ?? null);
    const passed = outcomes.includes("Pass");
    const pending = outcomes.some((outcome) => outcome === null);
    const latest =
      state.results
        .filter((result) => rows.some((row) => row.id === result.registrationId))
        .sort((left, right) => right.publishedOn.localeCompare(left.publishedOn))[0]
        ?.outcome ?? null;
    return {
      code: first.code,
      name: first.name,
      subjectId: first.subjectId,
      semester: Math.min(...rows.map((row) => row.semester)),
      status: passed ? "Passed" : pending ? "Pending" : "Arrear",
      outcome: passed ? "Pass" : latest,
      attempts: rows.length,
    };
  });
}

/** Papers with an RA or Absent result that the scholar may register again. */
export function arrearPapers(
  state: Pick<DoctoralState, "registrations" | "results">,
  identifier: string,
) {
  return paperStandings(state, identifier).filter((paper) => paper.status === "Arrear");
}

/** Marks paid registrations as sent to the Controller of Examinations. */
export async function forwardToCoe(registrationIds: readonly string[]) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const next = snapshot();
  const chosen = next.registrations.filter((item) => registrationIds.includes(item.id));
  const unpaid = chosen.filter((item) => item.paymentStatus !== "Approved");
  if (unpaid.length > 0) {
    return {
      ok: false as const,
      message: `${unpaid.length} registration(s) do not have a verified fee yet.`,
    };
  }
  const today = clientToday();
  next.registrations = next.registrations.map((item) =>
    registrationIds.includes(item.id)
      ? { ...item, coeStatus: "Forwarded" as const, coeForwardedOn: today }
      : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: "coursework:coe",
      subject: "coe",
      detail: `${chosen.length} registration(s) forwarded on ${today}`,
    });
    const scholars = [...new Set(chosen.map((item) => item.scholarIdentifier))];
    for (const identifier of scholars) {
      await pushNotice({
        role: "scholar",
        identifier,
        title: "Course-work registration sent to the COE",
        detail: "The Controller of Examinations issues the hall ticket and the results.",
        href: "/scholar/course-work",
      });
    }
  }
  return saved;
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
  /** The campus where the scholar will write the papers. */
  examCentreId: string;
}) {
  const next = snapshot();
  const window = next.windows.find((item) => item.batchId === input.batchId);
  if (!window?.enabled || window.semester !== input.semester) {
    return { ok: false as const, message: "Registration is not open for this semester." };
  }
  if (!window.lastDate || window.lastDate < clientToday()) {
    return { ok: false as const, message: "The last date for registration has passed." };
  }
  const closed = semesterClosed(
    semesterHeld(next.standings, next.registrations, input.scholarIdentifier),
    input.semester,
  );
  if (closed) return { ok: false as const, message: closed };
  if (input.subjects.length < 1) {
    return { ok: false as const, message: "Add a subject." };
  }
  const codes = input.subjects.map((subject) => subject.code.trim().toLowerCase());
  if (new Set(codes).size !== codes.length) {
    return { ok: false as const, message: "Each subject code can be entered once." };
  }
  const standings = paperStandings(next, input.scholarIdentifier);
  const standingOf = (code: string) =>
    standings.find((paper) => paper.code.trim().toLowerCase() === code);
  const taken = codes.find((code) => {
    const status = standingOf(code)?.status;
    return status === "Passed" || status === "Pending";
  });
  if (taken) {
    return {
      ok: false as const,
      message: `${taken.toUpperCase()} is already ${standingOf(taken)?.status === "Passed" ? "passed" : "registered and waiting for the result"}.`,
    };
  }
  const arrearCodes = codes.filter((code) => standingOf(code)?.status === "Arrear");
  const fresh = input.subjects.filter(
    (subject) => !arrearCodes.includes(subject.code.trim().toLowerCase()),
  );
  if (input.semester > 2 && fresh.length > 0) {
    return {
      ok: false as const,
      message: "Semester 3 and semester 4 are open only to register arrear papers again.",
    };
  }
  const firstAttempts = next.registrations.filter(
    (item) =>
      sameId(item.scholarIdentifier, input.scholarIdentifier) &&
      item.semester === input.semester &&
      !item.arrear &&
      item.paymentStatus !== "Returned",
  );
  if (firstAttempts.length + fresh.length > 2) {
    return {
      ok: false as const,
      message: "Two papers are the limit for this semester.",
    };
  }
  const catalog = courseCatalogFor(next, {
    identifier: input.scholarIdentifier,
    semester: input.semester,
    batchId: input.batchId,
  });
  if (fresh.length > 0 && catalog.length === 0) {
    return {
      ok: false as const,
      message: "Subjects for this semester are not listed yet.",
    };
  }
  const matched = input.subjects.map((subject) => {
    const code = subject.code.trim().toLowerCase();
    const arrear = standingOf(code);
    if (arrear?.status === "Arrear") {
      return {
        id: arrear.subjectId,
        code: arrear.code,
        name: arrear.name,
        semester: arrear.semester,
        arrear: true,
      };
    }
    const hit = catalog.find(
      (item) =>
        item.code.trim().toLowerCase() === code &&
        item.name.trim().toLowerCase() === subject.name.trim().toLowerCase(),
    );
    return hit
      ? {
          id: hit.id,
          code: hit.code,
          name: hit.name,
          semester: input.semester,
          arrear: false,
        }
      : null;
  });
  if (matched.some((item) => item === null)) {
    return { ok: false as const, message: "Select a listed subject." };
  }
  for (const subject of matched) {
    if (!subject) continue;
    next.registrations.unshift({
      id: localId(),
      batchId: input.batchId,
      subjectId: subject.id,
      scholarIdentifier: input.scholarIdentifier,
      scholarName: input.scholarName,
      semester: subject.semester,
      arrear: subject.arrear,
      coeStatus: "",
      coeForwardedOn: "",
      examCentreId: input.examCentreId,
      code: subject.code,
      name: subject.name,
      amount: courseWorkFee,
      paymentMode: input.paymentMode,
      paymentReference: input.paymentReference.trim(),
      paymentDate: input.paymentDate,
      receiptName: input.receiptName,
      receiptData: input.receiptData,
      paymentStatus: "Pending",
    });
  }
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await notifyOffice({
      title: `Course work registration · ${input.scholarName}`,
      detail: `Semester ${input.semester}: ${input.subjects.length} paper(s). Fee receipt to verify.`,
      href: "/admin/payments",
    });
  }
  return saved;
}

export async function setCourseWorkPayment(
  registrationIds: readonly string[],
  paymentStatus: FeeStatus,
  comment = "",
) {
  if (registrationIds.length === 0) {
    return { ok: false as const, message: "Select a course-work payment." };
  }
  const next = snapshot();
  const ids = new Set(registrationIds);
  const rows = next.registrations.filter((item) => ids.has(item.id));
  if (rows.length === 0) {
    return { ok: false as const, message: "That course-work payment was not found." };
  }
  if (rows.some((item) => item.paymentStatus === "Approved")) {
    return {
      ok: false as const,
      message: "An approved course-work payment cannot be changed.",
    };
  }
  next.registrations = next.registrations.map((item) =>
    ids.has(item.id) ? { ...item, paymentStatus } : item,
  );
  const saved = await saveDoctoral(next);
  if (!saved.ok) return saved;
  const first = rows[0];
  if (first) {
    await recordAudit({
      action: `payment:${paymentStatus}`,
      subject: `course-work:${first.id}`,
      detail: `${first.scholarName} · course-work fee`,
    });
    await pushNotice({
      role: "scholar",
      identifier: first.scholarIdentifier,
      title: `Course-work fee ${paymentStatus}`,
      detail:
        paymentStatus === "Returned" && comment.trim()
          ? `The course-work fee receipt was returned: ${comment.trim()} Please upload the receipt again.`
          : `The research office marked the course-work fee ${paymentStatus}.`,
      href: "/scholar/course-work",
    });
  }
  return { ok: true as const };
}

export async function publishResult(
  registrationId: string,
  outcome: ExamOutcome | "Pass" | "Fail",
  publishedOn: string,
  attendance: "Present" | "Absent" | "" = "Present",
  sessionMonth = "",
  sessionYear = "",
) {
  return publishResults(
    [
      {
        registrationId,
        outcome: parseExamOutcome(outcome, attendance),
      },
    ],
    sessionMonth,
    sessionYear,
    publishedOn,
  );
}

export async function publishResults(
  entries: readonly {
    registrationId: string;
    outcome: ExamOutcome;
    marks?: number | null;
    grade?: string;
  }[],
  sessionMonth: string,
  sessionYear: string,
  publishedOn: string,
) {
  const next = snapshot();
  for (const entry of entries) {
    const passed = next.results.some(
      (item) => item.registrationId === entry.registrationId && item.outcome === "Pass",
    );
    const published = next.results.some(
      (item) =>
        item.registrationId === entry.registrationId &&
        item.sessionMonth === sessionMonth &&
        item.sessionYear === sessionYear,
    );
    if (passed || published) {
      const row = next.registrations.find((item) => item.id === entry.registrationId);
      const who = row ? `${row.scholarName} · ${row.code || row.name}` : "A paper";
      return {
        ok: false as const,
        message: passed
          ? `${who} is already passed. Its result cannot be changed.`
          : `${who} already has a result for ${sessionMonth} ${sessionYear}. Published results cannot be changed.`,
      };
    }
  }
  for (const entry of entries) {
    const recorded: CourseResult = {
      id: localId(),
      registrationId: entry.registrationId,
      outcome: entry.outcome,
      marks: entry.marks ?? null,
      grade: entry.grade ?? "",
      sessionMonth,
      sessionYear,
      publishedOn,
    };
    const existing = next.results.find(
      (item) =>
        item.registrationId === entry.registrationId &&
        item.sessionMonth === sessionMonth &&
        item.sessionYear === sessionYear,
    );
    next.results = existing
      ? next.results.map((item) =>
          item.id === existing.id ? { ...recorded, id: item.id } : item,
        )
      : [recorded, ...next.results];
  }
  return saveDoctoral(next);
}

/** The guide a notice about this scholar goes to: the allotment, else the register. */
function guideOf(identifier: string) {
  const allocation = currentOffice()?.allocations.find((item) =>
    sameId(item.scholarIdentifier, identifier),
  );
  if (allocation) return allocation.supervisorIdentifier || allocation.supervisorName;
  const scholar = scholarBySignIn(identifier);
  if (!scholar?.guideName.trim()) return "";
  return supervisorForGuide(scholar.guideName)?.supervisorId || scholar.guideName;
}

const committeeNames: Record<CommitteeKind, string> = {
  first: "First doctoral committee",
  second: "Ph.D. confirmation",
  third: "Third doctoral committee",
  fourth: "Fourth doctoral committee",
};

export function committeeBlocked(
  state: Pick<DoctoralState, "committees" | "synopses" | "registrations" | "results">,
  kind: CommitteeKind,
  identifier: string,
) {
  if (kind === "first") {
    // Scholars admitted through Selection can hold the first doctoral committee only after the
    // Dean has approved their RAC. Scholars already on the register are not held back.
    if (scholarBySignIn(identifier)) return null;
    return presentRac(currentOffice()?.proposals ?? [], identifier)
      ? null
      : "The first doctoral committee can be conducted only after the Dean approves the RAC.";
  }
  if (kind === "second") {
    return confirmationReady(state, identifier)
      ? null
      : "All four course-work papers have to be cleared first: the two common papers, the major paper and the allied paper.";
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
  state: Pick<DoctoralState, "committees" | "synopses" | "plagiarism">,
  identifier: string,
) {
  const synopsis = latestSynopsis(state, identifier);
  if (synopsis?.status !== "Approved") {
    return "The synopsis has to be accepted first.";
  }
  const opens = thesisOpensOn(synopsis);
  if (clientToday() < opens) {
    return `The thesis opens on ${opens}, three months after the synopsis was submitted.`;
  }
  if (!plagiarismIssued(state, identifier, "thesis")) {
    return "The research office has to verify the checklist and issue the thesis plagiarism certificate first.";
  }
  return null;
}

export async function saveCommittee(
  report: Pick<
    CommitteeReport,
    "kind" | "scholarIdentifier" | "scholarName" | "fileName" | "fileData" | "meetingOn"
  > & { researchTitle?: string },
) {
  const next = snapshot();
  if (!report.meetingOn) {
    return { ok: false as const, message: "Enter the date of the meeting." };
  }
  const researchTitle = (report.researchTitle ?? "").trim();
  if (
    (report.kind === "first" || report.kind === "second") &&
    researchTitle.length < 10
  ) {
    return {
      ok: false as const,
      message:
        report.kind === "first"
          ? "Enter the research title fixed in the first doctoral committee."
          : "Enter the final research title approved in the second doctoral committee.",
    };
  }
  if (synopsisSubmitted(next, report.scholarIdentifier) && researchTitle) {
    const fixed = latestCommittee(
      next,
      "second",
      report.scholarIdentifier,
    )?.researchTitle;
    if (fixed && fixed !== researchTitle) {
      return {
        ok: false as const,
        message: "The synopsis is submitted, so the research title can no longer change.",
      };
    }
  }
  const blocked = committeeBlocked(next, report.kind, report.scholarIdentifier);
  if (blocked) return { ok: false as const, message: blocked };
  if (
    latestCommittee(next, report.kind, report.scholarIdentifier)?.status === "Approved"
  ) {
    return {
      ok: false as const,
      message: "This doctoral committee is approved. It cannot be submitted again.",
    };
  }
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
    researchTitle,
    id: localId(),
    status: "Submitted",
    remarks: "",
    agenda: "",
    attendance: "",
    minutes: "",
    decidedOn: "",
    createdAt: new Date().toISOString(),
    supervisorStatus: "",
    supervisorRemarks: "",
    supervisorOn: "",
    supervisorAt: "",
    supervisorName: "",
    decidedBy: "",
    decidedAt: "",
    officeEntry: false,
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    const guide = guideOf(report.scholarIdentifier);
    if (guide) {
      await pushNotice({
        role: "supervisor",
        identifier: guide,
        title: `${committeeNames[report.kind]} report to recommend`,
        detail: `${report.scholarName} uploaded the committee report.`,
        href: committeeHref("supervisor", report.kind),
      });
    } else {
      await notifyOffice({
        title: `${committeeNames[report.kind]} report · ${report.scholarName}`,
        detail: "No guide is on record. The report is waiting for the research office.",
        href: committeeHref("admin", report.kind),
      });
    }
  }
  return saved;
}

/** Who decided as the Dean, and the exact moment. */
function deanStamp() {
  const signer = readPreviewSession();
  return {
    decidedBy: signer ? signer.name.trim() || signer.identifier : "",
    decidedAt: new Date().toISOString(),
  };
}

/** The guide approves a synopsis or thesis for the Dean, or returns it to the scholar. */
export async function recommendSubmission(
  kind: "synopsis" | "thesis",
  id: string,
  decision: { status: "Recommended" | "Returned"; remarks: string },
) {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const signer = readPreviewSession();
  if (!signer || signer.role !== "supervisor") {
    return { ok: false as const, message: "Only the guide can do this." };
  }
  if (decision.status === "Returned" && decision.remarks.trim().length < 2) {
    return { ok: false as const, message: "Enter the remarks for the scholar." };
  }
  const next = snapshot();
  const label = kind === "synopsis" ? "synopsis" : "thesis";
  const list = (kind === "synopsis" ? next.synopses : next.theses) as (
    | SynopsisSubmission
    | ThesisSubmission
  )[];
  const current = list.find((item) => item.id === id);
  if (!current || current.status !== "Submitted" || current.supervisorStatus !== "") {
    return { ok: false as const, message: `This ${label} is not waiting for the guide.` };
  }
  const apply = <T extends SynopsisSubmission | ThesisSubmission>(items: T[]) =>
    items.map((item) =>
      item.id === id
        ? {
            ...item,
            supervisorStatus: decision.status,
            supervisorRemarks: decision.remarks.trim(),
            supervisorOn: clientToday(),
            supervisorAt: new Date().toISOString(),
            supervisorName: signer.name.trim() || signer.identifier,
            ...(decision.status === "Returned"
              ? {
                  status: "Rejected" as const,
                  remarks: `Returned by the guide: ${decision.remarks.trim()}`,
                  decidedOn: clientToday(),
                }
              : {}),
          }
        : item,
    );
  if (kind === "synopsis") next.synopses = apply(next.synopses);
  else next.theses = apply(next.theses);
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title:
        decision.status === "Recommended"
          ? `${label[0].toUpperCase()}${label.slice(1)} approved by your guide`
          : `${label[0].toUpperCase()}${label.slice(1)} returned by your guide`,
      detail:
        decision.remarks ||
        (decision.status === "Recommended"
          ? "It now goes to the Dean."
          : `The guide returned your ${label}.`),
      href: `/scholar/${label}`,
    });
    if (decision.status === "Recommended") {
      await notifyOffice({
        title: `${label[0].toUpperCase()}${label.slice(1)} for approval · ${current.scholarName}`,
        detail: `Approved by ${signer.name.trim() || signer.identifier}. Waiting for the Dean.`,
        href: `/admin/${label}`,
      });
    }
  }
  return saved;
}

/** The guide recommends the report to the Dean, or returns it to the scholar. */
export async function recommendCommittee(
  id: string,
  decision: { status: "Recommended" | "Returned"; remarks: string },
) {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const signer = readPreviewSession();
  if (!signer || signer.role !== "supervisor") {
    return { ok: false as const, message: "Only the guide can recommend this report." };
  }
  const next = snapshot();
  const current = next.committees.find((item) => item.id === id);
  if (!current || current.status !== "Submitted" || current.supervisorStatus !== "") {
    return { ok: false as const, message: "This report is not waiting for the guide." };
  }
  if (decision.status === "Returned" && decision.remarks.trim().length < 2) {
    return { ok: false as const, message: "Enter the remarks for the scholar." };
  }
  next.committees = next.committees.map((item) =>
    item.id === id
      ? {
          ...item,
          supervisorStatus: decision.status,
          supervisorRemarks: decision.remarks.trim(),
          supervisorOn: clientToday(),
          supervisorAt: new Date().toISOString(),
          supervisorName: signer.name.trim() || signer.identifier,
          ...(decision.status === "Returned"
            ? {
                status: "Rejected" as const,
                remarks: `Returned by the guide: ${decision.remarks.trim()}`,
                decidedOn: clientToday(),
              }
            : {}),
        }
      : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await pushNotice({
      role: "scholar",
      identifier: current.scholarIdentifier,
      title:
        decision.status === "Recommended"
          ? "Committee report sent to the Dean"
          : "Committee report returned by the guide",
      detail: decision.remarks || "The guide reviewed your committee report.",
      href: committeeHref("scholar", current.kind),
    });
    if (decision.status === "Recommended") {
      await notifyOffice({
        title: `${committeeNames[current.kind]} report for approval · ${current.scholarName}`,
        detail: `Recommended by ${signer.name.trim() || signer.identifier}. Waiting for the Dean.`,
        href: committeeHref("admin", current.kind),
      });
    }
  }
  return saved;
}

/**
 * Office entry for scholars whose committee met before the ERP: records the meeting as held
 * and approved, with no upload and no guide step.
 */
export async function recordCommitteeHeld(input: {
  kind: CommitteeKind;
  meetingOn: string;
  remarks: string;
  scholars: readonly { identifier: string; name: string }[];
  /** Research title for each scholar, by identifier (first and second committee). */
  titles?: Readonly<Record<string, string>>;
}) {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const signer = readPreviewSession();
  if (
    !signer ||
    (signer.role !== "admin" && signer.role !== "dean" && signer.role !== "staff")
  ) {
    return { ok: false as const, message: "Only the research office can record this." };
  }
  if (!input.meetingOn)
    return { ok: false as const, message: "Enter the date of the meeting." };
  if (input.meetingOn > clientToday()) {
    return { ok: false as const, message: "The meeting date cannot be in the future." };
  }
  const next = snapshot();
  const fresh = input.scholars.filter(
    (scholar) =>
      latestCommittee(next, input.kind, scholar.identifier)?.status !== "Approved",
  );
  if (fresh.length === 0) {
    return {
      ok: false as const,
      message: "These scholars are already recorded as completed.",
    };
  }
  const by = signer.name.trim() || signer.identifier;
  const stamp = new Date().toISOString();
  next.committees = [
    ...fresh.map((scholar) => ({
      id: localId(),
      kind: input.kind,
      scholarIdentifier: scholar.identifier,
      scholarName: scholar.name,
      status: "Approved" as const,
      fileName: "",
      fileData: null,
      remarks: input.remarks.trim(),
      agenda: "",
      attendance: "",
      minutes: "Recorded by the research office.",
      decidedOn: clientToday(),
      createdAt: stamp,
      meetingOn: input.meetingOn,
      supervisorStatus: "" as const,
      supervisorRemarks: "",
      supervisorOn: "",
      supervisorAt: "",
      supervisorName: "",
      decidedBy: by,
      decidedAt: stamp,
      officeEntry: true,
      researchTitle: input.titles?.[scholar.identifier]?.trim() ?? "",
    })),
    ...next.committees.filter(
      (item) =>
        !(
          item.kind === input.kind &&
          item.status !== "Approved" &&
          fresh.some((scholar) => sameId(scholar.identifier, item.scholarIdentifier))
        ),
    ),
  ];
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `committee:recorded:${input.kind}`,
      subject: input.kind,
      detail: `${fresh.length} scholar(s) · meeting ${input.meetingOn} · ${by}`,
    });
  }
  return saved.ok ? { ok: true as const, saved: fresh.length } : saved;
}

/** True once a synopsis is on record (submitted or approved): the title is then locked. */
export function synopsisSubmitted(
  state: Pick<DoctoralState, "synopses">,
  identifier: string,
) {
  return state.synopses.some(
    (item) => sameId(item.scholarIdentifier, identifier) && item.status !== "Rejected",
  );
}

/** Office correction of the title on a committee record, allowed until the synopsis. */
export async function setCommitteeTitle(id: string, title: string) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const next = snapshot();
  const current = next.committees.find((item) => item.id === id);
  if (!current)
    return { ok: false as const, message: "That committee record was not found." };
  if (synopsisSubmitted(next, current.scholarIdentifier)) {
    return {
      ok: false as const,
      message: "The synopsis is submitted, so the research title is locked.",
    };
  }
  if (title.trim().length < 10) {
    return { ok: false as const, message: "Enter the full research title." };
  }
  next.committees = next.committees.map((item) =>
    item.id === id ? { ...item, researchTitle: title.trim() } : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `committee:title:${current.kind}`,
      subject: current.scholarIdentifier,
      detail: title.trim(),
    });
  }
  return saved;
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
  if (!current) return { ok: false as const, message: "That report was not found." };
  if (current.status !== "Submitted") {
    return {
      ok: false as const,
      message: `This report is already ${current.status.toLowerCase()} and cannot be changed.`,
    };
  }
  if (decision.status === "Approved" && (decision.minutes ?? "").trim().length < 2) {
    return { ok: false as const, message: "Enter the minutes before approving." };
  }
  const signer = readPreviewSession();
  if (!signer || (signer.role !== "dean" && signer.role !== "admin")) {
    return {
      ok: false as const,
      message: "Only the Dean (or the administrator) approves this report.",
    };
  }
  if (
    decision.status === "Approved" &&
    !current.officeEntry &&
    current.supervisorStatus !== "Recommended"
  ) {
    return {
      ok: false as const,
      message: "The guide has to recommend the report first.",
    };
  }
  next.committees = next.committees.map((item) =>
    item.id === id
      ? {
          ...item,
          ...decision,
          decidedBy: signer.name.trim() || signer.identifier,
          decidedAt: new Date().toISOString(),
        }
      : item,
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
      detail:
        decision.remarks || `The committee report was ${decision.status.toLowerCase()}.`,
      href: committeeHref("scholar", current.kind),
    });
  }
  return saved;
}

export type ColloquiumEventInput = Pick<
  Colloquium,
  | "name"
  | "sitting"
  | "year"
  | "date"
  | "time"
  | "venue"
  | "mode"
  | "details"
  | "scholars"
  | "supervisors"
>;

/** Creates a colloquium event, or updates the details of one not yet marked. */
export async function saveColloquiumEvent(input: ColloquiumEventInput, id?: string) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const next = snapshot();
  if (id) {
    const current = next.colloquia.find((item) => item.id === id);
    if (!current)
      return { ok: false as const, message: "That colloquium was not found." };
    next.colloquia = next.colloquia.map((item) =>
      item.id === id
        ? {
            ...item,
            ...input,
            // Invitees stay as issued once attendance is marked.
            scholars: colloquiumMarked(item) ? item.scholars : input.scholars,
            supervisors: colloquiumMarked(item) ? item.supervisors : input.supervisors,
          }
        : item,
    );
  } else {
    next.colloquia.unshift({
      ...input,
      id: localId(),
      issuedOn: new Date().toISOString(),
      attendance: {},
      markedOn: "",
      markedBy: "",
    });
  }
  const saved = await saveDoctoral(next);
  if (saved.ok && !id) {
    await recordAudit({
      action: "colloquium:create",
      subject: input.name,
      detail: `${input.sitting} ${input.year} · ${input.date}`,
    });
    for (const person of input.scholars) {
      await pushNotice({
        role: "scholar",
        identifier: person.identifier,
        title: `Colloquium: ${input.name}`,
        detail: `${input.date}${input.time ? ` at ${input.time}` : ""} · ${input.venue}. Attendance is recorded.`,
      });
    }
  }
  return saved;
}

/** Records attendance after the event. The office may correct it later. */
export async function markColloquiumAttendance(
  id: string,
  attendance: Record<string, ColloquiumMark>,
) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const signer = readPreviewSession();
  const next = snapshot();
  const current = next.colloquia.find((item) => item.id === id);
  if (!current) return { ok: false as const, message: "That colloquium was not found." };
  if (current.date && current.date > clientToday()) {
    return {
      ok: false as const,
      message: "Attendance can be marked on or after the date of the colloquium.",
    };
  }
  next.colloquia = next.colloquia.map((item) =>
    item.id === id
      ? {
          ...item,
          attendance,
          markedOn: clientToday(),
          markedBy: signer?.name || signer?.identifier || "",
        }
      : item,
  );
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: "colloquium:attendance",
      subject: current.name,
      detail: `${Object.values(attendance).filter((mark) => mark === "Present").length} present`,
    });
  }
  return saved;
}

/** Kept for older callers: records an event with no details. */
export async function issueColloquium(
  colloquium: Pick<Colloquium, "name" | "sitting" | "year" | "scholars" | "supervisors">,
) {
  return saveColloquiumEvent({
    ...colloquium,
    date: "",
    time: "",
    venue: "",
    mode: "Offline",
    details: "",
  });
}

type ChainKeys =
  | "needsSupervisor"
  | "supervisorStatus"
  | "supervisorRemarks"
  | "supervisorOn"
  | "supervisorAt"
  | "supervisorName"
  | "decidedBy"
  | "decidedAt";

const noChain = {
  supervisorStatus: "" as const,
  supervisorRemarks: "",
  supervisorOn: "",
  supervisorAt: "",
  supervisorName: "",
  decidedBy: "",
  decidedAt: "",
};

export async function saveSynopsis(
  synopsis: Omit<
    SynopsisSubmission,
    "id" | "status" | "remarks" | "decidedOn" | "createdAt" | ChainKeys
  >,
) {
  const next = snapshot();
  if (latestCommittee(next, "third", synopsis.scholarIdentifier)?.status !== "Approved") {
    return {
      ok: false as const,
      message: "The third doctoral committee has to be approved first.",
    };
  }
  if (latestSynopsis(next, synopsis.scholarIdentifier)?.status === "Approved") {
    return {
      ok: false as const,
      message: "This synopsis is approved and cannot be replaced.",
    };
  }
  const synopsisCertificate = plagiarismIssued(
    next,
    synopsis.scholarIdentifier,
    "synopsis",
  );
  if (!synopsisCertificate) {
    return {
      ok: false as const,
      message:
        "The research office has to verify the checklist and issue the synopsis plagiarism certificate first.",
    };
  }
  next.synopses = next.synopses.filter(
    (item) =>
      !(
        sameId(item.scholarIdentifier, synopsis.scholarIdentifier) &&
        item.status !== "Rejected"
      ),
  );
  const guide = guideOf(synopsis.scholarIdentifier);
  next.synopses.unshift({
    ...synopsis,
    id: localId(),
    status: "Submitted",
    remarks: "",
    decidedOn: "",
    createdAt: new Date().toISOString(),
    needsSupervisor: Boolean(guide),
    ...noChain,
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    if (guide) {
      await pushNotice({
        role: "supervisor",
        identifier: guide,
        title: "Synopsis to approve",
        detail: `${synopsis.scholarName} submitted the synopsis.`,
        href: "/supervisor/submissions",
      });
    } else {
      await notifyOffice({
        title: `Synopsis submitted · ${synopsis.scholarName}`,
        detail: "No guide is on record. Waiting for the research office.",
        href: "/admin/synopsis",
      });
    }
  }
  return saved;
}

export async function decideSynopsis(
  id: string,
  decision: { status: "Approved" | "Rejected"; remarks: string; decidedOn: string },
) {
  const role = readPreviewSession()?.role;
  if (role !== "dean" && role !== "admin") {
    return { ok: false as const, message: "Only the Dean can give the final decision." };
  }
  const next = snapshot();
  const current = next.synopses.find((item) => item.id === id);
  if (!current) return { ok: false as const, message: "That synopsis was not found." };
  if (current.status !== "Submitted") {
    return {
      ok: false as const,
      message: `This synopsis is already ${current.status.toLowerCase()} and cannot be changed.`,
    };
  }
  if (
    decision.status === "Approved" &&
    current.needsSupervisor &&
    current.supervisorStatus !== "Recommended"
  ) {
    return { ok: false as const, message: "The supervisor has to approve the synopsis first." };
  }
  next.synopses = next.synopses.map((item) =>
    item.id === id ? { ...item, ...decision, ...deanStamp() } : item,
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
      href: "/scholar/synopsis",
    });
  }
  return saved;
}

export async function saveThesis(
  thesis: Omit<
    ThesisSubmission,
    "id" | "status" | "remarks" | "decidedOn" | "createdAt" | "version" | "versions" | ChainKeys
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
  const guide = guideOf(thesis.scholarIdentifier);
  next.theses.unshift({
    ...thesis,
    id: localId(),
    version: 1,
    versions: [{ version: 1, fileName: thesis.fileName, uploadedAt: createdAt }],
    status: "Submitted",
    remarks: "",
    decidedOn: "",
    createdAt,
    needsSupervisor: Boolean(guide),
    ...noChain,
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    if (guide) {
      await pushNotice({
        role: "supervisor",
        identifier: guide,
        title: "Thesis to approve",
        detail: `${thesis.scholarName}: ${thesis.title}`,
        href: "/supervisor/submissions",
      });
    } else {
      await notifyOffice({
        title: `Thesis submitted · ${thesis.scholarName}`,
        detail: thesis.title,
        href: "/admin/thesis",
      });
    }
  }
  return saved;
}

export async function decideThesis(
  id: string,
  decision: { status: "Approved" | "Rejected"; remarks: string; decidedOn: string },
) {
  const role = readPreviewSession()?.role;
  if (role !== "dean" && role !== "admin") {
    return { ok: false as const, message: "Only the Dean can give the final decision." };
  }
  const next = snapshot();
  const current = next.theses.find((item) => item.id === id);
  if (!current) return { ok: false as const, message: "That thesis was not found." };
  if (current.status !== "Submitted") {
    return {
      ok: false as const,
      message: `This thesis is already ${current.status.toLowerCase()} and cannot be changed.`,
    };
  }
  if (decision.status === "Approved") {
    const certificate = latestPlagiarism(
      next,
      current?.scholarIdentifier ?? "",
      "thesis",
    );
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
  if (
    decision.status === "Approved" &&
    current.needsSupervisor &&
    current.supervisorStatus !== "Recommended"
  ) {
    return { ok: false as const, message: "The supervisor has to approve the thesis first." };
  }
  next.theses = next.theses.map((item) =>
    item.id === id ? { ...item, ...decision, ...deanStamp() } : item,
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
      href: "/scholar/thesis",
    });
  }
  return saved;
}

export function latestPlagiarism(
  state: Pick<DoctoralState, "plagiarism">,
  identifier: string,
  stage?: PlagiarismStage,
) {
  return (
    state.plagiarism
      .filter(
        (item) =>
          sameId(item.scholarIdentifier, identifier) &&
          (stage === undefined || item.stage === stage),
      )
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

export function plagiarismIssued(
  state: Pick<DoctoralState, "plagiarism">,
  identifier: string,
  stage: PlagiarismStage,
) {
  const latest = latestPlagiarism(state, identifier, stage);
  return latest?.status === "Approved" ? latest : null;
}

/** Why the office cannot issue the certificate for this stage yet, or null when it can. */
export function plagiarismBlocked(
  state: Pick<DoctoralState, "committees" | "synopses" | "plagiarism">,
  identifier: string,
  stage: PlagiarismStage = "thesis",
) {
  if (plagiarismIssued(state, identifier, stage)) {
    return `The ${stage} plagiarism certificate is already issued.`;
  }
  if (stage === "synopsis") {
    return latestCommittee(state, "third", identifier)?.status === "Approved"
      ? null
      : "The third doctoral committee has to be approved first.";
  }
  return latestSynopsis(state, identifier)?.status === "Approved"
    ? null
    : "The synopsis has to be accepted first.";
}

export async function issuePlagiarism(input: {
  stage: PlagiarismStage;
  scholarIdentifier: string;
  scholarName: string;
  checks: string[];
  similarity: string;
  fileName: string;
  fileData: string | null;
  remarks: string;
}) {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const signer = readPreviewSession();
  if (!signer || (signer.role !== "admin" && signer.role !== "dean")) {
    return {
      ok: false as const,
      message: "Only the Dean or the administrator issues the plagiarism certificate.",
    };
  }
  const next = snapshot();
  const blocked = plagiarismBlocked(next, input.scholarIdentifier, input.stage);
  if (blocked) return { ok: false as const, message: blocked };
  const checklist: readonly string[] =
    input.stage === "synopsis" ? synopsisChecklist : thesisChecklist;
  const missing = checklist.filter((item) => !input.checks.includes(item));
  if (missing.length > 0) {
    return {
      ok: false as const,
      message: `Checklist not complete: ${missing.join(", ")}.`,
    };
  }
  const similarity = Number(input.similarity);
  if (
    !input.similarity.trim() ||
    Number.isNaN(similarity) ||
    similarity < 0 ||
    similarity > 100
  ) {
    return { ok: false as const, message: "Enter the similarity percentage (0–100)." };
  }
  if (!input.fileName) {
    return { ok: false as const, message: "Attach the plagiarism report." };
  }
  const issuedOn = clientToday();
  const issuedBy = signer.name.trim() || signer.identifier;
  next.plagiarism.unshift({
    id: localId(),
    stage: input.stage,
    scholarIdentifier: input.scholarIdentifier,
    scholarName: input.scholarName,
    checks: [...checklist],
    issuedBy,
    similarity: input.similarity.trim(),
    fileName: input.fileName,
    fileData: input.fileData,
    status: "Approved",
    remarks: input.remarks.trim(),
    decidedOn: issuedOn,
    createdAt: new Date().toISOString(),
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `plagiarism:issued:${input.stage}`,
      subject: input.scholarIdentifier,
      detail: `${input.scholarName} · ${input.similarity}% · ${issuedBy}`,
    });
    await pushNotice({
      role: "scholar",
      identifier: input.scholarIdentifier,
      title: `Plagiarism certificate issued (${input.stage})`,
      detail:
        input.stage === "synopsis"
          ? "You can now submit the synopsis."
          : "You can now submit the thesis.",
    });
  }
  return saved;
}

export function reportsReady(
  state: Pick<DoctoralState, "examinerReports">,
  thesis: ThesisSubmission,
) {
  const current = state.examinerReports.filter(
    (item) => item.thesisId === thesis.id && item.version === thesis.version,
  );
  if (
    current.some((item) => item.outcome === "Rejected" || item.outcome === "Revision")
  ) {
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
  if (latestPlagiarism(state, identifier, "thesis")?.status !== "Approved") {
    return "The thesis plagiarism certificate has to be issued first.";
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
    | "id"
    | "status"
    | "remarks"
    | "decidedOn"
    | "createdAt"
    | "stage"
    | "checks"
    | "issuedBy"
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
    stage: "thesis",
    checks: [],
    issuedBy: "",
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
  if (!current) return { ok: false as const, message: "That certificate was not found." };
  if (current.status !== "Submitted") {
    return {
      ok: false as const,
      message: `This certificate is already ${current.status.toLowerCase()} and cannot be changed.`,
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
      detail:
        decision.remarks ||
        `The plagiarism certificate was ${decision.status.toLowerCase()}.`,
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
  if (latestPlagiarism(next, report.scholarIdentifier, "thesis")?.status !== "Approved") {
    return {
      ok: false as const,
      message: "The plagiarism certificate has to be approved first.",
    };
  }
  if (
    next.examinerReports.some(
      (item) =>
        item.thesisId === report.thesisId &&
        item.group === report.group &&
        item.version === report.version,
    )
  ) {
    return {
      ok: false as const,
      message: `The ${report.group} examiner report for version ${report.version} is already recorded.`,
    };
  }
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
    return {
      ok: false as const,
      message: "The thesis examiners have to be recorded first.",
    };
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
          versions: [...item.versions, { version, fileName: file.fileName, uploadedAt }],
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
  if (
    next.completions.some(
      (item) =>
        item.kind === completion.kind &&
        sameId(item.scholarIdentifier, completion.scholarIdentifier),
    )
  ) {
    return {
      ok: false as const,
      message: `The ${completion.kind.toLowerCase()} is already issued.`,
    };
  }
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
      detail:
        completion.remarks || `The ${completion.kind.toLowerCase()} is on the portal.`,
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
  const current = next.access.find((item) => item.id === id);
  if (!current) return { ok: false as const, message: "That request was not found." };
  if (current.status !== "Requested") {
    return {
      ok: false as const,
      message: `This request is already ${current.status.toLowerCase()}.`,
    };
  }
  next.access = next.access.map((item) =>
    item.id === id ? { ...item, ...decision } : item,
  );
  return saveDoctoral(next);
}

export function enrollmentFor(
  state: Pick<DoctoralState, "enrollments">,
  identifier: string,
) {
  return (
    state.enrollments.find((item) => sameId(item.scholarIdentifier, identifier)) ?? null
  );
}

export function courseCatalogFor(
  state: Pick<DoctoralState, "subjects" | "enrollments">,
  input: { identifier: string; semester: number; batchId: string },
) {
  const school = scholarSchoolName(
    input.identifier,
    enrollmentFor(state, input.identifier)?.school,
  );
  return state.subjects.filter((subject) => {
    if (subject.semester !== input.semester) return false;
    if (subject.batchId && subject.batchId !== input.batchId) return false;
    if (input.semester === 1) return isCommonSchool(subject.school);
    return Boolean(school) && sameId(subject.school, school);
  });
}

export function resultsFor(
  state: Pick<DoctoralState, "results">,
  registrationId: string,
) {
  return state.results.filter((item) => item.registrationId === registrationId);
}

export function resultFor(state: Pick<DoctoralState, "results">, registrationId: string) {
  return resultsFor(state, registrationId)[0] ?? null;
}

export function paperOf(
  state: Pick<DoctoralState, "subjects">,
  registration: Pick<CourseRegistration, "subjectId" | "code" | "name">,
) {
  const subject = state.subjects.find((item) => item.id === registration.subjectId);
  return {
    code: registration.code || subject?.code || "",
    name: registration.name || subject?.name || "",
    credits: subject?.credits || "",
    inChargeName: subject?.inChargeName || "",
    inChargeDesignation: subject?.inChargeDesignation || "",
    inChargeEmail: subject?.inChargeEmail || "",
    syllabusName: subject?.syllabusName || null,
    syllabusData: subject?.syllabusData || null,
  };
}

export function hasArrear(
  state: Pick<DoctoralState, "registrations" | "results">,
  identifier: string,
) {
  return arrearPapers(state, identifier).length > 0;
}

export function confirmationReady(
  state: Pick<DoctoralState, "registrations" | "results">,
  identifier: string,
) {
  // Four papers cleared: the two common papers (semester 1), and the major and allied papers
  // (semester 2). A paper cleared on a later attempt counts.
  const passed = paperStandings(state, identifier).filter(
    (paper) => paper.status === "Passed",
  );
  return [1, 2].every(
    (semester) => passed.filter((paper) => paper.semester === semester).length >= 2,
  );
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

export function latestSynopsis(
  state: Pick<DoctoralState, "synopses">,
  identifier: string,
) {
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

/** The thesis can be submitted three months after the synopsis was submitted. */
export function thesisOpensOn(synopsis: Pick<SynopsisSubmission, "createdAt">) {
  return addMonths(synopsis.createdAt.slice(0, 10), thesisWindowMonths);
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

/** Report periods for a scholar: from the course-work batch, else from the admission batch. */
export function reportPeriodsFor(
  state: Pick<DoctoralState, "enrollments" | "batches">,
  identifier: string,
) {
  const enrollment = enrollmentFor(state, identifier);
  const batch = state.batches.find((item) => item.id === enrollment?.batchId);
  if (batch) return reportPeriods(batch.session, Number(batch.year) || 2026);
  const scholar = scholarBySignIn(identifier);
  const admitted = researchRegister.batches.find((item) => item.id === scholar?.batchId);
  if (!admitted) return [];
  return reportPeriods(parseAdmissionSession(admitted.session), admitted.year);
}

/** The letter issued for an approval, if any (the latest when it was reissued). */
export function letterFor(
  state: Pick<DoctoralState, "letters">,
  kind: LetterKind,
  sourceId: string,
) {
  return (
    state.letters
      .filter((item) => item.kind === kind && item.sourceId === sourceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function lettersOf(
  state: Pick<DoctoralState, "letters">,
  role: "scholar" | "supervisor",
  keys: readonly string[],
) {
  return state.letters.filter(
    (item) =>
      item.recipientRole === role &&
      keys.some((key) => key.trim() && sameId(item.recipientIdentifier, key)),
  );
}

/** Next serial for a reference prefix in a year. */
export function nextLetterSerial(
  state: Pick<DoctoralState, "letters">,
  kind: LetterKind,
  year: string,
) {
  return (
    state.letters.filter((item) => item.kind === kind && item.issuedOn.startsWith(year))
      .length + 1
  );
}

const letterNames: Record<LetterKind, string> = {
  provisional: "Provisional selection letter",
  confirmation: "Confirmation of provisional registration",
  recognition: "Supervisor recognition letter",
  viva: "Viva-voce communication",
  completion: "Ph.D. completion letter",
};

export function letterName(kind: LetterKind) {
  return letterNames[kind];
}

/** Issues (or reissues, with the corrected text) an official letter. */
export async function issueLetter(draft: LetterDraft) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  if (!draft.refNo.trim() || !draft.issuedOn) {
    return { ok: false as const, message: "Enter the reference number and the date." };
  }
  if (draft.body.join("").trim().length < 20) {
    return { ok: false as const, message: "The letter has no text." };
  }
  const next = snapshot();
  const reissue = letterFor(next, draft.kind, draft.sourceId);
  const signer = readPreviewSession();
  next.letters.unshift({
    ...draft,
    id: localId(),
    issuedBy: signer?.name || signer?.identifier || "",
    createdAt: new Date().toISOString(),
  });
  const saved = await saveDoctoral(next);
  if (saved.ok) {
    await recordAudit({
      action: `letter:${draft.kind}${reissue ? ":reissued" : ""}`,
      subject: draft.recipientIdentifier,
      detail: `${draft.recipientName} · ${draft.refNo}`,
    });
    await pushNotice({
      role: draft.recipientRole,
      identifier: draft.recipientIdentifier,
      title: `${letterNames[draft.kind]} ${reissue ? "reissued" : "issued"}`,
      detail: `${draft.refNo} dated ${draft.issuedOn}. Download it under Approved documents.`,
      href: `/${draft.recipientRole}/approved`,
    });
  }
  return saved;
}
