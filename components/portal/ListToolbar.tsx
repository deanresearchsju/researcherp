"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { downloadCsv, toCsv } from "@/lib/csv";

export type ListFilter = {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

export function textMatches(query: string, parts: readonly string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.join(" ").toLowerCase().includes(needle);
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
  downloadLabel = "Download filtered CSV",
}: {
  query: string;
  onQuery: (value: string) => void;
  filters: readonly ListFilter[];
  shown: number;
  total: number;
  filename: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  downloadLabel?: string;
}) {
  const pathname = usePathname();
  const allowDownload =
    !pathname.startsWith("/scholar") && !pathname.startsWith("/supervisor");
  return (
    <div
      data-readonly-allow=""
      className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-semibold text-primary">Search</span>
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Name, number, or keyword"
            aria-label="Search"
          />
        </label>
        {filters.map((filter) => (
          <label key={filter.id} className="space-y-1.5 text-sm">
            <span className="font-semibold text-primary">{filter.label}</span>
            <NativeSelect
              aria-label={filter.label}
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {shown} of {total}
        </p>
        {allowDownload ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadCsv(filename, toCsv(headers, rows))}
          >
            {downloadLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
