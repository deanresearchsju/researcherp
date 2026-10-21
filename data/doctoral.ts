import { admissionSessions, indexedSources } from "@/lib/constants";

export { admissionSessions };

export const courseSemesters = [1, 2, 3, 4] as const;

export const programmeSemesters = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const;

export const courseWorkFee = 1000;

export const standardSubjects: Record<
  (typeof courseSemesters)[number],
  readonly string[]
> = {
  1: ["Research Methodology", "Research Publication and Ethics"],
  2: ["Elective", "Major"],
  3: ["Elective", "Major"],
  4: ["Elective", "Major"],
};

export const commonSchoolValue = "all";
export const commonSchoolLabel = "Common to all schools";

export function isCommonSchool(school: string) {
  const value = school.trim().toLowerCase();
  return value === "" || value === commonSchoolValue;
}

export function subjectSchoolLabel(school: string) {
  return isCommonSchool(school) ? commonSchoolLabel : school.trim();
}

export const colloquiumSittings = ["May", "November"] as const;

export const synopsisChecklist = [
  "Progress reports are complete",
  "Fees are paid",
  "Publications meet the school rule",
  "Title and domain are final",
] as const;

export const thesisChecklist = [
  "Payment",
  "Alignment",
  "Formatting",
  "References",
  "Title",
  "Domain",
  "Three Indian evaluators",
  "Three foreign evaluators",
  "Three local evaluators",
] as const;

export const dcCopy = {
  first: {
    title: "First doctoral committee",
    detail:
      "The first doctoral committee meets after admission. Upload the report. Course-work papers are confirmed in this meeting.",
  },
  second: {
    title: "Ph.D. confirmation",
    detail:
      "The second doctoral committee meets after the semester 1 and semester 2 course-work results are published.",
  },
  third: {
    title: "Third doctoral committee",
    detail:
      "Upload the third doctoral committee report. Synopsis opens after the office approves it.",
  },
  fourth: {
    title: "Fourth doctoral committee",
    detail:
      "Upload the fourth doctoral committee report. The thesis section opens after the office approves it.",
  },
} as const;

export function schoolNeedsIndexedPair(school: string) {
  return /engineering|medicine|agriculture/i.test(school);
}

export function isStrongIndex(indexing: string) {
  return (indexedSources as readonly string[]).includes(indexing);
}

export const hardcopyNotice =
  "Submit the hard copy to the Dean's office within 3 working days.";

export const thesisWindowMonths = 3;

export const examinerOutcomes = ["Recommended", "Revision", "Rejected"] as const;

export const vivaOutcomes = ["Passed", "Failed"] as const;

export const completionKinds = ["Provisional", "Degree"] as const;

export const reportTargets = { "Full-Time": 6, "Part-Time": 8 } as const;

/**
 * Batches whose doctoral committees met before the ERP. The office marks these as held with the
 * meeting date; scholars do not upload. Later batches upload the report, the guide recommends
 * it and the Dean approves.
 */
export const dcOfficeEntryBatchIds: readonly string[] = [
  "2025-january",
  "2025-june",
  "2026-january",
];

/** Six-month reports due before this date were received on paper; the office records them. */
export const sixMonthOnlineFrom = "2026-07-01";
