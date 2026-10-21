import type { ReactNode } from "react";

import { supervisorDeclaration } from "@/data/declarations";
import { supervisorEnclosures } from "@/data/documents";
import { supervisorFormCopy } from "@/data/forms";
import { supervisorSheetCopy } from "@/data/supervisor-application-sheet";
import { retirementAge, university } from "@/lib/constants";
import {
  ageParts,
  clientToday,
  formatAge,
  formatIsoDate,
  serviceUntilAge,
  sumDuration,
} from "@/lib/dates";
import type { SupervisorReceipt } from "@/lib/supervisor-application";
import { cn } from "@/lib/utils";
import type { SupervisorFormValues } from "@/lib/validation";

const enclosedDocuments = supervisorEnclosures.filter(
  (spec) => spec.id !== "photo" && spec.id !== "signature",
);

function addressOf(address: SupervisorFormValues["permanent"]) {
  return [
    address.door,
    address.street,
    address.city,
    address.district,
    address.state,
    address.pin,
    address.country,
  ]
    .filter((part) => part.trim())
    .join(", ");
}

function dash(value: string) {
  return value.trim() || supervisorSheetCopy.none;
}

function span(years: string, months: string) {
  return `${years || "0"} yrs, ${months || "0"} mo`;
}

function qualificationFilled(row: SupervisorFormValues["postgraduate"]) {
  return [row.degree, row.university, row.discipline, row.year, row.percentage].some(
    (part) => part.trim(),
  );
}

function Cell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 border-r border-foreground/20 px-1.5 py-0.5 last:border-r-0",
        className,
      )}
    >
      <span className="font-semibold text-primary">{label} : </span>
      <span className="break-words">{dash(value)}</span>
    </div>
  );
}

function Numbered({ n, children }: { n: number; children: ReactNode }) {
  return (
    <tr>
      <td className="w-6 border border-foreground/25 bg-muted px-0.5 py-0.5 text-center align-top font-bold text-primary">
        {n}
      </td>
      <td className="min-w-0 border border-foreground/25 p-0">{children}</td>
    </tr>
  );
}

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-foreground/20 bg-muted px-1.5 py-0.5 font-semibold text-primary">
      {children}
    </p>
  );
}

export function SupervisorApplicationSheet({ receipt }: { receipt: SupervisorReceipt }) {
  const { values } = receipt;
  const applied = formatIsoDate(receipt.submittedOn.slice(0, 10) || receipt.submittedOn);
  const printed = formatIsoDate(clientToday());
  const ageLabel = formatAge(ageParts(values.dateOfBirth));
  const remaining = formatAge(serviceUntilAge(values.dateOfBirth, retirementAge));
  const teaching = formatAge(
    sumDuration(values.preYears, values.preMonths, values.postYears, values.postMonths),
  );
  const communication = values.sameAddress
    ? supervisorSheetCopy.sameAddress
    : addressOf(values.communication);
  const recognised =
    values.recognisedElsewhere === "Yes"
      ? values.recognitionDetails
      : values.recognisedElsewhere;
  const qualifications = (
    [
      [supervisorSheetCopy.postgraduate, values.postgraduate],
      [supervisorSheetCopy.mphil, values.mphil],
      [supervisorSheetCopy.phd, values.phd],
      [supervisorSheetCopy.dlitt, values.dlitt],
    ] as const
  ).filter(
    ([label, row]) =>
      label === supervisorSheetCopy.postgraduate ||
      label === supervisorSheetCopy.phd ||
      qualificationFilled(row),
  );
  const papers = values.publications.filter((paper) => paper.title.trim());
  const other = values.otherInformation.trim();
  const enclosedNow = enclosedDocuments.filter((spec) => receipt.attachments[spec.id]);
  // Section numbers in print order, assigned once per render.
  const counter = { value: 0 };
  const next = () => {
    counter.value += 1;
    return counter.value;
  };

  return (
    <div className="w-full overflow-x-auto">
      <article className="phd-sheet print-root pdf-page mx-auto flex w-full max-w-[210mm] flex-col bg-white px-3 py-2 text-[9px] leading-tight text-foreground">
        <div className="h-0.5 bg-accent" />
        <div className="h-1 bg-primary" />

        <header className="grid grid-cols-[58mm_minmax(0,1fr)_22mm] items-center gap-2 py-1.5">
          <div className="flex min-w-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo-sju.jpg"
              alt={university.name}
              className="max-h-16 w-full object-contain object-left"
            />
          </div>
          <div className="min-w-0 px-1 text-center">
            <h2 className="font-heading text-[12px] leading-tight font-extrabold tracking-wide text-primary">
              {supervisorSheetCopy.formTitle}
            </h2>
            <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-secondary">
              {university.researchOffice}
            </p>
            <p className="mt-0.5 text-[9px] leading-tight">
              <span className="font-semibold tracking-wide text-muted-foreground">
                {supervisorSheetCopy.applicationNo}
              </span>
              <span className="mt-0.5 block font-heading text-[11px] font-bold break-all text-primary">
                {receipt.applicationNo}
              </span>
            </p>
          </div>
          <div className="h-[28mm] w-[22mm] overflow-hidden border border-foreground bg-white">
            {receipt.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.photo}
                alt={supervisorFormCopy.photoLabel}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center px-1 text-center text-[6px] leading-3 text-muted-foreground">
                {supervisorFormCopy.photoLabel}
              </span>
            )}
          </div>
        </header>

        <div className="mb-1.5 h-0.5 bg-primary" />

        <table className="w-full table-fixed border-collapse">
          <tbody>
            <Numbered n={next()}>
              <Cell label={supervisorSheetCopy.name} value={values.name} />
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-2">
                <Cell
                  label={supervisorSheetCopy.designation}
                  value={values.designation}
                />
                <Cell label={supervisorSheetCopy.department} value={values.department} />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-2">
                <Cell label={supervisorSheetCopy.sex} value={values.sex} />
                <Cell
                  label={supervisorSheetCopy.ageDob}
                  value={`${ageLabel || supervisorSheetCopy.none} · ${formatIsoDate(values.dateOfBirth)}`}
                />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-4">
                <Cell label={supervisorSheetCopy.religion} value={values.religion} />
                <Cell label={supervisorSheetCopy.community} value={values.community} />
                <Cell label={supervisorSheetCopy.state} value={values.state} />
                <Cell
                  label={supervisorSheetCopy.nationality}
                  value={values.nationality}
                />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <Cell
                label={supervisorSheetCopy.permanent}
                value={addressOf(values.permanent)}
              />
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-[1.4fr_0.9fr_1.1fr]">
                <Cell label={supervisorSheetCopy.communication} value={communication} />
                <Cell label={supervisorSheetCopy.contact} value={values.phone} />
                <Cell label={supervisorSheetCopy.email} value={values.email} />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <div>
                <BlockTitle>{supervisorSheetCopy.qualifications}</BlockTitle>
                <table className="w-full table-fixed border-collapse text-[8px]">
                  <thead>
                    <tr>
                      {[
                        supervisorSheetCopy.exam,
                        supervisorSheetCopy.degree,
                        supervisorSheetCopy.university,
                        supervisorSheetCopy.discipline,
                        supervisorSheetCopy.year,
                        supervisorSheetCopy.classObtained,
                        supervisorSheetCopy.percentage,
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="border-r border-b border-foreground/20 px-1 py-0.5 text-left font-semibold last:border-r-0"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {qualifications.map(([label, row]) => (
                      <tr key={label}>
                        <td className="border-r border-b border-foreground/20 px-1 py-0.5 font-semibold break-words">
                          {label}
                        </td>
                        <td className="border-r border-b border-foreground/20 px-1 py-0.5 break-words">
                          {dash(row.degree)}
                        </td>
                        <td className="border-r border-b border-foreground/20 px-1 py-0.5 break-words">
                          {dash(row.university)}
                        </td>
                        <td className="border-r border-b border-foreground/20 px-1 py-0.5 break-words">
                          {dash(row.discipline)}
                        </td>
                        <td className="border-r border-b border-foreground/20 px-1 py-0.5">
                          {label === supervisorSheetCopy.phd
                            ? dash(values.phdAwardYear || row.year)
                            : dash(row.year)}
                        </td>
                        <td className="border-r border-b border-foreground/20 px-1 py-0.5 break-words">
                          {dash(row.classObtained)}
                        </td>
                        <td className="border-b border-foreground/20 px-1 py-0.5">
                          {dash(row.percentage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-3">
                <Cell label={supervisorSheetCopy.faculty} value={values.faculty} />
                <Cell label={supervisorSheetCopy.subject} value={values.subject} />
                <Cell label={supervisorSheetCopy.expertise} value={values.expertise} />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-3">
                <Cell
                  label={supervisorSheetCopy.appointment}
                  value={formatIsoDate(values.appointmentDate)}
                />
                <Cell
                  label={supervisorSheetCopy.remaining}
                  value={remaining || supervisorSheetCopy.none}
                />
                <Cell
                  label={supervisorSheetCopy.proposed}
                  value={values.proposedDepartment}
                />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <div className="grid grid-cols-2">
                <Cell
                  label={supervisorSheetCopy.teaching}
                  value={`${supervisorSheetCopy.teachingPre} ${span(values.preYears, values.preMonths)} · ${supervisorSheetCopy.teachingPost} ${span(values.postYears, values.postMonths)} · ${supervisorSheetCopy.teachingTotal} ${teaching || supervisorSheetCopy.none}`}
                />
                <Cell
                  label={supervisorSheetCopy.research}
                  value={span(values.researchYears, values.researchMonths)}
                />
              </div>
            </Numbered>
            <Numbered n={next()}>
              <Cell label={supervisorSheetCopy.recognised} value={recognised} />
            </Numbered>
            <Numbered n={next()}>
              <div>
                <BlockTitle>{supervisorSheetCopy.publications}</BlockTitle>
                {papers.length === 0 ? (
                  <p className="px-1.5 py-0.5">{supervisorSheetCopy.none}</p>
                ) : (
                  <table className="w-full table-fixed border-collapse text-[8px]">
                    <thead>
                      <tr>
                        <th className="w-5 border-r border-b border-foreground/20 px-1 py-0.5 text-left">
                          #
                        </th>
                        <th className="border-r border-b border-foreground/20 px-1 py-0.5 text-left">
                          {supervisorSheetCopy.paperTitle}
                        </th>
                        <th className="w-[28%] border-r border-b border-foreground/20 px-1 py-0.5 text-left">
                          {supervisorSheetCopy.journal}
                        </th>
                        <th className="w-[22%] border-b border-foreground/20 px-1 py-0.5 text-left">
                          {supervisorSheetCopy.yearIndex}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {papers.map((paper, index) => (
                        <tr key={paper.id || `${paper.title}-${index}`}>
                          <td className="border-r border-b border-foreground/20 px-1 py-0.5">
                            {index + 1}
                          </td>
                          <td className="border-r border-b border-foreground/20 px-1 py-0.5 break-words">
                            {paper.title}
                          </td>
                          <td className="border-r border-b border-foreground/20 px-1 py-0.5 break-words">
                            {dash(paper.journal)}
                          </td>
                          <td className="border-b border-foreground/20 px-1 py-0.5 break-words">
                            {[paper.month, paper.year, paper.indexing]
                              .filter((part) => part.trim())
                              .join(" · ") || supervisorSheetCopy.none}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Numbered>
            {other ? (
              <Numbered n={next()}>
                <Cell label={supervisorSheetCopy.other} value={other} />
              </Numbered>
            ) : null}
            <Numbered n={next()}>
              <Cell
                label={supervisorSheetCopy.documents}
                value={
                  enclosedNow.length === 0
                    ? supervisorSheetCopy.none
                    : enclosedNow
                        .map((spec, index) => `${index + 1}. ${spec.label}`)
                        .join("   ")
                }
              />
            </Numbered>
          </tbody>
        </table>

        <section className="mt-2 border border-primary/30 px-2.5 py-1.5">
          <h3 className="text-center text-[9px] font-bold tracking-[0.14em] text-primary">
            {supervisorSheetCopy.declaration}
          </h3>
          <p className="mt-0.5 text-justify text-[8px] leading-tight">
            {supervisorDeclaration}
          </p>
        </section>

        <div className="mt-2">
          <div className="flex justify-end">
            <div className="flex h-[11mm] w-[44mm] items-end justify-end">
              {receipt.signature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={receipt.signature}
                  alt={supervisorSheetCopy.signature}
                  className="max-h-[11mm] max-w-[44mm] object-contain object-right"
                />
              ) : null}
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-end gap-4">
              <p className="flex min-w-0 items-baseline gap-1.5">
                <span className="text-[7px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  {supervisorSheetCopy.place}
                </span>
                <span className="inline-block min-w-[28mm] border-b border-foreground pb-0.5 text-[10px] font-semibold">
                  {dash(values.place)}
                </span>
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-[7px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  {supervisorSheetCopy.date}
                </span>
                <span className="inline-block min-w-[32mm] border-b border-foreground pb-0.5 text-[10px] font-semibold">
                  {applied}
                </span>
              </p>
            </div>
            <div className="w-[44mm] shrink-0 text-right">
              <p className="border-t border-foreground pt-0.5 text-[7px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {supervisorSheetCopy.signature}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold break-words">
                {dash(values.name)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 pt-1">
          <div className="h-0.5 bg-accent" />
          <p className="flex justify-between pt-0.5 text-[7px] tracking-wide text-muted-foreground">
            <span>
              {supervisorSheetCopy.dateApplied} : {applied}
            </span>
            <span>
              {supervisorSheetCopy.printedOn} : {printed}
            </span>
          </p>
        </div>
      </article>
    </div>
  );
}
