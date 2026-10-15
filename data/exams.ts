import { copyrightYear } from "@/lib/constants";

export const examPageSize = 25;

export const examOutcomes = ["Pass", "RA", "AAA"] as const;

export type ExamOutcome = (typeof examOutcomes)[number];

export const examYears = [
  String(copyrightYear - 2),
  String(copyrightYear - 1),
  String(copyrightYear),
  String(copyrightYear + 1),
] as const;

export const registrationCsvHeaders = [
  "scholar_id",
  "name",
  "application_number",
  "file_number",
  "email",
  "current_registration_number",
  "registration_number",
] as const;

export const examCopy = {
  entranceTitle: "Entrance marks",
  entranceKicker: "Admissions",
  entranceDetail:
    "Enter written and interview marks for scholars in this window. The list is saved 25 at a time. Save and continue keeps this page and opens the next.",
  savePage: "Save this page",
  saveContinue: "Save and continue",
  emptyMarks: "Leave both boxes blank to skip a scholar on this page.",
  registrationTitle: "Registration numbers",
  registrationDetail:
    "Download the template, fill registration_number, then upload the CSV. Existing numbers stay unless you replace them.",
  registrationTemplate: "Download template",
  registrationUpload: "Upload filled CSV",
  resultsTitle: "Course-work results",
  resultsDetail:
    "Choose the exam session, then mark Pass, RA, or AAA for the papers on this page. Earlier sittings stay on the exam history.",
  sessionLabel: "Exam session",
  historyTitle: "Exam history",
  pending: "Pending",
} as const;
