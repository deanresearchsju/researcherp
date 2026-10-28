import { researchRegister } from "@/data/research-register";
import { admissionCaseForIdentifier, currentAdmission } from "@/lib/admission";
import { currentDoctoral, enrollmentFor } from "@/lib/doctoral";
import { feePlan, programmeStart, type FeeYear } from "@/lib/fees";
import { sameId } from "@/lib/office";
import { batchById, intakeOfCase } from "@/lib/batches";
import {
  isPassedOut,
  scholarBySignIn,
  scholarSignInId,
  registerScholarsInOrder,
} from "@/lib/register";
import type { ScholarRecord } from "@/lib/scholar-records";

export type FeeLedger = {
  identifier: string;
  name: string;
  batchName: string;
  studyMode: string;
  start: string;
  plan: FeeYear[];
  /** The year running today (the last one in the plan). */
  current: FeeYear;
  /** Balance across every year that has started. */
  outstanding: number;
};

function modeLabel(value: string) {
  const text = value.trim();
  if (!text) return "Full time";
  return /part/i.test(text) ? "Part time" : /full/i.test(text) ? "Full time" : text;
}

export function feeLedger(
  identifier: string,
  name: string,
  records: readonly ScholarRecord[],
  today: string,
): FeeLedger {
  const scholar = scholarBySignIn(identifier);
  const doctoral = currentDoctoral();
  const enrollment = doctoral ? enrollmentFor(doctoral, identifier) : null;
  const admitted = scholar
    ? null
    : admissionCaseForIdentifier(identifier, currentAdmission()?.cases ?? []);
  const studyMode = modeLabel(
    enrollment?.studyMode || scholar?.category || admitted?.studyMode || "",
  );
  const batchId =
    scholar?.batchId ||
    enrollment?.batchId ||
    // Admitted through Selection: the intake the scholar applied for.
    (admitted ? intakeOfCase(currentAdmission(), admitted) : "") ||
    // Newly admitted and not yet on the register: the latest intake that has started.
    [...researchRegister.batches]
      .sort((left, right) => right.order - left.order)
      .find((batch) => programmeStart(batch.id, 0) <= today)?.id ||
    "";
  const start = programmeStart(batchId, Number(today.slice(0, 4)));
  const mine = records.filter(
    (record) =>
      record.kind === "payment" &&
      (sameId(record.scholarIdentifier, identifier) ||
        (scholar && sameId(record.scholarIdentifier, scholar.email))),
  );
  const plan = feePlan({ start, studyMode, records: mine, today });
  const current = plan[plan.length - 1];
  return {
    identifier,
    name: scholar?.name || name || identifier,
    batchName:
      batchById(batchId)?.name ??
      doctoral?.batches.find((item) => item.id === batchId)?.name ??
      "",
    studyMode,
    start,
    plan,
    current,
    outstanding: plan
      .filter((year) => year.status !== "Upcoming")
      .reduce((sum, year) => sum + year.balance, 0),
  };
}

/** Every active scholar's ledger: the register plus scholars enrolled later. */
export function feeRoster(records: readonly ScholarRecord[], today: string): FeeLedger[] {
  const doctoral = currentDoctoral();
  const fromRegister = registerScholarsInOrder().map((scholar) => ({
    identifier: scholarSignInId(scholar),
    name: scholar.name,
  }));
  const later = (doctoral?.enrollments ?? [])
    .filter(
      (item) =>
        !fromRegister.some((row) => sameId(row.identifier, item.scholarIdentifier)),
    )
    .map((item) => ({ identifier: item.scholarIdentifier, name: item.scholarName }));
  return [...fromRegister, ...later]
    .filter((row) => !isPassedOut(row.identifier, row.name))
    .map((row) => feeLedger(row.identifier, row.name, records, today));
}
