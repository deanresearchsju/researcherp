import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { interviewCriteria, interviewMax, writtenMax } from "@/data/admission";
import {
  clockLabel,
  displayName,
  emptyExpert,
  modeLabel,
  totalMarks,
  type AdmissionCase,
  type EntranceSchedule,
  type ExamCampus,
  type InterviewPanel,
  type LetterConfig,
} from "@/lib/admission";
import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";

export function Sheet({ children }: { children: ReactNode }) {
  return (
    <section className="pdf-page flex min-h-[277mm] flex-col rounded-xl border border-border bg-white p-4 text-foreground shadow-card">
      <div className="h-1.5 bg-primary" />
      <div className="h-0.5 bg-accent" />
      <div className="flex flex-1 flex-col pt-2">{children}</div>
    </section>
  );
}

export function pagesOf<T>(rows: readonly T[], size: number) {
  if (rows.length === 0) return [[] as T[]];
  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }
  return pages;
}

export function SheetHeading({
  title,
  lines,
}: {
  title: string;
  lines: readonly ReactNode[];
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Logo className="h-8" />
        <p className="text-right text-[0.65rem] leading-tight text-muted-foreground">
          {university.researchOffice} · Office of the Dean
        </p>
      </div>
      <h1 className="mt-2 font-serif text-lg leading-tight text-primary">{title}</h1>
      {lines.map((line, index) => (
        <p
          key={index}
          className={
            index === lines.length - 1
              ? "mt-0.5 text-xs font-medium text-primary"
              : "mt-0.5 text-xs text-muted-foreground"
          }
        >
          {line}
        </p>
      ))}
    </>
  );
}

function sessionText(schedule: EntranceSchedule) {
  return `${schedule.session || "—"} ${schedule.monthYear.slice(0, 4)} session`;
}

/** Campus-wise attendance with the candidate's photograph and a signature column. */
export function AttendanceSheet({
  rows,
  schedule,
  campus = null,
  photos = {},
}: {
  rows: readonly { row: AdmissionCase; serial: number }[];
  schedule: EntranceSchedule;
  campus?: ExamCampus | null;
  photos?: Readonly<Record<string, string | null>>;
}) {
  const pages = pagesOf(rows, 8);
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <SheetHeading
              title="Ph.D. Entrance Examination · Attendance sheet"
              lines={[
                `${sessionText(schedule)} · Date: ${schedule.date ? formatIsoDate(schedule.date) : "—"} · Test begins: ${clockLabel(schedule.examTime) || "—"}`,
                `Centre: ${campus ? campus.name : "Campus not assigned"}${campus?.address ? ` · ${campus.address}` : ""}`,
              ]}
            />
            <table className="mt-2 w-full border-collapse border border-foreground/30 text-xs">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="border border-foreground/30 px-2 py-1">S. No.</th>
                  <th className="border border-foreground/30 px-2 py-1">Photograph</th>
                  <th className="border border-foreground/30 px-2 py-1">Candidate</th>
                  <th className="border border-foreground/30 px-2 py-1">
                    Subject / hall
                  </th>
                  <th className="w-40 border border-foreground/30 px-2 py-1">
                    Signature of the candidate
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.map(({ row, serial }) => {
                  const photo = photos[row.applicationId];
                  return (
                    <tr key={row.applicationId}>
                      <td className="border border-foreground/30 px-2 py-1 align-middle">
                        {serial}
                      </td>
                      <td className="border border-foreground/30 p-1">
                        <div className="grid h-[22mm] w-[17mm] place-items-center overflow-hidden border border-foreground/20 bg-white">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt={displayName(row)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="px-1 text-center text-[9px] text-muted-foreground">
                              Affix photo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border border-foreground/30 px-2 py-1 align-middle">
                        <p className="font-mono text-xs font-semibold">
                          {row.hallTicketNo || "—"}
                        </p>
                        <p className="font-semibold">{displayName(row)}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.applicationNo}
                        </p>
                      </td>
                      <td className="border border-foreground/30 px-2 py-1 align-middle">
                        {row.department}
                        {row.examRoom ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.examRoom}
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-foreground/30" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-auto grid grid-cols-3 gap-6 pt-6 text-center text-xs text-muted-foreground">
              <p className="border-t border-foreground/40 pt-1">
                Present: ____ Absent: ____
              </p>
              <p className="border-t border-foreground/40 pt-1">
                Invigilator&apos;s name & signature
              </p>
              <p className="border-t border-foreground/40 pt-1">
                Exam Superintendent
                {schedule.superintendentName ? ` · ${schedule.superintendentName}` : ""}
              </p>
            </div>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Page {pageIndex + 1} of {pages.length}
            </p>
          </Sheet>
        ))}
      </article>
    </div>
  );
}

const criterionLetter = (index: number) => String.fromCharCode(65 + index);

/**
 * Interview assessment sheet of one panel (30 marks). Every page carries the panel's details and
 * its two members at the top, and the members' names with a signature line at the bottom.
 */
export function InterviewSheet({
  rows,
  schedule,
  panel,
}: {
  rows: readonly AdmissionCase[];
  schedule: EntranceSchedule;
  panel: InterviewPanel | null;
}) {
  const perPage = 12;
  const pages = pagesOf(rows, perPage);
  const experts = panel?.experts ?? [emptyExpert, emptyExpert];
  const date = panel?.date || schedule.date;
  const subjects = [...new Set(rows.map((row) => row.department))];
  const subjectText =
    panel && panel.subjects.length > 0 ? panel.subjects.join(", ") : subjects.join(", ");
  const blank = "________________________";
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <SheetHeading
              title={`Ph.D. Admission Interview · ${panel?.name ?? "Panel not assigned"}`}
              lines={[
                `${sessionText(schedule)} · Maximum ${interviewMax} marks · Date of interview: ${date ? formatIsoDate(date) : "—"}${panel?.venue ? ` · Venue: ${panel.venue}` : ""}`,
                `${panel?.school ? `${panel.school} · ` : ""}Subject(s): ${subjectText || "—"} · Candidates on this panel: ${rows.length}`,
              ]}
            />
            <div className="mt-2 grid grid-cols-2 gap-3 rounded-md border border-foreground/30 px-3 py-2 text-xs">
              {experts.map((expert, index) => (
                <div key={index} className="space-y-0.5">
                  <p className="text-[0.65rem] font-bold tracking-wide text-primary uppercase">
                    Panel member {index + 1}
                  </p>
                  <p className="font-semibold">{expert.name || blank}</p>
                  <p>{expert.designation || blank}</p>
                  <p>{expert.institution || blank}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.65rem] leading-tight text-muted-foreground">
              {interviewCriteria
                .map(
                  (item, index) =>
                    `${criterionLetter(index)}: ${item.label} (${item.max})`,
                )
                .join(" · ")}
            </p>
            <table className="mt-1 w-full table-fixed border-collapse border border-foreground/30 text-xs">
              <colgroup>
                <col className="w-[9mm]" />
                <col className="w-[26mm]" />
                <col />
                <col className="w-[30mm]" />
                {interviewCriteria.map((item) => (
                  <col key={item.label} className="w-[11mm]" />
                ))}
                <col className="w-[13mm]" />
                <col className="w-[20mm]" />
              </colgroup>
              <thead className="bg-muted/60">
                <tr className="text-left align-bottom">
                  <th className="border border-foreground/30 px-1 py-1">S. No.</th>
                  <th className="border border-foreground/30 px-1 py-1">Hall ticket</th>
                  <th className="border border-foreground/30 px-1 py-1">
                    Name of the candidate
                  </th>
                  <th className="border border-foreground/30 px-1 py-1">Subject</th>
                  {interviewCriteria.map((item, index) => (
                    <th
                      key={item.label}
                      className="border border-foreground/30 px-1 py-1 text-center"
                    >
                      {criterionLetter(index)}
                      <span className="block font-normal">({item.max})</span>
                    </th>
                  ))}
                  <th className="border border-foreground/30 px-1 py-1 text-center">
                    Total
                    <span className="block font-normal">({interviewMax})</span>
                  </th>
                  <th className="border border-foreground/30 px-1 py-1">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {page.map((row, index) => (
                  <tr key={row.applicationId} className="h-[10mm]">
                    <td className="border border-foreground/30 px-1.5">
                      {pageIndex * perPage + index + 1}
                    </td>
                    <td className="border border-foreground/30 px-1.5 font-mono">
                      {row.hallTicketNo || "—"}
                    </td>
                    <td className="border border-foreground/30 px-1.5 font-semibold">
                      {displayName(row)}
                    </td>
                    <td className="border border-foreground/30 px-1.5">
                      {row.department}
                    </td>
                    {interviewCriteria.map((item) => (
                      <td key={item.label} className="border border-foreground/30" />
                    ))}
                    <td className="border border-foreground/30" />
                    <td className="border border-foreground/30" />
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-auto grid grid-cols-2 gap-10 pt-8 text-xs">
              {experts.map((expert, index) => (
                <p key={index} className="flex items-end gap-2">
                  <span className="shrink-0 font-semibold">
                    {expert.name || "Panel member"}
                  </span>
                  <span className="flex-1 border-b border-foreground/60" />
                </p>
              ))}
            </div>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Page {pageIndex + 1} of {pages.length}
            </p>
          </Sheet>
        ))}
      </article>
    </div>
  );
}
/**
 * The provisional list put up for the approval of the Research Advisory Board or the Vice
 * Chancellor: selected candidates with their guides, the waiting list, and the Prepared by,
 * Verified by and Dean signature lines on every page.
 */
export function ApprovalSheet({
  rows,
  waiting = [],
  sessionLabel = "",
  preparedBy = "",
  verifiedBy = "",
  deanName = "",
  deanTitle = "Dean, Research and Development",
}: {
  rows: readonly { row: AdmissionCase; serial: number }[];
  waiting?: readonly AdmissionCase[];
  sessionLabel?: string;
  preparedBy?: string;
  verifiedBy?: string;
  deanName?: string;
  deanTitle?: string;
}) {
  const pages = pagesOf(rows, 16);
  const waitingPages = waiting.length > 0 ? pagesOf(waiting, 20) : [];
  const total = pages.length + waitingPages.length;
  const signatures = [
    { label: "Prepared by", name: preparedBy },
    { label: "Verified by", name: verifiedBy },
    { label: deanTitle, name: deanName },
  ];
  const footer = (page: number) => (
    <>
      <div className="mt-auto grid grid-cols-3 gap-8 pt-10 text-center text-xs">
        {signatures.map((item) => (
          <div key={item.label}>
            <div className="border-t border-foreground/60 pt-1">
              <p className="font-semibold">{item.name || "\u00a0"}</p>
              <p className="text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.65rem] text-muted-foreground">
        Page {page} of {total}
      </p>
    </>
  );
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <SheetHeading
              title="Ph.D. Admission · Provisional selection list"
              lines={[
                `${sessionLabel || "Admission session"} · For the approval of the Research Advisory Board / Vice Chancellor · Candidates selected: ${rows.length}`,
              ]}
            />
            <table className="mt-2 w-full table-fixed border-collapse border border-foreground/30 text-xs">
              <colgroup>
                <col className="w-[9mm]" />
                <col />
                <col className="w-[36mm]" />
                <col className="w-[34mm]" />
                <col className="w-[14mm]" />
                <col className="w-[38mm]" />
              </colgroup>
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="border border-foreground/30 px-1.5 py-1">S. No.</th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Name of the candidate
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Application No.
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Subject / department
                  </th>

                  <th className="border border-foreground/30 px-1.5 py-1 text-center">
                    Marks /{writtenMax + interviewMax}
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Guide allotted
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.map(({ row, serial }) => (
                  <tr key={row.applicationId} className="h-[8mm]">
                    <td className="border border-foreground/30 px-1.5">{serial}</td>
                    <td className="border border-foreground/30 px-1.5 font-semibold">
                      {displayName(row)}
                    </td>
                    <td className="border border-foreground/30 px-1.5 font-mono">
                      {row.applicationNo}
                    </td>
                    <td className="border border-foreground/30 px-1.5">
                      {row.department}
                    </td>

                    <td className="border border-foreground/30 px-1.5 text-center">
                      {totalMarks(row) ?? "—"}
                    </td>
                    <td className="border border-foreground/30 px-1.5">
                      {row.guideName || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {footer(pageIndex + 1)}
          </Sheet>
        ))}
        {waitingPages.map((page, pageIndex) => (
          <Sheet key={`w-${pageIndex}`}>
            <SheetHeading
              title="Ph.D. Admission · Waiting list"
              lines={[
                `${sessionLabel || "Admission session"} · For the approval of the Research Advisory Board / Vice Chancellor · Candidates on the waiting list: ${waiting.length}`,
              ]}
            />
            <table className="mt-2 w-full border-collapse border border-foreground/30 text-xs">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Subject / department
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Waiting list No.
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Name of the candidate
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Application No.
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1 text-center">
                    Marks /{writtenMax + interviewMax}
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.map((row) => (
                  <tr key={row.applicationId} className="h-[8mm]">
                    <td className="border border-foreground/30 px-1.5">
                      {row.department}
                    </td>
                    <td className="border border-foreground/30 px-1.5">
                      W{row.waitlistRank}
                    </td>
                    <td className="border border-foreground/30 px-1.5 font-semibold">
                      {displayName(row)}
                    </td>
                    <td className="border border-foreground/30 px-1.5 font-mono">
                      {row.applicationNo}
                    </td>
                    <td className="border border-foreground/30 px-1.5 text-center">
                      {totalMarks(row) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {footer(pages.length + pageIndex + 1)}
          </Sheet>
        ))}
      </article>
    </div>
  );
}

export function ProvisionalSheet({
  rows,
  waiting = [],
  sessionLabel = "",
}: {
  rows: readonly { row: AdmissionCase; serial: number }[];
  waiting?: readonly AdmissionCase[];
  sessionLabel?: string;
}) {
  const pages = pagesOf(rows, 20);
  const waitingPages = waiting.length > 0 ? pagesOf(waiting, 20) : [];
  const total = pages.length + waitingPages.length;
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <Logo className="h-8" />
            <h1 className="mt-2 font-serif text-lg text-primary">
              Provisional list{sessionLabel ? ` · ${sessionLabel}` : ""}
            </h1>
            <table className="mt-2 w-full border-collapse text-xs">
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
                    <td className="py-1 pr-2">{serial}</td>
                    <td className="py-1 pr-2">{displayName(row)}</td>
                    <td className="py-1 pr-2">{row.department}</td>
                    <td className="py-1">{row.guideName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Page {pageIndex + 1} of {total}
            </p>
          </Sheet>
        ))}
        {waitingPages.map((page, pageIndex) => (
          <Sheet key={`w-${pageIndex}`}>
            <Logo className="h-8" />
            <h1 className="mt-2 font-serif text-lg text-primary">
              Waiting list{sessionLabel ? ` · ${sessionLabel}` : ""}
            </h1>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-primary/30 text-left">
                  <th className="py-1 pr-2">Subject/department</th>
                  <th className="py-1 pr-2">Waiting list No.</th>
                  <th className="py-1 pr-2">Name of the Candidate</th>
                  <th className="py-1">Application No.</th>
                </tr>
              </thead>
              <tbody>
                {page.map((row) => (
                  <tr key={row.applicationId} className="border-b border-border">
                    <td className="py-1 pr-2">{row.department}</td>
                    <td className="py-1 pr-2">W{row.waitlistRank}</td>
                    <td className="py-1 pr-2">{displayName(row)}</td>
                    <td className="py-1">{row.applicationNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              A seat released by a selected candidate who does not report is offered to
              the next candidate on the waiting list of the same subject, in this order.
            </p>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Page {pages.length + pageIndex + 1} of {total}
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
