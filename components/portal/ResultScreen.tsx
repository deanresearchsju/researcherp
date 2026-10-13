"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  currentDoctoral,
  paperOf,
  publishResult,
  resultFor,
  subscribeDoctoral,
} from "@/lib/doctoral";
import { usePortalSession } from "@/lib/use-preview-session";

export function ResultScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [semester, setSemester] = useState("");

  if (!ready || !doctoral)
    return <p className="text-sm text-muted-foreground">Loading results…</p>;

  const rows = doctoral.registrations.filter((row) => {
    if (mode === "scholar" && row.scholarIdentifier !== session?.identifier) return false;
    if (mode !== "admin") return true;
    const result = resultFor(doctoral, row.id);
    const paper = paperOf(doctoral, row);
    const label = result?.outcome ?? "Pending";
    return (
      (outcome === "" || label === outcome) &&
      (semester === "" || String(row.semester) === semester) &&
      textMatches(query, [row.scholarName, paper.code, paper.name, label])
    );
  });

  async function mark(registrationId: string, outcome: "Pass" | "Fail") {
    const saved = await publishResult(
      registrationId,
      outcome,
      new Date().toISOString().slice(0, 10),
    );
    setNotice(saved.ok ? `${outcome} recorded.` : saved.message);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Course-work results</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pass or fail for each registered paper. A scholar can write the papers across
          four semesters.
        </p>
      </header>
      {mode === "admin" ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filters={[
            {
              id: "outcome",
              label: "Result",
              value: outcome,
              options: ["Pass", "Fail", "Pending"].map((item) => ({
                value: item,
                label: item,
              })),
              onChange: setOutcome,
            },
            {
              id: "semester",
              label: "Semester",
              value: semester,
              options: ["1", "2", "3", "4"].map((item) => ({
                value: item,
                label: `Semester ${item}`,
              })),
              onChange: setSemester,
            },
          ]}
          shown={rows.length}
          total={doctoral.registrations.length}
          filename="course-results.csv"
          headers={["scholar", "semester", "code", "subject", "result", "published"]}
          rows={rows.map((row) => {
            const paper = paperOf(doctoral, row);
            const result = resultFor(doctoral, row.id);
            return [
              row.scholarName,
              String(row.semester),
              paper.code,
              paper.name,
              result?.outcome ?? "Pending",
              result?.publishedOn ?? "",
            ];
          })}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No registered papers yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const paper = paperOf(doctoral, row);
            const result = resultFor(doctoral, row.id);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-semibold text-primary">
                    {paper.code} {paper.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.scholarName} · Semester {row.semester}
                  </p>
                </div>
                {mode === "admin" ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      onClick={() => void mark(row.id, "Pass")}
                    >
                      Pass
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="maroon"
                      onClick={() => void mark(row.id, "Fail")}
                    >
                      Fail
                    </Button>
                  </div>
                ) : (
                  <Badge
                    variant={
                      result?.outcome === "Fail" ? "maroon" : result ? "gold" : "outline"
                    }
                  >
                    {result?.outcome ?? "Pending"}
                  </Badge>
                )}
                {mode === "admin" && result ? (
                  <span className="text-sm text-muted-foreground">
                    {result.outcome} · {result.publishedOn}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
