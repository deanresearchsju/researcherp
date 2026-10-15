"use client";

import { X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { emptyRecordCopy, missingFileCopy, viewFilesLabel } from "@/data/portal-desk";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { currentAllotments, subscribeRegister } from "@/lib/register";
import { openStoredFile } from "@/lib/scholar-records";
import { scholarIdentity } from "@/lib/scholar-identity";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordStatus } from "@/data/scholar-records";

export function DeskPage({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <header>
        {kicker ? (
          <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-2 font-heading text-4xl text-primary">{title}</h1>
      </header>
      {children}
    </section>
  );
}

export function ScholarIdentityHeader({ identifier }: { identifier: string }) {
  useSyncExternalStore(subscribeRegister, currentAllotments, currentAllotments);
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  if (!identifier) return null;
  const card = scholarIdentity(identifier);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <dl className="grid sm:grid-cols-2">
        {card.pairs.flatMap((pair) =>
          pair.map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[9.5rem_1fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 sm:odd:border-r"
            >
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-semibold break-words text-primary">{item.value}</dd>
            </div>
          )),
        )}
      </dl>
    </div>
  );
}

export function DeskTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold",
            value === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-primary",
          )}
          aria-current={value === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function DeskSection({
  title,
  tone = "primary",
  action,
  children,
}: {
  title: string;
  tone?: "primary" | "new" | "muted";
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
          tone === "primary" && "bg-primary text-primary-foreground",
          tone === "new" && "bg-accent text-accent-foreground",
          tone === "muted" && "bg-muted text-primary",
        )}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function DeskTable({
  headers,
  children,
  empty,
}: {
  headers: readonly string[];
  children?: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="bg-muted text-primary">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {emptyRecordCopy}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function GateBanner({
  tone = "info",
  children,
}: {
  tone?: "info" | "danger";
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-6",
        tone === "info" && "border-border bg-primary/10 text-primary",
        tone === "danger" && "border-secondary/20 bg-secondary/10 text-secondary",
      )}
    >
      {children}
    </p>
  );
}

export function ProcessFlow({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm leading-6 text-primary">
      {children}
    </p>
  );
}

export function StatusPill({
  status,
}: {
  status:
    | RecordStatus
    | "Pending"
    | "Pass"
    | "Fail"
    | "RA"
    | "AAA"
    | "Absent"
    | "Granted"
    | "Rejected";
}) {
  const variant =
    status === "Approved" || status === "Pass" || status === "Granted"
      ? "gold"
      : status === "Returned" ||
          status === "Fail" ||
          status === "RA" ||
          status === "AAA" ||
          status === "Absent" ||
          status === "Rejected"
        ? "maroon"
        : "purple";
  return <Badge variant={variant}>{status}</Badge>;
}

export function DeskModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-primary/40 p-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desk-modal-title"
    >
      <div className="w-full max-w-5xl rounded-2xl bg-card shadow-lift">
        <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-primary px-4 py-3 text-primary-foreground">
          <h2 id="desk-modal-title" className="text-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full hover:bg-primary-foreground/10"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-4">{children}</div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ViewFilesButton({
  fileName,
  data,
  load,
  onMissing,
}: {
  fileName: string | null | undefined;
  data?: string | null;
  load?: () => Promise<string | null>;
  onMissing?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const name = fileName?.trim() ?? "";
  if (!name) return null;

  async function open() {
    setBusy(true);
    const payload = data ?? (load ? await load().catch(() => null) : null);
    setBusy(false);
    if (!payload) {
      onMissing?.(missingFileCopy);
      return;
    }
    openStoredFile(name, payload);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => void open()}
    >
      {viewFilesLabel}
    </Button>
  );
}

export function DeskPager({
  page,
  pageCount,
  label,
  onPage,
}: {
  page: number;
  pageCount: number;
  label: string;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return <p className="text-sm text-muted-foreground">{label}</p>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
