"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import {
  DeskModal,
  DeskPage,
  DeskPager,
  DeskSection,
  DeskTable,
  DeskTabs,
  ScholarIdentityHeader,
  StatusPill,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  examCopy,
  examOutcomes,
  examPageSize,
  examYears,
  type ExamOutcome,
} from "@/data/exams";
import { resultGradeKey } from "@/data/portal-desk";
import { months } from "@/lib/constants";
import { clientToday } from "@/lib/dates";
import {
  currentDoctoral,
  examSessionLabel,
  paperOf,
  publishResults,
  resultFor,
  resultsFor,
  subscribeDoctoral,
  type CourseRegistration,
} from "@/lib/doctoral";
import { pageCount, pageSlice } from "@/lib/paging";
import { usePortalSession } from "@/lib/use-preview-session";

function outcomeLabel(
  row: CourseRegistration,
  doctoral: NonNullable<ReturnType<typeof currentDoctoral>>,
) {
  return resultFor(doctoral, row.id)?.outcome ?? examCopy.pending;
}

export function ResultScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [semester, setSemester] = useState("");
  const [tab, setTab] = useState("grades");
  const [gradeKey, setGradeKey] = useState(false);
  const [sessionMonth, setSessionMonth] = useState("");
  const [sessionYear, setSessionYear] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, ExamOutcome | "">>({});
  const [busy, setBusy] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  if (!ready || !doctoral)
    return <p className="text-sm text-muted-foreground">Loading results…</p>;

  const rows = doctoral.registrations.filter((row) => {
    if (mode === "scholar" && row.scholarIdentifier !== session?.identifier) return false;
    if (mode !== "admin") return true;
    const label = outcomeLabel(row, doctoral);
    return (
      filterMatches(outcome, label) &&
      filterMatches(semester, String(row.semester)) &&
      textMatches(query, [
        row.scholarName,
        paperOf(doctoral, row).code,
        paperOf(doctoral, row).name,
        label,
      ])
    );
  });

  const pages = pageCount(rows.length, examPageSize);
  const shown = pageSlice(rows, Math.min(page, pages), examPageSize);
  const failed = rows.filter((row) => resultFor(doctoral, row.id)?.outcome === "RA");
  const absent = rows.filter((row) => resultFor(doctoral, row.id)?.outcome === "AAA");
  const history = historyId && doctoral ? resultsFor(doctoral, historyId) : [];

  async function save(advance: boolean) {
    if (!doctoral) return;
    if (!sessionMonth || !sessionYear) {
      setNotice("Select the month and year of the exam session.");
      return;
    }
    const entries = shown.rows.flatMap((row) => {
      const chosen = drafts[row.id];
      if (!chosen) return [];
      return [{ registrationId: row.id, outcome: chosen }];
    });
    if (entries.length === 0) {
      setNotice("Mark Pass, RA or Absent on this page before saving.");
      return;
    }
    setBusy(true);
    const saved = await publishResults(entries, sessionMonth, sessionYear, clientToday());
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      shown.rows.forEach((row) => {
        delete next[row.id];
      });
      return next;
    });
    if (advance && shown.page < pages) {
      setPage(shown.page + 1);
      setNotice(`Page ${shown.page} saved. Continue with the next 25 papers.`);
      return;
    }
    setNotice(
      "This page of results is saved. Earlier sittings stay in the exam history.",
    );
  }

  return (
    <DeskPage title={examCopy.resultsTitle}>
      {mode === "scholar" ? (
        <ScholarIdentityHeader identifier={session?.identifier ?? ""} />
      ) : null}
      {mode === "scholar" ? (
        <DeskTabs
          tabs={[
            { id: "grades", label: "Grade / mark" },
            { id: "failed", label: "RA courses" },
            { id: "absent", label: "Absent details" },
            { id: "history", label: examCopy.historyTitle },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : (
        <>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {examCopy.resultsDetail}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-primary">
                {examCopy.sessionLabel} month
              </span>
              <NativeSelect
                aria-label="Exam month"
                value={sessionMonth}
                onChange={(event) => setSessionMonth(event.target.value)}
              >
                <option value="">Select month</option>
                {months.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-primary">Year</span>
              <NativeSelect
                aria-label="Exam year"
                value={sessionYear}
                onChange={(event) => setSessionYear(event.target.value)}
              >
                <option value="">Select year</option>
                {examYears.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
        </>
      )}
      {mode === "admin" ? (
        <ListToolbar
          query={query}
          onQuery={(value) => {
            setQuery(value);
            setPage(1);
          }}
          filters={[
            {
              id: "outcome",
              label: "Result",
              value: outcome,
              options: [...examOutcomes, examCopy.pending].map((item) => ({
                value: item,
                label: item === "AAA" ? "Absent" : item,
              })),
              onChange: (value) => {
                setOutcome(value);
                setPage(1);
              },
            },
            {
              id: "semester",
              label: "Semester",
              value: semester,
              options: ["1", "2", "3", "4"].map((item) => ({
                value: item,
                label: `Semester ${item}`,
              })),
              onChange: (value) => {
                setSemester(value);
                setPage(1);
              },
            },
          ]}
          shown={rows.length}
          total={doctoral.registrations.length}
          filename="course-results.csv"
          headers={[
            "scholar",
            "semester",
            "code",
            "subject",
            "latest_result",
            "session",
            "attempts",
          ]}
          rows={rows.map((row) => {
            const paper = paperOf(doctoral, row);
            const result = resultFor(doctoral, row.id);
            return [
              row.scholarName,
              String(row.semester),
              paper.code,
              paper.name,
              result?.outcome ?? examCopy.pending,
              result ? examSessionLabel(result) : "",
              String(resultsFor(doctoral, row.id).length),
            ];
          })}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        <>
          {tab === "grades" ? (
            <DeskSection
              title="Grade / mark obtained"
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setGradeKey(true)}
                >
                  View grade details
                </Button>
              }
            >
              <DeskTable
                headers={[
                  "Semester",
                  "Month / year",
                  "Code",
                  "Description",
                  "Credit",
                  "Result",
                ]}
                empty={rows.length === 0}
              >
                {rows.map((row) => {
                  const paper = paperOf(doctoral, row);
                  const result = resultFor(doctoral, row.id);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3">{row.semester}</td>
                      <td className="px-4 py-3">
                        {result ? examSessionLabel(result) || "—" : "—"}
                      </td>
                      <td className="px-4 py-3">{paper.code || "—"}</td>
                      <td className="px-4 py-3">{paper.name || "—"}</td>
                      <td className="px-4 py-3">{paper.credits || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={result?.outcome ?? examCopy.pending} />
                      </td>
                    </tr>
                  );
                })}
              </DeskTable>
            </DeskSection>
          ) : null}
          {tab === "failed" ? (
            <DeskSection title="RA courses">
              <DeskTable
                headers={["Code", "Description", "Semester", "Result"]}
                empty={failed.length === 0}
              >
                {failed.map((row) => {
                  const paper = paperOf(doctoral, row);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3">{paper.code || "—"}</td>
                      <td className="px-4 py-3">{paper.name || "—"}</td>
                      <td className="px-4 py-3">{row.semester}</td>
                      <td className="px-4 py-3">
                        <StatusPill status="RA" />
                      </td>
                    </tr>
                  );
                })}
              </DeskTable>
            </DeskSection>
          ) : null}
          {tab === "absent" ? (
            <DeskSection title="Absent details">
              <DeskTable
                headers={["Code", "Description", "Semester"]}
                empty={absent.length === 0}
              >
                {absent.map((row) => {
                  const paper = paperOf(doctoral, row);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3">{paper.code || "—"}</td>
                      <td className="px-4 py-3">{paper.name || "—"}</td>
                      <td className="px-4 py-3">{row.semester}</td>
                    </tr>
                  );
                })}
              </DeskTable>
            </DeskSection>
          ) : null}
          {tab === "history" ? (
            <DeskSection title={examCopy.historyTitle}>
              <DeskTable
                headers={["Code", "Session", "Result"]}
                empty={rows.every((row) => resultsFor(doctoral, row.id).length === 0)}
              >
                {rows.flatMap((row) => {
                  const paper = paperOf(doctoral, row);
                  return resultsFor(doctoral, row.id).map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {paper.code} {paper.name}
                      </td>
                      <td className="px-4 py-3">{examSessionLabel(item) || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={item.outcome} />
                      </td>
                    </tr>
                  ));
                })}
              </DeskTable>
            </DeskSection>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <DeskPager
            page={shown.page}
            pageCount={pages}
            label={`Papers ${rows.length === 0 ? 0 : shown.start}–${shown.end} of ${rows.length}`}
            onPage={setPage}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-3 font-semibold">Scholar</th>
                  <th className="px-3 py-3 font-semibold">Paper</th>
                  <th className="px-3 py-3 font-semibold">Latest</th>
                  <th className="px-3 py-3 font-semibold">This session</th>
                  <th className="px-3 py-3 font-semibold">History</th>
                </tr>
              </thead>
              <tbody>
                {shown.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                      No course-work paper is waiting on this page.
                    </td>
                  </tr>
                ) : (
                  shown.rows.map((row) => {
                    const paper = paperOf(doctoral, row);
                    const result = resultFor(doctoral, row.id);
                    const attempts = resultsFor(doctoral, row.id);
                    const locked =
                      attempts.some((item) => item.outcome === "Pass") ||
                      attempts.some(
                        (item) =>
                          item.sessionMonth === sessionMonth &&
                          item.sessionYear === sessionYear,
                      );
                    return (
                      <tr key={row.id} className="border-t border-border align-top">
                        <td className="px-3 py-3">
                          <p className="font-medium text-primary">{row.scholarName}</p>
                          <p className="text-muted-foreground">Semester {row.semester}</p>
                        </td>
                        <td className="px-3 py-3">
                          {paper.code} {paper.name}
                        </td>
                        <td className="px-3 py-3">
                          {result ? (
                            <span>
                              {result.outcome}
                              {examSessionLabel(result)
                                ? ` · ${examSessionLabel(result)}`
                                : ""}
                            </span>
                          ) : (
                            examCopy.pending
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <NativeSelect
                            aria-label={`Result for ${row.scholarName} ${paper.code}`}
                            disabled={locked}
                            title={
                              locked ? "This result is published and locked." : undefined
                            }
                            value={locked ? "" : (drafts[row.id] ?? "")}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [row.id]: event.target.value as ExamOutcome | "",
                              }))
                            }
                          >
                            <option value="">{locked ? "Locked" : "Not marked"}</option>
                            {examOutcomes.map((item) => (
                              <option key={item} value={item}>
                                {item === "AAA" ? "Absent" : item}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setHistoryId(row.id)}
                          >
                            {attempts.length} sitting{attempts.length === 1 ? "" : "s"}
                          </Button>
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
        </div>
      )}
      {historyId ? (
        <DeskModal title={examCopy.historyTitle} onClose={() => setHistoryId(null)}>
          <DeskTable
            headers={["Session", "Result", "Recorded on"]}
            empty={history.length === 0}
          >
            {history.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3">{examSessionLabel(item) || "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill status={item.outcome} />
                </td>
                <td className="px-4 py-3">{item.publishedOn || "—"}</td>
              </tr>
            ))}
          </DeskTable>
        </DeskModal>
      ) : null}
      {gradeKey ? (
        <DeskModal title="Grade details" onClose={() => setGradeKey(false)}>
          <DeskTable headers={["Grade", "Range", "Result"]} empty={false}>
            {resultGradeKey.map((row) => (
              <tr key={row.grade} className="border-t border-border">
                <td className="px-4 py-3">{row.grade}</td>
                <td className="px-4 py-3">{row.range}</td>
                <td className="px-4 py-3">{row.result}</td>
              </tr>
            ))}
          </DeskTable>
        </DeskModal>
      ) : null}
    </DeskPage>
  );
}
