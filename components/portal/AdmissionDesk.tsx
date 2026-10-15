"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import {
  AdmissionLetter,
  AttendanceSheet,
  ProvisionalSheet,
} from "@/components/portal/AdmissionPrint";
import { ApplicationViewer } from "@/components/portal/ApplicationViewer";
import { EntranceMarksScreen } from "@/components/portal/EntranceMarksScreen";
import { ViewFilesButton } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { useClientReady } from "@/components/forms/ClientGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  admissionArchiveCopy,
  admissionChecklist,
  admissionLockCopy,
  archiveSessionOptions,
  archiveYearOptions,
  defaultLetter,
  interviewMax,
  selectionFlowCopy,
  selectionSteps,
  writtenMax,
  type SelectionStepId,
} from "@/data/admission";
import { admissionSessions } from "@/lib/constants";
import { adminActionBlock, officeWriteBlock } from "@/lib/access";
import {
  admissionCompleted,
  admissionFileFrozen,
  applyVacancySelection,
  archiveUnselected,
  archiveYearOf,
  archivedKeys,
  attendanceOrder,
  clearSelectionProgress,
  completeSelectionProgress,
  currentAdmission,
  displayName,
  isLiveAdmissionCase,
  keepHiddenCases,
  mergeApplications,
  missingItems,
  provisionalOrder,
  saveAdmission,
  scheduleIsReady,
  seatsFor,
  sameSubject,
  shouldArchiveCase,
  stepIsBlocked,
  stepIsOpen,
  subscribeAdmission,
  totalMarks,
  verificationBlock,
  type AdmissionCase,
  type AttendanceMark,
  type CheckMark,
  type EntranceSchedule,
  type LetterConfig,
} from "@/lib/admission";
import { usePreviewSession } from "@/lib/use-preview-session";
import {
  currentOffice,
  removeAllocation,
  sameId,
  saveAllocation,
  subscribeOffice,
} from "@/lib/office";
import { applicationReviewCopy } from "@/data/application-review";
import {
  currentApplications,
  subscribeApplications,
  updateApplicationStatus,
  type StoredApplication,
} from "@/lib/records";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import type { Vacancy } from "@/lib/vacancies";

type Step = SelectionStepId;

type Sheet =
  | null
  | { kind: "attendance" }
  | { kind: "provisional" }
  | { kind: "letter"; applicationId: string };

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
    guideName: selected ? row.guideName : "",
    guideIdentifier: selected ? row.guideIdentifier : "",
    verification: selected ? row.verification : "Pending",
  };
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
  const session = usePreviewSession();
  const form = useForm<LetterConfig>({
    resolver: zodResolver(letterSchema) as Resolver<LetterConfig>,
    values: store?.letter ?? defaultLetter,
  });
  const [step, setStep] = useState<Step>("applications");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [attendance, setAttendance] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<EntranceSchedule | null>(null);
  const [notice, setNotice] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [archiveSession, setArchiveSession] = useState("");
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const storedApplications = useSyncExternalStore(
    subscribeApplications,
    currentApplications,
    () => null,
  );

  function linkedScholar(row: AdmissionCase) {
    const accounts = (users?.users ?? []).filter((item) => item.role === "scholar");
    const match =
      accounts.find((item) => sameId(item.identifier, row.email)) ??
      accounts.find((item) => sameId(item.identifier, row.applicationNo)) ??
      accounts.find((item) => sameId(item.name, row.name));
    return match?.identifier ?? row.email;
  }

  if (!ready || !store) {
    return <p className="text-sm text-muted-foreground">Loading the admission file…</p>;
  }

  const officeFile = store;
  const archiveKeys = archivedKeys(officeFile.archived);
  const phdApplications = storedApplications
    ? storedApplications.filter((row) => row.kind === "phd")
    : applications;
  const cases = mergeApplications(officeFile.cases, phdApplications).filter((row) =>
    isLiveAdmissionCase(row, archiveKeys),
  );
  const departments = [...new Set(cases.map((row) => row.department))].sort((a, b) =>
    a.localeCompare(b),
  );
  const subjects = [...new Set(vacancies.map((item) => item.department))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = cases.filter(
    (row) =>
      textMatches(query, [
        row.name,
        row.applicationNo,
        row.email,
        row.department,
        row.guideName,
      ]) &&
      (!department || row.department === department) &&
      (!attendance || row.attendance === attendance),
  );

  const progress = officeFile.progress;
  const shownStep = session?.role === "staff" ? progress.current : step;
  const writeBlocked = officeWriteBlock();
  const canWrite = !writeBlocked && stepIsOpen(progress, shownStep);
  const schedule = scheduleDraft ?? progress.entrance;

  async function commit(
    nextCases: AdmissionCase[],
    letter = officeFile.letter,
    nextProgress = progress,
    ignoreStep = false,
  ) {
    if (ignoreStep) {
      const blocked = adminActionBlock();
      if (blocked) {
        setNotice(blocked.message);
        return false;
      }
    } else {
      const blocked = officeWriteBlock();
      if (blocked) {
        setNotice(blocked.message);
        return false;
      }
      if (!stepIsOpen(progress, shownStep)) {
        setNotice(selectionFlowCopy.skipBlocked);
        return false;
      }
    }
    const saved = await saveAdmission({
      cases: keepHiddenCases(nextCases, officeFile.cases, archiveKeys),
      letter,
      progress: nextProgress,
    });
    setNotice(saved.ok ? "" : saved.message);
    return saved.ok;
  }

  async function archiveClosedSession(
    fromProgress = progress,
    options?: { confirm?: boolean; prefix?: string },
  ) {
    const session = archiveSession || fromProgress.entrance.session;
    const year = archiveYear || archiveYearOf(fromProgress.entrance);
    if (!session || !year) {
      setNotice(
        options?.prefix
          ? `${options.prefix} ${selectionFlowCopy.needArchiveSession}`
          : selectionFlowCopy.needArchiveSession,
      );
      return;
    }
    if (options?.confirm !== false && !window.confirm(selectionFlowCopy.archiveConfirm)) {
      return;
    }
    setArchiveBusy(true);
    const result = await archiveUnselected({
      session,
      year,
      applications: phdApplications,
    });
    setArchiveBusy(false);
    if (!result.ok) {
      if (result.message === selectionFlowCopy.noneToArchive && options?.prefix) {
        setNotice(options.prefix);
        return;
      }
      setNotice(result.message);
      return;
    }
    setNotice(
      options?.prefix
        ? `${options.prefix} ${selectionFlowCopy.archived}`
        : selectionFlowCopy.archived,
    );
  }

  async function persistProgress(nextProgress: typeof progress, message: string) {
    const blocked =
      nextProgress.completed.length < progress.completed.length
        ? adminActionBlock()
        : officeWriteBlock();
    if (blocked) {
      setNotice(blocked.message);
      return;
    }
    const saved = await saveAdmission({
      cases: officeFile.cases,
      letter: officeFile.letter,
      progress: nextProgress,
    });
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setStep(nextProgress.current);
    setScheduleDraft(null);
    const closedSession =
      shownStep === "certificates" &&
      nextProgress.completed.includes("certificates") &&
      !progress.completed.includes("certificates");
    if (closedSession) {
      await archiveClosedSession(nextProgress, { confirm: false, prefix: message });
      return;
    }
    setNotice(message);
  }

  async function commitRow(id: string, patch: Partial<AdmissionCase>) {
    const current = cases.find((row) => row.applicationId === id);
    if (!current) return;
    const onlyUnlock =
      Object.keys(patch).length === 1 &&
      Object.prototype.hasOwnProperty.call(patch, "correctionOpen");
    if (admissionFileFrozen(current) && !onlyUnlock) {
      setNotice(admissionLockCopy.blocked);
      return;
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
    const ok = await commit(nextCases, officeFile.letter, progress, onlyUnlock);
    if (ok && nextRow.verification === "Approved") {
      const allotted = await saveAllocation({
        scholarIdentifier: linkedScholar(nextRow),
        scholarName: nextRow.name,
        supervisorIdentifier: nextRow.guideIdentifier || nextRow.guideName,
        supervisorName: nextRow.guideName,
      });
      if (!allotted.ok) setNotice(allotted.message);
    }
  }

  async function persistCases(nextCases: AdmissionCase[]) {
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
    return commit(nextCases);
  }

  async function saveLetter(letter: LetterConfig) {
    const ok = await commit(cases, letter);
    if (ok) setNotice("The provisional letter wording has been saved.");
  }

  function toggleCorrection(row: AdmissionCase) {
    void commitRow(row.applicationId, { correctionOpen: !row.correctionOpen });
  }

  const orderedAttendance = attendanceOrder(cases).map((row, index) => ({
    row,
    serial: index + 1,
  }));
  const orderedProvisional = provisionalOrder(cases).map((row, index) => ({
    row,
    serial: index + 1,
  }));

  if (sheet?.kind === "attendance") {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSheet(null)}>
            Back to selection
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print attendance list
          </Button>
        </div>
        <AttendanceSheet rows={orderedAttendance} schedule={progress.entrance} />
      </div>
    );
  }

  if (sheet?.kind === "provisional") {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSheet(null)}>
            Back to selection
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print provisional list
          </Button>
        </div>
        <ProvisionalSheet rows={orderedProvisional} />
      </div>
    );
  }

  if (sheet?.kind === "letter") {
    const match = orderedProvisional.find(
      (item) => item.row.applicationId === sheet.applicationId,
    );
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSheet(null)}>
            Back to selection
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (match && !match.row.letterIssued) {
                void commitRow(match.row.applicationId, { letterIssued: true });
              }
              window.print();
            }}
          >
            Print admission letter
          </Button>
        </div>
        {match ? (
          <AdmissionLetter
            row={match.row}
            serial={match.serial}
            letter={officeFile.letter}
          />
        ) : (
          <p className="text-sm">This candidate is not on the provisional list.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Admissions
        </p>
        <h1 className="mt-1 font-serif text-3xl text-primary">Selection</h1>
        {officeFile.detail ? (
          <p className="mt-2 text-sm text-muted-foreground">{officeFile.detail}</p>
        ) : null}
        {notice ? <p className="mt-2 text-sm text-secondary">{notice}</p> : null}
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {admissionLockCopy.banner}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {selectionFlowCopy.monitor}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {selectionFlowCopy.liveHidden}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {selectionSteps.map((item) => {
          const blocked = stepIsBlocked(progress, item.id);
          const open = stepIsOpen(progress, item.id);
          const staffLocked = session?.role === "staff" && !open;
          return (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={shownStep === item.id ? "default" : "outline"}
              disabled={staffLocked}
              onClick={() => setStep(item.id)}
            >
              {item.label}
              {blocked
                ? ` · ${selectionFlowCopy.blocked}`
                : open
                  ? ` · ${selectionFlowCopy.open}`
                  : ` · ${selectionFlowCopy.closed}`}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {canWrite ? (
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              if (shownStep === "entrance" && !progress.entranceReady) {
                setNotice(selectionFlowCopy.needSchedule);
                return;
              }
              const next = completeSelectionProgress(progress);
              if (next === progress) {
                setNotice(selectionFlowCopy.needSchedule);
                return;
              }
              void persistProgress(next, selectionFlowCopy.completeFirst);
            }}
          >
            {selectionFlowCopy.complete}
          </Button>
        ) : null}
        {session?.role === "admin" && progress.completed.length > 0 ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void persistProgress(
                  clearSelectionProgress(progress, 1),
                  "The last blocked step is open again.",
                )
              }
            >
              {selectionFlowCopy.clearOne}
            </Button>
            {progress.completed.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void persistProgress(
                    clearSelectionProgress(progress, 2),
                    "The last two blocked steps are open again.",
                  )
                }
              >
                {selectionFlowCopy.clearTwo}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {!writeBlocked ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <label className="grid min-w-[10rem] gap-1 text-sm">
            <span className="font-semibold text-primary">
              {selectionFlowCopy.session}
            </span>
            <NativeSelect
              value={archiveSession || progress.entrance.session}
              onChange={(event) => setArchiveSession(event.target.value)}
              aria-label={selectionFlowCopy.session}
            >
              <option value="">Select session</option>
              {archiveSessionOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid min-w-[8rem] gap-1 text-sm">
            <span className="font-semibold text-primary">
              {admissionArchiveCopy.year}
            </span>
            <NativeSelect
              value={
                archiveYear ||
                (progress.entrance.monthYear ? archiveYearOf(progress.entrance) : "")
              }
              onChange={(event) => setArchiveYear(event.target.value)}
              aria-label={admissionArchiveCopy.year}
            >
              <option value="">Select year</option>
              {archiveYearOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={archiveBusy || cases.filter(shouldArchiveCase).length === 0}
            onClick={() => void archiveClosedSession(progress)}
          >
            {selectionFlowCopy.archive}
          </Button>
        </div>
      ) : null}

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "department",
            label: "Department",
            value: department,
            options: departments.map((item) => ({ value: item, label: item })),
            onChange: setDepartment,
          },
          {
            id: "attendance",
            label: "Attendance",
            value: attendance,
            options: [
              { value: "Present", label: "Present" },
              { value: "Absent", label: "Absent" },
            ],
            onChange: setAttendance,
          },
        ]}
        shown={visible.length}
        total={cases.length}
        filename="admission-selection.csv"
        headers={[
          "Application No.",
          "Name",
          "Department",
          "Shortlisted",
          "Attendance",
          "Written",
          "Interview",
          "Total",
          "Selected",
          "Guide",
          "Certificates",
        ]}
        rows={visible.map((row) => [
          row.applicationNo,
          displayName(row),
          row.department,
          row.shortlisted ? "Yes" : "No",
          row.attendance || "—",
          row.written === null ? "" : String(row.written),
          row.interview === null ? "" : String(row.interview),
          totalMarks(row) === null ? "" : String(totalMarks(row)),
          row.selected ? "Yes" : "No",
          row.guideName,
          row.verification,
        ])}
      />

      {shownStep === "applications" ? (
        <Stage
          title="Applications received"
          text="These are the Ph.D. applications already stored by the office."
        >
          <Rows
            rows={visible}
            empty="No application matches these filters."
            render={(row) => (
              <>
                <td className="px-3 py-2">{row.applicationNo}</td>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">{row.studyMode}</td>
                <td className="px-3 py-2">{row.email}</td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingId(row.applicationId)}
                  >
                    {applicationReviewCopy.view}
                  </Button>
                </td>
              </>
            )}
            headers={["Application No.", "Name", "Department", "Mode", "Email", ""]}
          />
        </Stage>
      ) : null}

      {shownStep === "shortlist" ? (
        <Stage title="Shortlist against vacancies" text={selectionFlowCopy.shortlistText}>
          <Button
            type="button"
            className="mb-3"
            disabled={!canWrite}
            onClick={() => {
              const next = cases.map((row) => {
                if (admissionFileFrozen(row)) return row;
                const eligible = seatsFor(row.department, vacancies) > 0;
                return cleared({ ...row, shortlisted: eligible }, eligible);
              });
              void persistCases(next);
              next.forEach((row) => {
                void updateApplicationStatus(
                  "phd",
                  row.applicationId,
                  row.shortlisted ? "Shortlisted" : "Under review",
                );
              });
            }}
          >
            Shortlist every eligible candidate
          </Button>
          <Rows
            rows={visible}
            empty="No application matches these filters."
            headers={["Name", "Subject", "Seats", "Shortlist", "Application", "File"]}
            render={(row) => {
              const seats = seatsFor(row.department, vacancies);
              return (
                <>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">
                    <NativeSelect
                      value={row.department}
                      disabled={admissionFileFrozen(row) || !canWrite}
                      onChange={(event) => {
                        void commitRow(
                          row.applicationId,
                          cleared(
                            {
                              ...row,
                              department: event.target.value,
                              shortlisted: false,
                              attendance: "",
                              written: null,
                              interview: null,
                              selected: false,
                            },
                            false,
                          ),
                        );
                      }}
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={admissionFileFrozen(row) || !canWrite}
                        onClick={() => {
                          void commitRow(
                            row.applicationId,
                            cleared({ ...row, shortlisted: false }, false),
                          );
                          void updateApplicationStatus(
                            "phd",
                            row.applicationId,
                            "Under review",
                          );
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={admissionFileFrozen(row) || !canWrite || seats === 0}
                        onClick={() => {
                          void commitRow(
                            row.applicationId,
                            cleared({ ...row, shortlisted: true }, true),
                          );
                          void updateApplicationStatus(
                            "phd",
                            row.applicationId,
                            "Shortlisted",
                          );
                        }}
                      >
                        Shortlist
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingId(row.applicationId)}
                    >
                      {applicationReviewCopy.view}
                    </Button>
                  </td>
                  <td className="px-3 py-2">
                    <FileLock row={row} onToggle={toggleCorrection} />
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {shownStep === "entrance" ? (
        <Stage title="Entrance and interview" text={selectionFlowCopy.entranceText}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">
                {selectionFlowCopy.session}
              </span>
              <NativeSelect
                value={schedule.session}
                disabled={progress.entranceReady || !canWrite}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, session: event.target.value })
                }
                aria-label={selectionFlowCopy.session}
              >
                <option value="">Select session</option>
                {admissionSessions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">
                {selectionFlowCopy.monthYear}
              </span>
              <Input
                type="month"
                value={schedule.monthYear}
                disabled={progress.entranceReady || !canWrite}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, monthYear: event.target.value })
                }
                aria-label={selectionFlowCopy.monthYear}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">{selectionFlowCopy.date}</span>
              <Input
                type="date"
                value={schedule.date}
                disabled={progress.entranceReady || !canWrite}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, date: event.target.value })
                }
                aria-label={selectionFlowCopy.date}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">
                {selectionFlowCopy.venue}
              </span>
              <Input
                value={schedule.venue}
                disabled={progress.entranceReady || !canWrite}
                onChange={(event) =>
                  setScheduleDraft({ ...schedule, venue: event.target.value })
                }
                aria-label={selectionFlowCopy.venue}
              />
            </label>
          </div>
          <p className="mb-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {selectionFlowCopy.scheduleHint}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {!progress.entranceReady ? (
              <Button
                type="button"
                disabled={!canWrite || !scheduleIsReady(schedule)}
                onClick={() =>
                  void persistProgress(
                    { ...progress, entrance: schedule, entranceReady: true },
                    selectionFlowCopy.scheduleSaved,
                  )
                }
              >
                {selectionFlowCopy.saveSchedule}
              </Button>
            ) : session?.role === "admin" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void persistProgress(
                    { ...progress, entranceReady: false },
                    "Date and venue can be corrected.",
                  )
                }
              >
                {selectionFlowCopy.clearSchedule}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!progress.entranceReady}
              onClick={() => {
                if (!progress.entranceReady) {
                  setNotice(selectionFlowCopy.needSchedule);
                  return;
                }
                setSheet({ kind: "attendance" });
              }}
            >
              {selectionFlowCopy.printAttendance}
            </Button>
          </div>
          <Rows
            rows={visible.filter((row) => row.shortlisted)}
            empty="Shortlist a candidate before marking attendance."
            headers={["S. No.", "Department", "Name", "Application No.", "Attendance"]}
            render={(row) => {
              const serial =
                orderedAttendance.find(
                  (item) => item.row.applicationId === row.applicationId,
                )?.serial ?? "—";
              return (
                <>
                  <td className="px-3 py-2">{serial}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.applicationNo}</td>
                  <td className="px-3 py-2">
                    <NativeSelect
                      value={row.attendance}
                      disabled={
                        admissionFileFrozen(row) || !canWrite || !progress.entranceReady
                      }
                      onChange={(event) => {
                        const next = event.target.value as AttendanceMark | "";
                        void commitRow(
                          row.applicationId,
                          cleared({ ...row, attendance: next === "" ? "" : next }, true),
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
        </Stage>
      ) : null}

      {shownStep === "marks" ? (
        <Stage
          title="Entrance marks"
          text={`Written test ${writtenMax} and interview ${interviewMax}. Enter marks 25 scholars at a time, then save and continue.`}
        >
          <EntranceMarksScreen embedded locked={!canWrite} />
        </Stage>
      ) : null}

      {shownStep === "selection" ? (
        <Stage
          title="Department-wise selection"
          text={`${admissionLockCopy.promoteHint} Present candidates with marks are ranked in each department. The vacancy count decides how many are selected.`}
        >
          <Button
            type="button"
            className="mb-3"
            disabled={!canWrite}
            onClick={() => {
              const next = applyVacancySelection(cases, vacancies);
              void persistCases(next);
              next.forEach((row) => {
                if (row.attendance !== "Present" || totalMarks(row) === null) return;
                void updateApplicationStatus(
                  "phd",
                  row.applicationId,
                  row.selected ? "Selected" : "Not selected",
                );
              });
              setNotice("Selection now follows the vacancy count in each department.");
            }}
          >
            Select by vacancy
          </Button>
          <Rows
            rows={visible.filter(
              (row) => row.attendance === "Present" && totalMarks(row) !== null,
            )}
            empty="Enter marks for a present candidate before selection."
            headers={["Department", "Name", "Total", "Seats", "Selected", "File"]}
            render={(row) => (
              <>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{totalMarks(row)}</td>
                <td className="px-3 py-2">{seatsFor(row.department, vacancies)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {row.selected ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={admissionFileFrozen(row)}
                        onClick={() => {
                          void commitRow(row.applicationId, {
                            selected: false,
                            guideName: "",
                            guideIdentifier: "",
                            verification: "Pending",
                          });
                          void updateApplicationStatus(
                            "phd",
                            row.applicationId,
                            "Not selected",
                          );
                        }}
                      >
                        {admissionLockCopy.demote}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={admissionFileFrozen(row) || totalMarks(row) === null}
                        onClick={() => {
                          void commitRow(row.applicationId, { selected: true });
                          void updateApplicationStatus(
                            "phd",
                            row.applicationId,
                            "Selected",
                          );
                        }}
                      >
                        {admissionLockCopy.promote}
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <FileLock row={row} onToggle={toggleCorrection} />
                </td>
              </>
            )}
          />
        </Stage>
      ) : null}

      {shownStep === "provisional" ? (
        <Stage
          title="Provisional list and guide"
          text="Allot the guide here. The guide does not see the scholar until certificate verification is approved."
        >
          <Button
            type="button"
            className="mb-3"
            onClick={() => setSheet({ kind: "provisional" })}
          >
            Prepare provisional list
          </Button>
          <Rows
            rows={visible.filter((row) => row.selected)}
            empty="Run the vacancy selection before allotting a guide."
            headers={[
              "S. No.",
              "Name of the Candidate",
              "Subject/department",
              "Guide Allotted",
            ]}
            render={(row) => {
              const serial =
                orderedProvisional.find(
                  (item) => item.row.applicationId === row.applicationId,
                )?.serial ?? "—";
              const choices = vacancies.filter((item) =>
                sameSubject(row.department, item.department),
              );
              const guideChoices = choices.length > 0 ? choices : vacancies;
              return (
                <>
                  <td className="px-3 py-2">{serial}</td>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">
                    <NativeSelect
                      value={
                        guideChoices.find((item) => item.supervisorName === row.guideName)
                          ?.id ?? ""
                      }
                      disabled={admissionFileFrozen(row)}
                      onChange={(event) => {
                        const vacancy = guideChoices.find(
                          (item) => item.id === event.target.value,
                        );
                        if (!vacancy) {
                          void commitRow(row.applicationId, {
                            guideName: "",
                            guideIdentifier: "",
                          });
                          return;
                        }
                        const used = cases.filter(
                          (item) =>
                            item.applicationId !== row.applicationId &&
                            item.guideName === vacancy.supervisorName,
                        ).length;
                        if (used >= vacancy.vacancyCount) {
                          setNotice(`${vacancy.supervisorName} has no vacancy left.`);
                          return;
                        }
                        const account = users?.users.find(
                          (item) =>
                            item.role === "supervisor" &&
                            item.name.toLowerCase() ===
                              vacancy.supervisorName.toLowerCase(),
                        );
                        void commitRow(row.applicationId, {
                          guideName: vacancy.supervisorName,
                          guideIdentifier: account?.identifier ?? vacancy.supervisorName,
                        });
                      }}
                      aria-label={`Guide for ${row.name}`}
                    >
                      <option value="">Choose a guide</option>
                      {guideChoices.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.supervisorName} · {item.department} · {item.vacancyCount}{" "}
                          seats
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {shownStep === "letter" ? (
        <Stage
          title="Provisional admission letter"
          text="This wording is used for every selected candidate. The application number, name, department, mode, and reference are filled from the selection list."
        >
          <form
            className="mb-6 grid gap-3 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) => void saveLetter(values))}
          >
            {(
              [
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
              ] as const
            ).map(([key, label]) => (
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
            <Button type="submit" className="sm:col-span-2 sm:w-fit">
              Save letter wording
            </Button>
          </form>
          <Rows
            rows={visible.filter((row) => row.selected)}
            empty="Select a candidate before printing a letter."
            headers={["S. No.", "Name", "Application No.", "Letter"]}
            render={(row) => {
              const serial =
                orderedProvisional.find(
                  (item) => item.row.applicationId === row.applicationId,
                )?.serial ?? "—";
              return (
                <>
                  <td className="px-3 py-2">{serial}</td>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.applicationNo}</td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSheet({ kind: "letter", applicationId: row.applicationId });
                        if (!row.letterIssued) {
                          void commitRow(row.applicationId, { letterIssued: true });
                        }
                      }}
                    >
                      Open letter
                    </Button>
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {shownStep === "fees" ? (
        <Stage
          title="Tuition fee receipt"
          text="Selected scholars upload the payment reference and the receipt from their own admission file."
        >
          <Rows
            rows={visible.filter((row) => row.selected)}
            empty="No selected candidate matches these filters."
            headers={["Name", "Reference", "Amount", "Receipt"]}
            render={(row) => (
              <>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{row.feeReference || "Not uploaded"}</td>
                <td className="px-3 py-2">{row.feeAmount ? `₹${row.feeAmount}` : "—"}</td>
                <td className="px-3 py-2">
                  {row.feeReceiptData ? (
                    <a
                      className="font-semibold text-primary underline"
                      href={row.feeReceiptData}
                    >
                      {row.feeReceiptName}
                    </a>
                  ) : (
                    "Waiting for the scholar"
                  )}
                </td>
              </>
            )}
          />
        </Stage>
      ) : null}

      {shownStep === "certificates" ? (
        <Stage
          title="Certificate verification"
          text="Mark each checklist line. Anything marked Missing stays on the scholar's admission file until they upload it. Approving this step shows the guide to the scholar and the new scholar to the supervisor."
        >
          <div className="space-y-4">
            {visible.filter((row) => row.selected).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No selected candidate matches these filters.
              </p>
            ) : null}
            {visible
              .filter((row) => row.selected)
              .map((row) => (
                <section
                  key={row.applicationId}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      {displayName(row)} · {row.department}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm">
                        {row.verification === "Approved" ? "Approved" : "Pending"}
                        {row.guideName ? ` · ${row.guideName}` : ""}
                      </p>
                      <FileLock row={row} onToggle={toggleCorrection} />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {admissionChecklist.map((item) => {
                      const upload = row.uploads[item.id];
                      return (
                        <div
                          key={item.id}
                          className="grid gap-2 sm:grid-cols-[1fr_14rem] sm:items-center"
                        >
                          <div>
                            <p className="text-sm">{item.title}</p>
                            {upload ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm">{upload.fileName}</p>
                                <ViewFilesButton
                                  fileName={upload.fileName}
                                  data={upload.fileData}
                                />
                              </div>
                            ) : null}
                          </div>
                          <NativeSelect
                            value={row.checks[item.id] ?? ""}
                            disabled={admissionFileFrozen(row)}
                            onChange={(event) => {
                              const mark = event.target.value as CheckMark | "";
                              const checks = { ...row.checks };
                              if (mark === "") delete checks[item.id];
                              else checks[item.id] = mark;
                              void commitRow(row.applicationId, { checks });
                            }}
                            aria-label={item.title}
                          >
                            <option value="">Not reviewed</option>
                            <option value="Received">Received</option>
                            <option value="Missing">Missing</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Not applicable">Not applicable</option>
                          </NativeSelect>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    className="mt-4"
                    disabled={admissionFileFrozen(row) || row.verification === "Approved"}
                    onClick={() => {
                      const blocked = verificationBlock(row);
                      if (blocked) {
                        setNotice(blocked);
                        return;
                      }
                      void commitRow(row.applicationId, { verification: "Approved" });
                      setNotice(
                        `${displayName(row)} can now see ${row.guideName}, and the guide can see this scholar.`,
                      );
                    }}
                  >
                    Approve certificate verification
                  </Button>
                  {missingItems(row).length > 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Still missing on the scholar's file:{" "}
                      {missingItems(row)
                        .map((item) => item.title)
                        .join("; ")}
                      .
                    </p>
                  ) : null}
                </section>
              ))}
          </div>
        </Stage>
      ) : null}
      {viewingId
        ? (() => {
            const admission =
              cases.find((row) => row.applicationId === viewingId) ?? null;
            const application =
              applications.find(
                (item) =>
                  item.id === viewingId ||
                  item.applicationNo === admission?.applicationNo,
              ) ??
              storedApplications?.find(
                (item) =>
                  item.id === viewingId ||
                  item.applicationNo === admission?.applicationNo,
              );
            if (!application && !admission) return null;
            const shown = application ?? {
              id: admission!.applicationId,
              kind: "phd" as const,
              applicationNo: admission!.applicationNo,
              applicantName: admission!.name,
              email: admission!.email,
              dateOfBirth: "",
              studyMode: admission!.studyMode,
              status: admission!.selected ? "Selected" : "Under review",
              createdAt: "",
              payload: {
                fullName: admission!.name,
                email: admission!.email,
                department: admission!.department,
              },
            };
            return (
              <ApplicationViewer
                application={shown}
                admission={admission}
                onClose={() => setViewingId(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

function FileLock({
  row,
  onToggle,
}: {
  row: AdmissionCase;
  onToggle: (row: AdmissionCase) => void;
}) {
  if (!admissionCompleted(row)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {admissionFileFrozen(row) ? (
        <span className="text-xs font-semibold text-secondary">
          {admissionLockCopy.frozen}
        </span>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={() => onToggle(row)}>
        {row.correctionOpen ? admissionLockCopy.lock : admissionLockCopy.unlock}
      </Button>
    </div>
  );
}

function Stage({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-primary">{title}</h2>
      <p className="mt-1 mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">
        {text}
      </p>
      {children}
    </section>
  );
}

function Rows({
  rows,
  headers,
  empty,
  render,
}: {
  rows: AdmissionCase[];
  headers: string[];
  empty: string;
  render: (row: AdmissionCase) => ReactNode;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            {headers.map((header) => (
              <th key={header || "action"} className="px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.applicationId} className="border-t border-border">
              {render(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
