"use client";

import { FileText, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fileLimits, type FileLimitKey } from "@/lib/constants";
import { fileError, releaseFile, takeFile, type StoredFile } from "@/lib/files";

type FileUploadProps = {
  id: string;
  acceptRule: FileLimitKey;
  value: StoredFile | null;
  error?: string;
  onChange: (value: StoredFile | null) => void;
  /** The photo already appears in a frame, so skip the second thumbnail. */
  framed?: boolean;
};

export function FileUpload({
  id,
  acceptRule,
  value,
  error,
  onChange,
  framed = false,
}: FileUploadProps) {
  const rule = fileLimits[acceptRule];
  const [pickError, setPickError] = useState<string | null>(null);
  const shownError = error ?? pickError;

  function replace(file: File | null) {
    releaseFile(value);
    onChange(takeFile(file));
  }

  return (
    <div className="space-y-2">
      <input
        id={id}
        type="file"
        accept={rule.accept}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? `${id}-error` : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) {
            setPickError(null);
            replace(null);
            return;
          }
          const message = fileError(file, acceptRule, true);
          if (message) {
            setPickError(message);
            event.target.value = "";
            return;
          }
          setPickError(null);
          replace(file);
          event.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">{rule.label}</p>
      {value && framed ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {value.file.name}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {Math.max(1, Math.round(value.file.size / 1024))} KB
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => replace(null)}>
            <X className="size-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : null}
      {value && !framed ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2">
          {value.previewUrl ? (
            // User-selected blob preview; next/image cannot serve object URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.previewUrl}
              alt=""
              width={64}
              height={64}
              className="size-16 rounded-lg object-cover"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-lg bg-white text-primary">
              <FileText className="size-5" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-medium text-foreground">
              {value.file.name}
            </span>
            <span className="text-muted-foreground">
              {Math.max(1, Math.round(value.file.size / 1024))} KB
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => replace(null)}>
            <X className="size-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : null}
      {shownError ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-secondary">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
