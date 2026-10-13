import { indexedSources } from "@/lib/constants";

export const admissionSessions = ["June", "January"] as const;

export const courseSemesters = [1, 2, 3, 4] as const;

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

export const reportTargets = { "Full-Time": 6, "Part-Time": 8 } as const;
