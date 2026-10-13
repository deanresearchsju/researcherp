"use client";

import Link from "next/link";

import {
  PrintActions,
  PrintCell,
  PrintGrid,
  PrintLetterhead,
  PrintPage,
  PrintPages,
  PrintSection,
  PrintSignature,
} from "@/components/forms/PrintForm";
import { buttonVariants } from "@/components/ui/button";
import { supervisorDeclaration } from "@/data/declarations";
import { supervisorEnclosures } from "@/data/documents";
import { supervisorFormCopy } from "@/data/forms";
import {
  ageParts,
  formatAge,
  formatIsoDate,
  serviceUntilAge,
  sumDuration,
} from "@/lib/dates";
import { retirementAge, university } from "@/lib/constants";
import type { SupervisorFormValues } from "@/lib/validation";

export type SupervisorReceipt = {
  applicationNo: string;
  submittedOn: string;
  values: SupervisorFormValues;
  photo: string | null;
  signature: string | null;
  attachments: Record<string, string | null>;
};

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

function span(years: string, months: string) {
  return `${years || "0"} years, ${months || "0"} months`;
}

export function SupervisorReceiptView({ receipt }: { receipt: SupervisorReceipt }) {
  const { values } = receipt;
  const ageLabel = formatAge(ageParts(values.dateOfBirth));
  const remaining = formatAge(serviceUntilAge(values.dateOfBirth, retirementAge));
  const teaching = formatAge(
    sumDuration(values.preYears, values.preMonths, values.postYears, values.postMonths),
  );

  const qualifications = [
    ["P.G.", values.postgraduate],
    ["M.Phil.", values.mphil],
    ["Ph.D.", values.phd],
    ["D.Litt.", values.dlitt],
  ] as const;

  return (
    <div>
      <PrintActions>
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Application submitted
        </p>
        <h1 className="mt-2 font-heading text-3xl text-primary">
          {receipt.applicationNo}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {supervisorFormCopy.successNote}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </div>
      </PrintActions>

      <PrintPages>
        <PrintPage page={1}>
          <PrintLetterhead
            title={supervisorFormCopy.title}
            photo={receipt.photo}
            photoAlt="Passport photograph"
            photoLabel={supervisorFormCopy.photoLabel}
          />

          <PrintSection title="1. Applicant">
            <PrintGrid>
              <PrintCell label="Application no." value={receipt.applicationNo} />
              <PrintCell label="Date" value={formatIsoDate(receipt.submittedOn)} />
              <div className="col-span-2">
                <PrintCell label="Name (block letters)" value={values.name} />
              </div>
              <PrintCell label="Designation" value={values.designation} />
              <PrintCell label="Department" value={values.department} />
              <PrintCell label="Sex" value={values.sex} />
              <PrintCell
                label="Age and date of birth"
                value={`${ageLabel || "—"} · ${formatIsoDate(values.dateOfBirth)}`}
              />
              <PrintCell label="Religion" value={values.religion} />
              <PrintCell label="Community" value={values.community} />
              <PrintCell label="State" value={values.state} />
              <PrintCell label="Nationality" value={values.nationality} />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="2. Address and contact">
            <PrintCell label="Permanent address" value={addressOf(values.permanent)} />
            <PrintCell
              label="Address for communication"
              value={
                values.sameAddress
                  ? "Same as permanent address"
                  : addressOf(values.communication)
              }
            />
            <PrintGrid>
              <PrintCell label="Contact number" value={values.phone} />
              <PrintCell label="Email" value={values.email} />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="3. Academic qualification">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-muted">
                  {[
                    "Exam",
                    "Degree",
                    "University",
                    "Discipline",
                    "Year",
                    "Class",
                    "%",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border border-primary/15 px-1.5 py-1 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualifications.map(([label, row]) => (
                  <tr key={label}>
                    <td className="border border-primary/15 px-1.5 py-1 font-semibold">
                      {label}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-1">
                      {row.degree || "—"}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-1">
                      {row.university || "—"}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-1">
                      {row.discipline || "—"}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-1">
                      {row.year || "—"}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-1">
                      {row.classObtained || "—"}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-1">
                      {row.percentage || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px]">Ph.D. year of award: {values.phdAwardYear}</p>
          </PrintSection>
        </PrintPage>

        <PrintPage page={2}>
          <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">
            {supervisorFormCopy.title} · {receipt.applicationNo}
          </p>

          <PrintSection title="4. Faculty and service">
            <PrintGrid>
              <PrintCell label="Faculty" value={values.faculty} />
              <PrintCell label="Subject" value={values.subject} />
              <div className="col-span-2">
                <PrintCell label="Area of expertise" value={values.expertise} />
              </div>
              <PrintCell
                label="Date of appointment"
                value={formatIsoDate(values.appointmentDate)}
              />
              <PrintCell
                label={`Remaining service (up to ${retirementAge} years)`}
                value={remaining || "—"}
              />
              <PrintCell
                label="Department proposed for guideship"
                value={values.proposedDepartment}
              />
              <PrintCell
                label="Recognised elsewhere"
                value={
                  values.recognisedElsewhere === "Yes"
                    ? values.recognitionDetails
                    : values.recognisedElsewhere
                }
              />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="5. Experience">
            <PrintGrid>
              <PrintCell
                label="Teaching — pre-doctoral"
                value={span(values.preYears, values.preMonths)}
              />
              <PrintCell
                label="Teaching — post-doctoral"
                value={span(values.postYears, values.postMonths)}
              />
              <PrintCell label="Teaching — total" value={teaching} />
              <PrintCell
                label="Research (post-doctoral)"
                value={span(values.researchYears, values.researchMonths)}
              />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="6. Best post-doctoral publications">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="bg-muted">
                  {["#", "Title", "Journal", "Year", "Indexing"].map((heading) => (
                    <th
                      key={heading}
                      className="border border-primary/15 px-1.5 py-1 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.publications.map((paper, index) => (
                  <tr key={paper.id}>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {index + 1}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {paper.title}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {paper.journal}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {paper.month} {paper.year}
                    </td>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {paper.indexing}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>

          <PrintSection title="7. Enclosures">
            <table className="w-full border-collapse text-left text-[10px]">
              <tbody>
                {supervisorEnclosures.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {item.label}
                    </td>
                    <td className="w-12 border border-primary/15 px-1.5 py-0.5 text-center font-semibold">
                      {receipt.attachments[item.id] ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {values.otherInformation.trim() ? (
              <p className="mt-1 text-[10px]">Other: {values.otherInformation.trim()}</p>
            ) : null}
          </PrintSection>

          <PrintSection title="8. Declaration">
            <p className="text-[10px] leading-4">{supervisorDeclaration}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Supporting documents may also be emailed to {university.email}.
            </p>
          </PrintSection>

          <PrintSignature
            name={values.name}
            signature={receipt.signature}
            date={formatIsoDate(receipt.submittedOn)}
            place={values.place}
          />
        </PrintPage>
      </PrintPages>
    </div>
  );
}
