"use client";

import { Lock } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { MarkButtons, type Mark } from "@/components/portal/AttendanceControls";
import { DeskPage, DeskSection, FormDialog } from "@/components/portal/Desk";
import { ListSheet, PrintFrame } from "@/components/portal/ExamPrint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatIsoDate } from "@/lib/dates";
import {
  currentDoctoral,
  subscribeDoctoral,
  type CourseRegistration,
} from "@/lib/doctoral";
import {
  candidatesFor,
  centreOf,
  currentExam,
  examRegistrations,
  fileFor,
  freezeMarks,
  gradeFor,
  attendanceLockOf,
  markExamAttendance,
  outcomeFor,
  readyToSubmit,
  saveExamMarks,
  sendMarksBack,
  sendMarksForVerification,
  sheetOf,
  submitToOffice,
  subscribeExam,
  type ExamSettings,
  type ExamState,
  type ExamTicket,
  type SheetStatus,
} from "@/lib/exam-office";
import { registrationCompare } from "@/lib/register";
import { cn } from "@/lib/utils";

type Candidate = { registration: CourseRegistration; ticket: ExamTicket };

type Paper = {
  subjectId: string;
  label: string;
  candidates: Candidate[];
};

const statusTone: Record<SheetStatus, "outline" | "purple" | "gold" | "maroon"> = {
  Entry: "outline",
  Sent: "purple",
  Frozen: "gold",
  Returned: "maroon",
};

const statusWords: Record<SheetStatus, string> = {
  Entry: "Marks being entered",
  Sent: "With the verifier",
  Frozen: "Frozen",
  Returned: "Sent back for correction",
};

function resultOf(
  settings: ExamSettings,
  state: ExamState,
  registrationId: string,
  marks: number | null,
) {
  const absent = state.attendance[registrationId] === "Absent";
  const outcome = outcomeFor(settings, marks, absent);
  return {
    absent,
    outcome,
    grade: absent ? "AAA" : marks === null ? "" : gradeFor(settings, marks),
  };
}

type Printing = { kind: "marks"; subjectId: string } | { kind: "galley" };

/**
 * The Controller of Examinations' screens. "entry": marks are entered paper by paper, campus
 * by campus or for the whole batch, and sent for verification. "verify": the verifier checks
 * them and freezes them (a frozen mark can not be changed), prints the sheets for the COE's
 * records and submits the file to the research office.
 */
export function CoeMarksScreen({ mode }: { mode: "entry" | "verify" }) {
  const ready = useClientReady();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const [batchId, setBatchId] = useState("");
  const [semester, setSemester] = useState(1);
  const [paperId, setPaperId] = useState("");
  const [centreId, setCentreId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [printing, setPrinting] = useState<Printing | null>(null);

  const batches = doctoral?.batches ?? [];
  const activeBatch = batchId || batches[0]?.id || "";

  const papers: Paper[] = useMemo(() => {
    if (!doctoral || !exam) return [];
    const ids = [
      ...new Map(
        examRegistrations(doctoral, activeBatch, semester)
          .filter((row) => exam.tickets.some((ticket) => ticket.registrationIds.includes(row.id)))
          .map((row) => [row.subjectId, `${row.code} ${row.name}`] as const),
      ).entries(),
    ];
    return ids
      .map(([subjectId, label]) => ({
        subjectId,
        label,
        candidates: candidatesFor(doctoral, exam, activeBatch, semester, subjectId),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [doctoral, exam, activeBatch, semester]);

  if (!ready || !doctoral || !exam) {
    return <p className="text-sm text-muted-foreground">Loading the examination…</p>;
  }
  const settings = exam.settings;
  const file = fileFor(exam, activeBatch, semester);
  const batchName = batches.find((batch) => batch.id === activeBatch)?.name ?? "";
  const centres = settings.centres;
  const shownPapers = papers.filter((paper) => !paperId || paper.subjectId === paperId);

  const marksOf = (subjectId: string, registrationId: string) =>
    sheetOf(file, subjectId)?.marks[registrationId] ?? null;

  const lockedFor = (subjectId: string) => {
    const status = sheetOf(file, subjectId)?.status ?? "Entry";
    return file?.status === "Published" || status === "Sent" || status === "Frozen";
  };

  function countsOf(paper: Paper) {
    const total = paper.candidates.length;
    let entered = 0;
    let absent = 0;
    let passed = 0;
    let reappear = 0;
    let forwarded = 0;
    for (const { registration } of paper.candidates) {
      if (attendanceLockOf(exam!, registration)) forwarded += 1;
      const marks = marksOf(paper.subjectId, registration.id);
      const result = resultOf(settings, exam!, registration.id, marks);
      if (result.absent) {
        absent += 1;
        entered += 1;
      } else if (marks !== null) {
        entered += 1;
        if (result.outcome === "Pass") passed += 1;
        else reappear += 1;
      }
    }
    return { total, entered, absent, missing: total - entered, passed, reappear, forwarded };
  }

  async function saveDrafts() {
    const bySubject = new Map<string, { registrationId: string; marks: number | null }[]>();
    for (const paper of shownPapers) {
      for (const { registration } of paper.candidates) {
        const draft = drafts[registration.id];
        if (draft === undefined) continue;
        const marks = draft.trim() === "" ? null : Number(draft);
        if (marks !== null && Number.isNaN(marks)) {
          setNotice(`${registration.scholarName}: enter the marks as a number.`);
          return;
        }
        bySubject.set(paper.subjectId, [
          ...(bySubject.get(paper.subjectId) ?? []),
          { registrationId: registration.id, marks },
        ]);
      }
    }
    if (bySubject.size === 0) {
      setNotice("Enter some marks first.");
      return;
    }
    setBusy(true);
    for (const [subjectId, entries] of bySubject) {
      const saved = await saveExamMarks(activeBatch, semester, subjectId, entries);
      if (!saved.ok) {
        setBusy(false);
        setNotice(saved.message);
        return;
      }
    }
    setBusy(false);
    setDrafts({});
    setNotice("The marks were saved.");
  }

  async function act(task: Promise<{ ok: boolean }>, done: string) {
    setBusy(true);
    const result = await task;
    setBusy(false);
    setNotice(
      result.ok
        ? done
        : ((result as unknown as { message?: string }).message ?? "That could not be done."),
    );
    return result.ok;
  }

  /* ------------------------------------- printed sheets ------------------------------- */

  if (printing) {
    const session = file ? `${file.sessionMonth} ${file.sessionYear}`.trim() : "";
    if (printing.kind === "marks") {
      const paper = papers.find((item) => item.subjectId === printing.subjectId);
      const sheet = sheetOf(file, printing.subjectId);
      return (
        <PrintFrame onBack={() => setPrinting(null)} printLabel="Print marks sheet">
          <ListSheet
            title="Course Work Examination · Marks sheet"
            details={[
              `Batch: ${batchName}`,
              `Semester: ${semester}`,
              `Paper: ${paper?.label ?? ""}`,
              `Session: ${session || "—"}`,
              `Maximum marks: ${settings.maxMarks}`,
              `Pass mark: ${settings.passMark}`,
              `Entered by: ${sheet?.enteredBy.join(", ") || "—"}`,
              `Status: ${sheet?.status === "Frozen" ? `Frozen on ${formatIsoDate(sheet.frozenOn)}` : (sheet?.status ?? "—")}`,
            ]}
            headers={["Hall ticket No.", "Registration No.", "Name", "Campus", "Marks", "Grade", "Result"]}
            widths={["w-28", "w-32", "", "w-24", "w-16", "w-14", "w-16"]}
            bold={[2, 4]}
            rows={(paper?.candidates ?? []).map(({ registration, ticket }) => {
              const marks = marksOf(printing.subjectId, registration.id);
              const result = resultOf(settings, exam, registration.id, marks);
              return [
                ticket.ticketNo,
                ticket.registration,
                registration.scholarName,
                centreOf(settings, ticket.centreId)?.name ?? "",
                result.absent ? "AAA" : marks === null ? "" : String(marks),
                result.grade,
                result.absent ? "AAA" : marks === null ? "" : result.outcome === "Pass" ? "PASS" : "RA",
              ];
            })}
            signatures={["Marks entered by", "Verified by", "Controller of Examinations", "Dean, Research and Development"]}
            perPage={22}
          />
        </PrintFrame>
      );
    }
    const rows = papers
      .flatMap((paper) =>
        paper.candidates.map(({ registration, ticket }) => {
          const marks = marksOf(paper.subjectId, registration.id);
          const result = resultOf(settings, exam, registration.id, marks);
          return {
            sort: ticket.registration,
            cells: [
              ticket.registration,
              registration.scholarName,
              registration.code,
              result.absent ? "AAA" : marks === null ? "" : String(marks),
              result.grade,
              result.absent ? "AAA" : marks === null ? "" : result.outcome === "Pass" ? "PASS" : "RA",
            ],
          };
        }),
      )
      .sort(
        (left, right) =>
          registrationCompare(left.sort, right.sort) ||
          left.cells[1].localeCompare(right.cells[1]) ||
          left.cells[2].localeCompare(right.cells[2]),
      );
    return (
      <PrintFrame onBack={() => setPrinting(null)} printLabel="Print result list">
        <ListSheet
          title="Course Work Examination · Result list"
          details={[
            `Batch: ${batchName}`,
            `Semester: ${semester}`,
            `Session: ${session || "—"}`,
            `Papers: ${papers.length}`,
            file?.afterBoard ? "Version: Final, after the passing board" : "Version: For the passing board",
          ]}
          headers={["Registration No.", "Name", "Code", "Marks", "Grade", "Result"]}
          widths={["w-36", "", "w-24", "w-16", "w-14", "w-16"]}
          bold={[1]}
          rows={rows.map((row) => row.cells)}
          signatures={["Verified by", "Controller of Examinations", "Dean, Research and Development"]}
          perPage={24}
        />
      </PrintFrame>
    );
  }

  /* ------------------------------------ the screen ------------------------------------ */

  const ofCentre = (paper: Paper) =>
    paper.candidates.filter(({ ticket }) => !centreId || ticket.centreId === centreId);
  const gridRows = shownPapers.flatMap((paper) =>
    ofCentre(paper).map((candidate) => ({ paper, ...candidate })),
  );
  const dirty = Object.keys(drafts).length;
  const submitReady = readyToSubmit(doctoral, exam, activeBatch, semester);
  const filesWithNote = file?.log.filter((entry) => /Sent back|asked for changes/i.test(entry.action));
  const lastNote = filesWithNote?.[filesWithNote.length - 1];

  return (
    <DeskPage
      kicker="Controller of Examinations"
      title={mode === "entry" ? "Marks entry" : "Verify & freeze marks"}
    >
      {exam.detail ? <p className="text-sm text-secondary">{exam.detail}</p> : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Batch</span>
          <NativeSelect
            value={activeBatch}
            onChange={(event) => {
              setBatchId(event.target.value);
              setDrafts({});
            }}
            aria-label="Batch"
          >
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Semester</span>
          <NativeSelect
            value={semester}
            onChange={(event) => {
              setSemester(Number(event.target.value));
              setDrafts({});
            }}
            aria-label="Semester"
          >
            {[1, 2, 3, 4].map((item) => (
              <option key={item} value={item}>
                Semester {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Paper</span>
          <NativeSelect
            value={paperId}
            onChange={(event) => setPaperId(event.target.value)}
            aria-label="Paper"
          >
            <option value="">All papers (batch-wise)</option>
            {papers.map((paper) => (
              <option key={paper.subjectId} value={paper.subjectId}>
                {paper.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Campus</span>
          <NativeSelect
            value={centreId}
            onChange={(event) => setCentreId(event.target.value)}
            aria-label="Campus"
          >
            <option value="">All campuses</option>
            {centres.map((centre) => (
              <option key={centre.id} value={centre.id}>
                {centre.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {file ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <Badge
            variant={
              file.status === "Published" ? "gold" : file.status === "Open" ? "outline" : "purple"
            }
          >
            {file.status === "Open"
              ? "File open"
              : file.status === "Submitted"
                ? file.afterBoard
                  ? "Final file with the research office"
                  : "With the research office"
                : file.status === "Approved"
                  ? "Approved by the passing board"
                  : "Published"}
          </Badge>
          {file.boardOn ? (
            <span className="text-muted-foreground">
              Passing board {formatIsoDate(file.boardOn)}
              {file.boardRef ? ` · ${file.boardRef}` : ""}
            </span>
          ) : null}
          {lastNote && file.status === "Open" ? (
            <span className="font-medium text-secondary">
              {lastNote.action}: {lastNote.note}
            </span>
          ) : null}
        </div>
      ) : null}

      <DeskSection title={`Papers · ${batchName} · Semester ${semester}`}>
        <div className="overflow-x-auto p-4">
          {papers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hall ticket issued for this batch and semester.
            </p>
          ) : (
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-2 font-semibold">Paper</th>
                  <th className="px-3 py-2 font-semibold">Scholars</th>
                  <th className="px-3 py-2 font-semibold">Attendance</th>
                  <th className="px-3 py-2 font-semibold">Marks entered</th>
                  <th className="px-3 py-2 font-semibold">Absent</th>
                  <th className="px-3 py-2 font-semibold">Pass · RA</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => {
                  const sheet = sheetOf(file, paper.subjectId);
                  const status = sheet?.status ?? "Entry";
                  const counts = countsOf(paper);
                  return (
                    <tr key={paper.subjectId} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium text-primary">{paper.label}</td>
                      <td className="px-3 py-2">{counts.total}</td>
                      <td className="px-3 py-2">
                        {counts.forwarded === counts.total ? (
                          <Badge variant="gold">Forwarded</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {counts.forwarded} of {counts.total} forwarded
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {counts.entered} of {counts.total}
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${counts.total === 0 ? 0 : Math.round((counts.entered / counts.total) * 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">{counts.absent}</td>
                      <td className="px-3 py-2">
                        {counts.passed} · {counts.reappear}
                        {counts.total - counts.absent > 0 && counts.entered === counts.total ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({Math.round((counts.passed / (counts.total - counts.absent)) * 100)}% pass)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusTone[status]}>
                          {status === "Frozen" ? <Lock className="mr-1 size-3" /> : null}
                          {statusWords[status]}
                        </Badge>
                        {sheet && sheet.revision > 1 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Revision {sheet.revision}
                          </p>
                        ) : null}
                        {sheet && sheet.enteredBy.length > 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Entered by {sheet.enteredBy.join(", ")}
                          </p>
                        ) : null}
                        {status === "Frozen" ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatIsoDate(sheet?.frozenOn ?? "")} · {sheet?.frozenBy}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          {mode === "entry" &&
                          (status === "Entry" || status === "Returned") &&
                          file?.status !== "Published" ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy || counts.missing > 0}
                              title={
                                counts.missing > 0
                                  ? `${counts.missing} scholar(s) still need marks`
                                  : undefined
                              }
                              onClick={() =>
                                void act(
                                  sendMarksForVerification(activeBatch, semester, paper.subjectId),
                                  "The marks were sent for verification.",
                                )
                              }
                            >
                              Send for verification
                            </Button>
                          ) : null}
                          {mode === "verify" && status === "Sent" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="gold"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Freeze the marks of ${paper.label}? A frozen mark can not be changed by anyone.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  void act(
                                    freezeMarks(activeBatch, semester, paper.subjectId),
                                    "The marks are verified and frozen.",
                                  );
                                }}
                              >
                                Freeze marks
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setNote("");
                                  setSendingBack(paper.subjectId);
                                }}
                              >
                                Send back
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-readonly-allow
                            onClick={() => setViewing(viewing === paper.subjectId ? null : paper.subjectId)}
                          >
                            {viewing === paper.subjectId ? "Hide marks" : "View marks"}
                          </Button>
                          {status === "Frozen" || status === "Sent" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-readonly-allow
                              onClick={() => setPrinting({ kind: "marks", subjectId: paper.subjectId })}
                            >
                              Print marks sheet
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DeskSection>

      {mode === "verify" && papers.length > 0 ? (
        <DeskSection title="Submit to the research office">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="gold"
                disabled={
                  busy ||
                  !submitReady ||
                  file?.status === "Submitted" ||
                  file?.status === "Approved" ||
                  file?.status === "Published"
                }
                onClick={() => {
                  if (
                    !window.confirm(
                      "Submit this file to the research office? You can not change the marks after this.",
                    )
                  ) {
                    return;
                  }
                  void act(submitToOffice(activeBatch, semester), "The file was submitted to the research office.");
                }}
              >
                {file?.afterBoard ? "Submit the final file" : "Submit to the research office"}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-readonly-allow
                disabled={!submitReady}
                onClick={() => setPrinting({ kind: "galley" })}
              >
                Print the result list
              </Button>
            </div>
            {!submitReady ? (
              <p className="text-muted-foreground">Freeze every paper to submit.</p>
            ) : null}
          </div>
        </DeskSection>
      ) : null}

      {mode === "entry" || viewing ? (
        <DeskSection
          title={mode === "entry" ? "Marks" : "Marks entered"}
          action={
            mode === "entry" ? (
              <Button type="button" size="sm" variant="gold" disabled={busy || dirty === 0} onClick={() => void saveDrafts()}>
                Save marks{dirty > 0 ? ` (${dirty})` : ""}
              </Button>
            ) : null
          }
        >
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  {paperId === "" ? <th className="px-3 py-2 font-semibold">Paper</th> : null}
                  <th className="px-3 py-2 font-semibold">Hall ticket No.</th>
                  <th className="px-3 py-2 font-semibold">Registration No.</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Campus</th>
                  <th className="px-3 py-2 font-semibold">Attendance</th>
                  <th className="px-3 py-2 font-semibold">Marks (out of {settings.maxMarks})</th>
                  <th className="px-3 py-2 font-semibold">Grade · result</th>
                </tr>
              </thead>
              <tbody>
                {gridRows.filter((row) => mode === "entry" || row.paper.subjectId === viewing).length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground" colSpan={8}>
                      No scholar matches.
                    </td>
                  </tr>
                ) : (
                  gridRows
                    .filter((row) => mode === "entry" || row.paper.subjectId === viewing)
                    .map(({ paper, registration, ticket }) => {
                      const forwarded = Boolean(attendanceLockOf(exam, registration));
                      const locked = lockedFor(paper.subjectId) || mode === "verify";
                      const saved = marksOf(paper.subjectId, registration.id);
                      const draft = drafts[registration.id];
                      const shown = draft ?? (saved === null ? "" : String(saved));
                      const marks = shown.trim() === "" ? null : Number(shown);
                      const result = resultOf(
                        settings,
                        exam,
                        registration.id,
                        marks !== null && !Number.isNaN(marks) ? marks : null,
                      );
                      return (
                        <tr key={registration.id} className="border-t border-border">
                          {paperId === "" ? (
                            <td className="px-3 py-2 text-xs">{paper.label}</td>
                          ) : null}
                          <td className="px-3 py-2 font-mono text-xs">{ticket.ticketNo}</td>
                          <td className="px-3 py-2 font-mono text-xs">{ticket.registration}</td>
                          <td className="px-3 py-2 font-medium text-primary">
                            {registration.scholarName}
                          </td>
                          <td className="px-3 py-2">
                            {centreOf(settings, ticket.centreId)?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <MarkButtons
                              name={registration.scholarName}
                              value={(exam.attendance[registration.id] ?? "") as Mark}
                              disabled={locked || busy || forwarded}
                              onChange={(next) =>
                                void act(
                                  markExamAttendance([
                                    { registrationId: registration.id, mark: next },
                                  ]),
                                  "Attendance saved.",
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={result.absent ? "" : shown}
                              inputMode="decimal"
                              className={cn("w-24", locked && "bg-muted")}
                              disabled={locked || result.absent || !forwarded}
                              placeholder={result.absent ? "AAA" : !forwarded ? "Attendance awaited" : ""}
                              aria-label={`Marks for ${registration.scholarName}`}
                              data-marks=""
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                const boxes = [
                                  ...document.querySelectorAll<HTMLInputElement>(
                                    "input[data-marks]:not(:disabled)",
                                  ),
                                ];
                                const next = boxes[boxes.indexOf(event.currentTarget) + 1];
                                next?.focus();
                                next?.select();
                              }}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [registration.id]: event.target.value.replace(/[^0-9.]/g, ""),
                                }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            {result.absent ? (
                              <Badge variant="maroon">AAA</Badge>
                            ) : marks === null || Number.isNaN(marks) ? (
                              "—"
                            ) : (
                              <span>
                                {result.grade} ·{" "}
                                <Badge variant={result.outcome === "Pass" ? "gold" : "maroon"}>
                                  {result.outcome === "Pass" ? "PASS" : "RA"}
                                </Badge>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </DeskSection>
      ) : null}

      {sendingBack ? (
        <FormDialog
          title="Send the marks back to marks entry"
          submitLabel="Send back"
          busy={busy}
          onClose={() => setSendingBack(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void act(
              sendMarksBack(activeBatch, semester, sendingBack, note),
              "The marks were sent back for correction.",
            ).then((ok) => {
              if (ok) setSendingBack(null);
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">What has to be corrected?</span>
            <textarea
              value={note}
              rows={4}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
              aria-label="What has to be corrected"
            />
          </label>
        </FormDialog>
      ) : null}
    </DeskPage>
  );
}
