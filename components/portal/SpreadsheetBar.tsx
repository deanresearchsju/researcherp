"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { fileLimits } from "@/lib/constants";
import { csvFileError, downloadCsv, recordsFromCsv, toCsv } from "@/lib/csv";
import { useCanMenuAction } from "@/lib/use-menu-action";

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
  canUpload,
  busy,
  onUpload,
  onError,
}: SpreadsheetBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canUploadRight = useCanMenuAction("upload");
  const mayUpload = canUpload && canUploadRight;
  // Exporting lives in the list toolbar; this bar is only for bulk upload.
  if (!mayUpload) return null;

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
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() =>
          downloadCsv(filename.replace(/\.csv$/i, "-template.csv"), toCsv(headers, []))
        }
      >
        Download template
      </Button>
      {mayUpload ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
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
        </>
      ) : null}
    </div>
  );
}
