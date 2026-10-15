import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import {
  displayName,
  modeLabel,
  type AdmissionCase,
  type EntranceSchedule,
  type LetterConfig,
} from "@/lib/admission";
import { university } from "@/lib/constants";
import { formatIsoDate, formatYearMonth } from "@/lib/dates";

function Sheet({ children }: { children: ReactNode }) {
  return (
    <section className="pdf-page flex min-h-[277mm] flex-col rounded-xl border border-border bg-white p-6 text-foreground shadow-card">
      <div className="h-1.5 bg-primary" />
      <div className="h-0.5 bg-accent" />
      <div className="pt-3">{children}</div>
    </section>
  );
}

function pagesOf<T>(rows: readonly T[], size: number) {
  if (rows.length === 0) return [[] as T[]];
  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }
  return pages;
}

export function AttendanceSheet({
  rows,
  schedule,
}: {
  rows: readonly { row: AdmissionCase; serial: number }[];
  schedule: EntranceSchedule;
}) {
  const pages = pagesOf(rows, 16);
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <div className="flex items-center justify-between gap-4">
              <Logo className="h-10" />
              <p className="text-right text-xs text-muted-foreground">
                {university.researchOffice}
              </p>
            </div>
            <h1 className="mt-4 font-serif text-xl text-primary">
              Entrance and interview attendance
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Session: {schedule.session || "—"} · Month and year:{" "}
              {formatYearMonth(schedule.monthYear) || "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Date: {schedule.date ? formatIsoDate(schedule.date) : "—"} · Venue:{" "}
              {schedule.venue || "—"}
            </p>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-primary/30 text-left">
                  <th className="py-1 pr-2">S. No.</th>
                  <th className="py-1 pr-2">Department</th>
                  <th className="py-1 pr-2">Name of the candidate</th>
                  <th className="py-1 pr-2">Application No.</th>
                  <th className="py-1">Signature</th>
                </tr>
              </thead>
              <tbody>
                {page.map(({ row, serial }) => (
                  <tr key={row.applicationId} className="border-b border-border">
                    <td className="py-2 pr-2">{serial}</td>
                    <td className="py-2 pr-2">{row.department}</td>
                    <td className="py-2 pr-2">{displayName(row)}</td>
                    <td className="py-2 pr-2">{row.applicationNo}</td>
                    <td className="py-2" />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-6 text-xs text-muted-foreground">
              Page {pageIndex + 1} of {pages.length}
            </p>
          </Sheet>
        ))}
      </article>
    </div>
  );
}

export function ProvisionalSheet({
  rows,
}: {
  rows: readonly { row: AdmissionCase; serial: number }[];
}) {
  const pages = pagesOf(rows, 16);
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <Logo className="h-10" />
            <h1 className="mt-4 font-serif text-xl text-primary">Provisional list</h1>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-primary/30 text-left">
                  <th className="py-1 pr-2">S. No.</th>
                  <th className="py-1 pr-2">Name of the Candidate</th>
                  <th className="py-1 pr-2">Subject/department</th>
                  <th className="py-1">Guide Allotted</th>
                </tr>
              </thead>
              <tbody>
                {page.map(({ row, serial }) => (
                  <tr key={row.applicationId} className="border-b border-border">
                    <td className="py-2 pr-2">{serial}</td>
                    <td className="py-2 pr-2">{displayName(row)}</td>
                    <td className="py-2 pr-2">{row.department}</td>
                    <td className="py-2">{row.guideName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-6 text-xs text-muted-foreground">
              Page {pageIndex + 1} of {pages.length}
            </p>
          </Sheet>
        ))}
      </article>
    </div>
  );
}

export function AdmissionLetter({
  row,
  serial,
  letter,
}: {
  row: AdmissionCase;
  serial: number;
  letter: LetterConfig;
}) {
  const documents = letter.documents
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const ref = `${letter.refPrefix}/${String(serial).padStart(2, "0")}`;
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        <Sheet>
          <Logo className="h-10" />
          <p className="mt-3 text-center font-serif text-lg text-primary">
            {letter.programme}
          </p>
          <p className="text-center text-sm font-semibold">{letter.sessionLabel}</p>
          <div className="mt-3 flex justify-between gap-4 text-sm">
            <p>Ref. No: {ref}</p>
            <p>Date: {letter.issueDate}</p>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-sm">
            <p>App. No.: {row.applicationNo}</p>
            <p>For Office Use — Roll Number</p>
          </div>
          <p className="mt-4 text-sm leading-6">
            {displayName(row)} is informed that you have been provisionally selected for
            admission to the {letter.programme} in {row.department} under{" "}
            {modeLabel(row.studyMode)} registration, subject to the eligibility conditions
            as per the Ph.D. regulations of the University.
          </p>
          <p className="mt-3 text-sm leading-6">
            You are required to produce all the original certificates and one
            self-attested photocopy for verification upon admission. To complete your
            enrolment, please submit the following documents and materials.
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-6">
            {documents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6">
            Please report to the office of the Dean-Research on or before{" "}
            {letter.reportBy}. Your admission will be officially confirmed after the
            verification of your original certificates and the subsequent payment of the
            tuition fee.
          </p>
          <p className="mt-3 text-sm leading-6">
            Tuition fee: Full-time ₹{letter.fullTimeFee} per year, Part-time ₹
            {letter.partTimeFee} per year. The tuition fee must be paid by{" "}
            {letter.reportBy} through {letter.accountName} A/C No. {letter.accountNumber},{" "}
            {letter.bankName} (IFSC {letter.ifsc}), {letter.branch}. Failure to pay the
            required tuition fee by {letter.reportBy} may result in the cancellation of
            this provisional admission.
          </p>
          <p className="mt-3 text-sm leading-6">
            We congratulate you on your selection and look forward to welcoming you. Call{" "}
            {letter.phone} if you need any help.
          </p>
          <p className="mt-4 text-sm">Best Wishes,</p>
          <p className="mt-3 text-sm font-semibold">{letter.deanName}</p>
          <p className="text-sm">{letter.deanTitle}</p>
        </Sheet>
      </article>
    </div>
  );
}
