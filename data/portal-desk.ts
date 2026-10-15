export const processFlows = {
  courseWork:
    "Course-work enrolment: Scholar submits >> Doctoral committee >> Research office",
  publication:
    "Journal publication: Scholar >> Supervisor >> Research office >> Dean of Research",
  sixMonth: "Six-month report: Scholar >> Research office",
  supervisorChange: "Supervisor change: Scholar >> Present supervisor >> Research office",
  cancellation: "Ph.D. cancellation: Scholar >> Supervisor >> Research office",
  leave: "Leave: Scholar >> Supervisor >> Research office",
  extension: "Extension: Scholar >> Supervisor >> Research office",
  titleChange: "Title change: Scholar >> Supervisor >> Research office",
  studyMode: "Mode of study: Scholar >> Research office",
  synopsis: "Synopsis: Scholar >> Research office >> Dean of Research",
  thesis: "Thesis: Scholar >> Research office >> Examiners",
  plagiarism: "Plagiarism certificate: Scholar >> Research office",
} as const;

export const emptyRecordCopy = "No record found.";

export const viewFilesLabel = "View files";

export const missingFileCopy = "That file is not stored with the record.";

export const resultGradeKey = [
  { grade: "Pass", range: "Published pass", result: "PASS" },
  { grade: "RA", range: "Re-appearance", result: "RA" },
  { grade: "AAA", range: "Absent", result: "AAA" },
  { grade: "Pending", range: "Not published", result: "—" },
] as const;

export const conferenceLevels = [
  "International",
  "National",
  "State",
  "University",
] as const;

export const programmeNatures = [
  "Conference",
  "Workshop",
  "Seminar",
  "Training",
] as const;

export const patentStatuses = ["Filed", "Published", "Granted", "Rejected"] as const;
