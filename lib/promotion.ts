import { programmeSemesters } from "@/data/doctoral";
import { enrollmentFor, type DoctoralState } from "@/lib/doctoral";
import { exitFor, isPassedOut, scholarBySignIn } from "@/lib/register";
import type { ScholarReport } from "@/lib/scholar-report";

/**
 * Promotion of every batch before a new intake is admitted, so the fresh batch starts in
 * semester 1. A scholar moves up one semester unless a condition holds them in the same
 * semester. The conditions are the ones listed below; the office can still tick "Promote
 * anyway" for one scholar (for example to exempt the annual fee case by case).
 */
export type PromotionLine = {
  identifier: string;
  name: string;
  batchId: string;
  batchName: string;
  from: number;
  to: number;
  /** Why the scholar stays in the same semester; empty when the scholar moves up. */
  holds: string[];
};

type Hold = (report: ScholarReport) => string | null;

/** Course work must be cleared within the first two semesters. */
const courseWorkHold: Hold = (report) => {
  if (report.semester > 2) return null;
  if (report.courseArrears > 0) {
    return `Course work not cleared (${report.courseArrears} arrear paper${report.courseArrears === 1 ? "" : "s"})`;
  }
  if (report.coursePapers > 0 && report.coursePassed < report.coursePapers) {
    return `Course work not completed (${report.coursePassed} of ${report.coursePapers} papers passed)`;
  }
  return null;
};

const feeHold: Hold = (report) =>
  report.feeBalance > 0
    ? `Annual fee pending (₹${report.feeBalance.toLocaleString("en-IN")} due)`
    : null;

const sixMonthHold: Hold = (report) => {
  const open = report.sixMonthDue - report.sixMonthApproved;
  return open > 0
    ? `${open} six-month report${open === 1 ? "" : "s"} not approved`
    : null;
};

const racHold: Hold = (report) =>
  report.rac === "Not constituted" ? "Research Advisory Committee not constituted" : null;

const firstDcHold: Hold = (report) =>
  report.firstDc.startsWith("Approved") || report.firstDc.startsWith("Completed")
    ? null
    : "First Doctoral Committee meeting not done";

/** A scholar on the passed-out list, or whose supervisor is leaving and not yet transferred. */
const exitHold: Hold = (report) => {
  if (isPassedOut(report.identifier, report.name)) return "On the passed-out list";
  const leaving = exitFor([report.guideIdentifier, report.guideName], report.guideName);
  return leaving && !leaving.completedOn
    ? "Supervisor exit pending; transfer the scholar first"
    : null;
};

const holds: readonly Hold[] = [
  courseWorkHold,
  sixMonthHold,
  racHold,
  firstDcHold,
  exitHold,
  feeHold,
];

const lastSemester = Math.max(...programmeSemesters);

function batchIdOf(identifier: string, doctoral: DoctoralState) {
  return (
    enrollmentFor(doctoral, identifier)?.batchId ||
    scholarBySignIn(identifier)?.batchId ||
    ""
  );
}

export function planPromotion(
  reports: readonly ScholarReport[],
  doctoral: DoctoralState,
): PromotionLine[] {
  return reports
    .filter((report) => report.semester >= 1 && report.semester < lastSemester)
    .map((report) => ({
      identifier: report.identifier,
      name: report.name,
      batchId: batchIdOf(report.identifier, doctoral),
      batchName: report.batchName,
      from: report.semester,
      to: report.semester + 1,
      holds: holds.flatMap((hold) => {
        const reason = hold(report);
        return reason ? [reason] : [];
      }),
    }))
    .sort(
      (a, b) =>
        a.batchName.localeCompare(b.batchName) ||
        a.from - b.from ||
        a.name.localeCompare(b.name),
    );
}
