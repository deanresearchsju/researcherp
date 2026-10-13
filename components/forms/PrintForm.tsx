import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { university } from "@/lib/constants";

export function PrintActions({ children }: { children: ReactNode }) {
  return (
    <div className="no-print mx-auto mb-6 max-w-[210mm] rounded-xl border border-border bg-card p-6 text-center shadow-card">
      {children}
    </div>
  );
}

export function PrintPages({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col gap-6 print:w-full print:min-w-0">
        {children}
      </article>
    </div>
  );
}

export function PrintPage({ page, children }: { page: 1 | 2; children: ReactNode }) {
  return (
    <section className="pdf-page flex min-h-[277mm] flex-col rounded-xl border border-border bg-white p-6 text-foreground shadow-card">
      <div className="h-1.5 bg-primary" />
      <div className="h-0.5 bg-accent" />
      <div className="flex min-h-0 flex-1 flex-col pt-3">{children}</div>
      <p className="mt-3 border-t border-primary/20 pt-1 text-[10px] text-muted-foreground">
        {university.name} · {university.researchOffice} · Page {page} of 2
      </p>
    </section>
  );
}

export function PrintLetterhead({
  title,
  photo,
  photoAlt,
  photoLabel,
}: {
  title: string;
  photo: string | null;
  photoAlt: string;
  photoLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Logo className="h-10 w-auto" alt={university.name} />
        <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
          {university.unit}
        </p>
        <h2 className="mt-1 font-heading text-xl leading-tight text-primary">{title}</h2>
        <p className="text-[11px] font-medium text-secondary">
          {university.researchOffice}
        </p>
      </div>
      <div className="w-[28mm] shrink-0 border-2 border-primary p-0.5">
        <div className="relative aspect-[7/9] overflow-hidden bg-white">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={photoAlt}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <span className="grid h-full place-items-center px-1 text-center text-[9px] leading-3 text-muted-foreground">
              {photoLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrintSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-3">
      <h3 className="border-b border-primary/25 pb-0.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
        {title}
      </h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

export function PrintGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2">{children}</div>;
}

export function PrintCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-primary/15 px-2 py-1">
      <p className="text-[9px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-[11px] leading-4">{value.trim() || "—"}</p>
    </div>
  );
}

export function PrintSignature({
  name,
  signature,
  date,
  place,
}: {
  name: string;
  signature: string | null;
  date: string;
  place?: string;
}) {
  return (
    <div className="mt-auto grid grid-cols-[1.4fr_1fr_0.8fr] items-end gap-4 pt-4">
      <div>
        <p className="text-[9px] tracking-wide text-muted-foreground uppercase">
          Applicant
        </p>
        <p className="mt-1 border-b border-foreground pb-1 text-[12px]">{name || "—"}</p>
        {place ? (
          <p className="mt-1 text-[10px] text-muted-foreground">Place: {place}</p>
        ) : null}
      </div>
      <div>
        <p className="text-[9px] tracking-wide text-muted-foreground uppercase">
          Signature
        </p>
        <div className="mt-1 flex h-14 items-end border-b border-foreground">
          {signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signature}
              alt="Applicant signature"
              className="max-h-14 w-full object-contain object-left-bottom"
            />
          ) : null}
        </div>
      </div>
      <div>
        <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Date</p>
        <p className="mt-1 border-b border-foreground pb-1 text-[12px]">{date}</p>
      </div>
    </div>
  );
}
