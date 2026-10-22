import { Sheet, SheetHeading, pagesOf } from "@/components/portal/AdmissionPrint";
import { formatIsoDate } from "@/lib/dates";
import type { StoredApplication } from "@/lib/records";
import {
  eligibilityCriteria,
  eligibilityOf,
  payloadText,
} from "@/lib/supervisor-approval";

/** The sheet put up to the RAB / Vice Chancellor for approving supervisor recognition. */
export function SupervisorApprovalSheet({
  rows,
  body,
  preparedBy = "",
  verifiedBy = "",
  deanName = "",
  deanTitle = "Dean, Research and Development",
}: {
  rows: readonly StoredApplication[];
  body: string;
  preparedBy?: string;
  verifiedBy?: string;
  deanName?: string;
  deanTitle?: string;
}) {
  const pages = pagesOf(rows, 14);
  const signatures = [
    { label: "Prepared by", name: preparedBy },
    { label: "Verified by", name: verifiedBy },
    { label: deanTitle, name: deanName },
  ];
  return (
    <div className="overflow-x-auto">
      <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
        {pages.map((page, pageIndex) => (
          <Sheet key={pageIndex}>
            <SheetHeading
              title="Research Supervisors · Recognition list"
              lines={[
                `For the approval of the ${body || "Research Advisory Board / Vice Chancellor"} · Applicants whose eligibility is verified: ${rows.length}`,
              ]}
            />
            <table className="mt-2 w-full table-fixed border-collapse border border-foreground/30 text-xs">
              <colgroup>
                <col className="w-[9mm]" />
                <col />
                <col className="w-[34mm]" />
                <col className="w-[40mm]" />
                <col className="w-[22mm]" />
                <col className="w-[14mm]" />
              </colgroup>
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="border border-foreground/30 px-1.5 py-1">S. No.</th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Name and designation
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    Application No.
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">
                    School / subject
                  </th>
                  <th className="border border-foreground/30 px-1.5 py-1">Eligibility</th>
                  <th className="border border-foreground/30 px-1.5 py-1 text-center">
                    Quota
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.map((row, index) => {
                  const eligibility = eligibilityOf(row.payload);
                  const met = eligibilityCriteria.filter(
                    (item) => eligibility?.checks[item.id],
                  ).length;
                  return (
                    <tr key={row.id} className="h-[11mm] align-top">
                      <td className="border border-foreground/30 px-1.5 py-1">
                        {pageIndex * 14 + index + 1}
                      </td>
                      <td className="border border-foreground/30 px-1.5 py-1">
                        <p className="font-semibold">{row.applicantName}</p>
                        <p className="text-muted-foreground">
                          {payloadText(row, "designation") || "—"}
                        </p>
                      </td>
                      <td className="border border-foreground/30 px-1.5 py-1 font-mono">
                        {row.applicationNo}
                      </td>
                      <td className="border border-foreground/30 px-1.5 py-1">
                        {[payloadText(row, "faculty"), payloadText(row, "subject")]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="border border-foreground/30 px-1.5 py-1">
                        {met}/{eligibilityCriteria.length} met
                        {eligibility?.verifiedOn ? (
                          <span className="block text-muted-foreground">
                            {formatIsoDate(eligibility.verifiedOn)}
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-foreground/30 px-1.5 py-1 text-center">
                        {eligibility?.quota ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              Eligibility conditions checked:{" "}
              {eligibilityCriteria.map((item) => item.label).join("; ")}.
            </p>
            <div className="mt-auto grid grid-cols-3 gap-8 pt-10 text-center text-xs">
              {signatures.map((item) => (
                <div key={item.label}>
                  <div className="border-t border-foreground/60 pt-1">
                    <p className="font-semibold">{item.name || " "}</p>
                    <p className="text-muted-foreground">{item.label}</p>
                  </div>
                </div>
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
