"use client";

import { useState, useSyncExternalStore } from "react";

import { DeskPage, DeskPager } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
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
  isLiveAdmissionCase,
  sanitizeMark,
  saveEntrancePage,
  scoreFor,
  stepIsOpen,
  subscribeAdmission,
  totalMarks,
  type AdmissionCase,
} from "@/lib/admission";
import { pageCount, pageSlice } from "@/lib/paging";

type Draft = { written: string; interview: string };

type EntranceRow = {
  key: string;
  applicationId: string;
  name: string;
  department: string;
  applicationNo: string;
  registration: string;
  written: number | null;
  interview: number | null;
};

function rowFromCase(
  row: AdmissionCase,
  score: ReturnType<typeof scoreFor>,
  registration: string,
): EntranceRow {
  return {
    key: `app:${row.applicationId}`,
    applicationId: row.applicationId,
    name: row.name,
    department: row.department,
    applicationNo: row.applicationNo,
    registration,
    written: score?.written ?? row.written,
    interview: score?.interview ?? row.interview,
  };
}

export function EntranceMarksScreen({
  embedded = false,
  locked = false,
}: {
  embedded?: boolean;
  locked?: boolean;
}) {
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const [query, setQuery] = useState("");
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
    .filter((row) => isLiveAdmissionCase(row, liveKeys) && row.shortlisted)
    .map((row) =>
      rowFromCase(row, scoreFor(store.entranceScores, `app:${row.applicationId}`), ""),
    );

  const visible = rows.filter((row) =>
    textMatches(query, [row.name, row.applicationNo, row.registration, row.department]),
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
    const linked = row.applicationId
      ? admission.cases.find((item) => item.applicationId === row.applicationId)
      : null;
    if (linked?.correctionOpen) return false;
    if (linked) return admissionFileFrozen(linked);
    return false;
  }

  function setDraft(key: string, field: keyof Draft, value: string) {
    const max = field === "written" ? writtenMax : interviewMax;
    const checked = sanitizeMark(value, max);
    if (checked.value === null) {
      setFieldError((current) => ({
        ...current,
        [`${key}:${field}`]: checked.error ?? "",
      }));
      return;
    }
    setFieldError((current) => {
      const next = { ...current };
      delete next[`${key}:${field}`];
      return next;
    });
    setDrafts((current) => {
      const row = shown.rows.find((item) => item.key === key);
      const base = row ? draftOf(row) : { written: "", interview: "" };
      return { ...current, [key]: { ...base, [field]: checked.value } };
    });
  }

  async function save(advance: boolean) {
    setBusy(true);
    const saved = await saveEntrancePage(
      shown.rows
        .filter((row) => !rowFrozen(row) || Boolean(drafts[row.key]))
        .map((row) => {
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
      shown.rows.forEach((row) => {
        delete next[row.key];
      });
      return next;
    });
    if (advance && shown.page < pages) {
      setPage(shown.page + 1);
      setNotice(`Page ${shown.page} saved. Continue with the next 25 scholars.`);
      return;
    }
    setNotice("This page of entrance marks is saved.");
  }

  const body = (
    <>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {examCopy.entranceDetail} Written test {writtenMax}. Interview {interviewMax}.{" "}
        {examCopy.emptyMarks}
      </p>
      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        filters={[]}
        shown={visible.length}
        total={rows.length}
        filename="entrance-marks.csv"
        downloadLabel="Download entrance marks"
        headers={[
          "name",
          "department",
          "application_number",
          "registration_number",
          "written",
          "interview",
          "total",
        ]}
        rows={visible.map((row) => [
          row.name,
          row.department,
          row.applicationNo,
          row.registration,
          row.written === null ? "" : String(row.written),
          row.interview === null ? "" : String(row.interview),
          String(totalMarks({ written: row.written, interview: row.interview }) ?? ""),
        ])}
      />
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskPager
        page={shown.page}
        pageCount={pages}
        label={`Scholars ${visible.length === 0 ? 0 : shown.start}–${shown.end} of ${visible.length}`}
        onPage={setPage}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3 font-semibold">Name</th>
              <th className="px-3 py-3 font-semibold">Department</th>
              <th className="px-3 py-3 font-semibold">Application No.</th>
              <th className="px-3 py-3 font-semibold">Registration</th>
              <th className="px-3 py-3 font-semibold">Written</th>
              <th className="px-3 py-3 font-semibold">Interview</th>
              <th className="px-3 py-3 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {shown.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                  {selectionFlowCopy.marksEmpty}
                </td>
              </tr>
            ) : (
              shown.rows.map((row) => {
                const draft = draftOf(row);
                const rowLocked = rowFrozen(row);
                const frozen = stepLocked || rowLocked;
                const total = totalMarks({
                  written: draft.written === "" ? null : Number(draft.written),
                  interview: draft.interview === "" ? null : Number(draft.interview),
                });
                const writtenError = fieldError[`${row.key}:written`];
                const interviewError = fieldError[`${row.key}:interview`];
                return (
                  <tr key={row.key} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-primary">{row.name}</td>
                    <td className="px-3 py-2">{row.department || "—"}</td>
                    <td className="px-3 py-2">{row.applicationNo || "—"}</td>
                    <td className="px-3 py-2">{row.registration || "—"}</td>
                    <td className="px-3 py-2">
                      <Input
                        inputMode="numeric"
                        min={0}
                        max={writtenMax}
                        disabled={frozen}
                        value={draft.written}
                        onChange={(event) =>
                          setDraft(row.key, "written", event.target.value)
                        }
                        aria-label={`Written marks for ${row.name}`}
                      />
                      {writtenError ? (
                        <p className="mt-1 text-xs text-secondary">{writtenError}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        inputMode="numeric"
                        min={0}
                        max={interviewMax}
                        disabled={frozen}
                        value={draft.interview}
                        onChange={(event) =>
                          setDraft(row.key, "interview", event.target.value)
                        }
                        aria-label={`Interview marks for ${row.name}`}
                      />
                      {interviewError ? (
                        <p className="mt-1 text-xs text-secondary">{interviewError}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{total ?? "—"}</span>
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || stepLocked}
          onClick={() => void save(false)}
        >
          {examCopy.savePage}
        </Button>
        <Button
          type="button"
          variant="gold"
          disabled={busy || stepLocked}
          onClick={() => void save(true)}
        >
          {examCopy.saveContinue}
        </Button>
      </div>
    </>
  );

  if (embedded) return <div className="space-y-4">{body}</div>;

  return (
    <DeskPage kicker={examCopy.entranceKicker} title={examCopy.entranceTitle}>
      {body}
    </DeskPage>
  );
}
