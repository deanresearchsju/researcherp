"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  applyPlan,
  planScholars,
  planSupervisors,
  templateCsv,
  type ImportKind,
  type ImportPlan,
} from "@/lib/register-import";
import { openSpreadsheet, type Workbook } from "@/lib/spreadsheet";
import { usePreviewSession } from "@/lib/use-preview-session";

const labels: Record<ImportKind, { title: string; what: string; file: string }> = {
  supervisors: {
    title: "Import supervisors from Excel",
    what: "Supervisors already on the register are brought up to date from the cells that are filled; a supervisor who is not on it is added, with the quota of the designation. An empty cell never removes what is stored.",
    file: "supervisors-template.csv",
  },
  scholars: {
    title: "Import scholars and their details from Excel",
    what: "Scholars already on the register are matched by e-mail, registration, application or file number and brought up to date; the personal details in the sheet are saved as Scholar information. A scholar who is not on the register is added when the sheet gives an e-mail and a batch. An empty cell never removes what is stored.",
    file: "scholars-template.csv",
  },
};

function download(name: string, text: string) {
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const actionTone = {
  add: "gold",
  update: "purple",
  same: "outline",
  skip: "maroon",
} as const;
const actionWord = {
  add: "Add",
  update: "Update",
  same: "No change",
  skip: "Skipped",
} as const;

/** Reads an Excel or CSV sheet, shows what it would change, and saves it when the administrator confirms. */
export function RegisterImport({
  kind,
  onDone,
}: {
  kind: ImportKind;
  onDone?: (message: string) => void;
}) {
  const session = usePreviewSession();
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [filter, setFilter] = useState<"all" | "update" | "add" | "skip">("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  if (session?.role !== "admin") return null;
  const copy = labels[kind];

  async function read(book: Workbook, name: string) {
    const table = await book.read(name);
    setPlan(kind === "supervisors" ? planSupervisors(table) : planScholars(table));
  }

  async function choose(file: File | undefined) {
    setPlan(null);
    setMessage(null);
    setProblems([]);
    setWorkbook(null);
    if (!file) return;
    setBusy(true);
    try {
      const book = await openSpreadsheet(file);
      setWorkbook(book);
      const first = book.sheets[0] ?? "";
      setSheet(first);
      await read(book, first);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That file could not be read.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!plan) return;
    setBusy(true);
    setMessage(null);
    const result = await applyPlan(plan, (done, total) =>
      setProgress(total ? `Saving details: ${done} of ${total}` : null),
    );
    setBusy(false);
    setProgress(null);
    setProblems(result.problems);
    setMessage(
      result.ok
        ? `${result.message}${result.problems.length ? ` ${result.problems.length} item(s) need attention (below).` : ""}`
        : result.message,
    );
    if (result.ok) {
      setPlan(null);
      onDone?.(result.message);
    }
  }

  const counts = plan
    ? plan.rows.reduce((sum, row) => ({ ...sum, [row.action]: sum[row.action] + 1 }), {
        add: 0,
        update: 0,
        same: 0,
        skip: 0,
      })
    : null;
  const shown = (plan?.rows ?? []).filter((row) =>
    filter === "all" ? row.action !== "same" : row.action === filter,
  );

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-primary">
            <FileSpreadsheet className="size-5" aria-hidden="true" />
            {copy.title}
          </h2>
          <p className="mt-1 max-w-3xl text-justify text-sm leading-6 text-muted-foreground">
            {copy.what}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => download(copy.file, templateCsv(kind))}
        >
          Download the blank sheet
        </Button>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
        Take a backup first (see the backup guide). The first row of the sheet holds the
        headings; the headings of your own University sheet are understood as they are.
        Dates may be typed or formatted as dates in Excel. Nothing is saved until you
        press Save.
      </p>
      <input
        type="file"
        accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Choose the Excel or CSV file"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
        disabled={busy}
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      {workbook && workbook.sheets.length > 1 ? (
        <label className="grid max-w-sm gap-1 text-sm">
          <span className="font-semibold text-primary">Sheet to read</span>
          <NativeSelect
            value={sheet}
            disabled={busy}
            onChange={async (event) => {
              setSheet(event.target.value);
              setBusy(true);
              await read(workbook, event.target.value);
              setBusy(false);
            }}
          >
            {workbook.sheets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      {message ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {message}
        </p>
      ) : null}
      {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : null}
      {problems.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
          {problems.slice(0, 20).map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {plan && counts ? (
        <div className="space-y-3">
          {plan.missing.length > 0 ? (
            <p role="alert" className="text-sm font-semibold text-secondary">
              The sheet has no column for: {plan.missing.join(", ")}. Choose another sheet
              or add the heading.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {(["update", "add", "skip"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(filter === key ? "all" : key)}
                    className={`rounded-full border px-3 py-1 font-semibold ${filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-primary"}`}
                  >
                    {actionWord[key]} {counts[key]}
                  </button>
                ))}
                <span className="text-muted-foreground">No change {counts.same}</span>
              </div>
              {plan.unused.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Columns not used: {plan.unused.join(", ")}.
                </p>
              ) : null}
              <div className="max-h-96 overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-muted text-primary">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Row</th>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">What happens</th>
                      <th className="px-3 py-2 font-semibold">To check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                          Nothing to show for this choice.
                        </td>
                      </tr>
                    ) : (
                      shown.slice(0, 300).map((row) => (
                        <tr
                          key={`${row.line}-${row.label}`}
                          className="border-t border-border align-top"
                        >
                          <td className="px-3 py-2 tabular-nums">{row.line}</td>
                          <td className="px-3 py-2 font-medium text-primary">
                            {row.label}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={actionTone[row.action]}>
                              {actionWord[row.action]}
                            </Badge>
                            {row.changes.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                {row.changes.slice(0, 6).map((change) => (
                                  <li key={change}>{change}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs text-secondary">
                            {row.notes.join(" ")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="gold"
                disabled={busy || counts.update + counts.add === 0}
                onClick={() => void save()}
              >
                {busy
                  ? "Saving…"
                  : `Save ${counts.update + counts.add} change${counts.update + counts.add === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
