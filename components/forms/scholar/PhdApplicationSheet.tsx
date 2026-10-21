import type { ReactNode, Ref } from "react";

import { scholarDeclaration } from "@/data/declarations";
import { scholarDocuments } from "@/data/documents";
import { scholarFormCopy } from "@/data/forms";
import { phdSheetCopy } from "@/data/phd-application-sheet";
import { applicationFeeInr, university } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { formatNetQualification } from "@/lib/net-exam";
import type { PhdReceipt } from "@/lib/scholar-progress";
import { cn, formatInr } from "@/lib/utils";

const enclosedDocuments = scholarDocuments.filter(
  (spec) => spec.id !== "photo" && spec.id !== "signature",
);

function addressOf(address: PhdReceipt["values"]["communication"]) {
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
  return value.trim() || phdSheetCopy.none;
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
        "border-r border-foreground/20 px-1.5 py-1 last:border-r-0",
        className,
      )}
    >
      <span className="font-semibold text-primary">{label} : </span>
      {dash(value)}
    </div>
  );
}

function Numbered({ n, children }: { n: number; children: ReactNode }) {
  return (
    <tr>
      <td className="w-7 border border-foreground/25 bg-muted px-1 py-1 text-center align-top font-bold text-primary">
        {n}
      </td>
      <td className="border border-foreground/25 p-0">{children}</td>
    </tr>
  );
}

function EducationBlock({
  label,
  row,
}: {
  label: string;
  row: PhdReceipt["values"]["ug"];
}) {
  return (
    <div>
      <p className="border-b border-foreground/20 bg-muted px-1.5 py-1 font-semibold text-primary">
        {label}
      </p>
      <div className="grid grid-cols-3">
        <Cell label="Degree" value={row.degree} />
        <Cell label="Specialisation" value={row.specialisation} />
        <Cell label="Year" value={row.year} />
        <Cell label="Institution" value={row.institution} className="col-span-2" />
        <Cell label="% / CGPA" value={row.score} />
        <Cell label="University" value={row.university} className="col-span-3" />
      </div>
    </div>
  );
}

export function PhdApplicationSheet({
  receipt,
  sheetRef,
}: {
  receipt: PhdReceipt;
  sheetRef?: Ref<HTMLElement>;
}) {
  const { values } = receipt;
  const experience = values.experience.filter((row) => row.organization.trim());
  const permanent = values.sameAddress ? values.communication : values.permanent;
  const applied = formatIsoDate(receipt.submittedOn.slice(0, 10) || receipt.submittedOn);
  const printed = formatIsoDate(clientToday());
  const sessionLine = [values.session, values.year].filter(Boolean).join(" ");
  const applicant = values.applicantName || values.fullName || phdSheetCopy.none;
  const net = formatNetQualification(values, phdSheetCopy.none);
  const community = [values.community, values.communityName].filter(Boolean).join(" · ");
  const enclosedNow = enclosedDocuments.filter((spec) => receipt.attachments[spec.id]);

  return (
    <div className="overflow-x-auto">
      <article
        ref={sheetRef}
        className="phd-sheet print-root pdf-page mx-auto flex w-[210mm] min-w-[210mm] flex-col bg-white px-4 py-3 text-[10px] leading-4 text-foreground print:w-full print:min-w-0"
      >
        <div className="h-0.5 bg-accent" />
        <div className="h-1 bg-primary" />

        <header className="grid grid-cols-[58mm_1fr_24mm] items-center gap-2 py-2">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo-sju.jpg"
              alt={university.name}
              className="max-h-16 w-full object-contain object-left"
            />
          </div>
          <div className="min-w-0 text-center">
            <h2 className="font-heading text-base leading-none font-extrabold tracking-wide text-primary">
              {phdSheetCopy.formTitle}
            </h2>
            <p className="mt-0.5 text-[10px] font-semibold tracking-wide text-secondary">
              {university.researchOffice}
              {sessionLine ? ` · ${sessionLine}` : ""}
            </p>
            <p className="mt-1 text-[10px] leading-tight">
              <span className="font-semibold tracking-wide text-muted-foreground">
                {phdSheetCopy.applicationNo}
              </span>
              <span className="mt-0.5 block font-heading text-[12px] font-bold text-primary">
                {receipt.applicationNo}
              </span>
            </p>
          </div>
          <div className="h-[30mm] w-[24mm] overflow-hidden border border-foreground bg-white">
            {receipt.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.photo}
                alt={scholarFormCopy.photoLabel}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center px-1 text-center text-[7px] leading-3 text-muted-foreground">
                {scholarFormCopy.photoLabel}
              </span>
            )}
          </div>
        </header>

        <div className="mb-2 h-0.5 bg-primary" />

        <table className="w-full border-collapse">
          <tbody>
            <Numbered n={1}>
              <Cell
                label={phdSheetCopy.name}
                value={[values.title, values.fullName || values.applicantName]
                  .filter(Boolean)
                  .join(" ")}
              />
            </Numbered>
            <Numbered n={2}>
              <div className="grid grid-cols-3">
                <Cell
                  label={phdSheetCopy.dateOfBirth}
                  value={formatIsoDate(values.dateOfBirth)}
                />
                <Cell label={phdSheetCopy.gender} value={values.gender} />
                <Cell label={phdSheetCopy.bloodGroup} value={values.bloodGroup} />
              </div>
            </Numbered>
            <Numbered n={3}>
              <div className="grid grid-cols-3">
                <Cell label={phdSheetCopy.nationality} value={values.nationality} />
                <Cell
                  label={phdSheetCopy.country}
                  value={
                    values.nationality === "Non-Indian"
                      ? values.country
                      : values.nationality
                  }
                />
                <Cell label={phdSheetCopy.maritalStatus} value={values.maritalStatus} />
              </div>
            </Numbered>
            <Numbered n={4}>
              <Cell label={phdSheetCopy.community} value={community} />
            </Numbered>
            <Numbered n={5}>
              <div className="grid grid-cols-2">
                <Cell label={phdSheetCopy.studyMode} value={values.studyMode} />
                <Cell label={phdSheetCopy.appliedOn} value={applied} />
              </div>
            </Numbered>
            <Numbered n={6}>
              <div className="grid grid-cols-2">
                <Cell label={phdSheetCopy.discipline} value={values.school} />
                <Cell label={phdSheetCopy.specialization} value={values.specialization} />
              </div>
            </Numbered>
            <Numbered n={7}>
              <EducationBlock label={phdSheetCopy.ug} row={values.ug} />
            </Numbered>
            <Numbered n={8}>
              <EducationBlock label={phdSheetCopy.pg} row={values.pg} />
            </Numbered>
            <Numbered n={9}>
              <Cell label={phdSheetCopy.net} value={net} />
            </Numbered>
            <Numbered n={10}>
              <div className="grid grid-cols-2">
                <Cell label={phdSheetCopy.email} value={values.email} />
                <Cell label={phdSheetCopy.mobile} value={values.mobile} />
              </div>
            </Numbered>
            <Numbered n={11}>
              <div className="grid grid-cols-2">
                <Cell
                  label={phdSheetCopy.communication}
                  value={addressOf(values.communication)}
                />
                <Cell
                  label={phdSheetCopy.permanent}
                  value={
                    values.sameAddress
                      ? "Same as communication address"
                      : addressOf(permanent)
                  }
                />
              </div>
            </Numbered>
            <Numbered n={12}>
              {experience.length === 0 ? (
                <Cell label={phdSheetCopy.experience} value={phdSheetCopy.none} />
              ) : (
                <div>
                  <p className="border-b border-foreground/20 bg-muted px-1.5 py-1 font-semibold text-primary">
                    {phdSheetCopy.experience}
                  </p>
                  {experience.map((row, index) => (
                    <p key={`${row.organization}-${row.from}`} className="px-1.5 py-0.5">
                      {index + 1}.{" "}
                      {[row.organization, row.designation, row.from, row.to]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ))}
                </div>
              )}
            </Numbered>
            <Numbered n={13}>
              <Cell label={phdSheetCopy.research} value={values.researchArea} />
            </Numbered>
            <Numbered n={14}>
              <div className="grid grid-cols-[1.15fr_0.55fr_1.2fr_1.7fr]">
                <Cell label={phdSheetCopy.paymentMode} value={values.paymentMode} />
                <Cell
                  label={phdSheetCopy.amount}
                  value={`Rs. ${formatInr(applicationFeeInr)}`}
                />
                <Cell
                  label={phdSheetCopy.transactionNo}
                  value={values.transactionNumber}
                />
                <Cell
                  label={phdSheetCopy.paymentDate}
                  value={formatIsoDate(values.paymentDate)}
                  className="whitespace-nowrap"
                />
              </div>
            </Numbered>
            <Numbered n={15}>
              <div>
                <p className="border-b border-foreground/20 bg-muted px-1.5 py-1 font-semibold text-primary">
                  {phdSheetCopy.documents}
                </p>
                {enclosedNow.length === 0 ? (
                  <p className="px-1.5 py-1">{phdSheetCopy.none}</p>
                ) : (
                  <ul className="list-none space-y-0.5 px-1.5 py-1">
                    {enclosedNow.map((spec, index) => (
                      <li key={spec.id}>
                        {index + 1}. {spec.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Numbered>
          </tbody>
        </table>

        <section className="mt-3 border border-primary/30 px-3 py-2">
          <h3 className="text-center text-[10px] font-bold tracking-[0.14em] text-primary">
            {phdSheetCopy.declaration}
          </h3>
          <p className="mt-1 text-justify text-[9px] leading-4">{scholarDeclaration}</p>
        </section>

        <div className="mt-4">
          <div className="flex justify-end">
            <div className="flex h-[14mm] w-[48mm] items-end justify-end">
              {receipt.signature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={receipt.signature}
                  alt={phdSheetCopy.signature}
                  className="max-h-[14mm] max-w-[48mm] object-contain object-right"
                />
              ) : null}
            </div>
          </div>
          <div className="flex items-end justify-between gap-8">
            <p className="flex items-baseline gap-2">
              <span className="text-[8px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {phdSheetCopy.date}
              </span>
              <span className="inline-block w-[42mm] border-b border-foreground pb-0.5 text-[11px] font-semibold">
                {applied}
              </span>
            </p>
            <div className="w-[48mm] shrink-0 text-right">
              <p className="border-t border-foreground pt-0.5 text-[8px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {phdSheetCopy.signature}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold">{applicant}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-3">
          <div className="h-0.5 bg-accent" />
          <p className="flex justify-between pt-1 text-[8px] tracking-wide text-muted-foreground">
            <span>
              {phdSheetCopy.dateApplied} : {applied}
            </span>
            <span>
              {phdSheetCopy.printedOn} : {printed}
            </span>
          </p>
        </div>
      </article>
    </div>
  );
}
