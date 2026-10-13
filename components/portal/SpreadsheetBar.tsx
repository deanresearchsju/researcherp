"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { fileLimits } from "@/lib/constants";
import { csvFileError, downloadCsv, recordsFromCsv, toCsv } from "@/lib/csv";

type SpreadsheetBarProps = {
  filename: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  canUpload: boolean;
  busy: boolean;
  onUpload: (records: Record<string, string>[]) => void;
  onError: (message: string) => void;
};

export function SpreadsheetBar({
  filename,
  headers,
  rows,
  canUpload,
  busy,
  onUpload,
  onError,
}: SpreadsheetBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = csvFileError(file);
    if (problem) {
      onError(problem);
      return;
    }
    const text = await file.text();
    const parsed = recordsFromCsv(text);
    if (parsed.records.length === 0) {
      onError("The CSV has a header row but no records.");
      return;
    }
    onUpload(parsed.records);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => downloadCsv(filename, toCsv(headers, rows))}
      >
        Download CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!canUpload || busy}
        onClick={() => inputRef.current?.click()}
      >
        Upload CSV
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={fileLimits.spreadsheet.accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />
      <p className="text-xs text-muted-foreground">Columns: {headers.join(", ")}</p>
    </div>
  );
}
