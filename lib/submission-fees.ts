import { currentFees } from "@/lib/fee-settings";
import { sameId } from "@/lib/office";
import type { ScholarRecord } from "@/lib/scholar-records";

export type SubmissionFeeKind = "synopsis" | "thesis";

/** The purpose a scholar chooses on Payment history for each submission fee. */
export const submissionFeePurpose: Record<SubmissionFeeKind, string> = {
  synopsis: "Synopsis fee",
  thesis: "Thesis fee",
};

export function isSubmissionFeePurpose(purpose: string, kind?: SubmissionFeeKind) {
  const value = purpose.toLowerCase();
  if (kind) return value.includes(kind);
  return value.includes("synopsis") || value.includes("thesis");
}

/** The fee the administrator has fixed for this submission (0 means none). */
export function submissionFeeAmount(kind: SubmissionFeeKind) {
  return currentFees()[kind];
}

/**
 * Why the synopsis or thesis cannot be submitted for want of its fee; null when no fee is
 * fixed or an approved payment covers it. The fee is paid under Payment history and verified
 * by Accounts.
 */
export function submissionFeeBlock(
  kind: SubmissionFeeKind,
  identifier: string,
  payments: readonly ScholarRecord[],
) {
  const fee = submissionFeeAmount(kind);
  if (fee <= 0) return null;
  const mine = payments.filter(
    (record) =>
      record.kind === "payment" &&
      sameId(record.scholarIdentifier, identifier) &&
      isSubmissionFeePurpose(record.payload.purpose ?? "", kind),
  );
  const paid = mine
    .filter((record) => record.status === "Approved")
    .reduce((sum, record) => sum + (Number(record.payload.amount) || 0), 0);
  if (paid >= fee) return null;
  const label = kind === "synopsis" ? "synopsis" : "thesis";
  const waiting = mine.some(
    (record) => record.status === "Submitted" || record.status === "Supervisor approved",
  );
  return waiting
    ? `Your ${label} fee of ₹${fee} is with the Accounts department for verification. The ${label} upload opens once it is verified.`
    : `Pay the ${label} submission fee of ₹${fee} under Payment history (purpose: ${submissionFeePurpose[kind]}) and attach the receipt. The ${label} upload opens once Accounts verifies it.`;
}
