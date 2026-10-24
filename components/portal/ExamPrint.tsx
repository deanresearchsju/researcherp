"use client";

import type { ReactNode } from "react";

import { Sheet, SheetHeading, pagesOf } from "@/components/portal/AdmissionPrint";
import { Button } from "@/components/ui/button";

/**
 * A printed list for the examination: the details in boxes under a centred title, a table
 * with centred headings, and the signature lines at the end. Used for the seating plan, the
 * attendance sheets and the marks sheets.
 */
export function ListSheet({
  title,
  details,
  headers,
  rows,
  widths = [],
  bold = [],
  signatures = [],
  perPage = 22,
  tall = false,
}: {
  title: string;
  /** "Label: value" pieces shown as boxes. */
  details: readonly string[];
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Tailwind widths for the columns, "" for the rest. */
  widths?: readonly string[];
  /** Columns shown in bold. */
  bold?: readonly number[];
  signatures?: readonly string[];
  perPage?: number;
  /** Taller rows, for a column that is signed by hand. */
  tall?: boolean;
}) {
  const pages = pagesOf(
    rows.map((row, index) => ({ row, index })),
    perPage,
  );
  return (
    <>
      {pages.map((page, pageIndex) => (
        <Sheet key={pageIndex}>
          <SheetHeading title={title} lines={[details.join(" · ")]} />
          <table className="mt-2 w-full border-collapse border border-foreground/30 text-sm">
            <thead className="bg-muted/60">
              <tr className="text-center">
                <th className="w-12 border border-foreground/30 px-2 py-1.5">S. No.</th>
                {headers.map((header, at) => (
                  <th
                    key={header}
                    className={`${widths[at] ?? ""} border border-foreground/30 px-2 py-1.5`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.map(({ row, index }) => (
                <tr key={index}>
                  <td className="border border-foreground/30 px-2 py-1.5 text-center">
                    {index + 1}
                  </td>
                  {row.map((cell, at) => (
                    <td
                      key={at}
                      className={`border border-foreground/30 px-2 ${tall ? "py-3" : "py-1.5"} ${
                        bold.includes(at) ? "font-semibold" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    className="border border-foreground/30 px-2 py-4 text-center text-muted-foreground"
                  >
                    Nothing to list.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {pageIndex === pages.length - 1 && signatures.length > 0 ? (
            <div className="mt-auto flex flex-wrap justify-between gap-6 pt-16 text-xs">
              {signatures.map((label) => (
                <span key={label} className="border-t border-foreground/50 px-6 pt-1">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </Sheet>
      ))}
    </>
  );
}

/** The Back / Print bar and the A4 page area that the print style picks up. */
export function PrintFrame({
  onBack,
  printLabel = "Print",
  children,
}: {
  onBack: () => void;
  printLabel?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="no-print mb-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => window.print()}>
          {printLabel}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
          {children}
        </article>
      </div>
    </div>
  );
}
