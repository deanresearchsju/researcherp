import {
  admissionChecklist,
  admissionLockCopy,
  defaultLetter,
  emptyEntranceSchedule,
  interviewMax,
  selectionFlowCopy,
  selectionSteps,
  writtenMax,
  type SelectionStepId,
} from "@/data/admission";
import { researchRegister } from "@/data/research-register";
import { schools } from "@/data/schools";
import { adminActionBlock, officeWriteBlock } from "@/lib/access";
import { clientNowIso, isValidIsoDate } from "@/lib/dates";
import { admissionYear } from "@/lib/constants";
import { pushNotice, recordAudit } from "@/lib/audit";
import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { saveJsonBlob } from "@/lib/json-lock";
import { toJson, updateApplicationStatus, type StoredApplication } from "@/lib/records";
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
  /** The application says the research is interdisciplinary; such a candidate needs a co-supervisor. */
  interdisciplinary: boolean;
  interdisciplinaryNote: string;
  coGuideName: string;
  coGuideIdentifier: string;
  verification: "Pending" | "Approved";
  checks: Partial<Record<string, CheckMark>>;
  uploads: Partial<Record<string, { fileName: string; fileData: string }>>;
  feeReference: string;
  feeAmount: string;
  feeReceiptName: string | null;
  feeReceiptData: string | null;
  correctionOpen: boolean;
  letterIssued: boolean;
  /** Reference serial printed on the letter; fixed once issued. */
  letterNo: number | null;
  letterIssuedOn: string;
  /** Scrutiny of the application: eligibility and application fee. */
  scrutiny: ScrutinyMark;
  scrutinyNote: string;
  /** Position on the subject-wise merit list. */
  meritRank: number | null;
  /** Position on the subject-wise waiting list; null when not wait-listed. */
  waitlistRank: number | null;
  /** Set when a selected candidate did not report or declined; the seat is released. */
  reporting: ReportingMark;
  reportingNote: string;
  reportingOn: string;
  /** Selected later from the waiting list against a released seat. */
  fromWaitlist: boolean;
  /** Admitted in an earlier admission session that has been closed. */
  sessionClosed: boolean;
  /** Entrance test centre and hall, and the hall ticket issued for it. */
  examCampusId: string;
  examRoom: string;
  /** Seat number inside the room, from the seating arrangement. */
  examSeat: string;
  hallTicketNo: string;
  hallTicketOn: string;
  /** The day the document checklist was submitted and ERP access opened. */
  checklistSubmittedOn: string;
  /** Registration number given by the Controller of Examinations; permanent once recorded. */
  registrationNo: string;
  registrationOn: string;
  /** The intake (batch id) this file was admitted in, stamped when the selection is finished. */
  intake: string;
};

export const scrutinyMarks = ["Eligible", "Not eligible"] as const;
export type ScrutinyMark = (typeof scrutinyMarks)[number] | "";
export const reportingMarks = ["Not reported", "Declined"] as const;
export type ReportingMark = (typeof reportingMarks)[number] | "";

export type EntranceScore = {
  key: string;
  written: number | null;
  interview: number | null;
};

/** A hall or class at a venue, with the number of candidates it seats. */
export type ExamRoom = { id: string; name: string; capacity: number };

export type ExamCampus = {
  id: string;
  name: string;
  address: string;
  rooms: ExamRoom[];
};

export type InterviewExpert = { name: string; designation: string; institution: string };

/**
 * One interview panel: two experts who assess a group of candidates. A panel covers a school
 * and/or chosen subjects, and takes up to `strength` candidates (0 = no limit); several panels
 * can cover the same subject when it has many candidates.
 */
export type InterviewPanel = {
  id: string;
  name: string;
  /** Blank = any school. */
  school: string;
  /** Blank = every subject of the school. */
  subjects: string[];
  strength: number;
  date: string;
  venue: string;
  experts: [InterviewExpert, InterviewExpert];
};

export const emptyExpert: InterviewExpert = {
  name: "",
  designation: "",
  institution: "",
};

export function newPanelId() {
  return `panel-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type PanelAssignment = { panel: InterviewPanel | null; rows: AdmissionCase[] };

/**
 * Seats the present candidates on the panels: a panel naming the candidate's subject comes
 * first, then a panel for the candidate's school, then a general panel. Each panel fills to its
 * strength before the next panel for the same subject takes over. Candidates no open panel
 * covers are returned with a null panel.
 */
export function assignInterviewPanels(
  panels: readonly InterviewPanel[],
  rows: readonly AdmissionCase[],
  schoolOf: (subject: string) => string,
): PanelAssignment[] {
  const loads = panels.map(() => [] as AdmissionCase[]);
  const unassigned: AdmissionCase[] = [];
  const ordered = [...rows].sort(
    (a, b) =>
      a.department.localeCompare(b.department) ||
      (a.hallTicketNo || "~").localeCompare(b.hallTicketNo || "~") ||
      a.name.localeCompare(b.name),
  );
  for (const row of ordered) {
    const school = schoolOf(row.department);
    const indexes = panels.map((_, index) => index);
    const bySubject = indexes.filter((index) =>
      panels[index].subjects.some((subject) => sameDepartment(subject, row.department)),
    );
    const bySchool = indexes.filter(
      (index) =>
        panels[index].subjects.length === 0 &&
        panels[index].school &&
        sameDepartment(panels[index].school, school),
    );
    const general = indexes.filter(
      (index) => panels[index].subjects.length === 0 && !panels[index].school,
    );
    const open = [...bySubject, ...bySchool, ...general].find(
      (index) =>
        panels[index].strength <= 0 || loads[index].length < panels[index].strength,
    );
    if (open === undefined) unassigned.push(row);
    else loads[open].push(row);
  }
  return [
    ...panels.map((panel, index) => ({ panel, rows: loads[index] })),
    ...(unassigned.length > 0 ? [{ panel: null, rows: unassigned }] : []),
  ];
}
export type EntranceSchedule = {
  session: string;
  monthYear: string;
  date: string;
  /** Legacy single venue; campuses replace it. */
  venue: string;
  reportingTime: string;
  examTime: string;
  campuses: ExamCampus[];
  /** Printed on every hall ticket. Images are data URLs. */
  superintendentName: string;
  superintendentSignature: string;
  deanSignature: string;
  panels: InterviewPanel[];
};

export function campusFor(schedule: EntranceSchedule, id: string) {
  return schedule.campuses.find((item) => item.id === id) ?? null;
}

/** "14:30" → "2:30 PM". */
export function clockLabel(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${match[2]} ${suffix}`;
}

/** Hall ticket number: PHD + yy + mm of the admission session + serial, e.g. PHD2607001. */
export function hallTicketNumber(schedule: EntranceSchedule, serial: number) {
  const [year = "", month = ""] = schedule.monthYear.split("-");
  return `PHD${year.slice(-2)}${month}${String(serial).padStart(3, "0")}`;
}

/** The serial of a hall ticket number in the current format, or null for any other format. */
export function hallTicketSerial(schedule: EntranceSchedule, value: string) {
  const prefix = hallTicketNumber(schedule, 0).slice(0, -3);
  if (!value.startsWith(prefix)) return null;
  const serial = Number(value.slice(prefix.length));
  return Number.isInteger(serial) && serial > 0 ? serial : null;
}

export type SelectionProgress = {
  current: SelectionStepId;
  completed: SelectionStepId[];
  entrance: EntranceSchedule;
  entranceReady: boolean;
  /** Minimum total (out of 100) to enter the merit list; null when no minimum is set. */
  qualifyingTotal: number | null;
  /** Approval of the provisional list by the Research Advisory Board or the Vice Chancellor. */
  approval: ApprovalRecord;
  /** The day every batch was promoted, so the fresh batch starts in semester 1 ("" = not yet). */
  promotedOn: string;
};

export const approvalBodies = ["Research Advisory Board", "Vice Chancellor"] as const;

export type ApprovalRecord = {
  /** Names printed under the signature lines of the approval sheet. */
  preparedBy: string;
  verifiedBy: string;
  body: (typeof approvalBodies)[number] | "";
  /** Minutes or reference number of the approval. */
  reference: string;
  approvedOn: string;
  recordedBy: string;
  /** Fingerprint of the list that was approved; a later change makes the approval outdated. */
  listKey: string;
};

export const emptyApproval: ApprovalRecord = {
  preparedBy: "",
  verifiedBy: "",
  body: "",
  reference: "",
  approvedOn: "",
  recordedBy: "",
  listKey: "",
};

/** The provisional list as the approving body sees it: who, in which subject, with which guide. */
export function provisionalListKey(cases: readonly AdmissionCase[]) {
  const selected = provisionalOrder(cases).map(
    (row) =>
      `${row.applicationId}|${row.department}|${row.guideName}${row.coGuideName ? `|co:${row.coGuideName}` : ""}`,
  );
  const waiting = waitlistOrder(cases).map(
    (row) => `${row.applicationId}|${row.department}|W${row.waitlistRank}`,
  );
  return [...selected, "--", ...waiting].join(";");
}

export type ApprovalState = "none" | "approved" | "outdated";

export function approvalState(
  progress: Pick<SelectionProgress, "approval">,
  cases: readonly AdmissionCase[],
): ApprovalState {
  const { approval } = progress;
  if (!approval.listKey || !approval.body) return "none";
  return approval.listKey === provisionalListKey(cases) ? "approved" : "outdated";
}

export type ArchivedSession = {
  id: string;
  session: string;
  year: string;
  label: string;
  archivedAt: string;
  cases: AdmissionCase[];
  applications: StoredApplication[];
};

export type AdmissionState = {
  cases: AdmissionCase[];
  letter: LetterConfig;
  entranceScores: EntranceScore[];
  progress: SelectionProgress;
  archived: ArchivedSession[];
  updatedAt: string | null;
  detail: string | null;
};

export const defaultSelectionProgress: SelectionProgress = {
  current: "applications",
  completed: [],
  entrance: { ...emptyEntranceSchedule, campuses: [], panels: [] },
  entranceReady: false,
  qualifyingTotal: null,
  approval: { ...emptyApproval },
  promotedOn: "",
};

/** Session and month-year fixed at the start; date and venue fixed at the entrance step. */
export function sessionIsSet(schedule: EntranceSchedule) {
  return Boolean(schedule.session.trim() && schedule.monthYear.trim());
}

export function selectionStepIds() {
  return selectionSteps.map((item) => item.id);
}

export function scheduleIsReady(schedule: EntranceSchedule) {
  return Boolean(
    schedule.session.trim() &&
    schedule.monthYear.trim() &&
    isValidIsoDate(schedule.date) &&
    /^\d{1,2}:\d{2}$/.test(schedule.examTime.trim()) &&
    schedule.campuses.length > 0,
  );
}

export function stepIsOpen(progress: SelectionProgress, id: SelectionStepId) {
  return progress.current === id && !progress.completed.includes(id);
}

/** Reporting and Admission stay open until the admission session is closed. */
export function stepStaysOpen(id: SelectionStepId) {
  return id === "certificates" || id === "fees";
}

export function stepIsBlocked(progress: SelectionProgress, id: SelectionStepId) {
  return !stepStaysOpen(id) && progress.completed.includes(id);
}

export function completeSelectionProgress(progress: SelectionProgress) {
  if (progress.completed.includes(progress.current)) return progress;
  if (progress.current === "entrance" && !progress.entranceReady) return progress;
  const ids = selectionStepIds();
  const index = ids.indexOf(progress.current);
  const next = ids[index + 1];
  return {
    ...progress,
    completed: [...progress.completed, progress.current],
    current: next ?? progress.current,
  };
}

/**
 * Reopening a step deletes everything done in that step, so the step is worked again in full.
 * Returns the cases and progress as they stand after the reset, and whether the saved marks
 * must be cleared too.
 */
export function resetStepData(
  cases: readonly AdmissionCase[],
  progress: SelectionProgress,
  step: SelectionStepId,
) {
  let nextProgress = progress;
  let clearScores = false;
  const change = (patch: Partial<AdmissionCase>) =>
    cases.map((row) => (row.sessionClosed ? row : { ...row, ...patch }));
  let nextCases: AdmissionCase[] = cases.slice();
  switch (step) {
    case "applications":
      nextCases = change({ scrutiny: "", scrutinyNote: "" });
      break;
    case "shortlist":
      nextCases = change({ shortlisted: false });
      break;
    case "entrance":
      nextCases = change({
        attendance: "",
        hallTicketNo: "",
        hallTicketOn: "",
        examCampusId: "",
        examRoom: "",
        examSeat: "",
      });
      break;
    case "marks":
      nextCases = change({ written: null, interview: null });
      nextProgress = {
        ...progress,
        entrance: { ...progress.entrance, panels: [] },
      };
      clearScores = true;
      break;
    case "selection":
      nextCases = change({
        selected: false,
        meritRank: null,
        waitlistRank: null,
        fromWaitlist: false,
      });
      nextProgress = { ...progress, qualifyingTotal: null };
      break;
    case "provisional":
      nextCases = change({
        guideName: "",
        guideIdentifier: "",
        coGuideName: "",
        coGuideIdentifier: "",
      });
      nextProgress = { ...progress, approval: { ...emptyApproval } };
      break;
    case "letter":
      nextCases = change({ letterIssued: false, letterNo: null, letterIssuedOn: "" });
      break;
    case "certificates":
      nextCases = change({
        checks: {},
        verification: "Pending",
        checklistSubmittedOn: "",
        reporting: "",
        reportingNote: "",
        reportingOn: "",
      });
      break;
    case "fees":
      nextCases = change({ registrationNo: "", registrationOn: "" });
      break;
  }
  return { cases: nextCases, progress: nextProgress, clearScores };
}

export function clearSelectionProgress(progress: SelectionProgress, count: 1 | 2) {
  if (progress.completed.length === 0) {
    return {
      ...progress,
      current: "applications" as SelectionStepId,
      entranceReady: false,
    };
  }
  const take = Math.min(count, progress.completed.length);
  const cleared = progress.completed.slice(-take);
  const completed = progress.completed.slice(0, -take);
  const current = cleared[0] ?? ("applications" as SelectionStepId);
  const ids = selectionStepIds();
  const entranceIndex = ids.indexOf("entrance");
  const unlockEntrance = cleared.some((id) => ids.indexOf(id) <= entranceIndex);
  return {
    ...progress,
    completed,
    current,
    entranceReady: unlockEntrance ? false : progress.entranceReady,
  };
}

/** The batch id of an intake, as the batch lists use it (July sessions run as "june"). */
export function intakeIdOf(session: string, year: string | number) {
  return `${String(year).trim()}-${session.trim() === "July" ? "june" : "january"}`;
}

export function archiveSessionId(session: string, year: string) {
  return `${year.trim()}-${session.trim().toLowerCase()}`;
}

export function archiveSessionLabel(session: string, year: string) {
  return `${session.trim()} ${year.trim()}`.trim();
}

export function archivedKeys(sessions: readonly ArchivedSession[]) {
  const keys = new Set<string>();
  for (const item of sessions) {
    for (const row of item.cases) {
      if (row.applicationId) keys.add(row.applicationId);
      if (row.applicationNo) keys.add(row.applicationNo);
    }
    for (const application of item.applications) {
      keys.add(application.id);
      keys.add(application.applicationNo);
    }
  }
  return keys;
}

export function isLiveAdmissionCase(
  row: AdmissionCase,
  keys: ReadonlySet<string> = archivedKeys(currentAdmission()?.archived ?? []),
) {
  if (keys.has(row.applicationId) || keys.has(row.applicationNo)) return false;
  if (registerScholarForCase(row) && !row.correctionOpen) return false;
  return true;
}

export function shouldArchiveCase(row: AdmissionCase) {
  if (row.verification === "Approved" || registerScholarForCase(row)) return false;
  // A candidate who did not report or declined leaves with the unselected applications.
  if (row.reporting) return true;
  if (row.selected || row.letterIssued) return false;
  return true;
}

export function isArchivedApplication(
  application: Pick<StoredApplication, "id" | "applicationNo">,
  sessions: readonly ArchivedSession[] = currentAdmission()?.archived ?? [],
) {
  const keys = archivedKeys(sessions);
  return keys.has(application.id) || keys.has(application.applicationNo);
}

export function archiveYearOf(schedule: EntranceSchedule) {
  const match = /^(\d{4})/.exec(schedule.monthYear.trim());
  return match?.[1] ?? admissionYear;
}

export function keepHiddenCases(
  live: AdmissionCase[],
  stored: AdmissionCase[],
  keys: ReadonlySet<string>,
) {
  const liveIds = new Set(live.map((row) => row.applicationId));
  return [
    ...live,
    ...stored.filter(
      (row) => !liveIds.has(row.applicationId) && !isLiveAdmissionCase(row, keys),
    ),
  ];
}

export function archivedApplications(session: ArchivedSession) {
  if (session.applications.length > 0) return session.applications;
  return session.cases.map((row) => snapshotApplication(row, []));
}

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
    interdisciplinary: payloadText(application.payload, "interdisciplinary") === "Yes",
    interdisciplinaryNote: payloadText(application.payload, "interdisciplinaryNote"),
    coGuideName: "",
    coGuideIdentifier: "",
    verification: "Pending",
    checks: {},
    uploads: {},
    feeReference: "",
    feeAmount: "",
    feeReceiptName: null,
    feeReceiptData: null,
    correctionOpen: false,
    letterIssued: false,
    letterNo: null,
    letterIssuedOn: "",
    scrutiny: "",
    scrutinyNote: "",
    meritRank: null,
    waitlistRank: null,
    reporting: "",
    reportingNote: "",
    reportingOn: "",
    fromWaitlist: false,
    sessionClosed: false,
    examCampusId: "",
    examRoom: "",
    examSeat: "",
    hallTicketNo: "",
    hallTicketOn: "",
    checklistSubmittedOn: "",
    registrationNo: "",
    registrationOn: "",
    intake: "",
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
      interdisciplinary: fresh.interdisciplinary,
      interdisciplinaryNote: fresh.interdisciplinaryNote,
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

/** The permanent registration number of a scholar admitted through Selection ("" if none yet). */
export function admittedRegistration(identifier: string) {
  const key = identifier.trim().toLowerCase();
  if (!key) return "";
  const row = currentAdmission()?.cases.find(
    (item) =>
      item.email.trim().toLowerCase() === key ||
      item.applicationNo.trim().toLowerCase() === key,
  );
  return row?.registrationNo ?? "";
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

export function registerScholarForCase(
  row: Pick<AdmissionCase, "email" | "applicationNo">,
) {
  return scholarBySignIn(row.email) ?? scholarBySignIn(row.applicationNo);
}

/**
 * Where an applicant stands, worked out from the Selection file (the office's real record), so
 * a status left over from the old step-by-step buttons can never show the wrong message.
 */
export function applicationStageOf(
  row: AdmissionCase | null | undefined,
  fallback: string,
) {
  if (!row) return fallback;
  if (row.verification === "Approved") return "Admitted";
  if (row.reporting) return "Not reported";
  if (row.selected) return "Selected";
  if (row.waitlistRank !== null) return "Waiting list";
  if (row.scrutiny === "Not eligible") return "Not selected";
  if (row.shortlisted) return "Shortlisted";
  if (row.scrutiny === "Eligible" || row.payment === "Approved") return "Under review";
  return "Acknowledgement sent";
}

export function admissionCompleted(row: AdmissionCase) {
  return row.verification === "Approved" || Boolean(registerScholarForCase(row));
}

export function admissionFileFrozen(row: AdmissionCase) {
  return admissionCompleted(row) && !row.correctionOpen;
}

export function scholarAdmissionWriteBlock(row: AdmissionCase) {
  if (!admissionCompleted(row)) return null;
  return admissionLockCopy.scholarFrozen;
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

/** Present, marked and not withdrawn: the candidates who can be ranked. */
export function rankable(row: AdmissionCase) {
  return (
    row.shortlisted &&
    row.attendance === "Present" &&
    row.written !== null &&
    row.interview !== null &&
    !row.reporting
  );
}

/** Merit order: total, then the written test, then name. */
export function meritCompare(a: AdmissionCase, b: AdmissionCase) {
  return (
    (totalMarks(b) ?? 0) - (totalMarks(a) ?? 0) ||
    (b.written ?? 0) - (a.written ?? 0) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Prepares the subject-wise merit list. The top candidates fill the vacancies; the rest who
 * qualify go on the waiting list in merit order. Files already admitted keep their seat.
 */
export function applyVacancySelection(
  cases: AdmissionCase[],
  vacancies: readonly Vacancy[],
  qualifyingTotal: number | null = null,
) {
  const outcome = new Map<
    string,
    { selected: boolean; meritRank: number | null; waitlistRank: number | null }
  >();
  const departments = [...new Set(cases.map((item) => item.department))];
  for (const department of departments) {
    const seats = seatsFor(department, vacancies);
    const ranked = cases
      .filter(
        (item) =>
          item.department === department &&
          rankable(item) &&
          (qualifyingTotal === null || (totalMarks(item) ?? 0) >= qualifyingTotal),
      )
      .sort(meritCompare);
    const kept = ranked.filter((item) => admissionFileFrozen(item) && item.selected);
    let open = Math.max(seats - kept.length, 0);
    let waiting = 0;
    ranked.forEach((item, index) => {
      if (admissionFileFrozen(item)) {
        outcome.set(item.applicationId, {
          selected: item.selected,
          meritRank: index + 1,
          waitlistRank: null,
        });
        return;
      }
      if (open > 0) {
        open -= 1;
        outcome.set(item.applicationId, {
          selected: true,
          meritRank: index + 1,
          waitlistRank: null,
        });
        return;
      }
      waiting += 1;
      outcome.set(item.applicationId, {
        selected: false,
        meritRank: index + 1,
        waitlistRank: waiting,
      });
    });
  }
  return cases.map((item) => {
    if (admissionFileFrozen(item) || item.reporting) return item;
    const result = outcome.get(item.applicationId) ?? {
      selected: false,
      meritRank: null,
      waitlistRank: null,
    };
    return {
      ...item,
      ...result,
      fromWaitlist: false,
      guideName: result.selected ? item.guideName : "",
      guideIdentifier: result.selected ? item.guideIdentifier : "",
      verification: result.selected ? item.verification : ("Pending" as const),
    };
  });
}

/** Wait-listed candidates of a subject, best first. */
export function waitlistFor(cases: readonly AdmissionCase[], department: string) {
  return cases
    .filter(
      (row) =>
        row.waitlistRank !== null &&
        !row.selected &&
        !row.reporting &&
        sameDepartment(row.department, department),
    )
    .sort((a, b) => (a.waitlistRank ?? 0) - (b.waitlistRank ?? 0));
}

export function waitlistOrder(cases: readonly AdmissionCase[]) {
  return cases
    .filter((row) => row.waitlistRank !== null && !row.selected && !row.reporting)
    .slice()
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        (a.waitlistRank ?? 0) - (b.waitlistRank ?? 0),
    );
}

/**
 * Releases the seat of a selected candidate who did not report or declined, and, when asked,
 * offers it to the first candidate on the same subject's waiting list with the same guide.
 */
export function releaseSeat(
  cases: readonly AdmissionCase[],
  applicationId: string,
  reason: Exclude<ReportingMark, "">,
  note: string,
  on: string,
  offerNext: boolean,
) {
  const leaving = cases.find((row) => row.applicationId === applicationId);
  if (!leaving) return { cases: [...cases], promoted: null };
  const next = offerNext ? (waitlistFor(cases, leaving.department)[0] ?? null) : null;
  const updated = cases.map((row) => {
    if (row.applicationId === leaving.applicationId) {
      return {
        ...row,
        selected: false,
        reporting: reason,
        reportingNote: note,
        reportingOn: on,
        guideName: "",
        guideIdentifier: "",
        coGuideName: "",
        coGuideIdentifier: "",
        verification: "Pending" as const,
      };
    }
    if (next && row.applicationId === next.applicationId) {
      return {
        ...row,
        selected: true,
        fromWaitlist: true,
        waitlistRank: null,
        guideName: leaving.guideName,
        guideIdentifier: leaving.guideIdentifier,
        letterIssued: false,
        letterNo: null,
        letterIssuedOn: "",
      };
    }
    return row;
  });
  return { cases: updated, promoted: next };
}

/** The next free letter reference serial. */
export function nextLetterNo(cases: readonly AdmissionCase[]) {
  return cases.reduce((max, row) => Math.max(max, row.letterNo ?? 0), 0) + 1;
}

/** Why the open step cannot be completed yet; null when it can. */
export function stepCompletionBlock(
  step: SelectionStepId,
  cases: readonly AdmissionCase[],
  progress: SelectionProgress,
  context: { applicationWindowOpen?: boolean } = {},
): string | null {
  const live = cases.filter((row) => !admissionFileFrozen(row) || row.selected);
  switch (step) {
    case "applications": {
      if (!sessionIsSet(progress.entrance)) {
        return "Set the admission session and month before completing scrutiny.";
      }
      const open = live.filter((row) => !row.scrutiny).length;
      if (live.length === 0) return "There is no application to scrutinise.";
      return open > 0 ? `${open} application(s) still need the scrutiny decision.` : null;
    }
    case "shortlist":
      // Selection starts once applications are closed: no new application may arrive after.
      if (context.applicationWindowOpen) {
        return "Close the Ph.D. application window (Application window menu) before completing the shortlist.";
      }
      return live.some((row) => row.shortlisted)
        ? null
        : "Shortlist at least one eligible candidate.";
    case "entrance": {
      if (!progress.entranceReady) {
        return "Save the entrance date, time and at least one campus first.";
      }
      const noCampus = live.filter((row) => row.shortlisted && !row.examCampusId).length;
      if (noCampus > 0) return `Assign a campus to ${noCampus} shortlisted candidate(s).`;
      const noTicket = live.filter((row) => row.shortlisted && !row.hallTicketNo).length;
      if (noTicket > 0) return `Generate hall tickets for ${noTicket} candidate(s).`;
      const open = live.filter((row) => row.shortlisted && !row.attendance).length;
      return open > 0 ? `Mark attendance for ${open} shortlisted candidate(s).` : null;
    }
    case "marks": {
      const open = live.filter(
        (row) =>
          row.shortlisted &&
          row.attendance === "Present" &&
          (row.written === null || row.interview === null),
      ).length;
      return open > 0 ? `Enter marks for ${open} present candidate(s).` : null;
    }
    case "selection":
      return live.some((row) => row.selected)
        ? null
        : "Prepare the merit list so that at least one candidate is selected.";
    case "provisional": {
      const open = live.filter((row) => row.selected && !row.guideName).length;
      if (open > 0) return `Allot a guide to ${open} selected candidate(s).`;
      const noCo = live.filter(
        (row) => row.selected && row.interdisciplinary && !row.coGuideName,
      ).length;
      if (noCo > 0) {
        return `Allot a co-supervisor to ${noCo} interdisciplinary candidate(s).`;
      }
      const state = approvalState(progress, cases);
      if (state === "none") {
        return "Print the approval sheet, get the list approved by the Research Advisory Board or the Vice Chancellor, then record the approval.";
      }
      return state === "outdated"
        ? "The list changed after it was approved. Print the revised approval sheet and record the approval again."
        : null;
    }
    case "letter": {
      const open = live.filter((row) => row.selected && !row.letterIssued).length;
      if (open > 0) return `Issue the provisional letter to ${open} candidate(s).`;
      // Reporting opens after every batch is promoted, so the fresh batch starts in semester 1.
      return progress.promotedOn
        ? null
        : "Promote all batches (semester) before Reporting opens.";
    }
    case "certificates": {
      const open = live.filter(
        (row) => row.selected && row.verification !== "Approved",
      ).length;
      return open > 0
        ? `${open} selected candidate(s) are neither verified nor marked as not reported.`
        : null;
    }
    case "fees":
      return null;
  }
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
  if (row.reporting) return "This candidate did not report; the seat is released.";
  if (!row.guideName) return "Allot a guide on the provisional list first.";
  // The tuition fee is paid after the first sign-in, under Fee.
  // A document that is missing does not hold the file: the scholar brings it within
  // MISSING_DOCUMENT_DAYS days. Every item must still be marked.
  const open = admissionChecklist.filter((item) => {
    const mark = row.checks[item.id];
    if (item.required) return mark !== "Received" && mark !== "Missing";
    return !mark || mark === "Submitted";
  });
  if (open.length > 0) {
    return "Mark every document: Received, Missing, or Not applicable for optional items.";
  }
  return null;
}

/** Days allowed to hand over documents marked Missing at the checklist. */
export const MISSING_DOCUMENT_DAYS = 10;

export function missingDocumentsDue(row: AdmissionCase) {
  if (!row.checklistSubmittedOn) return "";
  const due = new Date(`${row.checklistSubmittedOn}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + MISSING_DOCUMENT_DAYS);
  return due.toISOString().slice(0, 10);
}

/**
 * Why a registration number cannot be allotted yet. It follows the tuition fee: the
 * scholar uploads the receipt in the ERP and the office approves it first.
 */
export function registrationBlock(row: AdmissionCase, tuitionApproved: boolean) {
  if (row.verification !== "Approved") return "Submit the document checklist first.";
  if (!tuitionApproved) return "Waiting for the tuition fee receipt to be approved.";
  return null;
}

export function registrationNumberTaken(
  cases: readonly AdmissionCase[],
  row: AdmissionCase,
  number: string,
) {
  const key = number.trim().toLowerCase();
  return cases.some(
    (item) =>
      item.applicationId !== row.applicationId &&
      item.registrationNo.trim().toLowerCase() === key,
  );
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
  const gatedAttendance = row.shortlisted === true ? attendance : "";
  const written =
    gatedAttendance === "Present" ? numberOrNull(row.written, writtenMax) : null;
  const interview =
    gatedAttendance === "Present" ? numberOrNull(row.interview, interviewMax) : null;
  const reporting = reportingMarks.find((item) => item === row.reporting) ?? "";
  const selected =
    row.selected === true && written !== null && interview !== null && !reporting;
  const rank = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
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
    shortlisted: row.shortlisted === true,
    attendance: gatedAttendance,
    written,
    interview,
    selected,
    guideName: selected ? text(row.guideName) : "",
    guideIdentifier: selected ? text(row.guideIdentifier) : "",
    interdisciplinary: row.interdisciplinary === true,
    interdisciplinaryNote: text(row.interdisciplinaryNote),
    coGuideName: selected ? text(row.coGuideName) : "",
    coGuideIdentifier: selected ? text(row.coGuideIdentifier) : "",
    verification: selected && row.verification === "Approved" ? "Approved" : "Pending",
    checks,
    uploads,
    feeReference: text(row.feeReference),
    feeAmount: text(row.feeAmount),
    feeReceiptName: text(row.feeReceiptName) || null,
    feeReceiptData: text(row.feeReceiptData) || null,
    correctionOpen: row.correctionOpen === true,
    letterIssued: row.letterIssued === true || row.verification === "Approved",
    letterNo: rank(row.letterNo),
    letterIssuedOn: text(row.letterIssuedOn),
    scrutiny: scrutinyMarks.find((item) => item === row.scrutiny) ?? "",
    scrutinyNote: text(row.scrutinyNote),
    meritRank: rank(row.meritRank),
    waitlistRank: selected || reporting ? null : rank(row.waitlistRank),
    reporting,
    reportingNote: text(row.reportingNote),
    reportingOn: text(row.reportingOn),
    fromWaitlist: row.fromWaitlist === true,
    sessionClosed: row.sessionClosed === true,
    examCampusId: row.shortlisted === true ? text(row.examCampusId) : "",
    examRoom: row.shortlisted === true ? text(row.examRoom) : "",
    examSeat: row.shortlisted === true ? text(row.examSeat) : "",
    hallTicketNo: row.shortlisted === true ? text(row.hallTicketNo) : "",
    hallTicketOn: row.shortlisted === true ? text(row.hallTicketOn) : "",
    checklistSubmittedOn:
      selected && row.verification === "Approved" ? text(row.checklistSubmittedOn) : "",
    registrationNo:
      selected && row.verification === "Approved" ? text(row.registrationNo) : "",
    registrationOn:
      selected && row.verification === "Approved" ? text(row.registrationOn) : "",
    intake: text(row.intake),
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

function parseSchedule(value: unknown): EntranceSchedule {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const venue = text(row.venue);
  const campuses = Array.isArray(row.campuses)
    ? row.campuses.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const campus = item as Record<string, unknown>;
        const id = text(campus.id);
        const name = text(campus.name);
        const rooms: ExamRoom[] = Array.isArray(campus.rooms)
          ? campus.rooms.flatMap((entry) => {
              if (!entry || typeof entry !== "object") return [];
              const room = entry as Record<string, unknown>;
              const roomName = text(room.name);
              const capacity = Number(room.capacity);
              return roomName && Number.isInteger(capacity) && capacity > 0
                ? [{ id: text(room.id) || roomName, name: roomName, capacity }]
                : [];
            })
          : [];
        return id && name ? [{ id, name, address: text(campus.address), rooms }] : [];
      })
    : [];
  return {
    session: text(row.session),
    monthYear: text(row.monthYear),
    date: text(row.date),
    venue,
    reportingTime: text(row.reportingTime) || emptyEntranceSchedule.reportingTime,
    examTime: text(row.examTime) || emptyEntranceSchedule.examTime,
    superintendentName: text(row.superintendentName),
    superintendentSignature: text(row.superintendentSignature).startsWith("data:image/")
      ? text(row.superintendentSignature)
      : "",
    deanSignature: text(row.deanSignature).startsWith("data:image/")
      ? text(row.deanSignature)
      : "",
    panels: Array.isArray(row.panels)
      ? row.panels.flatMap((item, position) => {
          if (!item || typeof item !== "object") return [];
          const panel = item as Record<string, unknown>;
          const list = Array.isArray(panel.experts) ? panel.experts : [];
          const expert = (value: unknown): InterviewExpert => {
            const entry =
              value && typeof value === "object"
                ? (value as Record<string, unknown>)
                : {};
            return {
              name: text(entry.name),
              designation: text(entry.designation),
              institution: text(entry.institution),
            };
          };
          // Panels saved per department become a panel for that subject.
          const legacy = text(panel.department);
          const subjects = Array.isArray(panel.subjects)
            ? panel.subjects.map(text).filter(Boolean)
            : legacy
              ? [legacy]
              : [];
          const strength = Math.floor(Number(panel.strength));
          return [
            {
              id: text(panel.id) || `panel-${position + 1}`,
              name: text(panel.name) || `Panel ${position + 1}`,
              school: text(panel.school) || (legacy ? schoolNameFromLabel(legacy) : ""),
              subjects,
              strength: Number.isFinite(strength) && strength > 0 ? strength : 0,
              date: text(panel.date),
              venue: text(panel.venue),
              experts: [expert(list[0]), expert(list[1])] as [
                InterviewExpert,
                InterviewExpert,
              ],
            },
          ];
        })
      : [], // A venue saved before campuses existed becomes the first campus.
    campuses:
      campuses.length > 0 || !venue
        ? campuses
        : [{ id: "campus-1", name: venue, address: "", rooms: [] }],
  };
}

function parseProgress(value: unknown): SelectionProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSelectionProgress;
  }
  const row = value as Record<string, unknown>;
  const ids = selectionStepIds();
  const current = ids.find((item) => item === row.current) ?? "applications";
  const completed = Array.isArray(row.completed)
    ? row.completed.flatMap((item) => {
        const match = ids.find((id) => id === item);
        return match ? [match] : [];
      })
    : [];
  const entrance = parseSchedule(row.entrance);
  const qualifying = Number(row.qualifyingTotal);
  return {
    current,
    completed,
    entrance,
    entranceReady: row.entranceReady === true && scheduleIsReady(entrance),
    qualifyingTotal:
      row.qualifyingTotal !== null &&
      row.qualifyingTotal !== undefined &&
      row.qualifyingTotal !== "" &&
      Number.isInteger(qualifying) &&
      qualifying >= 0 &&
      qualifying <= writtenMax + interviewMax
        ? qualifying
        : null,
    approval: parseApproval(row.approval),
    promotedOn: text(row.promotedOn),
  };
}

function parseApproval(value: unknown): ApprovalRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...emptyApproval };
  }
  const row = value as Record<string, unknown>;
  const body = approvalBodies.find((item) => item === row.body) ?? "";
  return {
    preparedBy: text(row.preparedBy),
    verifiedBy: text(row.verifiedBy),
    body,
    reference: text(row.reference),
    approvedOn: text(row.approvedOn),
    recordedBy: text(row.recordedBy),
    listKey: body ? text(row.listKey) : "",
  };
}

function parseArchivedApplication(value: unknown): StoredApplication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const applicationNo = text(row.applicationNo);
  const applicantName = text(row.applicantName);
  if (!id || !applicationNo || !applicantName) return null;
  return {
    id,
    kind: "phd",
    applicationNo,
    applicantName,
    email: text(row.email),
    dateOfBirth: text(row.dateOfBirth),
    studyMode: text(row.studyMode) || null,
    status: text(row.status) || "Not selected",
    createdAt: text(row.createdAt),
    payload: (row.payload as Json) ?? {},
  };
}

function parseArchivedSession(value: unknown): ArchivedSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const session = text(row.session);
  const year = text(row.year);
  if (!session || !year) return null;
  const cases = Array.isArray(row.cases)
    ? row.cases.flatMap((item) => {
        const parsed = parseCase(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const applications = Array.isArray(row.applications)
    ? row.applications.flatMap((item) => {
        const parsed = parseArchivedApplication(item);
        return parsed ? [parsed] : [];
      })
    : [];
  if (cases.length === 0 && applications.length === 0) return null;
  return {
    id: text(row.id) || archiveSessionId(session, year),
    session,
    year,
    label: text(row.label) || archiveSessionLabel(session, year),
    archivedAt: text(row.archivedAt),
    cases,
    applications,
  };
}

function parseStored(value: unknown): {
  cases: AdmissionCase[];
  letter: LetterConfig;
  entranceScores: EntranceScore[];
  progress: SelectionProgress;
  archived: ArchivedSession[];
} {
  if (!value || typeof value !== "object") {
    return {
      cases: [],
      letter: defaultLetter,
      entranceScores: [],
      progress: defaultSelectionProgress,
      archived: [],
    };
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
  const archived = Array.isArray(row.archived)
    ? row.archived.flatMap((item) => {
        const parsed = parseArchivedSession(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const progress = parseProgress(row.progress);
  return {
    cases: normalizeHallTickets(cases, progress.entrance),
    letter: parseLetter(row.letter),
    entranceScores,
    progress,
    archived,
  };
}

/**
 * Hall tickets issued in an older numbering are renumbered as PHDyymm001 in attendance
 * order, after the numbers already in the current format.
 */
export function normalizeHallTickets(cases: AdmissionCase[], schedule: EntranceSchedule) {
  if (!sessionIsSet(schedule)) return cases;
  const stale = attendanceOrder(cases).filter(
    (row) => row.hallTicketNo && hallTicketSerial(schedule, row.hallTicketNo) === null,
  );
  if (stale.length === 0) return cases;
  let serial =
    cases.reduce(
      (max, row) => Math.max(max, hallTicketSerial(schedule, row.hallTicketNo) ?? 0),
      0,
    ) + 1;
  const numbers = new Map(
    stale.map((row) => [row.applicationId, hallTicketNumber(schedule, serial++)]),
  );
  return cases.map((row) => {
    const next = numbers.get(row.applicationId);
    return next ? { ...row, hallTicketNo: next } : row;
  });
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
  progress: SelectionProgress;
  archived: ArchivedSession[];
} {
  if (typeof window === "undefined") {
    return {
      cases: [],
      letter: defaultLetter,
      entranceScores: [],
      progress: defaultSelectionProgress,
      archived: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(storageKeys.admission);
    return raw
      ? parseStored(JSON.parse(raw) as unknown)
      : {
          cases: [],
          letter: defaultLetter,
          entranceScores: [],
          progress: defaultSelectionProgress,
          archived: [],
        };
  } catch {
    return {
      cases: [],
      letter: defaultLetter,
      entranceScores: [],
      progress: defaultSelectionProgress,
      archived: [],
    };
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
    progress: remote.progress,
    archived: mergeArchived(browser.archived, remote.archived),
    updatedAt: data.updated_at ?? null,
    detail: null,
  };
}

function mergeArchived(local: ArchivedSession[], remote: ArchivedSession[]) {
  const seen = new Set(remote.map((item) => item.id));
  return [...local.filter((item) => !seen.has(item.id)), ...remote];
}

type PendingSave = {
  stored: Parameters<typeof toJson>[0];
  onFail?: (message: string) => void;
};
let pendingSave: PendingSave | null = null;
let flushing: Promise<void> | null = null;

/** Sends queued quick edits one at a time; only the newest queued state is sent. */
function flushPending() {
  if (flushing) return flushing;
  flushing = (async () => {
    while (pendingSave) {
      const job = pendingSave;
      pendingSave = null;
      const saved = await saveJsonBlob(
        "admission_office",
        "office",
        toJson(job.stored),
        memory?.updatedAt ?? null,
      );
      if (saved.ok) {
        if (memory) memory = { ...memory, updatedAt: saved.updatedAt };
        continue;
      }
      pendingSave = null;
      job.onFail?.(saved.message);
      // Show what the server really holds.
      const fresh = await loadAdmission();
      publish(fresh);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function saveAdmission(
  next: Pick<AdmissionState, "cases" | "letter"> & {
    entranceScores?: EntranceScore[];
    progress?: SelectionProgress;
    archived?: ArchivedSession[];
    updatedAt?: string | null;
    /** Show the change at once and save in the background (ticks and other quick edits). */
    optimistic?: { onFail: (message: string) => void };
  },
) {
  if (!next.optimistic && flushing) await flushing;
  const stored = {
    cases: next.cases,
    letter: next.letter,
    entranceScores: next.entranceScores ?? memory?.entranceScores ?? [],
    progress: next.progress ?? memory?.progress ?? defaultSelectionProgress,
    archived: next.archived ?? memory?.archived ?? [],
  };
  const supabase = createSupabase();
  if (next.optimistic && supabase && memory && !memory.detail) {
    publish({ ...stored, updatedAt: memory.updatedAt, detail: null });
    pendingSave = { stored, onFail: next.optimistic.onFail };
    void flushPending();
    return { ok: true as const };
  }
  const stamp = next.updatedAt ?? memory?.updatedAt ?? null;
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

function snapshotApplication(
  row: AdmissionCase,
  applications: readonly StoredApplication[],
): StoredApplication {
  const found =
    applications.find((item) => item.id === row.applicationId) ??
    applications.find((item) => item.applicationNo === row.applicationNo);
  if (found) return { ...found, status: "Not selected" };
  return {
    id: row.applicationId,
    kind: "phd",
    applicationNo: row.applicationNo,
    applicantName: row.name,
    email: row.email,
    dateOfBirth: "",
    studyMode: row.studyMode,
    status: "Not selected",
    createdAt: "",
    payload: {
      fullName: row.name,
      email: row.email,
      title: row.title,
      programme: row.department,
    },
  };
}

export async function archiveUnselected(input: {
  session: string;
  year: string;
  applications: readonly StoredApplication[];
}) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const session = input.session.trim();
  const year = input.year.trim() || admissionYear;
  if (!session) {
    return { ok: false as const, message: selectionFlowCopy.needArchiveSession };
  }
  const current = memory ?? (await ensureAdmission());
  const keys = archivedKeys(current.archived);
  const phd = input.applications.filter((item) => item.kind === "phd");
  const moving = mergeApplications(current.cases, phd).filter(
    (row) =>
      shouldArchiveCase(row) &&
      !keys.has(row.applicationId) &&
      !keys.has(row.applicationNo),
  );
  if (moving.length === 0) {
    return { ok: false as const, message: selectionFlowCopy.noneToArchive };
  }
  const snapshots = moving.map((row) => snapshotApplication(row, phd));
  const movingIds = new Set(moving.map((row) => row.applicationId));
  const movingNos = new Set(moving.map((row) => row.applicationNo));
  const id = archiveSessionId(session, year);
  const existing = current.archived.find((item) => item.id === id);
  const nextSession: ArchivedSession = existing
    ? {
        ...existing,
        archivedAt: clientNowIso(),
        cases: [...existing.cases, ...moving],
        applications: [...existing.applications, ...snapshots],
      }
    : {
        id,
        session,
        year,
        label: archiveSessionLabel(session, year),
        archivedAt: clientNowIso(),
        cases: moving,
        applications: snapshots,
      };
  const archived = existing
    ? current.archived.map((item) => (item.id === id ? nextSession : item))
    : [...current.archived, nextSession];
  const saved = await saveAdmission({
    cases: current.cases.filter(
      (row) => !movingIds.has(row.applicationId) && !movingNos.has(row.applicationNo),
    ),
    letter: current.letter,
    entranceScores: current.entranceScores,
    progress: current.progress,
    archived,
  });
  if (!saved.ok) return saved;
  return { ok: true as const, count: moving.length };
}

/**
 * Closes the admission session: unselected, wait-listed and not-reported candidates go to the
 * archive, admitted scholars leave the live desk, and the next session starts at scrutiny.
 */
export async function closeAdmissionSession(applications: readonly StoredApplication[]) {
  const blocked = adminActionBlock();
  if (blocked) return blocked;
  const before = memory ?? (await ensureAdmission());
  const session = before.progress.entrance.session;
  const year = archiveYearOf(before.progress.entrance);
  const archived = await archiveUnselected({ session, year, applications });
  if (!archived.ok && archived.message !== selectionFlowCopy.noneToArchive)
    return archived;
  const current = memory ?? before;
  const keys = archivedKeys(current.archived);
  const saved = await saveAdmission({
    cases: current.cases.map((row) =>
      keys.has(row.applicationId) || keys.has(row.applicationNo)
        ? row
        : {
            ...row,
            sessionClosed: true,
            correctionOpen: false,
            intake: row.intake || intakeIdOf(session, year),
          },
    ),
    letter: current.letter,
    entranceScores: current.entranceScores,
    progress: { ...defaultSelectionProgress },
    archived: current.archived,
  });
  if (!saved.ok) return saved;
  await recordAudit({
    action: "admission:close-session",
    subject: archiveSessionId(session, year),
    detail: `${archiveSessionLabel(session, year)} admission closed`,
  });
  return { ok: true as const, archived: archived.ok ? archived.count : 0 };
}

/**
 * Records the registration numbers given by the Controller of Examinations against admitted
 * scholars. A number is permanent: one already recorded is never changed.
 */
export async function allotIntakeRegistrations(
  rows: readonly { applicationNo: string; registrationNumber: string }[],
) {
  const blocked = officeWriteBlock();
  if (blocked) return { ...blocked, saved: 0, skipped: rows.length };
  const current = memory ?? (await ensureAdmission());
  const taken = new Set(
    [
      ...researchRegister.scholars.map((item) => item.registrationNumber),
      ...current.cases.map((item) => item.registrationNo),
    ]
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const byNo = new Map<string, string>();
  const messages: string[] = [];
  let skipped = 0;
  for (const entry of rows) {
    const number = entry.registrationNumber.trim();
    const no = entry.applicationNo.trim().toLowerCase();
    const row = current.cases.find(
      (item) =>
        item.applicationNo.trim().toLowerCase() === no && item.verification === "Approved",
    );
    if (!number) continue;
    if (!row) {
      skipped += 1;
      messages.push(`${entry.applicationNo || "A row"} is not an admitted scholar.`);
      continue;
    }
    if (row.registrationNo) {
      skipped += 1;
      messages.push(
        `${row.applicationNo}: the registration number is permanent and cannot be changed.`,
      );
      continue;
    }
    if (number.length < 8 || number.length > 20) {
      skipped += 1;
      messages.push(`${row.applicationNo}: registration number is not valid.`);
      continue;
    }
    if (taken.has(number.toLowerCase())) {
      skipped += 1;
      messages.push(`${row.applicationNo}: that registration number is already allotted.`);
      continue;
    }
    taken.add(number.toLowerCase());
    byNo.set(row.applicationNo, number);
  }
  if (byNo.size === 0) {
    return {
      ok: false as const,
      message: messages[0] ?? "Enter the registration number for each scholar.",
      saved: 0,
      skipped,
    };
  }
  const on = clientNowIso().slice(0, 10);
  const saved = await saveAdmission({
    cases: current.cases.map((row) =>
      byNo.has(row.applicationNo)
        ? { ...row, registrationNo: byNo.get(row.applicationNo) ?? "", registrationOn: on }
        : row,
    ),
    letter: current.letter,
  });
  if (!saved.ok) return { ...saved, saved: 0, skipped };
  await recordAudit({
    action: "registration:allot",
    subject: "admitted-scholars",
    detail: `${byNo.size} registration number(s): ${[...byNo.entries()]
      .map(([no, number]) => `${no} → ${number}`)
      .join("; ")}`,
  });
  return {
    ok: true as const,
    saved: byNo.size,
    skipped,
    message:
      skipped > 0
        ? `${byNo.size} registration numbers were recorded. ${skipped} rows were skipped.`
        : `${byNo.size} registration numbers were recorded.`,
  };
}

/** Records on the admission file that the provisional letter was issued from Letters. */
export async function recordProvisionalLetter(applicationId: string, issuedOn: string) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const current = memory ?? (await ensureAdmission());
  const row = current.cases.find((item) => item.applicationId === applicationId);
  if (!row)
    return {
      ok: false as const,
      message: "That candidate is not on the admission file.",
    };
  if (row.letterIssued && row.letterNo)
    return { ok: true as const, letterNo: row.letterNo };
  const letterNo = row.letterNo ?? nextLetterNo(current.cases);
  const saved = await saveAdmission({
    cases: current.cases.map((item) =>
      item.applicationId === applicationId
        ? { ...item, letterIssued: true, letterNo, letterIssuedOn: issuedOn }
        : item,
    ),
    letter: current.letter,
    entranceScores: current.entranceScores,
    progress: current.progress,
    archived: current.archived,
  });
  return saved.ok ? { ok: true as const, letterNo } : saved;
}

export function sanitizeMark(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed === "") return { value: "", error: null };
  if (!/^\d+$/.test(trimmed)) {
    return {
      value: null,
      error: `Enter a whole number from 0 to ${max}.`,
    };
  }
  const parsed = Number(trimmed);
  if (parsed > max) {
    return {
      value: null,
      error: `Marks cannot exceed ${max}.`,
    };
  }
  return { value: trimmed, error: null };
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

/**
 * Marks are kept in the marks list and on each candidate's record. Where the two differ, the
 * saved marks win, so the completion check, the merit list and the marks screen always agree.
 */
export function withEntranceScores(
  rows: readonly AdmissionCase[],
  scores: readonly EntranceScore[],
) {
  return rows.map((row) => {
    if (row.attendance !== "Present") return row;
    const score = scoreFor(scores, `app:${row.applicationId}`);
    if (!score) return row;
    const written = score.written ?? row.written;
    const interview = score.interview ?? row.interview;
    return written === row.written && interview === row.interview
      ? row
      : { ...row, written, interview };
  });
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
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const current = memory ?? (await ensureAdmission());
  if (!stepIsOpen(current.progress, "marks")) {
    return { ok: false as const, message: selectionFlowCopy.skipBlocked };
  }
  const scores = [...current.entranceScores];
  let cases = current.cases;
  for (const patch of patches) {
    // The written test and the interview are entered in two rounds, so each may be blank.
    const writtenCheck = sanitizeMark(patch.written, writtenMax);
    if (writtenCheck.value === null) {
      return { ok: false as const, message: `Written test: ${writtenCheck.error}` };
    }
    const interviewCheck = sanitizeMark(patch.interview, interviewMax);
    if (interviewCheck.value === null) {
      return { ok: false as const, message: `Interview: ${interviewCheck.error}` };
    }
    const written = patch.written.trim() === "" ? null : Number(patch.written);
    const interview = patch.interview.trim() === "" ? null : Number(patch.interview);
    if (interview !== null && written === null) {
      return {
        ok: false as const,
        message: "Enter the written test mark before the interview mark.",
      };
    }
    const nextScore: EntranceScore = { key: patch.key, written, interview };
    const index = scores.findIndex((item) => item.key === patch.key);
    if (index >= 0) scores[index] = nextScore;
    else scores.push(nextScore);
    if (patch.applicationId) {
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

/**
 * The research office's decision on the application fee of one or many applications, made on
 * the Applications page. An approved fee puts the application on the Selection list (scrutiny
 * step) and moves its status to "Under review"; a returned fee takes it off again.
 */
export async function decideApplicationFees(
  applications: readonly StoredApplication[],
  payment: Exclude<PaymentMark, "Pending">,
  comment = "",
) {
  const blocked = officeWriteBlock();
  if (blocked) return { ...blocked, changed: 0 };
  const current = memory ?? (await ensureAdmission());
  const phd = applications.filter((item) => item.kind === "phd");
  const merged = mergeApplications(current.cases, phd);
  const ids = new Set(phd.map((item) => item.id));
  const changedRows: AdmissionCase[] = [];
  const cases = merged.map((row) => {
    if (!ids.has(row.applicationId) || row.payment === payment) return row;
    // Once the file has moved past scrutiny it is not reopened from here.
    if (row.scrutiny || row.shortlisted || row.selected) return row;
    const next: AdmissionCase = { ...row, payment };
    changedRows.push(next);
    return next;
  });
  if (changedRows.length === 0) {
    return { ok: true as const, changed: 0 };
  }
  const saved = await saveAdmission({
    cases,
    letter: current.letter,
    entranceScores: current.entranceScores,
  });
  if (!saved.ok) return { ...saved, changed: 0 };
  for (const row of changedRows) {
    const application = phd.find((item) => item.id === row.applicationId);
    if (payment === "Approved" && application?.status === "Acknowledgement sent") {
      await updateApplicationStatus("phd", row.applicationId, "Under review");
    }
    await recordAudit({
      action: `payment:${payment}`,
      subject: `application-fee:${row.applicationId}`,
      detail: `${row.name} · application fee`,
    });
    if (row.email) {
      await pushNotice({
        role: "scholar",
        identifier: row.email,
        title: `Application fee ${payment === "Approved" ? "verified" : "returned"}`,
        detail:
          payment === "Approved"
            ? "The research office verified your application fee. Your application is now with the selection committee."
            : `The application fee receipt was returned${comment.trim() ? `: ${comment.trim()}` : ""}. Please contact the research office.`,
      });
    }
  }
  return { ok: true as const, changed: changedRows.length };
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
