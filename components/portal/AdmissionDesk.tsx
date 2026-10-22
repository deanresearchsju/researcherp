"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Lock } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import {
  AdmissionLetter,
  ApprovalSheet,
  AttendanceSheet,
  InterviewSheet,
  ProvisionalSheet,
} from "@/components/portal/AdmissionPrint";
import { ApplicationViewer } from "@/components/portal/ApplicationViewer";
import {
  DeskModal,
  FormDialog,
  GateBanner,
  PageTitle,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { EntranceMarksScreen } from "@/components/portal/EntranceMarksScreen";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { useClientReady } from "@/components/forms/ClientGate";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { applicationReviewCopy } from "@/data/application-review";
import {
  admissionChecklist,
  admissionLockCopy,
  archiveSessionOptions,
  defaultLetter,
  hallTicketDeanTitle,
  interviewMax,
  selectionSteps,
  writtenMax,
  type SelectionStepId,
} from "@/data/admission";
import { adminActionBlock, officeWriteBlock } from "@/lib/access";
import {
  admissionCompleted,
  admissionFileFrozen,
  approvalBodies,
  approvalState,
  provisionalListKey,
  applyVacancySelection,
  archiveSessionLabel,
  archiveYearOf,
  archivedKeys,
  attendanceOrder,
  clearSelectionProgress,
  closeAdmissionSession,
  completeSelectionProgress,
  currentAdmission,
  displayName,
  isLiveAdmissionCase,
  keepHiddenCases,
  mergeApplications,
  missingItems,
  nextLetterNo,
  provisionalOrder,
  rankable,
  releaseSeat,
  reportingMarks,
  sameDepartment,
  sameSubject,
  saveAdmission,
  scheduleIsReady,
  seatsFor,
  sessionIsSet,
  stepCompletionBlock,
  stepIsBlocked,
  stepStaysOpen,
  subscribeAdmission,
  totalMarks,
  verificationBlock,
  waitlistFor,
  waitlistOrder,
  withEntranceScores,
  type AdmissionCase,
  type AttendanceMark,
  type CheckMark,
  type EntranceSchedule,
  type ExamCampus,
  type LetterConfig,
  type ReportingMark,
  campusFor,
  hallTicketNumber,
  hallTicketSerial,
  assignInterviewPanels,
  emptyExpert,
  newPanelId,
  schoolNameFromLabel,
  registrationBlock,
  registrationNumberTaken,
  type ApprovalRecord,
  type InterviewExpert,
  type InterviewPanel,
} from "@/lib/admission";
import { researchRegister } from "@/data/research-register";
import { downloadHallTickets } from "@/lib/hall-ticket-pdf";
import { suggestRegistration } from "@/lib/registration-format";
import { mailSummary, sendMailEvent, type MailResult } from "@/lib/mail-client";
import { recordAudit } from "@/lib/audit";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { feeLedger } from "@/lib/fee-ledger";
import { compressImage, fileToDataUrl } from "@/lib/files";
import { filterMatches } from "@/lib/list-filter";
import {
  currentOffice,
  removeAllocation,
  sameId,
  saveAllocation,
  subscribeOffice,
} from "@/lib/office";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import {
  currentApplications,
  subscribeApplications,
  updateApplicationStatus,
  type StoredApplication,
} from "@/lib/records";
import { uniqueIssuedPassword } from "@/lib/register-access";
import { phdReceiptFromApplication } from "@/lib/scholar-progress";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { usePreviewSession } from "@/lib/use-preview-session";
import {
  createPortalUser,
  currentPortalUsers,
  subscribePortalUsers,
  updatePortalUser,
} from "@/lib/users";
import { cn } from "@/lib/utils";
import { vacancySchoolName, type Vacancy } from "@/lib/vacancies";
import { schools as schoolCatalogue } from "@/data/schools";

type Step = SelectionStepId;

type Sheet =
  | null
  | { kind: "attendance" }
  | { kind: "interview"; panelId?: string }
  | { kind: "approval" }
  | { kind: "provisional" }
  | { kind: "letters"; applicationIds: string[] };

type BulkAction = {
  label: string;
  variant?: "gold" | "outline" | "maroon";
  run: (chosen: AdmissionCase[]) => void;
};

const letterSchema = z.object({
  programme: z.string().min(1, "Enter the programme name.").max(120),
  sessionLabel: z.string().min(1, "Enter the letter heading.").max(160),
  refPrefix: z.string().min(1, "Enter the reference prefix.").max(80),
  issueDate: z.string().min(1, "Enter the letter date.").max(40),
  reportBy: z.string().min(1, "Enter the reporting date.").max(80),
  fullTimeFee: z.string().regex(/^\d+$/, "Enter the full-time fee in rupees."),
  partTimeFee: z.string().regex(/^\d+$/, "Enter the part-time fee in rupees."),
  accountName: z.string().min(1, "Enter the account name.").max(120),
  accountNumber: z.string().min(1, "Enter the account number.").max(40),
  bankName: z.string().min(1, "Enter the bank.").max(120),
  ifsc: z.string().min(1, "Enter the IFSC.").max(20),
  branch: z.string().min(1, "Enter the branch.").max(80),
  deanName: z.string().min(1, "Enter the signatory.").max(120),
  deanTitle: z.string().min(1, "Enter the designation.").max(160),
  phone: z.string().min(1, "Enter the phone number.").max(40),
  documents: z.string().min(1, "Enter the documents, one on each line."),
});

const letterFields = [
  ["programme", "Programme"],
  ["sessionLabel", "Letter heading"],
  ["refPrefix", "Reference prefix"],
  ["issueDate", "Letter date"],
  ["reportBy", "Report by"],
  ["fullTimeFee", "Full-time fee (₹)"],
  ["partTimeFee", "Part-time fee (₹)"],
  ["accountName", "Account name"],
  ["accountNumber", "Account number"],
  ["bankName", "Bank"],
  ["ifsc", "IFSC"],
  ["branch", "Branch"],
  ["deanName", "Signatory"],
  ["deanTitle", "Designation"],
  ["phone", "Phone"],
] as const;

function storedPhdForCase(
  row: AdmissionCase,
  live: StoredApplication[] | null | undefined,
  listed: StoredApplication[],
): StoredApplication {
  return (
    live?.find(
      (item) => item.id === row.applicationId || item.applicationNo === row.applicationNo,
    ) ??
    listed.find(
      (item) => item.id === row.applicationId || item.applicationNo === row.applicationNo,
    ) ?? {
      id: row.applicationId,
      kind: "phd",
      applicationNo: row.applicationNo,
      applicantName: row.name,
      email: row.email,
      dateOfBirth: "",
      studyMode: row.studyMode,
      status: row.selected ? "Selected" : "Under review",
      createdAt: "",
      payload: {
        fullName: row.name,
        email: row.email,
        department: row.department,
      },
    }
  );
}

/** Clears every later stage when an earlier stage of a file changes. */
function cleared(row: AdmissionCase, keepShortlist: boolean): AdmissionCase {
  const shortlisted = keepShortlist;
  const attendance: AttendanceMark = shortlisted ? row.attendance : "";
  const present = attendance === "Present";
  const selected =
    present && row.written !== null && row.interview !== null && row.selected;
  return {
    ...row,
    shortlisted,
    attendance,
    written: present ? row.written : null,
    interview: present ? row.interview : null,
    selected,
    meritRank: present ? row.meritRank : null,
    waitlistRank: present ? row.waitlistRank : null,
    examCampusId: shortlisted ? row.examCampusId : "",
    examRoom: shortlisted ? row.examRoom : "",
    hallTicketNo: shortlisted ? row.hallTicketNo : "",
    hallTicketOn: shortlisted ? row.hallTicketOn : "",
    guideName: selected ? row.guideName : "",
    guideIdentifier: selected ? row.guideIdentifier : "",
    verification: selected ? row.verification : "Pending",
  };
}

function letterRef(letter: LetterConfig, row: AdmissionCase) {
  return row.letterNo
    ? `${letter.refPrefix}/${String(row.letterNo).padStart(2, "0")}`
    : "—";
}

function documentCount(row: AdmissionCase) {
  const required = admissionChecklist.filter((item) => item.required);
  const received = required.filter((item) => row.checks[item.id] === "Received").length;
  return `${received}/${required.length}`;
}

function resultOf(row: AdmissionCase) {
  if (row.reporting) return { label: row.reporting, tone: "maroon" as const };
  if (row.verification === "Approved")
    return { label: "Admitted", tone: "gold" as const };
  if (row.selected) {
    return {
      label: row.fromWaitlist ? "Selected · from waiting list" : "Selected",
      tone: "gold" as const,
    };
  }
  if (row.waitlistRank !== null) {
    return { label: `Waiting list W${row.waitlistRank}`, tone: "purple" as const };
  }
  if (row.meritRank === null && rankable(row)) {
    return { label: "Below qualifying total", tone: "maroon" as const };
  }
  return { label: "Not selected", tone: "outline" as const };
}

export function AdmissionDesk({
  applications,
  vacancies,
}: {
  applications: StoredApplication[];
  vacancies: Vacancy[];
}) {
  const ready = useClientReady();
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const storedApplications = useSyncExternalStore(
    subscribeApplications,
    currentApplications,
    () => null,
  );
  const feeLoad = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const session = usePreviewSession();
  const canDownload = useCanMenuAction("export");
  const form = useForm<LetterConfig>({
    resolver: zodResolver(letterSchema) as Resolver<LetterConfig>,
    values: store?.letter ?? defaultLetter,
  });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [issued, setIssued] = useState<
    { name: string; identifier: string; password: string }[]
  >([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [finalStep, setFinalStep] = useState<"certificates" | "fees" | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [registrationDrafts, setRegistrationDrafts] = useState<Record<string, string>>(
    {},
  );
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingLetter, setEditingLetter] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<{
    session: string;
    year: string;
  } | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<EntranceSchedule | null>(null);
  const [qualifyingDraft, setQualifyingDraft] = useState<string | null>(null);
  const [approvalNames, setApprovalNames] = useState<{
    preparedBy: string;
    verifiedBy: string;
  } | null>(null);
  const [recordingApproval, setRecordingApproval] = useState(false);
  const [panelDialog, setPanelDialog] = useState<{ id: string | null } | null>(null);
  const [campusDialog, setCampusDialog] = useState<
    | null
    | { mode: "add" }
    | { mode: "edit"; campus: ExamCampus }
    | { mode: "assign"; ids: string[] }
  >(null);

  if (!ready || !store) {
    return <p className="text-sm text-muted-foreground">Loading the admission file…</p>;
  }

  const officeFile = store;
  const progress = officeFile.progress;
  // Reporting and Admission are open together; the office moves between them until the
  // admission session is closed.
  const step: Step = finalStep ?? progress.current;
  const currentStepInfo =
    selectionSteps.find((item) => item.id === progress.current) ?? selectionSteps[0];
  const stepIndex = selectionSteps.findIndex((item) => item.id === step);
  const stepInfo = selectionSteps[stepIndex] ?? selectionSteps[0];
  const isAdmin = session?.role === "admin";
  const writeBlocked = officeWriteBlock();
  const canWrite = !writeBlocked && !stepIsBlocked(progress, step);
  const archiveKeys = archivedKeys(officeFile.archived);
  const phdApplications = storedApplications
    ? storedApplications.filter((row) => row.kind === "phd")
    : applications;
  const cases = withEntranceScores(
    mergeApplications(officeFile.cases, phdApplications).filter(
      (row) => isLiveAdmissionCase(row, archiveKeys) && !row.sessionClosed,
    ),
    officeFile.entranceScores,
  );
  const sessionName = progress.entrance.session
    ? archiveSessionLabel(progress.entrance.session, archiveYearOf(progress.entrance))
    : "";
  const today = clientToday();
  const orderedAttendance = attendanceOrder(cases).map((row, index) => ({
    row,
    serial: index + 1,
  }));
  const orderedProvisional = provisionalOrder(cases).map((row, index) => ({
    row,
    serial: index + 1,
  }));

  function linkedScholar(row: AdmissionCase) {
    const accounts = (users?.users ?? []).filter((item) => item.role === "scholar");
    const match =
      accounts.find((item) => sameId(item.identifier, row.email)) ??
      accounts.find((item) => sameId(item.identifier, row.applicationNo)) ??
      accounts.find((item) => sameId(item.name, row.name));
    return match?.identifier ?? row.email;
  }

  async function commit(
    nextCases: AdmissionCase[],
    letter = officeFile.letter,
    nextProgress = progress,
    adminOnly = false,
    optimistic = false,
  ) {
    const blocked = adminOnly ? adminActionBlock() : officeWriteBlock();
    if (blocked) {
      setNotice(blocked.message);
      return false;
    }
    if (!adminOnly && stepIsBlocked(progress, step)) {
      setNotice("This step is complete and locked.");
      return false;
    }
    const saved = await saveAdmission({
      cases: keepHiddenCases(nextCases, officeFile.cases, archiveKeys),
      letter,
      progress: nextProgress,
      ...(optimistic ? { optimistic: { onFail: setNotice } } : {}),
    });
    if (!saved.ok) setNotice(saved.message);
    return saved.ok;
  }

  async function persistProgress(nextProgress: typeof progress, message: string) {
    const blocked =
      nextProgress.completed.length < progress.completed.length ||
      (progress.entranceReady && !nextProgress.entranceReady)
        ? adminActionBlock()
        : officeWriteBlock();
    if (blocked) {
      setNotice(blocked.message);
      return false;
    }
    const saved = await saveAdmission({
      cases: officeFile.cases,
      letter: officeFile.letter,
      progress: nextProgress,
    });
    if (!saved.ok) {
      setNotice(saved.message);
      return false;
    }
    setScheduleDraft(null);
    setSessionDraft(null);
    setSelectedIds([]);
    setQuery("");
    setDepartment("");
    setNotice(message);
    return true;
  }

  async function commitRow(id: string, patch: Partial<AdmissionCase>) {
    const current = cases.find((row) => row.applicationId === id);
    if (!current) return false;
    const onlyUnlock =
      Object.keys(patch).length === 1 &&
      Object.prototype.hasOwnProperty.call(patch, "correctionOpen");
    const registrationOnly =
      Object.keys(patch).length > 0 &&
      Object.keys(patch).every(
        (key) =>
          key === "registrationNo" ||
          key === "registrationOn" ||
          // Documents marked Missing are ticked Received once handed over.
          (key === "checks" && current.verification === "Approved"),
      );
    if (admissionFileFrozen(current) && !onlyUnlock && !registrationOnly) {
      setNotice(admissionLockCopy.blocked);
      return false;
    }
    let nextRow: AdmissionCase = { ...current, ...patch };
    const dropped =
      current.verification === "Approved" &&
      (nextRow.verification !== "Approved" || verificationBlock(nextRow) !== null);
    if (dropped) {
      nextRow = { ...nextRow, verification: "Pending" };
      const allocation = currentOffice()?.allocations.find((item) =>
        sameId(item.scholarIdentifier, linkedScholar(current)),
      );
      if (allocation) await removeAllocation(allocation);
    }
    const nextCases = cases.map((row) => (row.applicationId === id ? nextRow : row));
    const tickOnly = Object.keys(patch).every((key) => key === "checks") && !dropped;
    return commit(nextCases, officeFile.letter, progress, onlyUnlock, tickOnly);
  }

  async function persistCases(nextCases: AdmissionCase[], nextProgress = progress) {
    for (const before of cases) {
      const after = nextCases.find((item) => item.applicationId === before.applicationId);
      if (!after) continue;
      if (before.verification === "Approved" && after.verification !== "Approved") {
        const allocation = currentOffice()?.allocations.find((item) =>
          sameId(item.scholarIdentifier, linkedScholar(before)),
        );
        if (allocation) await removeAllocation(allocation);
      }
      if (
        after.verification === "Approved" &&
        (before.guideIdentifier !== after.guideIdentifier ||
          before.verification !== "Approved")
      ) {
        const allotted = await saveAllocation({
          scholarIdentifier: linkedScholar(after),
          scholarName: after.name,
          supervisorIdentifier: after.guideIdentifier || after.guideName,
          supervisorName: after.guideName,
        });
        if (!allotted.ok) setNotice(allotted.message);
      }
    }
    return commit(nextCases, officeFile.letter, nextProgress);
  }

  /** Applies a change to every chosen row in one save. */
  async function applyToRows(
    chosen: readonly AdmissionCase[],
    change: (row: AdmissionCase) => AdmissionCase | null,
    status?: (row: AdmissionCase) => string | null,
    message?: string,
  ) {
    const ids = new Set(chosen.map((row) => row.applicationId));
    let changed = 0;
    const next = cases.map((row) => {
      if (!ids.has(row.applicationId) || admissionFileFrozen(row)) return row;
      const updated = change(row);
      if (!updated) return row;
      changed += 1;
      return updated;
    });
    setBusy(true);
    const ok = await persistCases(next);
    setBusy(false);
    if (!ok) return 0;
    if (status) {
      for (const row of next) {
        if (!ids.has(row.applicationId)) continue;
        const value = status(row);
        if (value) void updateApplicationStatus("phd", row.applicationId, value);
      }
    }
    setSelectedIds([]);
    if (message) setNotice(`${message}: ${changed}.`);
    return changed;
  }

  async function issueSignIns(rows: readonly AdmissionCase[]) {
    const created: { name: string; identifier: string; password: string }[] = [];
    for (const row of rows) {
      const identifier = row.email.trim();
      if (!identifier) continue;
      const exists = users?.users.some(
        (user) =>
          user.role === "scholar" &&
          user.identifier.toLowerCase() === identifier.toLowerCase(),
      );
      if (exists) continue;
      const password = uniqueIssuedPassword();
      const saved = await createPortalUser(
        { role: "scholar", name: displayName(row), identifier, password, menus: null },
        users?.source ?? "browser",
      );
      if (saved.ok) created.push({ name: displayName(row), identifier, password });
    }
    if (created.length) {
      setIssued((current) => [...created, ...current]);
      const total: MailResult = { ok: true, sent: 0, failed: 0, configured: true };
      for (const item of created) {
        const result = await sendMailEvent({
          event: "credentials",
          role: "scholar",
          identifier: item.identifier,
          password: item.password,
        });
        total.sent += result.sent;
        total.failed += result.failed;
        total.configured = result.configured;
      }
      setNotice(
        `${created.length} sign-in(s) created.${mailSummary(total, "Sign-in details")}`,
      );
    }
  }

  /** Gives an admitted scholar a fresh first sign-in password (shown once below). */
  async function issueNewPassword(row: AdmissionCase) {
    const identifier = row.email.trim();
    if (!identifier) {
      setNotice("This candidate has no email address to sign in with.");
      return;
    }
    const password = uniqueIssuedPassword();
    const existing = users?.users.find(
      (user) =>
        user.role === "scholar" &&
        user.identifier.toLowerCase() === identifier.toLowerCase(),
    );
    setBusy(true);
    const saved = existing
      ? await updatePortalUser(
          existing,
          { name: existing.name, password, mustReset: true, menus: existing.menus },
          users?.source ?? "browser",
        )
      : await createPortalUser(
          { role: "scholar", name: displayName(row), identifier, password, menus: null },
          users?.source ?? "browser",
        );
    setBusy(false);
    if (!saved.ok) {
      setNotice("The new password could not be saved. Try again.");
      return;
    }
    setIssued((current) => [
      { name: displayName(row), identifier, password },
      ...current.filter((item) => item.identifier !== identifier),
    ]);
    const mailed = await sendMailEvent({
      event: "credentials",
      role: "scholar",
      identifier,
      password,
    });
    setNotice(
      `New first sign-in password issued for ${displayName(row)}.${mailSummary(mailed, "Sign-in details")}${mailed.sent > 0 ? "" : " Share it once."}`,
    );
  }

  async function approveVerification(chosen: readonly AdmissionCase[]) {
    const readyRows = chosen.filter(
      (row) => row.verification !== "Approved" && !verificationBlock(row),
    );
    const blocked = chosen.length - readyRows.length;
    if (readyRows.length === 0) {
      setNotice(
        chosen.length === 1
          ? (verificationBlock(chosen[0]) ?? "Already verified.")
          : "None of the chosen candidates is ready: check the guide and the checklist.",
      );
      return;
    }
    const changed = await applyToRows(
      readyRows,
      (row) => ({ ...row, verification: "Approved", checklistSubmittedOn: today }),
      () => "Admitted",
      "Checklist submitted and ERP access opened",
    );
    if (changed === 0) return;
    await issueSignIns(readyRows);
    if (blocked) {
      setNotice(
        `${readyRows.length} verified. ${blocked} still need the guide or a checklist item.`,
      );
    }
  }

  async function issueLetters(chosen: readonly AdmissionCase[]) {
    const fresh = chosen.filter((row) => !row.letterIssued || !row.letterNo);
    // New letters wait for the approval of the list; reprints of issued letters do not.
    if (fresh.length > 0 && approvalState(progress, cases) !== "approved") {
      setNotice(
        "Get the list approved by the Research Advisory Board or the Vice Chancellor and record the approval before issuing letters.",
      );
      return;
    }
    let serial = nextLetterNo(cases);
    const numbers = new Map(fresh.map((row) => [row.applicationId, serial++]));
    if (fresh.length > 0) {
      const changed = await applyToRows(
        fresh,
        (row) => ({
          ...row,
          letterIssued: true,
          letterNo: row.letterNo ?? numbers.get(row.applicationId) ?? null,
          letterIssuedOn: row.letterIssuedOn || today,
        }),
        undefined,
        "Provisional letters issued",
      );
      if (changed === 0) return;
      const mailed = await sendMailEvent({
        event: "selection-letter",
        applicationNos: fresh.map((row) => row.applicationNo),
      });
      setNotice(
        `Provisional letters issued: ${changed}.${mailSummary(mailed, "Letter notice")}`,
      );
    }
    setSheet({ kind: "letters", applicationIds: chosen.map((row) => row.applicationId) });
  }

  /** Saves the campus list without touching the unsaved schedule fields. */
  async function saveCampuses(campuses: ExamCampus[], message: string) {
    return saveEntrancePatch({ campuses }, message);
  }

  /** Saves part of the schedule (campuses, signatures) without the unsaved date fields. */
  async function saveEntrancePatch(patch: Partial<EntranceSchedule>, message: string) {
    const blocked = officeWriteBlock();
    if (blocked) {
      setNotice(blocked.message);
      return false;
    }
    setBusy(true);
    const saved = await saveAdmission({
      cases: officeFile.cases,
      letter: officeFile.letter,
      progress: { ...progress, entrance: { ...progress.entrance, ...patch } },
    });
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return false;
    }
    setScheduleDraft((draft) => (draft ? { ...draft, ...patch } : draft));
    setNotice(message);
    return true;
  }

  /** The Dean's name is shared by the hall tickets and the provisional letters. */
  async function saveDeanName(name: string) {
    if (name.length < 3) {
      setNotice("Enter the Dean's full name.");
      return;
    }
    const blocked = officeWriteBlock();
    if (blocked) {
      setNotice(blocked.message);
      return;
    }
    setBusy(true);
    const saved = await saveAdmission({
      cases: officeFile.cases,
      letter: { ...officeFile.letter, deanName: name },
      progress,
    });
    setBusy(false);
    setNotice(
      saved.ok
        ? `Dean's name saved as ${name}. Hall tickets and letters now use it.`
        : saved.message,
    );
  }

  async function generateHallTickets() {
    const shortlisted = attendanceOrder(cases);
    // Tickets numbered in an older format are renumbered as PHDyymm001.
    const waiting = shortlisted.filter(
      (row) => hallTicketSerial(progress.entrance, row.hallTicketNo) === null,
    );
    const noCampus = waiting.filter((row) => !row.examCampusId);
    const ready = waiting.filter((row) => row.examCampusId);
    if (ready.length === 0) {
      setNotice(
        noCampus.length > 0
          ? `Assign a campus to ${noCampus.length} candidate(s) before generating hall tickets.`
          : "Every shortlisted candidate already has a hall ticket.",
      );
      return;
    }
    let serial =
      shortlisted.reduce(
        (max, row) =>
          Math.max(max, hallTicketSerial(progress.entrance, row.hallTicketNo) ?? 0),
        0,
      ) + 1;
    const numbers = new Map(
      ready.map((row) => [
        row.applicationId,
        hallTicketNumber(progress.entrance, serial++),
      ]),
    );
    const changed = await applyToRows(
      ready,
      (row) => ({
        ...row,
        hallTicketNo: numbers.get(row.applicationId) ?? "",
        hallTicketOn: today,
      }),
      undefined,
      "Hall tickets generated",
    );
    if (changed > 0) {
      await recordAudit({
        action: "admission:hall-tickets",
        subject: "entrance",
        detail: `${changed} hall ticket(s) for ${sessionName}`,
      });
      const mailed = await sendMailEvent({
        event: "hall-ticket",
        applicationNos: ready.map((row) => row.applicationNo),
      });
      setNotice(
        `${changed} hall ticket(s) generated. Candidates can download them from Track application.${noCampus.length > 0 ? ` ${noCampus.length} still need a campus.` : ""}${mailSummary(mailed, "Hall ticket notice")}`,
      );
    }
  }

  async function downloadTickets(rows: readonly AdmissionCase[]) {
    setBusy(true);
    try {
      await downloadHallTickets(
        rows
          .filter((row) => row.hallTicketNo)
          .map((row) => ({
            row,
            receipt: phdReceiptFromApplication(
              storedPhdForCase(row, storedApplications, applications),
            ),
            schedule: progress.entrance,
            letter: officeFile.letter,
          })),
      );
    } catch {
      setNotice("The hall tickets could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function offerSeat(row: AdmissionCase) {
    const ok = await commitRow(row.applicationId, {
      selected: true,
      fromWaitlist: true,
      waitlistRank: null,
      letterIssued: false,
      letterNo: null,
      letterIssuedOn: "",
    });
    if (!ok) return;
    void updateApplicationStatus("phd", row.applicationId, "Selected");
    await recordAudit({
      action: "admission:waitlist-offer",
      subject: `application:${row.applicationId}`,
      detail: `${displayName(row)} · ${row.department} · seat offered from the waiting list`,
    });
    setNotice(
      `${displayName(row)} is selected from the waiting list. Allot the guide and issue the letter.`,
    );
  }

  async function releaseCandidate(
    row: AdmissionCase,
    reason: Exclude<ReportingMark, "">,
    note: string,
    offerNext: boolean,
  ) {
    if (admissionFileFrozen(row)) {
      setNotice(admissionLockCopy.blocked);
      return;
    }
    const result = releaseSeat(cases, row.applicationId, reason, note, today, offerNext);
    setBusy(true);
    const ok = await persistCases(result.cases);
    setBusy(false);
    if (!ok) return;
    void updateApplicationStatus("phd", row.applicationId, "Not reported");
    await recordAudit({
      action: "admission:seat-released",
      subject: `application:${row.applicationId}`,
      detail: `${displayName(row)} · ${reason}${note ? ` · ${note}` : ""}`,
    });
    if (result.promoted) {
      void updateApplicationStatus("phd", result.promoted.applicationId, "Selected");
      await recordAudit({
        action: "admission:waitlist-offer",
        subject: `application:${result.promoted.applicationId}`,
        detail: `${displayName(result.promoted)} · seat released by ${displayName(row)}`,
      });
    }
    setReleasingId(null);
    setNotice(
      result.promoted
        ? `${displayName(row)}: ${reason}. The seat is offered to ${displayName(result.promoted)} (W${result.promoted.waitlistRank}). Issue the provisional letter.`
        : `${displayName(row)}: ${reason}. The seat is released.`,
    );
  }

  /* ---------- printed sheets ---------- */

  if (sheet) {
    const back = (
      <Button type="button" variant="outline" onClick={() => setSheet(null)}>
        Back to selection
      </Button>
    );
    if (sheet.kind === "attendance") {
      return (
        <div>
          <div className="no-print mb-4 flex gap-2">
            {back}
            <Button type="button" onClick={() => window.print()}>
              Print attendance sheets
            </Button>
          </div>
          {[...progress.entrance.campuses, null].map((campus) => {
            const rows = orderedAttendance
              .filter((item) =>
                campus
                  ? item.row.examCampusId === campus.id
                  : !campusFor(progress.entrance, item.row.examCampusId),
              )
              .sort((a, b) =>
                (a.row.hallTicketNo || "~").localeCompare(b.row.hallTicketNo || "~"),
              )
              .map((item, index) => ({ row: item.row, serial: index + 1 }));
            if (rows.length === 0) return null;
            return (
              <div key={campus?.id ?? "unassigned"} style={{ breakAfter: "page" }}>
                <AttendanceSheet
                  rows={rows}
                  schedule={progress.entrance}
                  campus={campus}
                  photos={Object.fromEntries(
                    rows.map((item) => [
                      item.row.applicationId,
                      phdReceiptFromApplication(
                        storedPhdForCase(item.row, storedApplications, applications),
                      ).photo,
                    ]),
                  )}
                />
              </div>
            );
          })}
        </div>
      );
    }
    if (sheet.kind === "interview") {
      const present = cases.filter(
        (row) => row.shortlisted && row.attendance === "Present",
      );
      const groups = assignInterviewPanels(
        progress.entrance.panels,
        present,
        schoolOfSubject,
      ).filter(
        (item) =>
          item.rows.length > 0 && (!sheet.panelId || item.panel?.id === sheet.panelId),
      );
      return (
        <div>
          <div className="no-print mb-4 flex gap-2">
            {back}
            <Button type="button" onClick={() => window.print()}>
              Print interview sheet{groups.length === 1 ? "" : "s"}
            </Button>
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No candidate is on this panel yet.
            </p>
          ) : null}
          {groups.map((group) => (
            <div key={group.panel?.id ?? "unassigned"} style={{ breakAfter: "page" }}>
              <InterviewSheet
                rows={group.rows}
                schedule={progress.entrance}
                panel={group.panel}
              />
            </div>
          ))}
        </div>
      );
    }
    if (sheet.kind === "approval") {
      return (
        <div>
          <div className="no-print mb-4 flex gap-2">
            {back}
            <Button type="button" onClick={() => window.print()}>
              Print approval sheet
            </Button>
          </div>
          <ApprovalSheet
            rows={orderedProvisional}
            waiting={waitlistOrder(cases)}
            sessionLabel={sessionName}
            preparedBy={progress.approval.preparedBy}
            verifiedBy={progress.approval.verifiedBy}
            deanName={officeFile.letter.deanName}
            deanTitle={officeFile.letter.deanTitle}
          />
        </div>
      );
    }
    if (sheet.kind === "provisional") {
      return (
        <div>
          <div className="no-print mb-4 flex gap-2">
            {back}
            <Button type="button" onClick={() => window.print()}>
              Print provisional list
            </Button>
          </div>
          <ProvisionalSheet
            rows={orderedProvisional}
            waiting={waitlistOrder(cases)}
            sessionLabel={sessionName}
          />
        </div>
      );
    }
    const matches = orderedProvisional.filter((item) =>
      sheet.applicationIds.includes(item.row.applicationId),
    );
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          {back}
          <Button type="button" onClick={() => window.print()}>
            Print {matches.length} letter{matches.length === 1 ? "" : "s"}
          </Button>
        </div>
        {matches.map((match) => (
          <div key={match.row.applicationId} style={{ breakAfter: "page" }}>
            <AdmissionLetter
              row={match.row}
              serial={match.row.letterNo ?? match.serial}
              letter={officeFile.letter}
            />
          </div>
        ))}
      </div>
    );
  }

  /* ---------- rows of the open step ---------- */

  /** The school a subject belongs to: from the vacancy list first, then the school catalogue. */
  function schoolOfSubject(subject: string) {
    const vacancy = vacancies.find((item) => sameSubject(item.department, subject));
    return (vacancy ? vacancySchoolName(vacancy) : "") || schoolNameFromLabel(subject);
  }

  const attendancePresent = cases.filter(
    (row) => row.shortlisted && row.attendance === "Present",
  );

  const stepRows: AdmissionCase[] = (() => {
    switch (step) {
      case "applications":
        // Applications whose fee the office approved on the Applications page.
        return cases.filter(
          (row) =>
            (!admissionCompleted(row) || row.correctionOpen) &&
            (row.payment === "Approved" ||
              Boolean(row.scrutiny) ||
              row.shortlisted ||
              row.selected),
        );
      case "shortlist":
        return cases.filter(
          (row) => (row.scrutiny === "Eligible" || row.shortlisted) && !row.reporting,
        );
      case "entrance":
        return cases.filter((row) => row.shortlisted);
      case "marks":
        return cases.filter((row) => row.shortlisted && row.attendance === "Present");
      case "selection":
        return cases
          .filter(rankable)
          .sort(
            (a, b) =>
              a.department.localeCompare(b.department) ||
              (a.meritRank ?? 9999) - (b.meritRank ?? 9999),
          );
      case "provisional":
      case "letter":
        return orderedProvisional.map((item) => item.row);
      case "certificates":
        return cases.filter((row) => row.selected || row.reporting);
      case "fees":
        return cases.filter((row) => row.verification === "Approved");
    }
  })();
  const departments = [...new Set(stepRows.map((row) => row.department))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = stepRows.filter(
    (row) =>
      textMatches(query, [
        row.name,
        row.applicationNo,
        row.email,
        row.department,
        row.guideName,
      ]) && filterMatches(department, row.department),
  );
  const completionBlock = stepCompletionBlock(step, cases, progress);

  function picked(rows: readonly AdmissionCase[]) {
    return rows.filter(
      (row) => selectedIds.includes(row.applicationId) && !admissionFileFrozen(row),
    );
  }

  function pickCell(row: AdmissionCase) {
    return (
      <td className="w-10 px-3 py-2">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={selectedIds.includes(row.applicationId)}
          disabled={admissionFileFrozen(row)}
          aria-label={`Select ${row.applicationNo}`}
          onChange={() =>
            setSelectedIds((current) =>
              current.includes(row.applicationId)
                ? current.filter((id) => id !== row.applicationId)
                : [...current, row.applicationId],
            )
          }
        />
      </td>
    );
  }

  function bulkBar(rows: readonly AdmissionCase[], actions: readonly BulkAction[]) {
    if (!canWrite || actions.length === 0) return null;
    const ids = rows
      .filter((row) => !admissionFileFrozen(row))
      .map((row) => row.applicationId);
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    const chosen = picked(rows);
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={ids.length === 0}
          onClick={() => setSelectedIds(allOn ? [] : ids)}
        >
          {allOn ? applicationReviewCopy.clearSelection : applicationReviewCopy.selectAll}
        </Button>
        <span className="text-sm text-muted-foreground">{chosen.length} chosen</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              size="sm"
              variant={action.variant ?? "gold"}
              disabled={busy || chosen.length === 0}
              onClick={() => action.run(chosen)}
            >
              {action.label}
            </Button>
          ))}
        </span>
      </div>
    );
  }

  function viewButton(row: AdmissionCase) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-readonly-allow
        onClick={() => setViewingId(row.applicationId)}
      >
        {applicationReviewCopy.view}
      </Button>
    );
  }

  function guideSelect(row: AdmissionCase) {
    const choices = vacancies.filter((item) =>
      sameSubject(row.department, item.department),
    );
    const guideChoices = choices.length > 0 ? choices : vacancies;
    return (
      <NativeSelect
        value={
          guideChoices.find((item) => item.supervisorName === row.guideName)?.id ?? ""
        }
        disabled={admissionFileFrozen(row) || !canWrite || busy}
        onChange={(event) => {
          const vacancy = guideChoices.find((item) => item.id === event.target.value);
          if (!vacancy) {
            void commitRow(row.applicationId, { guideName: "", guideIdentifier: "" });
            return;
          }
          const used = cases.filter(
            (item) =>
              item.applicationId !== row.applicationId &&
              item.selected &&
              item.guideName === vacancy.supervisorName,
          ).length;
          if (used >= vacancy.vacancyCount) {
            setNotice(`${vacancy.supervisorName} has no vacancy left.`);
            return;
          }
          const account = users?.users.find(
            (item) =>
              item.role === "supervisor" &&
              item.name.toLowerCase() === vacancy.supervisorName.toLowerCase(),
          );
          void commitRow(row.applicationId, {
            guideName: vacancy.supervisorName,
            guideIdentifier: account?.identifier ?? vacancy.supervisorName,
          });
        }}
        aria-label={`Guide for ${row.name}`}
      >
        <option value="">Choose a guide</option>
        {guideChoices.map((item) => {
          const used = cases.filter(
            (other) => other.selected && other.guideName === item.supervisorName,
          ).length;
          return (
            <option key={item.id} value={item.id}>
              {item.supervisorName} · {item.department} ·{" "}
              {Math.max(item.vacancyCount - used, 0)} of {item.vacancyCount} free
            </option>
          );
        })}
      </NativeSelect>
    );
  }

  /* ---------- per-step figures and export ---------- */

  const count = (test: (row: AdmissionCase) => boolean) => stepRows.filter(test).length;
  const figures: { label: string; value: number | string }[] = (() => {
    switch (step) {
      case "applications":
        return [
          { label: "Applications", value: stepRows.length },
          { label: "Fee verified", value: count((row) => row.payment === "Approved") },
          { label: "Eligible", value: count((row) => row.scrutiny === "Eligible") },
          {
            label: "Not eligible",
            value: count((row) => row.scrutiny === "Not eligible"),
          },
          { label: "Pending", value: count((row) => !row.scrutiny) },
        ];
      case "shortlist":
        return [
          { label: "Eligible", value: stepRows.length },
          { label: "Shortlisted", value: count((row) => row.shortlisted) },
          {
            label: "No vacancy in subject",
            value: count((row) => seatsFor(row.department, vacancies) === 0),
          },
        ];
      case "entrance":
        return [
          { label: "Shortlisted", value: stepRows.length },
          { label: "Present", value: count((row) => row.attendance === "Present") },
          { label: "Absent", value: count((row) => row.attendance === "Absent") },
          { label: "Not marked", value: count((row) => !row.attendance) },
        ];
      case "marks":
        return [
          { label: "Present", value: stepRows.length },
          { label: "Written test entered", value: count((row) => row.written !== null) },
          { label: "Interview entered", value: count((row) => row.interview !== null) },
          { label: "Total ready", value: count((row) => totalMarks(row) !== null) },
        ];
      case "selection":
        return [
          { label: "Ranked", value: count((row) => row.meritRank !== null) },
          { label: "Selected", value: count((row) => row.selected) },
          { label: "Waiting list", value: count((row) => row.waitlistRank !== null) },
          {
            label: "Seats",
            value: departments.reduce((sum, item) => sum + seatsFor(item, vacancies), 0),
          },
        ];
      case "provisional":
        return [
          { label: "Selected", value: stepRows.length },
          { label: "Guide allotted", value: count((row) => Boolean(row.guideName)) },
          { label: "Waiting list", value: waitlistOrder(cases).length },
        ];
      case "letter":
        return [
          { label: "Selected", value: stepRows.length },
          { label: "Letters issued", value: count((row) => row.letterIssued) },
          { label: "Not issued", value: count((row) => !row.letterIssued) },
        ];
      case "certificates":
        return [
          { label: "Selected", value: count((row) => row.selected) },
          { label: "Verified", value: count((row) => row.verification === "Approved") },
          { label: "Not reported", value: count((row) => Boolean(row.reporting)) },
          {
            label: "From waiting list",
            value: count((row) => row.fromWaitlist && row.selected),
          },
          { label: "Still waiting", value: waitlistOrder(cases).length },
        ];
      case "fees":
        return [{ label: "Admitted", value: stepRows.length }];
    }
  })();

  const exportHeaders = [
    "Application No.",
    "Name",
    "Subject",
    "Mode",
    "Application fee",
    "Scrutiny",
    "Shortlisted",
    "Attendance",
    "Written",
    "Interview",
    "Total",
    "Merit rank",
    "Result",
    "Guide",
    "Letter",
    "Documents",
  ];
  const exportRows = visible.map((row) => [
    row.applicationNo,
    displayName(row),
    row.department,
    row.studyMode,
    row.payment,
    row.scrutiny || "Pending",
    row.shortlisted ? "Yes" : "No",
    row.attendance || "—",
    row.written === null ? "" : String(row.written),
    row.interview === null ? "" : String(row.interview),
    totalMarks(row) === null ? "" : String(totalMarks(row)),
    row.meritRank === null ? "" : String(row.meritRank),
    resultOf(row).label,
    row.guideName,
    row.letterIssued ? letterRef(officeFile.letter, row) : "",
    row.verification,
  ]);

  /* ---------- step bodies ---------- */

  function scrutinyBody() {
    const year = Number(today.slice(0, 4));
    const yearOptions = [year - 1, year, year + 1].map(String);
    const draft = sessionDraft ?? {
      session: progress.entrance.session,
      year: progress.entrance.monthYear ? archiveYearOf(progress.entrance) : "",
    };
    return (
      <>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <label className="grid min-w-[10rem] gap-1 text-sm">
            <span className="font-semibold text-primary">Admission session</span>
            <NativeSelect
              value={draft.session}
              disabled={!canWrite}
              onChange={(event) =>
                setSessionDraft({ ...draft, session: event.target.value })
              }
              aria-label="Admission session"
            >
              <option value="">Select</option>
              {archiveSessionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid min-w-[8rem] gap-1 text-sm">
            <span className="font-semibold text-primary">Year</span>
            <NativeSelect
              value={draft.year}
              disabled={!canWrite}
              onChange={(event) =>
                setSessionDraft({ ...draft, year: event.target.value })
              }
              aria-label="Admission year"
            >
              <option value="">Select</option>
              {yearOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !draft.session || !draft.year || sessionDraft === null}
              onClick={() =>
                void persistProgress(
                  {
                    ...progress,
                    entrance: {
                      ...progress.entrance,
                      session: draft.session,
                      monthYear: `${draft.year}-${draft.session === "January" ? "01" : "07"}`,
                    },
                  },
                  `Admission session set to ${draft.session} ${draft.year}.`,
                )
              }
            >
              Save session
            </Button>
          ) : null}
          {sessionIsSet(progress.entrance) ? (
            <Badge variant="gold">{sessionName}</Badge>
          ) : (
            <Badge variant="maroon">Session not set</Badge>
          )}
        </div>
        {bulkBar(visible, [
          {
            label: "Mark eligible",
            run: (chosen) => {
              const paid = chosen.filter((row) => row.payment === "Approved");
              const unpaid = chosen.length - paid.length;
              void applyToRows(
                paid,
                (row) => ({ ...row, scrutiny: "Eligible", scrutinyNote: "" }),
                () => "Under review",
                "Marked eligible",
              ).then(() => {
                if (unpaid > 0) {
                  setNotice(
                    `${paid.length} marked eligible. ${unpaid} skipped: verify the application fee first.`,
                  );
                }
              });
            },
          },
          {
            label: "Mark not eligible",
            variant: "maroon",
            run: (chosen) => setRejecting(chosen.map((row) => row.applicationId)),
          },
        ])}
        <Rows
          rows={visible}
          empty="No application matches."
          headers={[
            canWrite ? "" : null,
            "Application No.",
            "Candidate",
            "Subject",
            "Mode",
            "Application fee",
            "Scrutiny",
            "",
          ]}
          render={(row) => (
            <>
              {canWrite ? pickCell(row) : null}
              <td className="px-3 py-2 font-mono text-xs">{row.applicationNo}</td>
              <td className="px-3 py-2">
                <p className="font-medium text-primary">{displayName(row)}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </td>
              <td className="px-3 py-2">{row.department}</td>
              <td className="px-3 py-2">{row.studyMode}</td>
              <td className="px-3 py-2">
                <Badge
                  variant={
                    row.payment === "Approved"
                      ? "gold"
                      : row.payment === "Returned"
                        ? "maroon"
                        : "outline"
                  }
                >
                  {row.payment === "Approved" ? "Verified" : row.payment}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant={
                    row.scrutiny === "Eligible"
                      ? "gold"
                      : row.scrutiny === "Not eligible"
                        ? "maroon"
                        : "outline"
                  }
                >
                  {row.scrutiny || "Pending"}
                </Badge>
                {row.scrutinyNote ? (
                  <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">
                    {row.scrutinyNote}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right">{viewButton(row)}</td>
            </>
          )}
        />
      </>
    );
  }

  function shortlistBody() {
    const subjects = [...new Set(vacancies.map((item) => item.department))].sort((a, b) =>
      a.localeCompare(b),
    );
    return (
      <>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="gold"
              disabled={busy}
              onClick={() =>
                void applyToRows(
                  stepRows.filter(
                    (row) => !row.shortlisted && seatsFor(row.department, vacancies) > 0,
                  ),
                  (row) => cleared({ ...row, shortlisted: true }, true),
                  () => "Shortlisted",
                  "Shortlisted",
                )
              }
            >
              Shortlist all eligible with a vacancy
            </Button>
          </div>
        ) : null}
        {bulkBar(visible, [
          {
            label: "Shortlist",
            run: (chosen) => {
              const open = chosen.filter(
                (row) => seatsFor(row.department, vacancies) > 0,
              );
              void applyToRows(
                open,
                (row) => cleared({ ...row, shortlisted: true }, true),
                () => "Shortlisted",
                "Shortlisted",
              );
            },
          },
          {
            label: "Remove from shortlist",
            variant: "outline",
            run: (chosen) =>
              void applyToRows(
                chosen,
                (row) => cleared({ ...row, shortlisted: false }, false),
                () => "Under review",
                "Removed from the shortlist",
              ),
          },
        ])}
        <Rows
          rows={visible}
          empty="No eligible candidate matches."
          headers={[
            canWrite ? "" : null,
            "Application No.",
            "Candidate",
            "Subject",
            "Seats",
            "Status",
            "",
          ]}
          render={(row) => {
            const seats = seatsFor(row.department, vacancies);
            return (
              <>
                {canWrite ? pickCell(row) : null}
                <td className="px-3 py-2 font-mono text-xs">{row.applicationNo}</td>
                <td className="px-3 py-2 font-medium text-primary">{displayName(row)}</td>
                <td className="px-3 py-2">
                  <NativeSelect
                    value={row.department}
                    disabled={admissionFileFrozen(row) || !canWrite || busy}
                    onChange={(event) =>
                      void commitRow(
                        row.applicationId,
                        cleared(
                          { ...row, department: event.target.value, shortlisted: false },
                          false,
                        ),
                      )
                    }
                    aria-label={`Subject for ${row.name}`}
                  >
                    {subjects.includes(row.department) ? null : (
                      <option value={row.department}>{row.department}</option>
                    )}
                    {subjects.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-3 py-2">{seats}</td>
                <td className="px-3 py-2">
                  {row.shortlisted ? (
                    <Badge variant="gold">Shortlisted</Badge>
                  ) : seats === 0 ? (
                    <Badge variant="maroon">No vacancy</Badge>
                  ) : (
                    <Badge variant="outline">Not shortlisted</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{viewButton(row)}</td>
              </>
            );
          }}
        />
      </>
    );
  }

  function entranceBody() {
    const schedule = scheduleDraft ?? progress.entrance;
    const locked = progress.entranceReady || !canWrite;
    const year = Number(today.slice(0, 4));
    const yearOptions = [year - 1, year, year + 1].map(String);
    const draftYear = schedule.monthYear.slice(0, 4);
    const monthFor = (session: string) => (session === "January" ? "01" : "07");
    const missing = [
      !schedule.session && "session",
      !draftYear && "year",
      !schedule.date && "date",
      !/^\d{1,2}:\d{2}$/.test(schedule.examTime) && "test time",
      schedule.campuses.length === 0 && "a campus",
    ].filter(Boolean);
    const ticketed = visible.filter((row) => row.hallTicketNo);
    const chosenTicketed = ticketed.filter((row) =>
      selectedIds.includes(row.applicationId),
    );
    const pendingTickets = stepRows.filter(
      (row) => hallTicketSerial(progress.entrance, row.hallTicketNo) === null,
    );
    const identityOf = (row: AdmissionCase) => {
      const receipt = phdReceiptFromApplication(
        storedPhdForCase(row, storedApplications, applications),
      );
      return { photo: Boolean(receipt.photo), signature: Boolean(receipt.signature) };
    };
    return (
      <>
        <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-primary">Examination schedule</h3>
            {progress.entranceReady ? (
              <Badge variant="gold">Saved · {sessionName}</Badge>
            ) : (
              <Badge variant="maroon">Not saved</Badge>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">Session</span>
              <NativeSelect
                value={schedule.session}
                disabled={locked}
                onChange={(event) =>
                  setScheduleDraft({
                    ...schedule,
                    session: event.target.value,
                    monthYear: draftYear
                      ? `${draftYear}-${monthFor(event.target.value)}`
                      : "",
                  })
                }
                aria-label="Session"
              >
                <option value="">Select</option>
                {archiveSessionOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">Year</span>
              <NativeSelect
                value={draftYear}
                disabled={locked}
                onChange={(event) =>
                  setScheduleDraft({
                    ...schedule,
                    monthYear: event.target.value
                      ? `${event.target.value}-${monthFor(schedule.session)}`
                      : "",
                  })
                }
                aria-label="Year"
              >
                <option value="">Select</option>
                {yearOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">Date of entrance test</span>
              <Input
                type="date"
                value={schedule.date}
                disabled={locked}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, date: event.target.value })
                }
                aria-label="Date of entrance test"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">Reporting time</span>
              <Input
                type="time"
                value={schedule.reportingTime}
                disabled={locked}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, reportingTime: event.target.value })
                }
                aria-label="Reporting time"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">Test begins</span>
              <Input
                type="time"
                value={schedule.examTime}
                disabled={locked}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, examTime: event.target.value })
                }
                aria-label="Test begins"
              />
            </label>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">Examination centres</p>
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCampusDialog({ mode: "add" })}
                >
                  Add campus
                </Button>
              ) : null}
            </div>
            {schedule.campuses.length === 0 ? (
              <p className="text-sm text-secondary">Add at least one campus.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {schedule.campuses.map((campus) => {
                  const assigned = cases.filter(
                    (row) => row.shortlisted && row.examCampusId === campus.id,
                  ).length;
                  return (
                    <li
                      key={campus.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{campus.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campus.address || "Address not set"}
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {assigned} candidate(s)
                        </p>
                      </div>
                      {canWrite ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setCampusDialog({ mode: "edit", campus })}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={assigned > 0 || busy}
                            onClick={() =>
                              void saveCampuses(
                                schedule.campuses.filter((item) => item.id !== campus.id),
                                `${campus.name} removed.`,
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary">
              Signatures printed on the hall ticket
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SignatureSlot
                title="Exam Superintendent"
                name={progress.entrance.superintendentName}
                nameEditable
                image={progress.entrance.superintendentSignature}
                disabled={!canWrite || busy}
                onSave={(patch) =>
                  void saveEntrancePatch(
                    {
                      ...(patch.name !== undefined
                        ? { superintendentName: patch.name }
                        : {}),
                      ...(patch.image !== undefined
                        ? { superintendentSignature: patch.image }
                        : {}),
                    },
                    "Exam Superintendent's signature saved.",
                  )
                }
                onError={setNotice}
              />
              <SignatureSlot
                title={hallTicketDeanTitle}
                name={officeFile.letter.deanName}
                nameEditable
                image={progress.entrance.deanSignature}
                disabled={!canWrite || busy}
                onSave={(patch) => {
                  if (patch.name !== undefined) {
                    void saveDeanName(patch.name);
                    return;
                  }
                  void saveEntrancePatch(
                    patch.image !== undefined ? { deanSignature: patch.image } : {},
                    "Dean's signature saved.",
                  );
                }}
                onError={setNotice}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!progress.entranceReady && canWrite ? (
              <>
                <Button
                  type="button"
                  disabled={busy || !scheduleIsReady(schedule)}
                  onClick={() =>
                    void persistProgress(
                      { ...progress, entrance: { ...schedule }, entranceReady: true },
                      "Examination schedule saved. Assign campuses and generate hall tickets.",
                    )
                  }
                >
                  Save schedule
                </Button>
                {missing.length > 0 ? (
                  <span className="text-sm text-secondary">
                    Set the {missing.join(", ")}.
                  </span>
                ) : null}
              </>
            ) : null}
            {progress.entranceReady && isAdmin ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void persistProgress(
                    { ...progress, entranceReady: false },
                    "The schedule can be corrected. Save it again when done.",
                  )
                }
              >
                Correct schedule
              </Button>
            ) : null}
          </div>
        </div>

        {progress.entranceReady ? (
          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <Button
                type="button"
                variant="gold"
                disabled={busy || pendingTickets.length === 0}
                onClick={() => void generateHallTickets()}
              >
                Generate hall tickets
                {pendingTickets.length > 0 ? ` (${pendingTickets.length})` : ""}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy || ticketed.length === 0}
              data-readonly-allow
              onClick={() =>
                void downloadTickets(
                  chosenTicketed.length > 0 ? chosenTicketed : ticketed,
                )
              }
            >
              Download hall tickets
              {chosenTicketed.length > 0
                ? ` (${chosenTicketed.length} chosen)`
                : ticketed.length > 0
                  ? ` (${ticketed.length})`
                  : ""}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-readonly-allow
              onClick={() => setSheet({ kind: "attendance" })}
            >
              Print attendance sheets
            </Button>
          </div>
        ) : null}

        {progress.entranceReady
          ? bulkBar(visible, [
              {
                label: "Assign campus",
                variant: "outline",
                run: (chosen) =>
                  setCampusDialog({
                    mode: "assign",
                    ids: chosen.map((row) => row.applicationId),
                  }),
              },
              {
                label: "Mark chosen absent · others present",
                variant: "maroon",
                run: (chosen) => {
                  const absent = new Set(chosen.map((row) => row.applicationId));
                  void applyToRows(
                    visible,
                    (row) =>
                      cleared(
                        {
                          ...row,
                          attendance: absent.has(row.applicationId)
                            ? "Absent"
                            : "Present",
                        },
                        true,
                      ),
                    undefined,
                    `${absent.size} marked absent, the rest of this list present`,
                  );
                },
              },
              {
                label: "Mark present",
                run: (chosen) =>
                  void applyToRows(
                    chosen,
                    (row) => cleared({ ...row, attendance: "Present" }, true),
                    undefined,
                    "Marked present",
                  ),
              },
              {
                label: "Mark absent",
                variant: "outline",
                run: (chosen) =>
                  void applyToRows(
                    chosen,
                    (row) => cleared({ ...row, attendance: "Absent" }, true),
                    undefined,
                    "Marked absent",
                  ),
              },
            ])
          : null}
        <Rows
          rows={visible}
          empty="No shortlisted candidate matches."
          headers={[
            canWrite && progress.entranceReady ? "" : null,
            "Hall ticket No.",
            "Candidate",
            "Subject",
            "Campus / hall",
            "Hall ticket",
            "Attendance",
          ]}
          render={(row) => {
            const campus = campusFor(progress.entrance, row.examCampusId);
            return (
              <>
                {canWrite && progress.entranceReady ? pickCell(row) : null}
                <td className="px-3 py-2 font-mono text-xs">{row.hallTicketNo || "—"}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-primary">{displayName(row)}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.applicationNo}
                  </p>
                  {(() => {
                    const identity = identityOf(row);
                    if (identity.photo && identity.signature) return null;
                    return (
                      <button
                        type="button"
                        data-readonly-allow
                        className="mt-1 text-xs font-semibold text-secondary underline underline-offset-2"
                        onClick={() => setViewingId(row.applicationId)}
                      >
                        {!identity.photo && !identity.signature
                          ? "Photo & signature missing"
                          : !identity.photo
                            ? "Photo missing"
                            : "Signature missing"}{" "}
                        · upload
                      </button>
                    );
                  })()}
                </td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">
                  {campus ? (
                    <>
                      <p>{campus.name}</p>
                      {row.examRoom ? (
                        <p className="text-xs text-muted-foreground">{row.examRoom}</p>
                      ) : null}
                    </>
                  ) : (
                    <Badge variant="maroon">Not assigned</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.hallTicketNo ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      data-readonly-allow
                      onClick={() => void downloadTickets([row])}
                    >
                      Download
                    </Button>
                  ) : (
                    <Badge variant="outline">Not generated</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <NativeSelect
                    value={row.attendance}
                    disabled={
                      admissionFileFrozen(row) ||
                      !canWrite ||
                      !progress.entranceReady ||
                      busy
                    }
                    onChange={(event) => {
                      const next = event.target.value as AttendanceMark;
                      void commitRow(
                        row.applicationId,
                        cleared({ ...row, attendance: next }, true),
                      );
                    }}
                    aria-label={`Attendance for ${row.name}`}
                  >
                    <option value="">Not marked</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </NativeSelect>
                </td>
              </>
            );
          }}
        />
      </>
    );
  }

  function marksBody() {
    const panels = progress.entrance.panels;
    const groups = assignInterviewPanels(panels, stepRows, schoolOfSubject);
    const unassigned = groups.find((item) => item.panel === null)?.rows ?? [];
    // Strength by school and subject, to plan how many panels each needs.
    const strength = new Map<string, Map<string, number>>();
    stepRows.forEach((row) => {
      const school = schoolOfSubject(row.department) || "School not recorded";
      const bySubject = strength.get(school) ?? new Map<string, number>();
      bySubject.set(row.department, (bySubject.get(row.department) ?? 0) + 1);
      strength.set(school, bySubject);
    });
    return (
      <>
        <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-primary">Interview panels</h3>
            <div className="flex flex-wrap gap-2">
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="gold"
                  disabled={stepRows.length === 0}
                  onClick={() => setPanelDialog({ id: null })}
                >
                  Add panel
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={stepRows.length === 0 || panels.length === 0}
                data-readonly-allow
                onClick={() => setSheet({ kind: "interview" })}
              >
                Print all sheets
              </Button>
            </div>
          </div>
          {stepRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No candidate is marked present.
            </p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...strength.entries()].map(([school, subjects]) => (
                  <div
                    key={school}
                    className="rounded-lg border border-border bg-card p-3 text-xs"
                  >
                    <p className="font-semibold text-primary">
                      {school} ·{" "}
                      {[...subjects.values()].reduce((sum, value) => sum + value, 0)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {[...subjects.entries()]
                        .map(([subject, value]) => `${subject} (${value})`)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
              {panels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a panel for each group of candidates: choose the school and
                  subjects, the number of candidates it takes, and its two experts.
                </p>
              ) : (
                <ul className="grid gap-2 lg:grid-cols-2">
                  {groups
                    .filter((item) => item.panel)
                    .map(({ panel, rows }) => {
                      if (!panel) return null;
                      const named = panel.experts.filter((item) => item.name).length;
                      return (
                        <li
                          key={panel.id}
                          className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-primary">{panel.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {panel.school || "Any school"} ·{" "}
                                {panel.subjects.length > 0
                                  ? panel.subjects.join(", ")
                                  : "all subjects"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rows.length}
                                {panel.strength > 0 ? ` of ${panel.strength}` : ""}{" "}
                                candidate(s)
                                {panel.date
                                  ? ` · ${panel.date.split("-").reverse().join("/")}`
                                  : ""}
                                {panel.venue ? ` · ${panel.venue}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={rows.length === 0}
                                data-readonly-allow
                                onClick={() =>
                                  setSheet({ kind: "interview", panelId: panel.id })
                                }
                              >
                                Print
                              </Button>
                              {canWrite ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPanelDialog({ id: panel.id })}
                                >
                                  Edit
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {named === 2 ? (
                            <p className="text-xs">
                              {panel.experts.map((item) => item.name).join(" · ")}
                            </p>
                          ) : (
                            <Badge variant="maroon">Experts not set</Badge>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
              {unassigned.length > 0 && panels.length > 0 ? (
                <p
                  role="status"
                  className="rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-secondary"
                >
                  {unassigned.length} candidate(s) are not on any panel (
                  {[...new Set(unassigned.map((row) => row.department))].join(", ")}). Add
                  a panel for their school or subject, or raise a panel&apos;s strength.
                </p>
              ) : null}
            </>
          )}
        </div>
        <EntranceMarksScreen
          embedded
          locked={!canWrite}
          panels={
            panels.length > 0
              ? groups.map((group) => ({
                  id: group.panel?.id ?? "unassigned",
                  name: group.panel?.name ?? "Not on a panel",
                  experts: group.panel
                    ? group.panel.experts
                        .map((item) => item.name)
                        .filter(Boolean)
                        .join(" · ")
                    : "",
                  applicationIds: group.rows.map((row) => row.applicationId),
                }))
              : []
          }
        />
      </>
    );
  }
  function selectionBody() {
    const qualifying =
      qualifyingDraft ??
      (progress.qualifyingTotal === null ? "" : String(progress.qualifyingTotal));
    const subjects = [...new Set(visible.map((row) => row.department))];
    return (
      <>
        {canWrite ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">
                Qualifying total (out of {writtenMax + interviewMax})
              </span>
              <Input
                inputMode="numeric"
                className="w-40"
                placeholder="No minimum"
                value={qualifying}
                onChange={(event) =>
                  setQualifyingDraft(event.target.value.replace(/[^\d]/g, "").slice(0, 3))
                }
                aria-label="Qualifying total"
              />
            </label>
            <Button
              type="button"
              variant="gold"
              disabled={busy}
              onClick={() => {
                const minimum = qualifying === "" ? null : Number(qualifying);
                if (minimum !== null && minimum > writtenMax + interviewMax) {
                  setNotice(
                    `The qualifying total cannot exceed ${writtenMax + interviewMax}.`,
                  );
                  return;
                }
                const next = applyVacancySelection(cases, vacancies, minimum);
                setBusy(true);
                void persistCases(next, { ...progress, qualifyingTotal: minimum }).then(
                  (ok) => {
                    setBusy(false);
                    if (!ok) return;
                    setQualifyingDraft(null);
                    next.forEach((row) => {
                      if (!rankable(row) || admissionFileFrozen(row)) return;
                      void updateApplicationStatus(
                        "phd",
                        row.applicationId,
                        row.selected
                          ? "Selected"
                          : row.waitlistRank !== null
                            ? "Waiting list"
                            : "Not selected",
                      );
                    });
                    const selected = next.filter((row) => row.selected).length;
                    const waiting = next.filter(
                      (row) => row.waitlistRank !== null,
                    ).length;
                    setNotice(
                      `Merit list prepared: ${selected} selected against the vacancies, ${waiting} on the waiting list.`,
                    );
                  },
                );
              }}
            >
              Prepare merit list
            </Button>
          </div>
        ) : null}
        {isAdmin
          ? bulkBar(visible, [
              {
                label: "Select (override)",
                variant: "outline",
                run: (chosen) =>
                  void applyToRows(
                    chosen,
                    (row) => ({ ...row, selected: true, waitlistRank: null }),
                    () => "Selected",
                    "Selected by administrator",
                  ),
              },
              {
                label: "Not selected (override)",
                variant: "maroon",
                run: (chosen) =>
                  void applyToRows(
                    chosen,
                    (row) => ({
                      ...row,
                      selected: false,
                      waitlistRank: null,
                      guideName: "",
                      guideIdentifier: "",
                      verification: "Pending",
                    }),
                    () => "Not selected",
                    "Marked not selected by administrator",
                  ),
              },
            ])
          : null}
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No present candidate has marks yet.
          </p>
        ) : null}
        {subjects.map((subject) => {
          const rows = visible.filter((row) => row.department === subject);
          const seats = seatsFor(subject, vacancies);
          return (
            <section key={subject} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-primary">{subject}</h3>
                <p className="text-xs text-muted-foreground">
                  Seats {seats} · Selected {rows.filter((row) => row.selected).length} ·
                  Waiting {rows.filter((row) => row.waitlistRank !== null).length}
                </p>
              </div>
              <Rows
                rows={rows}
                empty=""
                headers={[
                  isAdmin && canWrite ? "" : null,
                  "Rank",
                  "Candidate",
                  "Application No.",
                  `Written /${writtenMax}`,
                  `Interview /${interviewMax}`,
                  "Total",
                  "Result",
                ]}
                render={(row) => {
                  const result = resultOf(row);
                  return (
                    <>
                      {isAdmin && canWrite ? pickCell(row) : null}
                      <td className="px-3 py-2 font-semibold">{row.meritRank ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-primary">
                        {displayName(row)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.applicationNo}</td>
                      <td className="px-3 py-2">{row.written}</td>
                      <td className="px-3 py-2">{row.interview}</td>
                      <td className="px-3 py-2 font-semibold">{totalMarks(row)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={result.tone}>{result.label}</Badge>
                      </td>
                    </>
                  );
                }}
              />
            </section>
          );
        })}
      </>
    );
  }

  /** Approval of the provisional list: print the sheet, then record the approval. */
  function approvalPanel() {
    const state = approvalState(progress, cases);
    const approval = progress.approval;
    const names = approvalNames ?? {
      preparedBy:
        approval.preparedBy || (session ? session.name.trim() || session.identifier : ""),
      verifiedBy: approval.verifiedBy,
    };
    const namesChanged =
      names.preparedBy.trim() !== approval.preparedBy ||
      names.verifiedBy.trim() !== approval.verifiedBy;
    const unguided = orderedProvisional.filter((item) => !item.row.guideName).length;
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-primary">
            Approval of the list · Research Advisory Board / Vice Chancellor
          </h3>
          {state === "approved" ? (
            <Badge variant="gold">
              Approved by {approval.body}
              {approval.approvedOn
                ? ` · ${approval.approvedOn.split("-").reverse().join("/")}`
                : ""}
              {approval.reference ? ` · ${approval.reference}` : ""}
            </Badge>
          ) : state === "outdated" ? (
            <Badge variant="maroon">List changed after approval</Badge>
          ) : (
            <Badge variant="maroon">Not approved yet</Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Prepared by</span>
            <Input
              value={names.preparedBy}
              disabled={!canWrite}
              onChange={(event) =>
                setApprovalNames({ ...names, preparedBy: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Verified by</span>
            <Input
              value={names.verifiedBy}
              disabled={!canWrite}
              onChange={(event) =>
                setApprovalNames({ ...names, verifiedBy: event.target.value })
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (namesChanged || !approval.preparedBy) ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void persistProgress(
                  {
                    ...progress,
                    approval: {
                      ...approval,
                      preparedBy: names.preparedBy.trim(),
                      verifiedBy: names.verifiedBy.trim(),
                    },
                  },
                  "Names for the approval sheet saved.",
                ).then(() => setApprovalNames(null))
              }
            >
              Save names
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={orderedProvisional.length === 0 || busy}
            data-readonly-allow
            onClick={() => {
              // The names typed above are saved first, so they print on the sheet.
              if (canWrite && (namesChanged || !approval.preparedBy)) {
                void persistProgress(
                  {
                    ...progress,
                    approval: {
                      ...approval,
                      preparedBy: names.preparedBy.trim(),
                      verifiedBy: names.verifiedBy.trim(),
                    },
                  },
                  "Names for the approval sheet saved.",
                ).then((ok) => {
                  setApprovalNames(null);
                  if (ok) setSheet({ kind: "approval" });
                });
                return;
              }
              setSheet({ kind: "approval" });
            }}
          >
            Print approval sheet
          </Button>
          {canWrite ? (
            <Button
              type="button"
              variant="gold"
              disabled={busy || orderedProvisional.length === 0}
              onClick={() => {
                if (unguided > 0) {
                  setNotice(`Allot a guide to ${unguided} selected candidate(s) first.`);
                  return;
                }
                setRecordingApproval(true);
              }}
            >
              {state === "approved" ? "Record approval again" : "Record approval"}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Print the sheet, get it approved and signed, then record the approval. If the
          Board or the Vice Chancellor asks for a change, make it here, print the revised
          sheet and record the approval again. Letters can be issued only after this.
        </p>
      </div>
    );
  }

  function provisionalBody() {
    return (
      <>
        {approvalPanel()}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            data-readonly-allow
            onClick={() => setSheet({ kind: "provisional" })}
          >
            Print provisional & waiting list
          </Button>
        </div>
        <Rows
          rows={visible}
          empty="No selected candidate matches."
          headers={["S. No.", "Candidate", "Subject", "Total", "Guide allotted"]}
          render={(row) => {
            const serial =
              orderedProvisional.find(
                (item) => item.row.applicationId === row.applicationId,
              )?.serial ?? "—";
            return (
              <>
                <td className="px-3 py-2">{serial}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-primary">{displayName(row)}</p>
                  {row.fromWaitlist ? (
                    <Badge variant="purple">From waiting list</Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">{totalMarks(row) ?? "—"}</td>
                <td className="min-w-[16rem] px-3 py-2">{guideSelect(row)}</td>
              </>
            );
          }}
        />
      </>
    );
  }

  function letterBody() {
    const approved = approvalState(progress, cases) === "approved";
    return (
      <>
        {approvalPanel()}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Report by {officeFile.letter.reportBy}</Badge>
          <Button
            type="button"
            variant="outline"
            data-readonly-allow
            onClick={() => setSheet({ kind: "provisional" })}
          >
            Print provisional & waiting list
          </Button>
          {canWrite ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingLetter(true)}
            >
              Letter wording
            </Button>
          ) : null}
        </div>
        {bulkBar(visible, [
          {
            label: "Issue & print letters",
            run: (chosen) => void issueLetters(chosen),
          },
        ])}
        <Rows
          rows={visible}
          empty="No selected candidate matches."
          headers={[
            canWrite ? "" : null,
            "Reference",
            "Candidate",
            "Subject",
            "Guide",
            "Issued on",
            "",
          ]}
          render={(row) => (
            <>
              {canWrite ? pickCell(row) : null}
              <td className="px-3 py-2 font-mono text-xs">
                {letterRef(officeFile.letter, row)}
              </td>
              <td className="px-3 py-2 font-medium text-primary">{displayName(row)}</td>
              <td className="px-3 py-2">{row.department}</td>
              <td className="px-3 py-2">{row.guideName || "—"}</td>
              <td className="px-3 py-2">
                {row.letterIssued ? (
                  <Badge variant="gold">{row.letterIssuedOn || "Issued"}</Badge>
                ) : (
                  <Badge variant="outline">Not issued</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  type="button"
                  size="sm"
                  variant={row.letterIssued ? "outline" : "default"}
                  disabled={busy || (!row.letterIssued && (!canWrite || !approved))}
                  data-readonly-allow={row.letterIssued ? true : undefined}
                  onClick={() => void issueLetters([row])}
                >
                  {row.letterIssued ? "Reprint" : "Issue letter"}
                </Button>
              </td>
            </>
          )}
        />
      </>
    );
  }

  function reportingBody() {
    const waiting = waitlistOrder(cases).filter((row) =>
      filterMatches(department, row.department),
    );
    return (
      <>
        {bulkBar(
          visible.filter((row) => row.selected),
          [
            {
              label: "Submit checklist & open ERP access",
              run: (chosen) => void approveVerification(chosen),
            },
          ],
        )}
        <Rows
          rows={visible}
          empty="No selected candidate matches."
          headers={[
            canWrite ? "" : null,
            "Candidate",
            "Subject",
            "Guide",
            "Letter",
            "Documents",
            "Status",
            "",
          ]}
          render={(row) => {
            const result = resultOf(row);
            const withdrawn = Boolean(row.reporting);
            return (
              <>
                {canWrite && !withdrawn ? pickCell(row) : canWrite ? <td /> : null}
                <td className="px-3 py-2">
                  <p className="font-medium text-primary">{displayName(row)}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.applicationNo}
                  </p>
                </td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="min-w-[12rem] px-3 py-2">
                  {withdrawn
                    ? "—"
                    : row.guideName && (admissionFileFrozen(row) || row.letterIssued)
                      ? row.guideName
                      : guideSelect(row)}
                </td>
                <td className="px-3 py-2">
                  {withdrawn ? (
                    "—"
                  ) : row.letterIssued ? (
                    <span className="font-mono text-xs">
                      {letterRef(officeFile.letter, row)}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canWrite || busy || !row.guideName}
                      onClick={() => void issueLetters([row])}
                    >
                      Issue letter
                    </Button>
                  )}
                </td>
                <td className="px-3 py-2">{withdrawn ? "—" : documentCount(row)}</td>
                <td className="px-3 py-2">
                  <Badge variant={result.tone}>{result.label}</Badge>
                  {row.reportingNote ? (
                    <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">
                      {row.reportingNote}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {withdrawn ? null : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={row.verification === "Approved" ? "outline" : "gold"}
                        data-readonly-allow
                        onClick={() => setVerifyingId(row.applicationId)}
                      >
                        {row.verification === "Approved"
                          ? "Documents"
                          : "Verify documents"}
                      </Button>
                      {canWrite && row.verification !== "Approved" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="maroon"
                          disabled={busy}
                          onClick={() => setReleasingId(row.applicationId)}
                        >
                          Not reported
                        </Button>
                      ) : null}
                      {isAdmin && admissionCompleted(row) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void commitRow(row.applicationId, {
                              correctionOpen: !row.correctionOpen,
                            })
                          }
                        >
                          {row.correctionOpen
                            ? admissionLockCopy.lock
                            : admissionLockCopy.unlock}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </td>
              </>
            );
          }}
        />
        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-semibold text-primary">Waiting list</h3>
          <Rows
            rows={waiting}
            empty="No candidate is waiting."
            headers={["Subject", "No.", "Candidate", "Total", "Free seats", ""]}
            render={(row) => {
              const free = Math.max(
                seatsFor(row.department, vacancies) -
                  cases.filter(
                    (other) =>
                      other.selected && sameDepartment(other.department, row.department),
                  ).length,
                0,
              );
              const first = waitlistFor(cases, row.department)[0];
              return (
                <>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2 font-semibold">W{row.waitlistRank}</td>
                  <td className="px-3 py-2 font-medium text-primary">
                    {displayName(row)}
                  </td>
                  <td className="px-3 py-2">{totalMarks(row) ?? "—"}</td>
                  <td className="px-3 py-2">{free}</td>
                  <td className="px-3 py-2 text-right">
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          busy || free === 0 || first?.applicationId !== row.applicationId
                        }
                        onClick={() => void offerSeat(row)}
                      >
                        Offer seat
                      </Button>
                    ) : null}
                  </td>
                </>
              );
            }}
          />
        </section>
      </>
    );
  }

  async function saveRegistration(row: AdmissionCase, tuitionApproved: boolean) {
    const number = (registrationDrafts[row.applicationId] ?? row.registrationNo).trim();
    const blocked = registrationBlock(row, tuitionApproved);
    if (blocked) {
      setNotice(blocked);
      return;
    }
    if (number.length < 8 || number.length > 20) {
      setNotice("Enter a registration number of 8 to 20 characters.");
      return;
    }
    const onRegister = researchRegister.scholars.some(
      (item) => item.registrationNumber.trim().toLowerCase() === number.toLowerCase(),
    );
    if (onRegister || registrationNumberTaken(cases, row, number)) {
      setNotice("That registration number is already allotted.");
      return;
    }
    if (row.registrationNo && row.registrationNo !== number && !isAdmin) {
      setNotice("Only an administrator can change an allotted registration number.");
      return;
    }
    setBusy(true);
    const saved = await commitRow(row.applicationId, {
      registrationNo: number,
      registrationOn: row.registrationOn || today,
    });
    setBusy(false);
    if (!saved) return;
    setRegistrationDrafts((current) => {
      const next = { ...current };
      delete next[row.applicationId];
      return next;
    });
    setNotice(`Registration number allotted to ${displayName(row)}.`);
  }

  function tuitionApprovedFor(row: AdmissionCase) {
    const first = feeLedger(row.email, displayName(row), feeLoad?.records ?? [], today)
      .plan[0];
    return Boolean(first && first.paid > 0);
  }

  /** Numbers already in use: the register, every admission file, and the drafts on screen. */
  function takenRegistrations(extra: readonly string[] = []) {
    return [
      ...researchRegister.scholars.map((item) => item.registrationNumber),
      ...cases.map((item) => item.registrationNo),
      ...extra,
    ].filter(Boolean);
  }

  /** Fills the numbers of every scholar whose tuition receipt is approved, by the register format. */
  function generateRegistrations() {
    const rows = visible.filter(
      (row) =>
        row.verification === "Approved" && !row.registrationNo && tuitionApprovedFor(row),
    );
    if (rows.length === 0) {
      setNotice("No scholar is waiting for a registration number.");
      return;
    }
    const drafts: Record<string, string> = {};
    const gaps = new Set<string>();
    const used: string[] = [];
    for (const row of rows) {
      const suggestion = suggestRegistration(row, {
        schoolName: schoolOfSubject(row.department),
        schedule: progress.entrance,
        taken: takenRegistrations(used),
      });
      if (suggestion.ok) {
        drafts[row.applicationId] = suggestion.number;
        used.push(suggestion.number);
      } else {
        suggestion.missing.forEach((item) => gaps.add(item));
      }
    }
    setRegistrationDrafts((current) => ({ ...current, ...drafts }));
    const made = Object.keys(drafts).length;
    setNotice(
      `${made} registration number(s) prepared; check them and press Allot all.` +
        (gaps.size > 0
          ? ` ${rows.length - made} could not be prepared. Needed: ${[...gaps].join("; ")}.`
          : ""),
    );
  }

  async function allotAllRegistrations() {
    const rows = visible.filter(
      (row) =>
        registrationDrafts[row.applicationId] &&
        !row.registrationNo &&
        registrationBlock(row, tuitionApprovedFor(row)) === null,
    );
    if (rows.length === 0) {
      setNotice("Prepare the registration numbers first.");
      return;
    }
    const numbers = rows.map((row) => registrationDrafts[row.applicationId].trim());
    const clash = numbers.find(
      (number, index) =>
        numbers.indexOf(number) !== index ||
        takenRegistrations().some((item) => item.toLowerCase() === number.toLowerCase()),
    );
    if (clash) {
      setNotice(`${clash} is already allotted. Prepare the numbers again.`);
      return;
    }
    const byId = new Map(rows.map((row, index) => [row.applicationId, numbers[index]]));
    setBusy(true);
    const saved = await commit(
      cases.map((row) =>
        byId.has(row.applicationId)
          ? {
              ...row,
              registrationNo: byId.get(row.applicationId) ?? "",
              registrationOn: today,
            }
          : row,
      ),
    );
    setBusy(false);
    if (!saved) return;
    setRegistrationDrafts({});
    setNotice(`Registration numbers allotted to ${rows.length} scholar(s).`);
  }

  function feesBody() {
    return (
      <>
        <p className="text-sm leading-6 text-muted-foreground">
          After the checklist is submitted the scholar signs in, pays the tuition fee and
          attaches the receipt under Fee. Approve the receipt in Fee collection, then
          allot the registration numbers here. A number is built as year, session, the
          guide&apos;s campus code, mode of study, school code, department code and roll
          number.
        </p>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={generateRegistrations}
            >
              Prepare registration numbers
            </Button>
            <Button
              type="button"
              variant="gold"
              disabled={busy || Object.keys(registrationDrafts).length === 0}
              onClick={() => void allotAllRegistrations()}
            >
              Allot all
            </Button>
          </div>
        ) : null}
        <Rows
          rows={visible}
          empty="No admitted scholar yet."
          headers={[
            "Candidate",
            "Checklist",
            "Tuition fee",
            "Paid",
            "Balance",
            "Registration No.",
          ]}
          render={(row) => {
            const ledger = feeLedger(
              row.email,
              displayName(row),
              feeLoad?.records ?? [],
              today,
            );
            const first = ledger.plan[0];
            const approved = Boolean(first && first.paid > 0);
            const waiting = Boolean(first && first.pending > 0);
            const block = registrationBlock(row, approved);
            const draft = registrationDrafts[row.applicationId] ?? row.registrationNo;
            const editable =
              canWrite && block === null && (!row.registrationNo || isAdmin);
            return (
              <>
                <td className="px-3 py-2">
                  <p className="font-medium text-primary">{displayName(row)}</p>
                  <p className="text-xs text-muted-foreground">{row.email || "—"}</p>
                  {canWrite && row.verification === "Approved" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      disabled={busy}
                      onClick={() => void issueNewPassword(row)}
                    >
                      New sign-in password
                    </Button>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={row.verification === "Approved" ? "gold" : "outline"}>
                    {row.verification === "Approved" ? "Submitted" : "Pending"}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={approved ? "gold" : waiting ? "purple" : "outline"}>
                    {approved
                      ? "Receipt approved"
                      : waiting
                        ? "Receipt awaiting approval"
                        : "Not paid"}
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Year 1 ₹{first?.amount ?? "—"}
                  </p>
                </td>
                <td className="px-3 py-2">₹{first?.paid ?? 0}</td>
                <td className="px-3 py-2">₹{first?.balance ?? "—"}</td>
                <td className="min-w-[14rem] px-3 py-2">
                  {editable ? (
                    <div className="flex gap-2">
                      <Input
                        value={draft}
                        maxLength={20}
                        aria-label={`Registration number for ${displayName(row)}`}
                        onChange={(event) =>
                          setRegistrationDrafts((current) => ({
                            ...current,
                            [row.applicationId]: event.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9/-]/g, ""),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="gold"
                        disabled={busy || draft.trim() === row.registrationNo}
                        onClick={() => void saveRegistration(row, approved)}
                      >
                        Allot
                      </Button>
                    </div>
                  ) : row.registrationNo ? (
                    <span className="font-mono text-sm">{row.registrationNo}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{block}</span>
                  )}
                </td>
              </>
            );
          }}
        />
        {isAdmin ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary/30 bg-secondary/5 p-4">
            <p className="text-sm font-semibold text-secondary">
              Close {sessionName || "this"} admission
            </p>
            <Button
              type="button"
              variant="maroon"
              disabled={busy}
              onClick={() => setConfirmClose(true)}
            >
              Close admission session
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  const body = (() => {
    switch (step) {
      case "applications":
        return scrutinyBody();
      case "shortlist":
        return shortlistBody();
      case "entrance":
        return entranceBody();
      case "marks":
        return marksBody();
      case "selection":
        return selectionBody();
      case "provisional":
        return provisionalBody();
      case "letter":
        return letterBody();
      case "certificates":
        return reportingBody();
      case "fees":
        return feesBody();
    }
  })();

  const verifying = verifyingId
    ? (cases.find((row) => row.applicationId === verifyingId) ?? null)
    : null;
  const releasing = releasingId
    ? (cases.find((row) => row.applicationId === releasingId) ?? null)
    : null;
  const nextStep = selectionSteps[stepIndex + 1];

  return (
    <div className="space-y-5">
      <PageTitle
        kicker="Admissions"
        title="Selection"
        actions={
          <>
            {sessionName ? <Badge variant="gold">{sessionName}</Badge> : null}
            {canDownload && step !== "marks" && stepRows.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                data-readonly-allow
                onClick={() => {
                  const chosen = visible.filter((row) =>
                    selectedIds.includes(row.applicationId),
                  );
                  const rows = chosen.length > 0 ? chosen : visible;
                  setBusy(true);
                  void downloadPhdApplications(
                    rows.map((row) =>
                      phdReceiptFromApplication(
                        storedPhdForCase(row, storedApplications, applications),
                      ),
                    ),
                  )
                    .catch(() => setNotice(applicationReviewCopy.downloadFailed))
                    .finally(() => setBusy(false));
                }}
              >
                Application PDFs
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setManageOpen(true)}
              >
                Manage
              </Button>
            ) : null}
          </>
        }
      />

      {officeFile.detail ? (
        <GateBanner tone="danger">{officeFile.detail}</GateBanner>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}
      {issued.length > 0 ? (
        <div className="rounded-xl border border-accent/50 bg-accent/10 p-3 text-sm">
          <p className="font-semibold text-primary">
            First sign-in for newly admitted scholars. Share each password once; it is not
            shown again after you leave this page (use New sign-in password in the
            Admission step to issue another). The scholar sets a new one at the first
            sign-in.
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {issued.map((item) => (
              <li key={item.identifier} className="font-mono text-xs">
                {item.name} · {item.identifier} · {item.password}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Stepper current={step} completed={progress.completed} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Open stages">
        {stepStaysOpen(progress.current) ? null : (
          <Button
            type="button"
            size="sm"
            variant={finalStep === null ? "default" : "outline"}
            aria-pressed={finalStep === null}
            data-readonly-allow
            onClick={() => {
              setFinalStep(null);
              setQuery("");
              setDepartment("");
              setSelectedIds([]);
            }}
          >
            Current step: {currentStepInfo.label}
          </Button>
        )}
        {(
          [
            ["certificates", "Reporting & documents"],
            ["fees", "Fee & registration number"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={step === id ? "default" : "outline"}
            aria-pressed={step === id}
            data-readonly-allow
            onClick={() => {
              setFinalStep(
                stepStaysOpen(progress.current) && id === progress.current ? null : id,
              );
              setQuery("");
              setDepartment("");
              setSelectedIds([]);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-primary to-purple-deep px-5 py-4 text-primary-foreground">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.16em] uppercase opacity-80">
              Step {stepIndex + 1} of {selectionSteps.length}
            </p>
            <h2 className="text-lg font-semibold">{stepInfo.title}</h2>
          </div>
          {!canWrite ? (
            <Badge variant="outline">
              <Lock className="mr-1 size-3" aria-hidden="true" />
              View only
            </Badge>
          ) : null}
        </header>
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {figures.map((item) => (
            <div key={item.label} className="bg-card px-4 py-3">
              <p className="text-[0.65rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {item.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-primary">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-4 p-5">
          {step !== "marks" && stepRows.length > 0 ? (
            <ListToolbar
              query={query}
              onQuery={setQuery}
              filters={[
                {
                  id: "department",
                  label: "Subject",
                  value: department,
                  options: departments.map((item) => ({ value: item, label: item })),
                  onChange: setDepartment,
                },
              ]}
              shown={visible.length}
              total={stepRows.length}
              filename={`selection-${step}.csv`}
              title={`${stepInfo.title}${sessionName ? ` · ${sessionName}` : ""}`}
              headers={exportHeaders}
              rows={exportRows}
            />
          ) : null}
          {body}
        </div>
        {!stepStaysOpen(step) ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-4">
            <p
              className={cn(
                "text-sm",
                completionBlock ? "text-secondary" : "font-medium text-primary",
              )}
            >
              {completionBlock ??
                `Ready. Completing locks this step and opens ${nextStep?.label ?? "the next step"}.`}
            </p>
            {canWrite ? (
              <Button
                type="button"
                variant="gold"
                disabled={busy || completionBlock !== null}
                onClick={() => setConfirmStep(true)}
              >
                Complete & open {nextStep?.label ?? "next step"}
              </Button>
            ) : null}
          </footer>
        ) : null}
      </section>

      {confirmStep ? (
        <FormDialog
          title={`Complete ${stepInfo.label}`}
          submitLabel={`Complete & open ${nextStep?.label ?? "next step"}`}
          busy={busy}
          onClose={() => setConfirmStep(false)}
          onSubmit={(event) => {
            event.preventDefault();
            const next = completeSelectionProgress(progress);
            if (next === progress) {
              setConfirmStep(false);
              return;
            }
            setBusy(true);
            void persistProgress(
              next,
              `${stepInfo.label} is complete and locked. ${nextStep?.label ?? "The next step"} is open.`,
            ).finally(() => {
              setBusy(false);
              setConfirmStep(false);
            });
          }}
        >
          <p className="text-sm">
            <strong>{stepInfo.title}</strong> will be locked and hidden.{" "}
            <strong>{nextStep?.title}</strong> opens next. Only an administrator can
            reopen a completed step.
          </p>
        </FormDialog>
      ) : null}

      {confirmClose ? (
        <FormDialog
          title="Close admission session"
          submitLabel="Close session"
          busy={busy}
          onClose={() => setConfirmClose(false)}
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void closeAdmissionSession(phdApplications)
              .then((result) => {
                if (!result.ok) {
                  setNotice(result.message);
                  return;
                }
                setNotice(
                  `${sessionName || "The"} admission is closed. ${result.archived} application(s) moved to the admission archive. The next session starts at Scrutiny.`,
                );
              })
              .finally(() => {
                setBusy(false);
                setConfirmClose(false);
              });
          }}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Unselected, wait-listed and not-reported candidates move to the admission
              archive.
            </li>
            <li>
              Admitted scholars leave this desk and continue under the scholar menus.
            </li>
            <li>The desk restarts at Step 1 for the next admission session.</li>
          </ul>
        </FormDialog>
      ) : null}

      {rejecting ? (
        <RejectDialog
          count={rejecting.length}
          busy={busy}
          onClose={() => setRejecting(null)}
          onSave={(note) => {
            const ids = new Set(rejecting);
            void applyToRows(
              cases.filter((row) => ids.has(row.applicationId)),
              (row) =>
                cleared({ ...row, scrutiny: "Not eligible", scrutinyNote: note }, false),
              () => "Not selected",
              "Marked not eligible",
            ).then(() => setRejecting(null));
          }}
        />
      ) : null}

      {recordingApproval ? (
        <ApprovalDialog
          busy={busy}
          initial={progress.approval}
          today={today}
          onClose={() => setRecordingApproval(false)}
          onSave={(values) => {
            void persistProgress(
              {
                ...progress,
                approval: {
                  ...progress.approval,
                  ...values,
                  recordedBy: session ? session.name.trim() || session.identifier : "",
                  listKey: provisionalListKey(cases),
                },
              },
              `Approval by the ${values.body} recorded. The letters can be issued.`,
            ).then((ok) => {
              if (ok) setRecordingApproval(false);
            });
          }}
        />
      ) : null}

      {panelDialog ? (
        <PanelDialog
          panel={
            progress.entrance.panels.find((item) => item.id === panelDialog.id) ?? null
          }
          nextName={`Panel ${progress.entrance.panels.length + 1}`}
          defaultDate={progress.entrance.date}
          presentSubjects={[...new Set(attendancePresent.map((row) => row.department))]
            .sort((a, b) => a.localeCompare(b))
            .map((subject) => ({
              subject,
              school: schoolOfSubject(subject),
              count: attendancePresent.filter((row) => row.department === subject).length,
            }))}
          busy={busy}
          onClose={() => setPanelDialog(null)}
          onRemove={(id) => {
            void saveEntrancePatch(
              { panels: progress.entrance.panels.filter((item) => item.id !== id) },
              "Interview panel removed.",
            ).then((ok) => {
              if (ok) setPanelDialog(null);
            });
          }}
          onSave={(panel) => {
            const exists = progress.entrance.panels.some((item) => item.id === panel.id);
            void saveEntrancePatch(
              {
                panels: exists
                  ? progress.entrance.panels.map((item) =>
                      item.id === panel.id ? panel : item,
                    )
                  : [...progress.entrance.panels, panel],
              },
              `${panel.name} saved.`,
            ).then((ok) => {
              if (ok) setPanelDialog(null);
            });
          }}
        />
      ) : null}
      {campusDialog ? (
        <CampusDialog
          state={campusDialog}
          campuses={progress.entrance.campuses}
          busy={busy}
          onClose={() => setCampusDialog(null)}
          onSaveCampus={(campus) => {
            const list = progress.entrance.campuses;
            const exists = list.some((item) => item.id === campus.id);
            void saveCampuses(
              exists
                ? list.map((item) => (item.id === campus.id ? campus : item))
                : [...list, campus],
              `${campus.name} saved.`,
            ).then((ok) => {
              if (ok) setCampusDialog(null);
            });
          }}
          onAssign={(campusId, room) => {
            if (campusDialog.mode !== "assign") return;
            const ids = new Set(campusDialog.ids);
            const campus = campusFor(progress.entrance, campusId);
            void applyToRows(
              cases.filter((row) => ids.has(row.applicationId)),
              (row) => ({ ...row, examCampusId: campusId, examRoom: room }),
              undefined,
              `Assigned to ${campus?.name ?? "the campus"}`,
            ).then(() => setCampusDialog(null));
          }}
        />
      ) : null}

      {releasing ? (
        <ReleaseDialog
          row={releasing}
          next={waitlistFor(cases, releasing.department)[0] ?? null}
          busy={busy}
          onClose={() => setReleasingId(null)}
          onSave={(reason, note, offer) =>
            void releaseCandidate(releasing, reason, note, offer)
          }
        />
      ) : null}

      {verifying ? (
        <DeskModal
          title={`Documents · ${displayName(verifying)}`}
          size="lg"
          onClose={() => setVerifyingId(null)}
        >
          <VerifyPanel
            row={verifying}
            locked={!canWrite || busy}
            onMark={(id, mark) => {
              const checks = { ...verifying.checks };
              if (mark === "") delete checks[id];
              else checks[id] = mark;
              void commitRow(verifying.applicationId, { checks });
            }}
            onTickAll={() => {
              const checks = { ...verifying.checks };
              for (const item of admissionChecklist) {
                if (item.required && checks[item.id] !== "Not applicable") {
                  checks[item.id] = "Received";
                } else if (checks[item.id] === "Submitted") {
                  checks[item.id] = "Received";
                }
              }
              void commitRow(verifying.applicationId, { checks });
            }}
            onApprove={() => {
              const blocked = verificationBlock(verifying);
              if (blocked) {
                setNotice(blocked);
                return;
              }
              void approveVerification([verifying]).then(() => setVerifyingId(null));
            }}
          />
        </DeskModal>
      ) : null}

      {manageOpen ? (
        <DeskModal title="Selection settings" onClose={() => setManageOpen(false)}>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="font-semibold text-primary">Provisional letter wording</p>
                <p className="text-muted-foreground">
                  Reference {officeFile.letter.refPrefix} · report by{" "}
                  {officeFile.letter.reportBy}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setManageOpen(false);
                  setEditingLetter(true);
                }}
              >
                Edit
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary/30 p-3">
              <div>
                <p className="font-semibold text-secondary">Reopen the previous step</p>
                <p className="text-muted-foreground">
                  {progress.completed.length > 0
                    ? `Reopens ${selectionSteps.find((item) => item.id === progress.completed[progress.completed.length - 1])?.label}. Use only to correct an error.`
                    : "No step has been completed yet."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="maroon"
                disabled={progress.completed.length === 0 || busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Reopen the previous step? The current step is hidden until it is completed again.",
                    )
                  ) {
                    return;
                  }
                  void persistProgress(
                    clearSelectionProgress(progress, 1),
                    "The previous step is open again for correction.",
                  ).then((ok) => {
                    if (ok) setManageOpen(false);
                  });
                }}
              >
                Reopen
              </Button>
            </div>
          </div>
        </DeskModal>
      ) : null}

      {editingLetter ? (
        <FormDialog
          title="Provisional admission letter wording"
          onClose={() => setEditingLetter(false)}
          onSubmit={form.handleSubmit((values) => {
            void commit(cases, values, progress, isAdmin && !canWrite).then((ok) => {
              if (ok) {
                setNotice("The provisional letter wording has been saved.");
                setEditingLetter(false);
              }
            });
          })}
          submitLabel="Save letter wording"
          size="lg"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {letterFields.map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block font-semibold">{label}</span>
                <Input {...form.register(key)} />
                {form.formState.errors[key] ? (
                  <span className="mt-1 block text-secondary">
                    {form.formState.errors[key]?.message}
                  </span>
                ) : null}
              </label>
            ))}
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">
                Documents, one on each line
              </span>
              <textarea
                {...form.register("documents")}
                rows={8}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
              />
              {form.formState.errors.documents ? (
                <span className="mt-1 block text-secondary">
                  {form.formState.errors.documents.message}
                </span>
              ) : null}
            </label>
          </div>
        </FormDialog>
      ) : null}

      {viewingId
        ? (() => {
            const admission =
              cases.find((row) => row.applicationId === viewingId) ?? null;
            if (!admission) return null;
            return (
              <ApplicationViewer
                application={storedPhdForCase(
                  admission,
                  storedApplications,
                  applications,
                )}
                admission={admission}
                onClose={() => setViewingId(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

function Stepper({
  current,
  completed,
}: {
  current: SelectionStepId;
  completed: readonly SelectionStepId[];
}) {
  return (
    <ol
      className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9"
      aria-label="Selection steps"
    >
      {selectionSteps.map((item, index) => {
        const done = completed.includes(item.id);
        const active = item.id === current && !done;
        return (
          <li
            key={item.id}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold",
              done && "border-accent/40 bg-accent/10 text-primary",
              active && "border-primary bg-primary text-primary-foreground shadow-card",
              !done && !active && "border-border bg-card text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem]",
                done && "bg-accent text-accent-foreground",
                active && "bg-primary-foreground text-primary",
                !done && !active && "bg-muted",
              )}
            >
              {done ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : active ? (
                index + 1
              ) : (
                <Lock className="size-3" aria-hidden="true" />
              )}
            </span>
            <span className="truncate">{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function RejectDialog({
  count,
  busy,
  onClose,
  onSave,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <FormDialog
      title={`Not eligible · ${count} application${count === 1 ? "" : "s"}`}
      submitLabel="Mark not eligible"
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (note.trim().length < 3) {
          setError("Record the reason.");
          return;
        }
        onSave(note.trim());
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-primary">Reason</span>
        <NativeSelect
          value=""
          onChange={(event) => {
            if (event.target.value) setNote(event.target.value);
          }}
          aria-label="Common reasons"
        >
          <option value="">Choose a common reason…</option>
          <option value="Minimum marks in the qualifying degree not met">
            Minimum marks in the qualifying degree not met
          </option>
          <option value="Qualifying degree not in a relevant subject">
            Qualifying degree not in a relevant subject
          </option>
          <option value="Application fee not paid">Application fee not paid</option>
          <option value="Required documents not enclosed">
            Required documents not enclosed
          </option>
          <option value="Duplicate application">Duplicate application</option>
        </NativeSelect>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError("");
          }}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          aria-label="Reason"
        />
        {error ? <span className="text-secondary">{error}</span> : null}
      </label>
    </FormDialog>
  );
}

function ApprovalDialog({
  busy,
  initial,
  today,
  onClose,
  onSave,
}: {
  busy: boolean;
  initial: ApprovalRecord;
  today: string;
  onClose: () => void;
  onSave: (values: {
    body: (typeof approvalBodies)[number];
    reference: string;
    approvedOn: string;
  }) => void;
}) {
  const [body, setBody] = useState<(typeof approvalBodies)[number]>(
    initial.body || approvalBodies[0],
  );
  const [reference, setReference] = useState(initial.reference);
  const [approvedOn, setApprovedOn] = useState(initial.approvedOn || today);
  const [error, setError] = useState("");
  return (
    <FormDialog
      title="Record approval of the list"
      submitLabel="Record approval"
      size="sm"
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (!approvedOn || approvedOn > today) {
          setError("Enter the date of approval (not a future date).");
          return;
        }
        onSave({ body, reference: reference.trim(), approvedOn });
      }}
    >
      <div className="space-y-3 text-sm">
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Approved by</span>
          <NativeSelect
            value={body}
            onChange={(event) =>
              setBody(event.target.value as (typeof approvalBodies)[number])
            }
          >
            {approvalBodies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Minutes / reference no.</span>
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Date of approval</span>
          <Input
            type="date"
            max={today}
            value={approvedOn}
            onChange={(event) => setApprovedOn(event.target.value)}
          />
        </label>
        {error ? <p className="text-secondary">{error}</p> : null}
      </div>
    </FormDialog>
  );
}

function PanelDialog({
  panel,
  nextName,
  defaultDate,
  presentSubjects,
  busy,
  onClose,
  onSave,
  onRemove,
}: {
  panel: InterviewPanel | null;
  nextName: string;
  defaultDate: string;
  presentSubjects: { subject: string; school: string; count: number }[];
  busy: boolean;
  onClose: () => void;
  onSave: (panel: InterviewPanel) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState(panel?.name ?? nextName);
  const [school, setSchool] = useState(panel?.school ?? "");
  const [subjects, setSubjects] = useState<string[]>(panel?.subjects ?? []);
  const [strength, setStrength] = useState(panel?.strength ? String(panel.strength) : "");
  const [date, setDate] = useState(panel?.date || defaultDate);
  const [venue, setVenue] = useState(panel?.venue ?? "");
  const [experts, setExperts] = useState<[InterviewExpert, InterviewExpert]>(
    panel?.experts ?? [{ ...emptyExpert }, { ...emptyExpert }],
  );
  const [error, setError] = useState("");

  const schoolNames = [
    ...new Set([
      ...schoolCatalogue.map((item) => item.name),
      ...presentSubjects.map((item) => item.school).filter(Boolean),
    ]),
  ];
  const choices = presentSubjects.filter(
    (item) => !school || sameDepartment(item.school, school),
  );
  const covered = choices
    .filter((item) => subjects.length === 0 || subjects.includes(item.subject))
    .reduce((sum, item) => sum + item.count, 0);

  function update(index: 0 | 1, field: keyof InterviewExpert, value: string) {
    setExperts((current) => {
      const next: [InterviewExpert, InterviewExpert] = [
        { ...current[0] },
        { ...current[1] },
      ];
      next[index][field] = value;
      return next;
    });
    setError("");
  }

  return (
    <FormDialog
      title={panel ? `Edit · ${panel.name}` : "Add interview panel"}
      submitLabel="Save panel"
      size="lg"
      busy={busy}
      onClose={onClose}
      extraActions={
        panel ? (
          <Button
            type="button"
            variant="maroon"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Remove ${panel.name}?`)) onRemove(panel.id);
            }}
          >
            Remove panel
          </Button>
        ) : null
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length < 2) {
          setError("Enter the panel name.");
          return;
        }
        if (experts.some((item) => item.name.trim().length < 3)) {
          setError("Enter the name of both experts.");
          return;
        }
        const limit = strength.trim() === "" ? 0 : Number(strength);
        if (!Number.isInteger(limit) || limit < 0 || limit > 500) {
          setError("Enter how many candidates the panel takes, or leave it blank.");
          return;
        }
        onSave({
          id: panel?.id ?? newPanelId(),
          name: name.trim(),
          school,
          subjects: subjects.filter((subject) =>
            choices.some((item) => item.subject === subject),
          ),
          strength: limit,
          date,
          venue: venue.trim(),
          experts: experts.map((item) => ({
            name: item.name.trim(),
            designation: item.designation.trim(),
            institution: item.institution.trim(),
          })) as [InterviewExpert, InterviewExpert],
        });
      }}
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="font-semibold text-primary">Panel name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold text-primary">School</span>
            <NativeSelect
              value={school}
              onChange={(event) => {
                setSchool(event.target.value);
                setSubjects([]);
              }}
            >
              <option value="">Any school</option>
              {schoolNames.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 font-semibold text-primary">
            Subjects (leave all unticked for every subject of the school)
          </legend>
          <div className="flex flex-wrap gap-2">
            {choices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No present candidate in this school.
              </p>
            ) : null}
            {choices.map((item) => {
              const checked = subjects.includes(item.subject);
              return (
                <label
                  key={item.subject}
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs",
                    checked
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-card",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={checked}
                    onChange={() =>
                      setSubjects((current) =>
                        current.includes(item.subject)
                          ? current.filter((value) => value !== item.subject)
                          : [...current, item.subject],
                      )
                    }
                  />
                  {item.subject} ({item.count})
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {covered} candidate(s) match this panel.
          </p>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="font-semibold text-primary">Candidates it takes</span>
            <Input
              inputMode="numeric"
              placeholder="No limit"
              value={strength}
              onChange={(event) => {
                setStrength(event.target.value.replace(/\D/g, "").slice(0, 3));
                setError("");
              }}
            />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold text-primary">Date of interview</span>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold text-primary">Hall / room</span>
            <Input value={venue} onChange={(event) => setVenue(event.target.value)} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([0, 1] as const).map((index) => (
            <fieldset
              key={index}
              className="space-y-2 rounded-xl border border-border p-3"
            >
              <legend className="px-1 font-semibold text-primary">
                Expert {index + 1}
              </legend>
              {(
                [
                  ["name", "Name"],
                  ["designation", "Designation"],
                  ["institution", "Institution"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="grid gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {label}
                  </span>
                  <Input
                    value={experts[index][field]}
                    onChange={(event) => update(index, field, event.target.value)}
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {error ? <p className="text-secondary">{error}</p> : null}
      </div>
    </FormDialog>
  );
}
function SignatureSlot({
  title,
  name,
  nameEditable = false,
  image,
  disabled,
  onSave,
  onError,
}: {
  title: string;
  name: string;
  nameEditable?: boolean;
  image: string;
  disabled: boolean;
  onSave: (patch: { name?: string; image?: string }) => void;
  onError: (message: string) => void;
}) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const shownName = draftName ?? name;
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="grid h-16 w-32 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-border bg-white">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`${title} signature`} className="max-h-full max-w-full" />
        ) : (
          <span className="text-xs text-muted-foreground">No signature</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold text-primary">{title}</p>
        {nameEditable ? (
          <div className="flex gap-2">
            <Input
              value={shownName}
              placeholder="Name"
              disabled={disabled}
              onChange={(event) => setDraftName(event.target.value)}
              aria-label={`${title} name`}
            />
            {draftName !== null && draftName.trim() !== name ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  onSave({ name: draftName.trim() });
                  setDraftName(null);
                }}
              >
                Save
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {name || "Name from the letter settings"}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <label
            className={buttonVariants({
              size: "sm",
              variant: "outline",
              className: cn(
                "cursor-pointer",
                disabled && "pointer-events-none opacity-60",
              ),
            })}
          >
            {image ? "Replace signature" : "Upload signature"}
            <input
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (!["image/png", "image/jpeg"].includes(file.type)) {
                  onError("Upload the signature as a PNG or JPG image.");
                  return;
                }
                void compressImage(file, 200 * 1024)
                  .then((prepared) => fileToDataUrl(prepared))
                  .then((data) => onSave({ image: data }))
                  .catch(() => onError("The signature image could not be read."));
              }}
            />
          </label>
          {image ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onSave({ image: "" })}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CampusDialog({
  state,
  campuses,
  busy,
  onClose,
  onSaveCampus,
  onAssign,
}: {
  state:
    | { mode: "add" }
    | { mode: "edit"; campus: ExamCampus }
    | { mode: "assign"; ids: string[] };
  campuses: readonly ExamCampus[];
  busy: boolean;
  onClose: () => void;
  onSaveCampus: (campus: ExamCampus) => void;
  onAssign: (campusId: string, room: string) => void;
}) {
  const editing = state.mode === "edit" ? state.campus : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");

  if (state.mode === "assign") {
    return (
      <FormDialog
        title={`Assign campus · ${state.ids.length} candidate${state.ids.length === 1 ? "" : "s"}`}
        submitLabel="Assign"
        busy={busy}
        onClose={onClose}
        onSubmit={(event) => {
          event.preventDefault();
          if (!campusId) {
            setError("Choose a campus.");
            return;
          }
          onAssign(campusId, room.trim());
        }}
      >
        <div className="space-y-3 text-sm">
          <label className="grid gap-1">
            <span className="font-semibold text-primary">Campus</span>
            <NativeSelect
              value={campusId}
              onChange={(event) => {
                setCampusId(event.target.value);
                setError("");
              }}
              aria-label="Campus"
            >
              <option value="">Choose a campus</option>
              {campuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1">
            <span className="font-semibold text-primary">Hall / room (optional)</span>
            <Input
              value={room}
              placeholder="e.g. Block A, Room 104"
              onChange={(event) => setRoom(event.target.value)}
            />
          </label>
          {error ? <p className="text-secondary">{error}</p> : null}
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      title={editing ? `Edit ${editing.name}` : "Add campus"}
      submitLabel="Save campus"
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length < 2) {
          setError("Enter the campus name.");
          return;
        }
        const duplicate = campuses.some(
          (item) =>
            item.id !== editing?.id &&
            item.name.trim().toLowerCase() === name.trim().toLowerCase(),
        );
        if (duplicate) {
          setError("A campus with this name is already listed.");
          return;
        }
        onSaveCampus({
          id: editing?.id ?? `campus-${Date.now().toString(36)}`,
          name: name.trim(),
          address: address.trim(),
        });
      }}
    >
      <div className="space-y-3 text-sm">
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Campus name</span>
          <Input
            value={name}
            placeholder="e.g. St. Joseph University, Main Campus"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">
            Address (printed on the hall ticket)
          </span>
          <textarea
            rows={3}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-secondary">{error}</p> : null}
      </div>
    </FormDialog>
  );
}

function ReleaseDialog({
  row,
  next,
  busy,
  onClose,
  onSave,
}: {
  row: AdmissionCase;
  next: AdmissionCase | null;
  busy: boolean;
  onClose: () => void;
  onSave: (reason: Exclude<ReportingMark, "">, note: string, offer: boolean) => void;
}) {
  const [reason, setReason] = useState<Exclude<ReportingMark, "">>("Not reported");
  const [note, setNote] = useState("");
  const [offer, setOffer] = useState(Boolean(next));
  return (
    <FormDialog
      title={`Release seat · ${displayName(row)}`}
      submitLabel="Release seat"
      busy={busy}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(reason, note.trim(), offer && Boolean(next));
      }}
    >
      <div className="space-y-3 text-sm">
        <p>
          {row.department} · {row.applicationNo}
          {row.guideName ? ` · Guide ${row.guideName}` : ""}
        </p>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Reason</span>
          <NativeSelect
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as Exclude<ReportingMark, "">)
            }
            aria-label="Reason"
          >
            {reportingMarks.map((item) => (
              <option key={item} value={item}>
                {item === "Not reported"
                  ? "Did not report by the due date"
                  : "Declined the seat"}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Remarks</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {next ? (
          <label className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={offer}
              onChange={(event) => setOffer(event.target.checked)}
            />
            <span>
              Offer the seat to <strong>{displayName(next)}</strong> (W{next.waitlistRank}
              , total {totalMarks(next)}) with the same guide.
            </span>
          </label>
        ) : (
          <p className="text-muted-foreground">
            No candidate is on this subject&apos;s waiting list.
          </p>
        )}
      </div>
    </FormDialog>
  );
}

function VerifyPanel({
  row,
  locked,
  onMark,
  onTickAll,
  onApprove,
}: {
  row: AdmissionCase;
  locked: boolean;
  onMark: (id: string, mark: CheckMark | "") => void;
  onTickAll: () => void;
  onApprove: () => void;
}) {
  const block = verificationBlock(row);
  const missing = missingItems(row);
  const submitted = row.verification === "Approved";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={submitted ? "gold" : "outline"}>
          {submitted ? "Checklist submitted" : "Checklist pending"}
        </Badge>
        <Badge variant="outline">Guide {row.guideName || "not allotted"}</Badge>
        {row.feeReceiptName ? (
          <span className="inline-flex items-center gap-2">
            <Badge variant="purple">Fee receipt</Badge>
            <ViewFilesButton fileName={row.feeReceiptName} data={row.feeReceiptData} />
          </span>
        ) : null}
        {!submitted && !locked ? (
          <Button type="button" size="sm" variant="outline" onClick={onTickAll}>
            Tick all required
          </Button>
        ) : null}
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {admissionChecklist.map((item) => {
          const upload = row.uploads[item.id];
          const mark = row.checks[item.id] ?? "";
          const box = (label: string, value: CheckMark) => (
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={mark === value}
                disabled={locked || (submitted && mark !== "Missing")}
                aria-label={`${label}: ${item.title}`}
                onChange={(event) => onMark(item.id, event.target.checked ? value : "")}
              />
              {label}
            </label>
          );
          return (
            <div
              key={item.id}
              className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <p className="text-sm">
                {item.title}
                {item.required ? <span className="text-secondary"> *</span> : null}
                {mark === "Submitted" ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Uploaded by the scholar; tick Received once checked.
                  </span>
                ) : null}
              </p>
              <div>
                {upload ? (
                  <ViewFilesButton fileName={upload.fileName} data={upload.fileData} />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {box("Received", "Received")}
                {item.required ? null : box("Not applicable", "Not applicable")}
                {box("Missing", "Missing")}
              </div>
            </div>
          );
        })}
      </div>
      {missing.length > 0 ? (
        <p className="text-sm text-secondary">
          Missing: {missing.map((item) => item.title).join("; ")}. The scholar sees these
          under the admission file.
        </p>
      ) : null}
      {!submitted ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("text-sm", block ? "text-secondary" : "text-primary")}>
            {block ??
              "Every document is ticked. Submitting opens the scholar's ERP access to pay the tuition fee."}
          </p>
          <Button
            type="button"
            variant="gold"
            disabled={locked || block !== null}
            onClick={onApprove}
          >
            Submit checklist & open ERP access
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Submitted
          {row.checklistSubmittedOn
            ? ` on ${formatIsoDate(row.checklistSubmittedOn)}`
            : ""}
          . The scholar can now sign in, pay the tuition fee and upload the receipt; the
          registration number follows its approval (Admission step).
        </p>
      )}
    </div>
  );
}

function Rows({
  rows,
  headers,
  empty,
  render,
}: {
  rows: readonly AdmissionCase[];
  headers: readonly (string | null)[];
  empty: string;
  render: (row: AdmissionCase) => ReactNode;
}) {
  if (rows.length === 0) {
    return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  }
  const shown = headers.filter((header): header is string => header !== null);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <thead className="bg-muted/60 text-primary">
          <tr>
            {shown.map((header, index) => (
              <th key={`${header}-${index}`} className="px-3 py-2.5 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.applicationId}
              className={cn(
                "border-t border-border",
                row.reporting && "bg-secondary/5 text-muted-foreground",
              )}
            >
              {render(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
