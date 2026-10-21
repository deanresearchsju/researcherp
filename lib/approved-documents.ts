import { dcCopy } from "@/data/doctoral";
import { scholarRecordMenus } from "@/data/scholar-records";
import type { ApprovalStamp } from "@/lib/approved-copy";
import type { DoctoralState } from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import type { ScholarRecord } from "@/lib/scholar-records";

export type ApprovedDocument = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  title: string;
  fileName: string | null;
  /** Inline file, or a loader for files kept outside the list. */
  fileData: string | null;
  load?: () => Promise<string | null>;
  stamp: ApprovalStamp;
};

function mineOf(identifiers: readonly string[] | null, identifier: string) {
  return identifiers === null || identifiers.some((key) => sameId(key, identifier));
}

/**
 * Every approved item with its approval details, for the given scholars (null = everyone).
 * Each one can be downloaded as a stamped approved copy.
 */
export function approvedDocuments(
  identifiers: readonly string[] | null,
  doctoral: DoctoralState | null,
  records: readonly ScholarRecord[],
  loadFile: (record: ScholarRecord) => Promise<string | null>,
): ApprovedDocument[] {
  const list: ApprovedDocument[] = [];
  for (const report of doctoral?.committees ?? []) {
    if (report.status !== "Approved" || !mineOf(identifiers, report.scholarIdentifier))
      continue;
    const title = `${dcCopy[report.kind].title} report`;
    list.push({
      id: report.id,
      scholarIdentifier: report.scholarIdentifier,
      scholarName: report.scholarName,
      title,
      fileName: report.fileName || null,
      fileData: report.fileData,
      stamp: {
        title,
        scholarName: report.scholarName,
        scholarId: report.scholarIdentifier,
        reference: report.id.slice(-8).toUpperCase(),
        approvedOn: report.decidedOn,
        approvedBy: report.decidedBy || "Office of the Dean",
        details: report.meetingOn
          ? [{ label: "Meeting date", value: report.meetingOn }]
          : [],
        steps: report.officeEntry
          ? [
              {
                label: "Recorded as held by the research office",
                by: report.decidedBy,
                on: report.decidedOn,
              },
            ]
          : [
              {
                label: "Submitted by the scholar",
                by: report.scholarName,
                on: report.createdAt,
              },
              ...(report.supervisorStatus === "Recommended"
                ? [
                    {
                      label: "Recommended by the guide",
                      by: report.supervisorName,
                      on: report.supervisorOn,
                      note: report.supervisorRemarks,
                    },
                  ]
                : []),
              {
                label: "Approved by the Dean",
                by: report.decidedBy,
                on: report.decidedOn,
                note: report.minutes,
              },
            ],
      },
    });
  }
  for (const synopsis of doctoral?.synopses ?? []) {
    if (
      synopsis.status !== "Approved" ||
      !mineOf(identifiers, synopsis.scholarIdentifier)
    )
      continue;
    list.push({
      id: synopsis.id,
      scholarIdentifier: synopsis.scholarIdentifier,
      scholarName: synopsis.scholarName,
      title: "Synopsis",
      fileName: synopsis.fileName || null,
      fileData: synopsis.fileData,
      stamp: {
        title: "Synopsis",
        scholarName: synopsis.scholarName,
        scholarId: synopsis.scholarIdentifier,
        reference: synopsis.id.slice(-8).toUpperCase(),
        approvedOn: synopsis.decidedOn,
        approvedBy: "Office of the Dean",
        steps: [
          {
            label: "Submitted by the scholar",
            by: synopsis.scholarName,
            on: synopsis.createdAt,
          },
          {
            label: "Accepted by the Dean",
            by: "Office of the Dean",
            on: synopsis.decidedOn,
            note: synopsis.remarks,
          },
        ],
      },
    });
  }
  for (const certificate of doctoral?.plagiarism ?? []) {
    if (
      certificate.status !== "Approved" ||
      !mineOf(identifiers, certificate.scholarIdentifier)
    )
      continue;
    const title = `Plagiarism certificate (${certificate.stage === "synopsis" ? "before synopsis" : "before thesis"})`;
    list.push({
      id: certificate.id,
      scholarIdentifier: certificate.scholarIdentifier,
      scholarName: certificate.scholarName,
      title,
      fileName: certificate.fileName || null,
      fileData: certificate.fileData,
      stamp: {
        title,
        scholarName: certificate.scholarName,
        scholarId: certificate.scholarIdentifier,
        reference: certificate.id.slice(-8).toUpperCase(),
        approvedOn: certificate.decidedOn,
        approvedBy: certificate.issuedBy || "Office of the Dean",
        details: [{ label: "Similarity", value: `${certificate.similarity}%` }],
      },
    });
  }
  for (const thesis of doctoral?.theses ?? []) {
    if (thesis.status !== "Approved" || !mineOf(identifiers, thesis.scholarIdentifier))
      continue;
    list.push({
      id: thesis.id,
      scholarIdentifier: thesis.scholarIdentifier,
      scholarName: thesis.scholarName,
      title: "Thesis accepted for evaluation",
      fileName: thesis.fileName || null,
      fileData: thesis.fileData,
      stamp: {
        title: "Thesis accepted for evaluation",
        scholarName: thesis.scholarName,
        scholarId: thesis.scholarIdentifier,
        reference: thesis.id.slice(-8).toUpperCase(),
        approvedOn: thesis.decidedOn,
        approvedBy: "Office of the Dean",
        details: [
          { label: "Title", value: thesis.title },
          { label: "Domain", value: thesis.domain },
        ],
      },
    });
  }
  for (const record of records) {
    if (record.status !== "Approved" || !mineOf(identifiers, record.scholarIdentifier))
      continue;
    const menu = scholarRecordMenus.find((item) => item.kind === record.kind);
    const title =
      record.kind === "payment" && record.payload.feeYear
        ? `Annual research fee · Year ${record.payload.feeYear}`
        : (menu?.label ?? record.kind.replaceAll("_", " "));
    list.push({
      id: record.id,
      scholarIdentifier: record.scholarIdentifier,
      scholarName: record.scholarName,
      title,
      fileName: record.fileName,
      fileData: record.fileData,
      load: () => loadFile(record),
      stamp: {
        title,
        scholarName: record.scholarName,
        scholarId: record.scholarIdentifier,
        reference: record.id.slice(-8).toUpperCase(),
        approvedOn: record.payload.approvedOn || record.createdAt,
        approvedBy: record.payload.approvedBy || "Research office",
        details:
          record.kind === "payment"
            ? [
                { label: "Amount", value: `₹${record.payload.amount ?? ""}` },
                { label: "Paid on", value: record.payload.paidOn ?? "" },
                { label: "Transaction", value: record.payload.transactionNumber ?? "" },
              ]
            : [],
        steps: [
          {
            label: "Submitted by the scholar",
            by: record.scholarName,
            on: record.createdAt,
          },
          ...(record.payload.supervisorOn
            ? [
                {
                  label: "Recommended by the guide",
                  by: record.payload.supervisorBy ?? "",
                  on: record.payload.supervisorOn,
                },
              ]
            : []),
          {
            label: "Approved by the research office",
            by: record.payload.approvedBy || "Research office",
            on: record.payload.approvedOn || record.createdAt,
            note: record.payload.remarks,
          },
        ],
      },
    });
  }
  return list.sort((left, right) =>
    (right.stamp.approvedOn || "").localeCompare(left.stamp.approvedOn || ""),
  );
}
