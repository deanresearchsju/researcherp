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
import { examCopy, examOutcomes, examPageSize } from "@/data/exams";
import {
  currentDoctoral,
  examSessionLabel,
  paperOf,
  resultFor,
  resultsFor,
  subscribeDoctoral,
  type CourseRegistration,
} from "@/lib/doctoral";
import { pageCount, pageSlice } from "@/lib/paging";
import { currentExam, subscribeExam } from "@/lib/exam-office";
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
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [semester, setSemester] = useState("");
  const [tab, setTab] = useState("grades");
  const [gradeKey, setGradeKey] = useState(false);
  const [page, setPage] = useState(1);
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

  const bands = [...(exam?.settings.grades ?? [])].sort(
    (left, right) => right.min - left.min,
  );
  const gradeRows = [
    ...bands.map((band, index) => ({
      grade: band.grade,
      range: `${band.min} – ${band.max}`,
      result: "PASS",
    })),
    {
      grade: "RA",
      range: `Below ${exam?.settings.passMark ?? 50}`,
      result: "RA (re-appearance)",
    },
    { grade: "AAA", range: "Absent", result: "AAA" },
  ];
  const pages = pageCount(rows.length, examPageSize);
  const shown = pageSlice(rows, Math.min(page, pages), examPageSize);
  const failed = rows.filter((row) => resultFor(doctoral, row.id)?.outcome === "RA");
  const absent = rows.filter((row) => resultFor(doctoral, row.id)?.outcome === "AAA");
  const history = historyId && doctoral ? resultsFor(doctoral, historyId) : [];

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
            The published results of every course-work paper. Results are no longer typed
            here: the Controller of Examinations enters and freezes the marks, the passing
            board approves them, and you publish them under Result approval.
          </p>
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
                  "Subject",
                  "Marks",
                  "Grade",
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
                      <td className="px-4 py-3">{result?.marks ?? "—"}</td>
                      <td className="px-4 py-3">{result?.grade || "—"}</td>
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
                  <th className="px-3 py-3 font-semibold">History</th>
                </tr>
              </thead>
              <tbody>
                {shown.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                      No course-work paper is registered yet.
                    </td>
                  </tr>
                ) : (
                  shown.rows.map((row) => {
                    const paper = paperOf(doctoral, row);
                    const result = resultFor(doctoral, row.id);
                    const attempts = resultsFor(doctoral, row.id);
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
          <DeskTable headers={["Grade", "Marks", "Result"]} empty={false}>
            {gradeRows.map((row) => (
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
