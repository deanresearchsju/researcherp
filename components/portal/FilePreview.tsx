"use client";

import { Download, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { filePreviewCopy } from "@/data/portal-desk";
import { blobFromDataUrl } from "@/lib/scholar-records";

function previewKind(fileName: string, dataUrl: string) {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "";
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName)) {
    return "image" as const;
  }
  if (mime === "application/pdf" || /\.pdf$/i.test(fileName)) {
    return "pdf" as const;
  }
  return "other" as const;
}

/**
 * Shows an attachment inside the portal, above any open dialog, so the office can check it
 * and close it without leaving the page.
 */
export function FilePreview({
  fileName,
  data,
  onClose,
}: {
  fileName: string;
  data: string;
  onClose: () => void;
}) {
  const kind = previewKind(fileName, data);
  const src = useMemo(() => {
    const blob = blobFromDataUrl(data);
    return blob ? URL.createObjectURL(blob) : data;
  }, [data]);

  useEffect(() => {
    return () => {
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const dialog = (
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center overflow-y-auto bg-purple-deep/60 p-3 py-6 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
      data-readonly-allow
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-purple-deep px-4 py-3 text-primary-foreground">
          <h2 id="file-preview-title" className="truncate text-sm font-semibold">
            {fileName}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              data-readonly-allow
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-primary-foreground/10"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              New tab
            </a>
            <a
              href={src}
              download={fileName}
              data-readonly-allow
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-primary-foreground/10"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download
            </a>
            <button
              type="button"
              data-readonly-allow
              className="grid size-8 place-items-center rounded-full hover:bg-primary-foreground/10"
              aria-label={filePreviewCopy.close}
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid min-h-[60vh] place-items-center bg-muted/40 p-2 sm:p-3">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={fileName}
              className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-card"
            />
          ) : kind === "pdf" ? (
            <iframe
              title={fileName}
              src={src}
              className="h-[78vh] w-full rounded-lg border border-border bg-white"
            />
          ) : (
            <div className="space-y-3 px-4 text-center text-sm text-muted-foreground">
              <p>{filePreviewCopy.unavailable}</p>
              <a
                href={src}
                download={fileName}
                data-readonly-allow
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download to open
              </a>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Press Esc or Close when you have checked the file.
          </p>
          <Button type="button" variant="outline" onClick={onClose} data-readonly-allow>
            {filePreviewCopy.close}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
