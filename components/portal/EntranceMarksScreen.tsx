"use client";

import { useState, useSyncExternalStore } from "react";

import { DeskPager } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { examCopy, examPageSize } from "@/data/exams";
import {
  admissionLockCopy,
  interviewMax,
  selectionFlowCopy,
  writtenMax,
} from "@/data/admission";
import {
  admissionFileFrozen,
  archivedKeys,
  currentAdmission,
  displayName,
  isLiveAdmissionCase,
  sanitizeMark,
  saveEntrancePage,
  scoreFor,
  stepIsOpen,
  subscribeAdmission,
  totalMarks,
  type AdmissionCase,
} from "@/lib/admission";
import { filterMatches } from "@/lib/list-filter";
import { pageCount, pageSlice } from "@/lib/paging";
import { cn } from "@/lib/utils";

type Draft = { written: string; interview: string };
type Round = "written" | "interview";

type EntranceRow = {
  key: string;
  applicationId: string;
  name: string;
  department: string;
  applicationNo: string;
  hallTicketNo: string;
  written: number | null;
  interview: number | null;
};

const fullMarks = writtenMax + interviewMax;

/** One interview panel with the candidates seated on it, in the order of its sheet. */
export type MarksPanel = {
  id: string;
  name: string;
  /** The two experts, for the line under the panel name. */
  experts: string;
  applicationIds: string[];
};

function rowFromCase(
  row: AdmissionCase,
  score: ReturnType<typeof scoreFor>,
): EntranceRow {
  return {
    key: `app:${row.applicationId}`,
    applicationId: row.applicationId,
    name: displayName(row),
    department: row.department,
    applicationNo: row.applicationNo,
    hallTicketNo: row.hallTicketNo,
    written: score?.written ?? row.written,
    interview: score?.interview ?? row.interview,
  };
}

/**
 * Entrance marks in two rounds: the written test for every present candidate first, then
 * the interview. The total out of 100 is shown as the marks are typed.
 */
export function EntranceMarksScreen({
  locked = false,
  panels = [],
}: {
  /** Kept for the Selection desk, which always embeds this screen. */
  embedded?: boolean;
  locked?: boolean;
  /** When panels are set up, the interview round is entered panel by panel. */
  panels?: MarksPanel[];
}) {
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const [chosenRound, setChosenRound] = useState<Round | null>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [chosenPanel, setChosenPanel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!store) {
    return <p className="text-sm text-muted-foreground">Loading entrance marks…</p>;
  }

  const admission = store;
  const stepLocked = locked || !stepIsOpen(store.progress, "marks");
  const liveKeys = archivedKeys(store.archived);
  const rows: EntranceRow[] = store.cases
    .filter(
      (row) =>
        isLiveAdmissionCase(row, liveKeys) &&
        !row.sessionClosed &&
        row.shortlisted &&
        row.attendance === "Present",
    )
    .map((row) =>
      rowFromCase(row, scoreFor(store.entranceScores, `app:${row.applicationId}`)),
    )
    .sort(
      (a, b) =>
        (a.hallTicketNo || "~").localeCompare(b.hallTicketNo || "~") ||
        a.name.localeCompare(b.name),
    );
  const writtenDone = rows.filter((row) => row.written !== null).length;
  const interviewDone = rows.filter((row) => row.interview !== null).length;
  const roundOneComplete = rows.length > 0 && writtenDone === rows.length;
  const round: Round = !roundOneComplete
    ? "written"
    : (chosenRound ?? (interviewDone < rows.length ? "interview" : "written"));
  const departments = [...new Set(rows.map((row) => row.department))].sort((a, b) =>
    a.localeCompare(b),
  );

  // Interview marks are entered panel by panel, in the order printed on the panel's sheet.
  const byPanel = round === "interview" && panels.length > 0;
  const activePanel = byPanel
    ? (panels.find((item) => item.id === chosenPanel) ??
      panels.find((item) =>
        item.applicationIds.some(
          (id) => rows.find((row) => row.applicationId === id)?.interview === null,
        ),
      ) ??
      panels[0])
    : null;
  const panelRows = activePanel
    ? activePanel.applicationIds.flatMap((id) => {
        const found = rows.find((row) => row.applicationId === id);
        return found ? [found] : [];
      })
    : rows;

  const visible = panelRows.filter(
    (row) =>
      textMatches(query, [
        row.name,
        row.applicationNo,
        row.hallTicketNo,
        row.department,
      ]) && filterMatches(department, row.department),
  );
  const pages = pageCount(visible.length, examPageSize);
  const shown = pageSlice(visible, Math.min(page, pages), examPageSize);

  function draftOf(row: EntranceRow): Draft {
    return (
      drafts[row.key] ?? {
        written: row.written === null ? "" : String(row.written),
        interview: row.interview === null ? "" : String(row.interview),
      }
    );
  }

  function rowFrozen(row: EntranceRow) {
    if (unlocked[row.key]) return false;
    const linked = admission.cases.find(
      (item) => item.applicationId === row.applicationId,
    );
    if (linked?.correctionOpen) return false;
    return linked ? admissionFileFrozen(linked) : false;
  }

  function setDraft(row: EntranceRow, field: keyof Draft, value: string) {
    const max = field === "written" ? writtenMax : interviewMax;
    const checked = sanitizeMark(value, max);
    if (checked.value === null) {
      // The value is refused, so a mark above the maximum never reaches the field.
      setFieldError((current) => ({
        ...current,
        [`${row.key}:${field}`]: checked.error ?? "",
      }));
      return;
    }
    setFieldError((current) => {
      const next = { ...current };
      delete next[`${row.key}:${field}`];
      return next;
    });
    setDrafts((current) => ({
      ...current,
      [row.key]: { ...draftOf(row), [field]: checked.value },
    }));
  }

  async function save(advance: boolean) {
    const changed = shown.rows.filter((row) => drafts[row.key]);
    if (changed.length === 0) {
      if (advance && shown.page < pages) setPage(shown.page + 1);
      else setNotice("Nothing new to save on this page.");
      return;
    }
    setBusy(true);
    const saved = await saveEntrancePage(
      changed.map((row) => {
        const draft = draftOf(row);
        return {
          key: row.key,
          applicationId: row.applicationId,
          written: draft.written,
          interview: draft.interview,
        };
      }),
    );
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      changed.forEach((row) => delete next[row.key]);
      return next;
    });
    if (advance && shown.page < pages) {
      setPage(shown.page + 1);
      setNotice(`Page ${shown.page} saved. Continue with the next page.`);
      return;
    }
    setNotice(
      round === "written" ? "Written test marks saved." : "Interview marks saved.",
    );
  }

  function markInput(row: EntranceRow, field: keyof Draft, frozen: boolean) {
    const draft = draftOf(row);
    const max = field === "written" ? writtenMax : interviewMax;
    const error = fieldError[`${row.key}:${field}`];
    return (
      <div className="w-24">
        <Input
          inputMode="numeric"
          maxLength={2}
          disabled={frozen}
          value={draft[field]}
          placeholder={`/ ${max}`}
          onChange={(event) => setDraft(row, field, event.target.value)}
          aria-label={`${field === "written" ? "Written test" : "Interview"} mark for ${row.name}`}
        />
        {error ? <p className="mt-1 text-xs text-secondary">{error}</p> : null}
      </div>
    );
  }

  const roundButton = (id: Round, label: string, done: number, disabled: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setChosenRound(id);
        setPage(1);
        setNotice(null);
      }}
      className={cn(
        "flex flex-1 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm",
        round === id
          ? "border-primary bg-primary text-primary-foreground shadow-card"
          : "border-border bg-card text-primary hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className="text-xs font-semibold">
        {done}/{rows.length}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        {roundButton(
          "written",
          `Round 1 · Written test (out of ${writtenMax})`,
          writtenDone,
          false,
        )}
        {roundButton(
          "interview",
          `Round 2 · Interview (out of ${interviewMax})`,
          interviewDone,
          !roundOneComplete,
        )}
      </div>
      {byPanel ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Interview panel">
            {panels.map((item) => {
              const mine = item.applicationIds.flatMap((id) => {
                const found = rows.find((row) => row.applicationId === id);
                return found ? [found] : [];
              });
              const done = mine.filter((row) => row.interview !== null).length;
              const active = activePanel?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setChosenPanel(item.id);
                    setPage(1);
                    setNotice(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-primary hover:border-primary/40",
                  )}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="ml-2 text-xs">
                    {done}/{mine.length}
                  </span>
                </button>
              );
            })}
          </div>
          {activePanel?.experts ? (
            <p className="text-xs text-muted-foreground">
              Panel members: {activePanel.experts}
            </p>
          ) : null}
        </div>
      ) : null}
      {!roundOneComplete && rows.length > 0 ? (
        <p className="text-sm text-secondary">
          Enter the written test mark for every present candidate. The interview round
          opens after that.
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        filters={[
          {
            id: "department",
            label: "Subject",
            value: department,
            options: departments.map((item) => ({ value: item, label: item })),
            onChange: (value) => {
              setDepartment(value);
              setPage(1);
            },
          },
        ]}
        shown={visible.length}
        total={panelRows.length}
        filename="entrance-marks.csv"
        title="Entrance and interview marks"
        headers={[
          "Hall ticket No.",
          "Name",
          "Subject",
          "Application No.",
          `Written (${writtenMax})`,
          `Interview (${interviewMax})`,
          `Total (${fullMarks})`,
        ]}
        rows={visible.map((row) => [
          row.hallTicketNo,
          row.name,
          row.department,
          row.applicationNo,
          row.written === null ? "" : String(row.written),
          row.interview === null ? "" : String(row.interview),
          String(totalMarks({ written: row.written, interview: row.interview }) ?? ""),
        ])}
      />
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskPager
        page={shown.page}
        pageCount={pages}
        label={`Candidates ${visible.length === 0 ? 0 : shown.start}–${shown.end} of ${visible.length}`}
        onPage={setPage}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3 font-semibold">Hall ticket No.</th>
              <th className="px-3 py-3 font-semibold">Candidate</th>
              <th className="px-3 py-3 font-semibold">Subject</th>
              <th className="px-3 py-3 font-semibold">Written / {writtenMax}</th>
              <th className="px-3 py-3 font-semibold">Interview / {interviewMax}</th>
              <th className="px-3 py-3 font-semibold">Total / {fullMarks}</th>
            </tr>
          </thead>
          <tbody>
            {shown.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                  {selectionFlowCopy.marksEmpty}
                </td>
              </tr>
            ) : (
              shown.rows.map((row) => {
                const draft = draftOf(row);
                const rowLocked = rowFrozen(row);
                const frozen = stepLocked || rowLocked;
                const written = draft.written === "" ? null : Number(draft.written);
                const interview = draft.interview === "" ? null : Number(draft.interview);
                const total =
                  written === null && interview === null
                    ? null
                    : (written ?? 0) + (interview ?? 0);
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-t border-border",
                      drafts[row.key] && "bg-accent/10",
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.hallTicketNo || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-primary">{row.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.applicationNo}
                      </p>
                    </td>
                    <td className="px-3 py-2">{row.department || "—"}</td>
                    <td className="px-3 py-2">
                      {round === "written" ? (
                        markInput(row, "written", frozen)
                      ) : (
                        <span className="font-semibold">{row.written ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {round === "interview" ? (
                        markInput(row, "interview", frozen)
                      ) : (
                        <span className="text-muted-foreground">
                          {row.interview ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {total === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant={
                              written !== null && interview !== null ? "gold" : "outline"
                            }
                          >
                            {total} / {fullMarks}
                          </Badge>
                        )}
                        {!stepLocked && (rowLocked || unlocked[row.key]) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setUnlocked((current) => ({
                                ...current,
                                [row.key]: !current[row.key],
                              }))
                            }
                          >
                            {unlocked[row.key]
                              ? admissionLockCopy.lock
                              : admissionLockCopy.unlock}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!stepLocked ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {examCopy.savePage}
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={busy}
            onClick={() => void save(true)}
          >
            {examCopy.saveContinue}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
