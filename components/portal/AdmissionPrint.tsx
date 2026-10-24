import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { interviewCriteria, interviewMax } from "@/data/admission";
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
import { seatLabel } from "@/lib/seating";

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
  // Text lines are shown as boxes: "Batch: July 2026 · Date: 24 October 2026" becomes a Batch
  // box and a Date box. Anything else is shown as it is.
  const boxes = lines
    .filter((line): line is string => typeof line === "string")
    .flatMap((line) => line.split(" · "))
    .filter((part) => part.trim())
    .map((part) => {
      const match = /^([^:]{1,30}):\s*(.+)$/.exec(part);
      return match ? { label: match[1], value: match[2] } : { label: "", value: part };
    });
  const others = lines.filter((line) => typeof line !== "string");
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Logo className="h-8" />
        <p className="text-right text-[0.65rem] leading-tight text-muted-foreground">
          {university.researchOffice} · Office of the Dean
        </p>
      </div>
      <h1 className="mt-2 text-center font-serif text-xl leading-tight text-primary">
        {title}
      </h1>
      {boxes.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] border-t border-l border-foreground/30">
          {boxes.map((box, index) => (
            <div
              key={index}
              className="border-r border-b border-foreground/30 px-2 py-1 text-center"
            >
              {box.label ? (
                <dt className="text-[0.6rem] font-bold tracking-wide text-muted-foreground uppercase">
                  {box.label}
                </dt>
              ) : null}
              <dd className="text-xs font-semibold text-primary">{box.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {others.map((line, index) => (
        <p key={index} className="mt-0.5 text-center text-xs text-muted-foreground">
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
                <tr className="text-center">
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
                        {seatLabel(row) ? (
                          <span className="block text-xs text-muted-foreground">
                            {seatLabel(row)}
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
                <tr className="text-center align-bottom">
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
  // The signature lines follow the table by four blank lines, on the last page of the list:
  // when the table runs on to another page they appear there, after the table.
  const footer = (page: number, last: boolean) => (
    <>
      {last ? (
        <div className="mt-[24mm] grid grid-cols-3 gap-8 text-center text-xs">
          {signatures.map((item) => (
            <div key={item.label}>
              <div className="border-t border-foreground/60 pt-1">
                <p className="font-semibold">{item.name || "\u00a0"}</p>
                <p className="text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-auto pt-2 text-[0.65rem] text-muted-foreground">
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
                <col className="w-[38mm]" />
                <col className="w-[40mm]" />
                <col className="w-[44mm]" />
              </colgroup>
              <thead className="bg-muted/60">
                <tr className="text-center">
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
                    <td className="border border-foreground/30 px-1.5">
                      {row.guideName || "—"}
                      {row.coGuideName ? (
                        <span className="block text-[0.85em]">
                          Co-supervisor: {row.coGuideName}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {footer(pageIndex + 1, pageIndex === pages.length - 1)}
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
                <tr className="text-center">
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
                  </tr>
                ))}
              </tbody>
            </table>
            {footer(pages.length + pageIndex + 1, pageIndex === waitingPages.length - 1)}
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
                <tr className="border-b border-primary/30 text-center">
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
                    <td className="py-1">
                      {row.guideName || "—"}
                      {row.coGuideName ? (
                        <span className="block text-[0.85em]">
                          Co-supervisor: {row.coGuideName}
                        </span>
                      ) : null}
                    </td>
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
                <tr className="border-b border-primary/30 text-center">
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

/**
 * Seating plan for the notice board: large, bold sheets to fix outside the building or door.
 * One page per venue lists every room with its hall ticket range, then each room has its own
 * page(s) with the room name in a banner and the seat, hall ticket number and name of every
 * candidate. No signature columns; the attendance sheets carry those.
 */
export function SeatingSheet({
  rows,
  schedule,
  campuses,
}: {
  rows: readonly AdmissionCase[];
  schedule: EntranceSchedule;
  campuses: readonly ExamCampus[];
}) {
  const when = `${schedule.date ? formatIsoDate(schedule.date) : "—"}  ·  Test begins ${clockLabel(schedule.examTime) || "—"}`;
  const banner = (venue: string, address: string, title: string, big?: string) => (
    <>
      <div className="flex items-center justify-between gap-3">
        <Logo className="h-9" />
        <p className="text-right text-xs leading-tight font-semibold text-muted-foreground">
          {university.researchOffice} · Office of the Dean
        </p>
      </div>
      <p className="mt-3 text-center text-sm font-bold tracking-[0.2em] text-secondary uppercase">
        {sessionText(schedule)}
      </p>
      <h1 className="mt-1 text-center font-serif text-3xl leading-tight font-bold tracking-wide text-primary uppercase">
        {title}
      </h1>
      <p className="mt-1 text-center text-xl font-bold text-foreground">{when}</p>
      <p className="mt-1 text-center text-lg font-semibold text-foreground">
        {venue}
        {address ? <span className="font-normal"> · {address}</span> : null}
      </p>
      {big ? (
        <div className="mt-4 rounded-2xl border-4 border-primary bg-primary py-3 text-center">
          <p className="font-serif text-6xl leading-none font-bold tracking-wide text-primary-foreground uppercase">
            {big}
          </p>
        </div>
      ) : null}
    </>
  );
  const perPage = 11;
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {campuses.flatMap((campus) => {
          const seated = rows.filter(
            (row) => row.examCampusId === campus.id && row.examSeat && row.examRoom,
          );
          if (seated.length === 0) return [];
          const roomNames = [...new Set(seated.map((row) => row.examRoom))];
          const roomRows = roomNames.map((name) =>
            seated
              .filter((row) => row.examRoom === name)
              .sort((a, b) => Number(a.examSeat) - Number(b.examSeat)),
          );
          const summary = (
            <Sheet key={`${campus.id}-summary`}>
              {banner(campus.name, campus.address, "Seating plan")}
              <table className="mt-6 w-full border-collapse border-2 border-foreground text-xl">
                <thead className="bg-primary text-primary-foreground">
                  <tr className="text-center">
                    <th className="border-2 border-foreground px-4 py-3 text-2xl font-bold">
                      Room
                    </th>
                    <th className="border-2 border-foreground px-4 py-3 text-2xl font-bold">
                      Hall ticket numbers
                    </th>
                    <th className="border-2 border-foreground px-4 py-3 text-center text-2xl font-bold">
                      Candidates
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomRows.map((list, index) => {
                    const tickets = list
                      .map((row) => row.hallTicketNo)
                      .sort((a, b) => a.localeCompare(b));
                    return (
                      <tr key={roomNames[index]}>
                        <td className="border-2 border-foreground px-4 py-4 text-3xl font-bold">
                          {roomNames[index]}
                        </td>
                        <td className="border-2 border-foreground px-4 py-4 font-mono text-2xl font-bold">
                          {tickets[0]} – {tickets[tickets.length - 1]}
                        </td>
                        <td className="border-2 border-foreground px-4 py-4 text-center text-3xl font-bold">
                          {list.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-auto pt-6 text-center text-lg font-semibold">
                Candidates must sit only in the room and seat shown on the hall ticket.
              </p>
            </Sheet>
          );
          const sheets = roomRows.flatMap((list, roomIndex) =>
            pagesOf(list, perPage).map((page, pageIndex, pages) => (
              <Sheet key={`${campus.id}-${roomNames[roomIndex]}-${pageIndex}`}>
                {banner(
                  campus.name,
                  campus.address,
                  "Ph.D. Entrance Examination",
                  roomNames[roomIndex],
                )}
                <table className="mt-5 w-full border-collapse border-2 border-foreground">
                  <thead className="bg-muted">
                    <tr className="text-center">
                      <th className="w-[26mm] border-2 border-foreground px-3 py-2 text-center text-xl font-bold">
                        Seat
                      </th>
                      <th className="w-[58mm] border-2 border-foreground px-3 py-2 text-xl font-bold">
                        Hall ticket No.
                      </th>
                      <th className="border-2 border-foreground px-3 py-2 text-xl font-bold">
                        Candidate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.map((row) => (
                      <tr key={row.applicationId} className="h-[13mm]">
                        <td className="border-2 border-foreground px-3 text-center text-3xl font-bold">
                          {row.examSeat}
                        </td>
                        <td className="border-2 border-foreground px-3 font-mono text-2xl font-bold">
                          {row.hallTicketNo}
                        </td>
                        <td className="border-2 border-foreground px-3 text-2xl font-bold">
                          {displayName(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-auto pt-4 text-center text-sm font-semibold text-muted-foreground">
                  {roomNames[roomIndex]} · {list.length} candidate
                  {list.length === 1 ? "" : "s"}
                  {pages.length > 1 ? ` · Page ${pageIndex + 1} of ${pages.length}` : ""}
                </p>
              </Sheet>
            )),
          );
          return [summary, ...sheets];
        })}
      </article>
    </div>
  );
}

export type MeritGroup = {
  subject: string;
  seats: number;
  selected: readonly AdmissionCase[];
  waiting: readonly AdmissionCase[];
};

/**
 * Subject-wise merit list and waiting list. Each subject starts on a new page with its name in
 * a box at the top, then a Selection list box and a Waiting list box. When both fit on one
 * page they share it; otherwise the selection list takes its own page(s) and the waiting list
 * starts on the next page for that subject.
 */
export function MeritSheet({
  groups,
  sessionLabel,
}: {
  groups: readonly MeritGroup[];
  sessionLabel: string;
}) {
  /** Rows that fit on one page with both boxes (box titles and table headings included). */
  const sharedRows = 18;
  const perPage = 24;
  const cell = "border-b border-foreground/20 px-2";
  const headCell = "border-b border-foreground/30 px-2 py-1";
  const selectedBox = (rows: readonly AdmissionCase[], offset = 0) => (
    <div className="mt-4 overflow-hidden rounded-xl border-2 border-primary">
      <p className="bg-primary px-3 py-1.5 text-sm font-bold tracking-[0.12em] text-primary-foreground uppercase">
        Selection list
      </p>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/60">
          <tr className="text-center">
            <th className={`w-[10mm] ${headCell}`}>S. No.</th>
            <th className={`w-[12mm] ${headCell}`}>Rank</th>
            <th className={headCell}>Name of the candidate</th>
            <th className={`w-[36mm] ${headCell}`}>Application No.</th>
            <th className={`w-[16mm] text-center ${headCell}`}>Written</th>
            <th className={`w-[18mm] text-center ${headCell}`}>Interview</th>
            <th className={`w-[14mm] text-center ${headCell}`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-3 text-muted-foreground" colSpan={7}>
                No candidate is selected in this subject.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.applicationId} className="h-[8mm]">
                <td className={cell}>{offset + index + 1}</td>
                <td className={cell}>{row.meritRank ?? "—"}</td>
                <td className={`${cell} font-semibold`}>{displayName(row)}</td>
                <td className={`${cell} font-mono`}>{row.applicationNo}</td>
                <td className={`${cell} text-center`}>{row.written ?? "—"}</td>
                <td className={`${cell} text-center`}>{row.interview ?? "—"}</td>
                <td className={`${cell} text-center font-semibold`}>
                  {totalMarks(row) ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
  const waitingBox = (rows: readonly AdmissionCase[], offset = 0) => (
    <div className="mt-4 overflow-hidden rounded-xl border-2 border-secondary">
      <p className="bg-secondary px-3 py-1.5 text-sm font-bold tracking-[0.12em] text-secondary-foreground uppercase">
        Waiting list
      </p>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/60">
          <tr className="text-center">
            <th className={`w-[10mm] ${headCell}`}>S. No.</th>
            <th className={`w-[18mm] ${headCell}`}>Waiting No.</th>
            <th className={headCell}>Name of the candidate</th>
            <th className={`w-[36mm] ${headCell}`}>Application No.</th>
            <th className={`w-[14mm] text-center ${headCell}`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-3 text-muted-foreground" colSpan={5}>
                No candidate is on the waiting list for this subject.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.applicationId} className="h-[8mm]">
                <td className={cell}>{offset + index + 1}</td>
                <td className={`${cell} font-semibold`}>W{row.waitlistRank}</td>
                <td className={`${cell} font-semibold`}>{displayName(row)}</td>
                <td className={`${cell} font-mono`}>{row.applicationNo}</td>
                <td className={`${cell} text-center font-semibold`}>
                  {totalMarks(row) ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
  const head = (group: MeritGroup, part: string) => (
    <>
      <SheetHeading
        title="Ph.D. Admission · Merit list and waiting list"
        lines={[`${sessionLabel || "Admission session"}${part ? ` · ${part}` : ""}`]}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground px-4 py-2">
        <p className="font-serif text-2xl leading-tight font-bold text-primary">
          {group.subject}
        </p>
        <p className="text-xs font-semibold">
          Seats {group.seats} · Selected {group.selected.length} · Waiting{" "}
          {group.waiting.length}
        </p>
      </div>
    </>
  );
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {groups.flatMap((group) => {
          if (group.selected.length + group.waiting.length <= sharedRows) {
            return [
              <Sheet key={group.subject}>
                {head(group, "")}
                {selectedBox(group.selected)}
                {waitingBox(group.waiting)}
              </Sheet>,
            ];
          }
          const selectedPages = pagesOf(group.selected, perPage);
          const waitingPages = pagesOf(group.waiting, perPage);
          return [
            ...selectedPages.map((page, index) => (
              <Sheet key={`${group.subject}-s${index}`}>
                {head(
                  group,
                  `Selection list${selectedPages.length > 1 ? ` (page ${index + 1} of ${selectedPages.length})` : ""}`,
                )}
                {selectedBox(page, index * perPage)}
              </Sheet>
            )),
            ...waitingPages.map((page, index) => (
              <Sheet key={`${group.subject}-w${index}`}>
                {head(
                  group,
                  `Waiting list${waitingPages.length > 1 ? ` (page ${index + 1} of ${waitingPages.length})` : ""}`,
                )}
                {waitingBox(page, index * perPage)}
              </Sheet>
            )),
          ];
        })}
      </article>
    </div>
  );
}
