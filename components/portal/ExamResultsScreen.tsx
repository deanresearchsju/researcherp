"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskPage, DeskSection, FormDialog } from "@/components/portal/Desk";
import { ListSheet, PrintFrame } from "@/components/portal/ExamPrint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  candidatesFor,
  currentExam,
  gradeFor,
  outcomeFor,
  publishExamResults,
  recordPassingBoard,
  subscribeExam,
  type ExamResultFile,
} from "@/lib/exam-office";
import { registrationCompare } from "@/lib/register";
import { usePreviewSession } from "@/lib/use-preview-session";

const statusWords: Record<ExamResultFile["status"], string> = {
  Open: "With the COE",
  Submitted: "Submitted · waiting for the passing board",
  Approved: "Approved by the passing board",
  Published: "Published",
};

/**
 * The research office's side of the results: the file the COE submitted goes to the passing
 * board; the administrator records its approval (or the changes it suggests, which go back to
 * the COE) and then publishes the results to the scholars.
 */
export function ExamResultsScreen() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [decision, setDecision] = useState<"Approved" | "Changes">("Approved");
  const [on, setOn] = useState(clientToday());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);

  if (!ready || !doctoral || !exam) {
    return <p className="text-sm text-muted-foreground">Loading the results…</p>;
  }
  const isAdmin = session?.role === "admin";
  const settings = exam.settings;
  const files = [...exam.files].sort((left, right) =>
    `${right.sessionYear}${right.semester}`.localeCompare(
      `${left.sessionYear}${left.semester}`,
    ),
  );
  const batchName = (id: string) =>
    doctoral.batches.find((batch) => batch.id === id)?.name ?? id;
  const subjectLabel = (id: string) => {
    const subject = doctoral.subjects.find((item) => item.id === id);
    return subject ? `${subject.code} ${subject.name}` : id;
  };

  async function act(task: Promise<{ ok: boolean }>, done: string) {
    setBusy(true);
    const result = await task;
    setBusy(false);
    setNotice(
      result.ok
        ? done
        : ((result as unknown as { message?: string }).message ??
            "That could not be done."),
    );
    return result.ok;
  }

  if (printing) {
    const file = exam.files.find((item) => item.id === printing);
    if (file) {
      const rows = file.sheets
        .flatMap((sheet) =>
          candidatesFor(doctoral, exam, file.batchId, file.semester, sheet.subjectId).map(
            ({ registration, ticket }) => {
              const absent = exam.attendance[registration.id] === "Absent";
              const marks = absent ? null : (sheet.marks[registration.id] ?? null);
              const outcome = outcomeFor(settings, marks, absent);
              return {
                sort: ticket.registration,
                cells: [
                  ticket.registration,
                  registration.scholarName,
                  registration.code,
                  absent ? "AAA" : marks === null ? "" : String(marks),
                  absent ? "AAA" : marks === null ? "" : gradeFor(settings, marks),
                  absent ? "AAA" : outcome === "Pass" ? "PASS" : "RA",
                ],
              };
            },
          ),
        )
        .sort(
          (left, right) =>
            registrationCompare(left.sort, right.sort) ||
            left.cells[1].localeCompare(right.cells[1]),
        );
      return (
        <PrintFrame onBack={() => setPrinting(null)} printLabel="Print result list">
          <ListSheet
            title="Course Work Examination · Result list"
            details={[
              `Batch: ${batchName(file.batchId)}`,
              `Semester: ${file.semester}`,
              `Session: ${file.sessionMonth} ${file.sessionYear}`,
              `Status: ${statusWords[file.status]}`,
              file.boardOn
                ? `Passing board: ${formatIsoDate(file.boardOn)}`
                : "Passing board: —",
            ]}
            headers={["Registration No.", "Name", "Code", "Marks", "Grade", "Result"]}
            widths={["w-36", "", "w-24", "w-16", "w-14", "w-16"]}
            bold={[1]}
            rows={rows.map((row) => row.cells)}
            signatures={[
              "Controller of Examinations",
              "Dean, Research and Development",
              "Vice Chancellor",
            ]}
            perPage={24}
          />
        </PrintFrame>
      );
    }
  }

  const decidingFile = exam.files.find((file) => file.id === deciding) ?? null;

  return (
    <DeskPage kicker="Examination" title="Result approval">
      {exam.detail ? <p className="text-sm text-secondary">{exam.detail}</p> : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}

      {files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No marks file yet.
        </p>
      ) : (
        files.map((file) => {
          const frozen = file.sheets.filter((sheet) => sheet.status === "Frozen").length;
          const canPublish =
            file.status === "Approved" ||
            (file.status === "Submitted" && file.afterBoard);
          return (
            <DeskSection
              key={file.id}
              title={`${batchName(file.batchId)} · Semester ${file.semester} · ${file.sessionMonth} ${file.sessionYear}`}
              action={
                <Badge
                  variant={
                    file.status === "Published"
                      ? "gold"
                      : file.status === "Open"
                        ? "outline"
                        : "purple"
                  }
                >
                  {file.afterBoard && file.status === "Submitted"
                    ? "Final file submitted"
                    : statusWords[file.status]}
                </Badge>
              }
            >
              <div className="space-y-3 p-4 text-sm">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[36rem] border-collapse text-left">
                    <thead className="bg-muted text-primary">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Paper</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Frozen on</th>
                        <th className="px-3 py-2 font-semibold">Revision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {file.sheets.map((sheet) => (
                        <tr key={sheet.subjectId} className="border-t border-border">
                          <td className="px-3 py-2">{subjectLabel(sheet.subjectId)}</td>
                          <td className="px-3 py-2">{sheet.status}</td>
                          <td className="px-3 py-2">
                            {sheet.frozenOn ? formatIsoDate(sheet.frozenOn) : "—"}
                          </td>
                          <td className="px-3 py-2">{sheet.revision}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground">
                  {frozen} of {file.sheets.length} paper(s) frozen
                  {file.submittedOn
                    ? ` · submitted ${formatIsoDate(file.submittedOn)} by ${file.submittedBy}`
                    : ""}
                  {file.boardOn
                    ? ` · passing board ${formatIsoDate(file.boardOn)}${file.boardRef ? ` (${file.boardRef})` : ""}`
                    : ""}
                  {file.publishedOn
                    ? ` · published ${formatIsoDate(file.publishedOn)}`
                    : ""}
                </p>
                {file.boardNote && file.status !== "Published" ? (
                  <p className="font-medium text-secondary">Board: {file.boardNote}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-readonly-allow
                    disabled={frozen === 0}
                    onClick={() => setPrinting(file.id)}
                  >
                    Print result list
                  </Button>
                  {isAdmin && file.status === "Submitted" && !file.afterBoard ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      onClick={() => {
                        setDecision("Approved");
                        setOn(clientToday());
                        setReference("");
                        setNote("");
                        setSubjects([]);
                        setDeciding(file.id);
                      }}
                    >
                      Record passing board
                    </Button>
                  ) : null}
                  {isAdmin && canPublish ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Publish these results to the scholars? A published result can not be changed.",
                          )
                        ) {
                          return;
                        }
                        void act(
                          publishExamResults(file.id),
                          "The results are published. Scholars can see them under Results.",
                        );
                      }}
                    >
                      Publish results
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    data-readonly-allow
                    onClick={() => setOpened(opened === file.id ? null : file.id)}
                  >
                    {opened === file.id ? "Hide history" : "History"}
                  </Button>
                </div>
                {opened === file.id ? (
                  <ol className="space-y-1 border-l-2 border-primary/20 pl-4">
                    {file.log.length === 0 ? (
                      <li className="text-muted-foreground">Nothing recorded yet.</li>
                    ) : (
                      file.log.map((entry, index) => (
                        <li key={index}>
                          <span className="font-semibold text-primary">
                            {entry.action}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatIsoDate(entry.on)} · {entry.by}
                          </span>
                          {entry.note ? (
                            <p className="text-muted-foreground">{entry.note}</p>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ol>
                ) : null}
              </div>
            </DeskSection>
          );
        })
      )}

      {decidingFile ? (
        <FormDialog
          title="Passing board"
          submitLabel={
            decision === "Approved" ? "Record approval" : "Send back to the COE"
          }
          busy={busy}
          size="lg"
          onClose={() => setDeciding(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void act(
              recordPassingBoard(decidingFile.id, decision, {
                on,
                reference,
                note,
                subjectIds: subjects,
              }),
              decision === "Approved"
                ? "The passing board's approval is recorded. You can publish the results."
                : "The suggested changes were sent to the COE.",
            ).then((ok) => {
              if (ok) setDeciding(null);
            });
          }}
        >
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-4">
              {(["Approved", "Changes"] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="decision"
                    className="accent-primary"
                    checked={decision === item}
                    onChange={() => setDecision(item)}
                  />
                  {item === "Approved"
                    ? "Approved as it is"
                    : "Changes suggested (bossing etc.)"}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="font-semibold text-primary">
                  Date of the passing board
                </span>
                <Input
                  type="date"
                  value={on}
                  onChange={(event) => setOn(event.target.value)}
                  aria-label="Date of the passing board"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-semibold text-primary">Minutes / reference</span>
                <Input
                  value={reference}
                  maxLength={80}
                  onChange={(event) => setReference(event.target.value)}
                  aria-label="Minutes or reference"
                />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="font-semibold text-primary">
                {decision === "Approved" ? "Note (optional)" : "What the board suggests"}
              </span>
              <textarea
                value={note}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-xl border border-input bg-white px-3 py-2"
                aria-label="Note"
              />
            </label>
            {decision === "Changes" ? (
              <fieldset className="space-y-1">
                <legend className="font-semibold text-primary">
                  Papers going back to the COE (none ticked means all)
                </legend>
                {decidingFile.sheets.map((sheet) => (
                  <label key={sheet.subjectId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={subjects.includes(sheet.subjectId)}
                      onChange={() =>
                        setSubjects((current) =>
                          current.includes(sheet.subjectId)
                            ? current.filter((item) => item !== sheet.subjectId)
                            : [...current, sheet.subjectId],
                        )
                      }
                    />
                    {subjectLabel(sheet.subjectId)}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </div>
        </FormDialog>
      ) : null}
    </DeskPage>
  );
}
