"use client";

import { Check, Columns3, FileDown, FileSpreadsheet, Filter, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadSheet } from "@/lib/sheet";
import { filterValues, joinFilterValues } from "@/lib/list-filter";
import { downloadTablePdf } from "@/lib/table-pdf";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { usePreviewSession } from "@/lib/use-preview-session";
import { cn } from "@/lib/utils";

export { filterMatches } from "@/lib/list-filter";

export type ListFilter = {
  id: string;
  label: string;
  /** One or more chosen values; read it with `filterMatches`. Empty means all. */
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

export function textMatches(query: string, parts: readonly string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.join(" ").toLowerCase().includes(needle);
}

function optionLabel(filter: ListFilter, value: string) {
  return filter.options.find((option) => option.value === value)?.label ?? value;
}

/** One box for every filter on the page: pick any number of values from any field. */
function FilterBox({ filters }: { filters: readonly ListFilter[] }) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const chips = filters.flatMap((filter) =>
    filterValues(filter.value).map((value) => ({ filter, value })),
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function toggle(filter: ListFilter, value: string) {
    const chosen = filterValues(filter.value);
    filter.onChange(
      joinFilterValues(
        chosen.includes(value)
          ? chosen.filter((item) => item !== value)
          : [...chosen, value],
      ),
    );
  }

  const needle = find.trim().toLowerCase();

  return (
    <div ref={box} className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Filter"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        className={cn(
          "flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-1.5 text-sm transition hover:border-primary/40",
          open && "border-primary ring-2 ring-primary/15",
        )}
      >
        <Filter className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {chips.length === 0 ? (
          <span className="text-muted-foreground">
            Filter by {filters.map((filter) => filter.label.toLowerCase()).join(", ")}
          </span>
        ) : (
          chips.map(({ filter, value }) => (
            <span
              key={`${filter.id}-${value}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 text-xs font-semibold text-primary"
            >
              <span className="truncate">
                <span className="font-normal text-muted-foreground">{filter.label}:</span>{" "}
                {optionLabel(filter, value)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${filter.label} ${optionLabel(filter, value)}`}
                className="grid size-4 place-items-center rounded-full hover:bg-primary/20"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(filter, value);
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose filters"
          className="absolute right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-lift"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="Find an option"
              aria-label="Find an option"
              className="h-8 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="grid max-h-80 gap-x-6 gap-y-4 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3">
            {filters.map((filter) => {
              const chosen = filterValues(filter.value);
              const options = filter.options.filter(
                (option) => !needle || option.label.toLowerCase().includes(needle),
              );
              return (
                <fieldset key={filter.id} className="min-w-0">
                  <legend className="flex w-full items-center justify-between pb-1 text-[0.68rem] font-bold tracking-[0.14em] text-secondary uppercase">
                    {filter.label}
                    {chosen.length > 0 ? (
                      <button
                        type="button"
                        className="text-[0.68rem] tracking-normal text-primary normal-case hover:underline"
                        onClick={() => filter.onChange("")}
                      >
                        Clear
                      </button>
                    ) : null}
                  </legend>
                  {options.length === 0 ? (
                    <p className="py-1 text-xs text-muted-foreground">No options</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {options.map((option) => {
                        const on = chosen.includes(option.value);
                        return (
                          <li key={option.value}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                              onClick={() => toggle(filter, option.value)}
                            >
                              <span
                                className={cn(
                                  "grid size-4 shrink-0 place-items-center rounded border",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input",
                                )}
                              >
                                {on ? <Check className="size-3" /> : null}
                              </span>
                              <span className="truncate">{option.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </fieldset>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2">
            <button
              type="button"
              className="text-xs font-semibold text-secondary hover:underline"
              onClick={() => filters.forEach((filter) => filter.onChange(""))}
            >
              Clear all
            </button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const columnsEvent = "sju-columns-change";

function subscribeColumns(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(columnsEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(columnsEvent, onChange);
  };
}

/** The columns a person has switched off on this list, remembered in this browser. */
function useHiddenColumns(key: string) {
  const read = () => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const text = useSyncExternalStore(subscribeColumns, read, () => null);
  const hidden = useMemo(() => {
    try {
      const saved: unknown = JSON.parse(text ?? "[]");
      return Array.isArray(saved)
        ? saved.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }, [text]);
  const save = (next: readonly string[]) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(columnsEvent));
    } catch {
      // The choice then lasts only until the page is reloaded.
    }
  };
  return [hidden, save] as const;
}

const normal = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Hides or shows a column of an on-screen table, by the heading it carries. */
function applyColumnChoice(toolbar: HTMLElement, hidden: readonly string[]) {
  const off = new Set(hidden.map(normal));
  const tables = Array.from(
    toolbar.closest("main")?.querySelectorAll("table") ?? [],
  );
  const table = tables.find(
    (item) => toolbar.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const head = table?.tHead?.rows[0];
  if (!table || !head) return;
  Array.from(head.cells).forEach((cell, index) => {
    const hide = off.has(normal(cell.textContent ?? "")) && normal(cell.textContent ?? "") !== "";
    for (const row of Array.from(table.rows)) {
      const target = row.cells[index];
      if (target && target.colSpan === 1) target.style.display = hide ? "none" : "";
    }
  });
}

function pageHeading() {
  if (typeof document === "undefined") return "";
  return (
    document.querySelector("main h1")?.textContent?.trim() ??
    document.title.split("|")[0].trim()
  );
}

export function ListToolbar({
  query,
  onQuery,
  filters,
  shown,
  total,
  filename,
  headers,
  rows,
  title,
  extra,
}: {
  query: string;
  onQuery: (value: string) => void;
  filters: readonly ListFilter[];
  shown: number;
  total: number;
  filename: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Report heading in the PDF. Defaults to the page heading. */
  title?: string;
  /** Kept for older callers; the buttons read "Export Excel" and "Export PDF". */
  downloadLabel?: string;
  /** Shown beside the export buttons, for example a choice of the columns to export. */
  extra?: ReactNode;
}) {
  const pathname = usePathname();
  const session = usePreviewSession();
  const canExport = useCanMenuAction("export");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hidden, saveHidden] = useHiddenColumns(`sju-columns:${pathname}:${filename}`);
  // A page that brings its own choice of columns (the Scholar register) is left alone.
  const choosable = extra === undefined && headers.length > 3;
  const shownIndexes = headers
    .map((header, index) => (choosable && hidden.includes(header) ? -1 : index))
    .filter((index) => index >= 0);
  const outHeaders = shownIndexes.map((index) => headers[index]);
  const outRows = rows.map((row) => shownIndexes.map((index) => row[index] ?? ""));

  useEffect(() => {
    const toolbar = root.current;
    if (!toolbar || !choosable) return;
    let frame = 0;
    const apply = () => applyColumnChoice(toolbar, hidden);
    apply();
    const main = toolbar.closest("main");
    if (!main) return;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      // Leave the table whole when this list goes away.
      applyColumnChoice(toolbar, []);
    };
  }, [hidden, choosable]);
  const officeLead = session?.role === "admin" || session?.role === "dean";
  const allowDownload =
    (canExport || officeLead) &&
    !pathname.startsWith("/scholar") &&
    !pathname.startsWith("/supervisor");
  const active = filters.filter((filter) => filter.value !== "");

  function criteria() {
    const lines = active.map(
      (filter) =>
        `${filter.label}: ${filterValues(filter.value)
          .map((value) => optionLabel(filter, value))
          .join(", ")}`,
    );
    if (query.trim()) lines.push(`Search: “${query.trim()}”`);
    return lines;
  }

  async function exportPdf() {
    setBusy(true);
    try {
      await downloadTablePdf({
        title: title ?? (pageHeading() || "Report"),
        criteria: criteria(),
        headers: outHeaders,
        rows: outRows,
        filename,
        generatedBy: session ? session.name.trim() || session.identifier : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={root}
      data-readonly-allow=""
      className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div
        className={cn(
          "grid gap-3",
          filters.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]",
        )}
      >
        <label className="relative block text-sm">
          <span className="sr-only">Search</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search name, number, or keyword"
            aria-label="Search"
            className="pl-9"
          />
        </label>
        {filters.length > 0 ? <FilterBox filters={filters} /> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing <span className="font-semibold text-primary">{shown}</span> of {total}
          </span>
          {active.length > 0 || query.trim() ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              onClick={() => {
                filters.forEach((filter) => filter.onChange(""));
                onQuery("");
              }}
            >
              <X className="size-3" /> Clear all
            </button>
          ) : null}
        </div>
        {allowDownload ? (
          <div className="relative flex flex-wrap gap-2">
            {extra}
            {choosable ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={columnsOpen}
                  onClick={() => setColumnsOpen((value) => !value)}
                >
                  <Columns3 className="size-4" aria-hidden="true" />
                  Columns ({outHeaders.length} of {headers.length})
                </Button>
                {columnsOpen ? (
                  <div
                    role="dialog"
                    aria-label="Choose columns"
                    className="absolute right-0 bottom-full z-50 mb-2 w-72 max-w-[90vw] rounded-xl border border-border bg-card p-3 shadow-lift"
                  >
                    <p className="text-xs leading-5 text-muted-foreground">
                      Choose the columns carried into the Excel and PDF downloads. A column
                      that is also in the table on this page is shown or hidden there too.
                      Your choice is remembered.
                    </p>
                    <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
                      {headers.map((header) => {
                        const on = !hidden.includes(header);
                        return (
                          <li key={header}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={on}
                                onChange={() =>
                                  saveHidden(
                                    on
                                      ? [...hidden, header]
                                      : hidden.filter((item) => item !== header),
                                  )
                                }
                              />
                              <span className="truncate">{header}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-secondary hover:underline"
                        onClick={() => saveHidden([])}
                      >
                        Show all
                      </button>
                      <Button type="button" size="sm" onClick={() => setColumnsOpen(false)}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void downloadSheet(filename, outHeaders, outRows)}
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Export Excel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void exportPdf()}
            >
              <FileDown className="size-4" aria-hidden="true" />
              {busy ? "Preparing…" : "Export PDF"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
