"use client";

import { Download, Upload } from "lucide-react";
import { useState } from "react";

import { DeskModal } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  allFields,
  cleanValues,
  researchMenus,
  type ResearchKind,
  type ResearchValues,
} from "@/lib/faculty-research";
import { columnMap, rowValues, templateHeaders } from "@/lib/faculty-research-import";
import { openSpreadsheet } from "@/lib/spreadsheet";

type Outcome = {
  row: number;
  status: "added" | "duplicate" | "invalid";
  message: string;
};
type Prepared = { row: number; values: ResearchValues; problem: string };

const chunk = 100;

function today() {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Upload of records already collected in an Excel or CSV sheet. Each row is checked like the
 * form before anything is sent; the server checks again and skips any row whose title, DOI or
 * patent number is already saved.
 */
export function ResearchImport({
  kind,
  onClose,
  onDone,
}: {
  kind: ResearchKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Prepared[] | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const labels = new Map(allFields(kind).map((field) => [field.key, field.label]));

  async function choose(file: File | undefined) {
    setRows(null);
    setOutcomes(null);
    setMessage("");
    if (!file) return;
    if (file.size > 5_000_000) return setMessage("The file is too large (5 MB at most).");
    setBusy(true);
    try {
      const book = await openSpreadsheet(file);
      const table = await book.read(book.sheets[0]);
      const map = columnMap(kind, table.headers);
      const used = new Set(map.values());
      setUnmatched(table.headers.filter((header) => header.trim() && !used.has(header)));
      const date = today();
      setRows(
        table.rows
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => Object.values(row).some((cell) => String(cell).trim()))
          .map(({ row, index }) => {
            const values = rowValues(kind, row, map);
            const checked = cleanValues(kind, values, date);
            return {
              row: index + 2,
              values: checked.ok ? checked.values : values,
              problem: checked.ok
                ? ""
                : Object.entries(checked.errors)
                    .map(([key, text]) => `${labels.get(key) ?? key}: ${text}`)
                    .join("; "),
            };
          }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The file could not be read.");
    }
    setBusy(false);
  }

  async function save() {
    if (!rows) return;
    const ready = rows.filter((row) => !row.problem);
    setBusy(true);
    setMessage("");
    const done: Outcome[] = rows
      .filter((row) => row.problem)
      .map((row) => ({ row: row.row, status: "invalid", message: row.problem }));
    for (let at = 0; at < ready.length; at += chunk) {
      const part = ready.slice(at, at + chunk);
      try {
        const response = await fetch("/api/faculty-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import",
            kind,
            rows: part.map((item) => ({ row: item.row, values: item.values })),
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          outcomes?: Outcome[];
          message?: string;
        } | null;
        if (response.ok && data?.ok && data.outcomes) done.push(...data.outcomes);
        else
          done.push(
            ...part.map((item) => ({
              row: item.row,
              status: "invalid" as const,
              message: data?.message ?? "Not saved.",
            })),
          );
      } catch {
        done.push(
          ...part.map((item) => ({
            row: item.row,
            status: "invalid" as const,
            message: "Check the connection.",
          })),
        );
      }
      setOutcomes([...done].sort((a, b) => a.row - b.row));
    }
    setOutcomes([...done].sort((a, b) => a.row - b.row));
    setBusy(false);
    onDone();
  }

  const valid = rows?.filter((row) => !row.problem).length ?? 0;
  const added = outcomes?.filter((item) => item.status === "added").length ?? 0;
  const skipped = outcomes?.filter((item) => item.status === "duplicate") ?? [];
  const failed = outcomes?.filter((item) => item.status === "invalid") ?? [];

  return (
    <DeskModal
      title={`Upload ${researchMenus[kind].label.toLowerCase()}`}
      onClose={onClose}
      size="md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-readonly-allow
          onClick={() =>
            downloadCsv(
              `${researchMenus[kind].adminHref.split("/").pop()}-blank.csv`,
              toCsv(templateHeaders(kind), []),
            )
          }
        >
          <Download className="size-4" /> Download blank sheet
        </Button>
      </div>
      <input
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Choose the Excel or CSV file"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
        disabled={busy}
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      {message ? (
        <p role="alert" className="text-sm text-secondary">
          {message}
        </p>
      ) : null}
      {rows && !outcomes ? (
        <div className="space-y-3 text-sm">
          <p>
            <strong>{rows.length}</strong> rows read · <strong>{valid}</strong> ready ·{" "}
            <strong>{rows.length - valid}</strong> with problems
          </p>
          {unmatched.length > 0 ? (
            <p className="text-muted-foreground">
              Columns not used: {unmatched.join(", ")}
            </p>
          ) : null}
          {rows.some((row) => row.problem) ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs">
              {rows
                .filter((row) => row.problem)
                .map((row) => (
                  <li key={row.row}>
                    <strong>Row {row.row}:</strong> {row.problem}
                  </li>
                ))}
            </ul>
          ) : null}
          <Button
            type="button"
            disabled={busy || valid === 0}
            onClick={() => void save()}
          >
            <Upload className="size-4" /> {busy ? "Saving…" : `Save ${valid} rows`}
          </Button>
        </div>
      ) : null}
      {outcomes ? (
        <div className="space-y-2 text-sm">
          <p role="status">
            <strong>{added}</strong> added · <strong>{skipped.length}</strong> already
            saved (skipped) · <strong>{failed.length}</strong> not saved
          </p>
          {skipped.length + failed.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs">
              {[...skipped, ...failed]
                .sort((a, b) => a.row - b.row)
                .map((item) => (
                  <li key={item.row}>
                    <strong>Row {item.row}:</strong> {item.message}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </DeskModal>
  );
}
