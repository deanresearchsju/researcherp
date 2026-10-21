import { sameId } from "@/lib/office";
import { scholarBySignIn } from "@/lib/register";
import type { ScholarRecord } from "@/lib/scholar-records";

export const guideHiddenCopy = "Shown after your first fee payment is verified.";

/**
 * A newly admitted scholar sees the guide's details once the first annual-fee payment is
 * verified. Scholars already on the register (earlier batches) always see their guide.
 */
export function guideReleased(identifier: string, payments: readonly ScholarRecord[]) {
  if (!identifier.trim()) return false;
  if (scholarBySignIn(identifier)) return true;
  return payments.some(
    (record) =>
      record.kind === "payment" &&
      record.status === "Approved" &&
      sameId(record.scholarIdentifier, identifier) &&
      (Boolean(record.payload.feeYear) ||
        (record.payload.purpose ?? "").toLowerCase().includes("fee")),
  );
}
