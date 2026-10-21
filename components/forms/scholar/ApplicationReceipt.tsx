"use client";

import Link from "next/link";
import { useState } from "react";

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
import { Button, buttonVariants } from "@/components/ui/button";
import { scholarDeclaration } from "@/data/declarations";
import { scholarDocuments } from "@/data/documents";
import { scholarFormCopy } from "@/data/forms";
import { applicationFeeInr, isPartTimeMode, paymentStatus } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import { formatNetQualification } from "@/lib/net-exam";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import type { PhdReceipt } from "@/lib/scholar-progress";
import { formatInr } from "@/lib/utils";

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

export function ApplicationReceipt({ receipt }: { receipt: PhdReceipt }) {
  const { values } = receipt;
  const experience = values.experience.filter((row) => row.organization.trim());
  const permanent = values.sameAddress ? values.communication : values.permanent;
  const selected = receipt.status === "Selected";
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      await downloadPhdApplications([receipt]);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PrintActions>
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Application submitted
        </p>
        <h2 className="mt-2 font-heading text-3xl text-primary">
          {receipt.applicationNo}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: {receipt.status}. Submitted on {formatIsoDate(receipt.submittedOn)}.
        </p>
        {selected ? (
          <p className="mt-3 text-sm font-semibold text-secondary">
            {scholarFormCopy.trackSelected}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {selected ? (
            <Link href="/login/scholar" className={buttonVariants({ variant: "gold" })}>
              {scholarFormCopy.scholarLogin}
            </Link>
          ) : (
            <Button
              type="button"
              variant="gold"
              disabled={downloading}
              aria-busy={downloading}
              onClick={() => void download()}
            >
              {downloading ? "Preparing…" : scholarFormCopy.download}
            </Button>
          )}
          <Link href="/apply/status" className={buttonVariants({ variant: "outline" })}>
            {scholarFormCopy.track}
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </div>
      </PrintActions>

      <PrintPages>
        <PrintPage page={1}>
          <PrintLetterhead
            title={scholarFormCopy.title}
            photo={receipt.photo}
            photoAlt="Passport photograph"
            photoLabel={scholarFormCopy.photoLabel}
          />

          <PrintSection title={scholarFormCopy.officeTitle}>
            <div className="grid grid-cols-3">
              <PrintCell
                label={scholarFormCopy.applicationNo}
                value={receipt.applicationNo}
              />
              <PrintCell
                label={scholarFormCopy.applicationDate}
                value={formatIsoDate(receipt.submittedOn)}
              />
              <PrintCell
                label={scholarFormCopy.session}
                value={`${values.session} ${values.year}`}
              />
            </div>
          </PrintSection>

          <PrintSection title="1. Personal details">
            <PrintGrid>
              <PrintCell label="Title" value={values.title} />
              <PrintCell label="Full name" value={values.fullName} />
              <PrintCell
                label="Date of birth"
                value={formatIsoDate(values.dateOfBirth)}
              />
              <PrintCell label="Gender" value={values.gender} />
              <PrintCell label="Nationality" value={values.nationality} />
              {values.nationality === "Non-Indian" ? (
                <PrintCell label="Country" value={values.country} />
              ) : null}
              <PrintCell
                label="Community"
                value={[values.community, values.communityName]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <PrintCell label="Blood group" value={values.bloodGroup} />
              <PrintCell label="Marital status" value={values.maritalStatus} />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="2. Programme details">
            <PrintGrid>
              <PrintCell label="Programme" value={values.programme} />
              <PrintCell label="Mode of study" value={values.studyMode} />
              <PrintCell label="School" value={values.school} />
              <PrintCell label="Subject" value={values.specialization} />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="3. Education details">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-muted">
                  {[
                    "",
                    "Degree",
                    "Specialisation",
                    "Institution",
                    "University",
                    "Year",
                    "% / CGPA",
                  ].map((heading) => (
                    <th
                      key={heading || "level"}
                      className="border border-primary/15 px-1.5 py-1 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["UG", values.ug],
                  ["PG", values.pg],
                ].map(([level, row]) => {
                  const education = row as typeof values.ug;
                  return (
                    <tr key={String(level)}>
                      <td className="border border-primary/15 px-1.5 py-1 font-semibold">
                        {String(level)}
                      </td>
                      <td className="border border-primary/15 px-1.5 py-1">
                        {education.degree}
                      </td>
                      <td className="border border-primary/15 px-1.5 py-1">
                        {education.specialisation}
                      </td>
                      <td className="border border-primary/15 px-1.5 py-1">
                        {education.institution}
                      </td>
                      <td className="border border-primary/15 px-1.5 py-1">
                        {education.university}
                      </td>
                      <td className="border border-primary/15 px-1.5 py-1">
                        {education.year}
                      </td>
                      <td className="border border-primary/15 px-1.5 py-1">
                        {education.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[11px]">
              NET / SET / SLET: {formatNetQualification(values)}
            </p>
          </PrintSection>

          <PrintSection title="4. Contact details">
            <PrintGrid>
              <PrintCell label="Email" value={values.email} />
              <PrintCell label="Mobile" value={values.mobile} />
              <div className="col-span-2">
                <PrintCell
                  label="Address for communication"
                  value={addressOf(values.communication)}
                />
              </div>
              <div className="col-span-2">
                <PrintCell
                  label="Permanent address"
                  value={
                    values.sameAddress
                      ? "Same as communication address"
                      : addressOf(permanent)
                  }
                />
              </div>
            </PrintGrid>
          </PrintSection>
        </PrintPage>

        <PrintPage page={2}>
          <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">
            {scholarFormCopy.title} · {receipt.applicationNo}
          </p>

          {isPartTimeMode(values.studyMode) ? (
            <PrintSection title="5. Work experience">
              {experience.length === 0 ? (
                <p className="text-[11px]">—</p>
              ) : (
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-muted">
                      {["S.No.", "Organization", "Designation", "From", "To"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="border border-primary/15 px-1.5 py-1 font-semibold"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {experience.map((row, index) => (
                      <tr key={`${row.organization}-${row.from}`}>
                        <td className="border border-primary/15 px-1.5 py-1">
                          {index + 1}
                        </td>
                        <td className="border border-primary/15 px-1.5 py-1">
                          {row.organization}
                        </td>
                        <td className="border border-primary/15 px-1.5 py-1">
                          {row.designation}
                        </td>
                        <td className="border border-primary/15 px-1.5 py-1">
                          {row.from}
                        </td>
                        <td className="border border-primary/15 px-1.5 py-1">{row.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PrintSection>
          ) : null}

          <PrintSection title="6. Proposed research">
            <PrintCell label="Research area" value={values.researchArea} />
          </PrintSection>

          <PrintSection title="7. Payment details">
            <PrintGrid>
              <PrintCell label="Mode" value={values.paymentMode} />
              <PrintCell label="Amount" value={formatInr(applicationFeeInr)} />
              <PrintCell label="Transaction number" value={values.transactionNumber} />
              <PrintCell
                label="Date of payment"
                value={formatIsoDate(values.paymentDate)}
              />
              <PrintCell label="Status" value={paymentStatus} />
            </PrintGrid>
          </PrintSection>

          <PrintSection title="8. Document checklist">
            <table className="w-full border-collapse text-left text-[11px]">
              <tbody>
                {scholarDocuments.map((spec) => (
                  <tr key={spec.id}>
                    <td className="border border-primary/15 px-1.5 py-0.5">
                      {spec.label}
                    </td>
                    <td className="w-16 border border-primary/15 px-1.5 py-0.5 text-center font-semibold">
                      {receipt.attachments[spec.id] ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>

          <PrintSection title="9. Declaration">
            <p className="text-[10px] leading-4">{scholarDeclaration}</p>
          </PrintSection>

          <PrintSignature
            name={values.applicantName || values.fullName}
            signature={receipt.signature}
            date={formatIsoDate(receipt.submittedOn)}
          />
        </PrintPage>
      </PrintPages>
    </div>
  );
}
