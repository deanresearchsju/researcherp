"use client";

import { X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { FilePreview } from "@/components/portal/FilePreview";
import { emptyRecordCopy, missingFileCopy, viewFilesLabel } from "@/data/portal-desk";
import { stampedPreview, type ApprovalStamp } from "@/lib/approved-copy";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { currentAllotments, subscribeRegister } from "@/lib/register";
import { guideHiddenCopy, guideReleased } from "@/lib/guide-release";
import { researchTitleOf } from "@/lib/research-title";
import { scholarIdentity } from "@/lib/scholar-identity";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { usePreviewSession } from "@/lib/use-preview-session";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordStatus } from "@/data/scholar-records";

export function DeskPage({
  kicker,
  title,
  actions,
  children,
}: {
  kicker?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <PageTitle kicker={kicker} title={title} actions={actions} />
      {children}
    </section>
  );
}

/** Page heading used across the ERP: small kicker, title, optional actions. No description. */
export function PageTitle({
  kicker,
  title,
  actions,
}: {
  kicker?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[0.68rem] font-bold tracking-[0.18em] text-secondary uppercase">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-1 font-heading text-3xl text-primary sm:text-[2.1rem]">
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export type CardTone = "open" | "closed" | "pending" | "neutral";

const toneBadge: Record<CardTone, "gold" | "maroon" | "purple" | "outline"> = {
  open: "gold",
  closed: "maroon",
  pending: "purple",
  neutral: "outline",
};

/** Summary card for one setting or work item. Details open in a dialog through the action button. */
export function ManageCard({
  eyebrow,
  title,
  status,
  facts,
  actionLabel = "Manage",
  onAction,
  extra,
}: {
  eyebrow?: string;
  title: string;
  status?: { label: string; tone: CardTone };
  facts?: readonly { label: string; value: ReactNode }[];
  actionLabel?: string;
  onAction?: () => void;
  extra?: ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-primary/30 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold text-primary">{title}</h2>
        </div>
        {status ? (
          <Badge variant={toneBadge[status.tone]} className="shrink-0">
            {status.label}
          </Badge>
        ) : null}
      </div>
      {facts && facts.length > 0 ? (
        <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="truncate font-medium text-foreground">
                {fact.value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {extra}
      {onAction ? (
        <div className="mt-auto flex justify-end pt-5">
          <Button type="button" size="sm" onClick={onAction} data-readonly-allow>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

const modalWidths = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-5xl",
} as const;

function ModalShell({
  title,
  onClose,
  size = "lg",
  footer,
  formProps,
  children,
}: {
  title: string;
  onClose: () => void;
  size?: keyof typeof modalWidths;
  footer: ReactNode;
  formProps?: React.ComponentProps<"form">;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const body = (
    <>
      <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-5">{children}</div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
        {footer}
      </div>
    </>
  );
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-purple-deep/45 p-4 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desk-modal-title"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lift",
          modalWidths[size],
        )}
      >
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-purple-deep px-5 py-4 text-primary-foreground">
          <h2 id="desk-modal-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full hover:bg-primary-foreground/10"
            aria-label="Close"
            data-readonly-allow
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        {formProps ? (
          <form noValidate {...formProps}>
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body,
  );
}

export function DeskModal({
  title,
  onClose,
  size,
  children,
}: {
  title: string;
  onClose: () => void;
  size?: keyof typeof modalWidths;
  children: ReactNode;
}) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      size={size}
      footer={
        <Button type="button" variant="outline" onClick={onClose} data-readonly-allow>
          Close
        </Button>
      }
    >
      {children}
    </ModalShell>
  );
}

/** Dialog holding a form: fields in the body, Cancel and Save in the footer. */
export function FormDialog({
  title,
  onClose,
  onSubmit,
  busy = false,
  submitLabel = "Save",
  size = "md",
  extraActions,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  busy?: boolean;
  submitLabel?: string;
  size?: keyof typeof modalWidths;
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      size={size}
      formProps={{ onSubmit }}
      footer={
        <>
          {extraActions}
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      {children}
    </ModalShell>
  );
}

export function ScholarIdentityHeader({ identifier }: { identifier: string }) {
  useSyncExternalStore(subscribeRegister, currentAllotments, currentAllotments);
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const viewer = usePreviewSession();
  const payments = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const titleChanges = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("title_change", onChange),
    () => currentScholarRecords("title_change"),
    () => null,
  );
  if (!identifier) return null;
  const identity = scholarIdentity(identifier);
  const hideGuide =
    viewer?.role === "scholar" && !guideReleased(identifier, payments?.records ?? []);
  const doctoral = currentDoctoral();
  const title = doctoral
    ? researchTitleOf(doctoral, identifier, titleChanges?.records ?? [])
    : null;
  const facts: [string, string][] = [
    ["Register No.", identity.registerNo],
    ["Programme", identity.program],
    ["Semester", identity.semester],
    ["Supervisor", hideGuide ? guideHiddenCopy : identity.supervisorName],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-primary to-purple-deep px-4 py-3 text-primary-foreground">
        <p className="font-semibold">{identity.name}</p>
        <p className="text-xs opacity-80">{identity.institution}</p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-card px-4 py-2.5">
            <dt className="text-[0.62rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold break-words text-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {title ? (
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-[0.62rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Research title · {title.stage}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-primary">
            {title.title || "Fixed in the first doctoral committee"}
          </p>
        </div>
      ) : null}
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

/** Former flow-description box. Descriptions are hidden across the ERP, so this renders nothing. */
export function ProcessFlow(props: { children?: ReactNode }) {
  void props;
  return null;
}

/** Open / closed switch for a setting inside a dialog. */
export function OpenSwitch({
  checked,
  onChange,
  openLabel = "Open",
  closedLabel = "Closed",
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  openLabel?: string;
  closedLabel?: string;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <span className="text-sm font-semibold text-primary">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex rounded-lg border border-border bg-card p-1"
      >
        {[
          { value: true, text: openLabel },
          { value: false, text: closedLabel },
        ].map((option) => (
          <button
            key={option.text}
            type="button"
            role="radio"
            aria-checked={checked === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-8 rounded-md px-4 text-xs font-bold transition",
              checked === option.value
                ? option.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
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

export function ViewFilesButton({
  fileName,
  data,
  load,
  onMissing,
  stamp,
}: {
  fileName: string | null | undefined;
  data?: string | null;
  load?: () => Promise<string | null>;
  onMissing?: (message: string) => void;
  /** The approvals so far; stamped on the file (name, date and time) when it is opened. */
  stamp?: ApprovalStamp | null;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [previewName, setPreviewName] = useState("");
  const name = fileName?.trim() ?? "";
  if (!name) return null;

  async function open() {
    setBusy(true);
    setMissing(false);
    const payload = data || (load ? await load().catch(() => null) : null);
    if (!payload) {
      setBusy(false);
      if (onMissing) onMissing(missingFileCopy);
      else setMissing(true);
      return;
    }
    if (stamp) {
      try {
        setPreview(await stampedPreview(payload, name, stamp));
        setPreviewName(`${name.replace(/\.[^.]+$/, "")}-approved.pdf`);
        setBusy(false);
        return;
      } catch {
        // Fall back to the file as uploaded.
      }
    }
    setBusy(false);
    setPreviewName(name);
    setPreview(payload);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        data-readonly-allow
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void open();
        }}
      >
        {busy ? "Opening…" : viewFilesLabel}
      </Button>
      {missing ? (
        <span className="text-xs font-medium text-destructive">{missingFileCopy}</span>
      ) : null}
      {preview ? (
        <FilePreview
          fileName={previewName || name}
          data={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
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
