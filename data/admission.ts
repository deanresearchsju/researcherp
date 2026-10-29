import type { AdmissionStep } from "@/types";

export const admissionSteps: AdmissionStep[] = [
  {
    id: "apply",
    title: "Apply Online",
    detail: "Submit the Ph.D. application and the required documents.",
  },
  {
    id: "acknowledgement",
    title: "Acknowledgement Mail",
    detail: "The research office confirms receipt at your email address.",
  },
  {
    id: "test",
    title: "Written Test & Interview Intimation",
    detail: "Shortlisted applicants receive the test and interview schedule.",
  },
  {
    id: "selection",
    title: "Provisional Selection",
    detail: "Selected candidates are named in the provisional list.",
  },
  {
    id: "certificates",
    title: "Certificate Submission & Fee Payment",
    detail: "Submit certificates and pay the prescribed research fee.",
  },
  {
    id: "dc",
    title: "First DC Meeting & Supervisor Allocation",
    detail: "The first doctoral committee meets and a supervisor is allotted.",
  },
];

export const admissionOverview = {
  eyebrow: "Admissions",
  title: "Admission process",
  description:
    "From the online application to the allotment of a supervisor. Eligibility, the selection criteria and the programme rules are on the home page.",
  eligibilityTitle: "Who may apply",
  processTitle: "Admission in 4 steps",
};

export const admissionGlance: AdmissionStep[] = [
  {
    id: "apply",
    title: "Apply Online",
    detail: "Submit the online application.",
  },
  {
    id: "test",
    title: "Written Test & Interview",
    detail: "Attend the test and interview.",
  },
  {
    id: "selection",
    title: "Provisional Selection",
    detail: "The provisional list is published.",
  },
  {
    id: "allocation",
    title: "Supervisor Allocation",
    detail: "A supervisor is allotted after selection.",
  },
];

export const writtenMax = 70;
export const interviewMax = 30;

export const selectionSteps = [
  { id: "applications", label: "Scrutiny", title: "Scrutiny of applications" },
  { id: "shortlist", label: "Shortlist", title: "Shortlist against vacancies" },
  { id: "entrance", label: "Entrance", title: "Entrance test & interview attendance" },
  { id: "marks", label: "Marks", title: "Entrance and interview marks" },
  { id: "selection", label: "Merit list", title: "Merit list & waiting list" },
  { id: "provisional", label: "Guide", title: "Provisional list & guide allotment" },
  { id: "letter", label: "Letters", title: "Provisional admission letters" },
  { id: "certificates", label: "Reporting", title: "Reporting & document verification" },
  { id: "fees", label: "Finish", title: "Waiting list, archive & finish selection" },
] as const;

export type SelectionStepId = (typeof selectionSteps)[number]["id"];

export const emptyEntranceSchedule = {
  session: "",
  monthYear: "",
  date: "",
  venue: "",
  reportingTime: "09:00",
  examTime: "10:00",
  superintendentName: "",
  superintendentSignature: "",
  deanSignature: "",
} as const;

export const hallTicketDeanTitle = "Dean, Research and Development";

/** Heads of the 30-mark interview, assessed jointly by the two experts. */
export const interviewCriteria = [
  { label: "Research proposal & presentation", max: 10 },
  { label: "Subject knowledge", max: 10 },
  { label: "Research aptitude & communication", max: 10 },
] as const;

export const hallTicketInstructions = [
  "Bring this hall ticket and an original photo identity card (Aadhaar, passport, voter ID, PAN or driving licence). Candidates without both will not be admitted.",
  "Report at the examination centre at the reporting time. No candidate is admitted 30 minutes after the test begins.",
  "Do not leave the hall during the first hour or the last 15 minutes of the test.",
  "Mobile phones, smart watches, calculators, notes and any electronic device are not allowed in the hall.",
  "Sign the attendance sheet and this hall ticket in the presence of the invigilator.",
  "The written test (70 marks) is followed by the interview (30 marks) as scheduled by the research office.",
  "Any malpractice or impersonation leads to disqualification and further action as per University rules.",
  "Admission to the test is provisional. Eligibility is subject to verification of original certificates.",
] as const;

export const selectionFlowCopy = {
  complete: "Complete this step",
  clearOne: "Clear last step",
  clearTwo: "Clear two steps",
  blocked: "Completed · blocked",
  open: "Open",
  closed: "Not open yet",
  skipBlocked: "Steps open one at a time. Complete this step before the next.",
  completeFirst: "Complete this step to open the next.",
  monitor:
    "Staff complete the open step. The Dean monitors. Only an administrator can clear a blocked step.",
  scheduleHint:
    "Fix the entrance date and venue before printing attendance. Session and month-year print on the list.",
  saveSchedule: "Save date and venue",
  clearSchedule: "Clear date and venue",
  scheduleSaved: "Date and venue are saved. Print attendance is open.",
  needSchedule: "Save the date and venue before printing attendance.",
  printAttendance: "Print attendance list",
  session: "Session",
  monthYear: "Month and year",
  date: "Date",
  venue: "Venue",
  shortlistText:
    "View the full application and receipt before shortlisting. A candidate is eligible when the subject still has a vacancy.",
  entranceText: "Mark who was present after the date and venue are saved.",
  liveHidden:
    "Scholars already on the register stay off this live admission file. Unselected applications move to the archive when the session is closed.",
  archive: "Move unselected to archive",
  archived: "Unselected applications were moved to the admission archive.",
  noneToArchive: "There is no unselected application to archive.",
  needArchiveSession:
    "Choose the session and year before moving unselected applications.",
  archiveConfirm:
    "Move every unselected application for this session to the archive? They leave the live admission file.",
  marksEmpty: "No shortlisted candidate is on the live admission file.",
} as const;

export const archiveSessionOptions = ["January", "July"] as const;
export const archiveYearOptions = ["2025", "2026"] as const;

export const admissionArchiveCopy = {
  menu: "Admission archive",
  title: "Admission archive",
  kicker: "Admissions",
  detail:
    "Unselected applications from closed sessions, listed by session. Only an administrator or the Dean can open this list.",
  empty: "No unselected application is in the archive yet.",
  emptySession: "No unselected application is stored for this session.",
  session: "Session",
  year: "Year",
  archivedOn: "Archived on",
  count: "Unselected applications",
  view: "View",
  forbidden: "Only an administrator or the Dean can open this list.",
} as const;

export const admissionLockCopy = {
  banner:
    "Admission is complete for scholars already on the register and for candidates whose certificates are approved. Earlier steps stay frozen. Unlock a file only to correct an error. Later doctoral steps stay open.",
  frozen: "Admission complete · frozen",
  unlock: "Allow correction",
  lock: "Freeze again",
  blocked:
    "This admission file is frozen. Allow correction before changing an earlier step.",
  scholarFrozen:
    "Your admission steps are complete. Later doctoral steps stay open. Write to the research office if a correction is needed.",
  scholarComplete: "Admission is already complete for this sign-in.",
  promote: "Promote",
  demote: "Demote",
  promoteHint:
    "Promote places the candidate on the selection list. Demote removes the candidate. Only an administrator can do this.",
} as const;

export const admissionChecklist = [
  { id: "photos", title: "Passport size photographs (5 Nos.)", required: true },
  { id: "application", title: "Application form (SJU portal)", required: true },
  { id: "class10", title: "Secondary school (Class 10) mark sheet", required: true },
  {
    id: "class12",
    title: "Senior secondary (Class 12) mark sheet or equivalent",
    required: true,
  },
  { id: "ug-marks", title: "Graduation mark sheet or equivalent", required: true },
  { id: "ug-degree", title: "Graduation degree certificate", required: true },
  { id: "pg-marks", title: "Postgraduate mark sheet or equivalent", required: true },
  { id: "pg-degree", title: "Postgraduate degree certificate", required: true },
  {
    id: "mphil-degree",
    title: "M.Phil. degree certificate, if applicable",
    required: false,
  },
  { id: "mphil-marks", title: "M.Phil. mark sheet, if applicable", required: false },
  {
    id: "fellowship",
    title:
      "UGC-JRF, CSIR-JRF, UGC-NET, CSIR-NET, ICMR-JRF, DBT-BET, SLET, GATE, CAT, or other national fellowship certificate, if applicable",
    required: false,
  },
  { id: "undertaking", title: "Undertaking form", required: true },
  {
    id: "noc",
    title: "No objection certificate from the employer, if applicable",
    required: false,
  },
  {
    id: "community",
    title: "Caste or EWS certificate in the Government of India format, if applicable",
    required: false,
  },
  {
    id: "obc",
    title: "Self-declaration for the OBC-NCL category, if applicable",
    required: false,
  },
  {
    id: "pwd",
    title: "Disability certificate in the Government of India format, if applicable",
    required: false,
  },
  { id: "transfer", title: "Transfer or migration certificate", required: false },
  { id: "proposal", title: "Research proposal", required: false },
  {
    id: "fee",
    title: "Fee payment receipt, if paid before reporting (otherwise paid after sign-in)",
    required: false,
  },
] as const;

export type ChecklistId = (typeof admissionChecklist)[number]["id"];

export const defaultLetter = {
  programme: "Ph.D. Degree Programme",
  sessionLabel: "Provisional Admission Letter (January / July)",
  refPrefix: "SJU/Research/Adm/2026",
  issueDate: "10/09/2026",
  reportBy: "26 September 2026",
  applicationFee: "500",
  fullTimeFee: "70000",
  partTimeFee: "50000",
  synopsisFee: "0",
  thesisFee: "0",
  /** Charged once with every course-work registration, besides the fee of each paper. */
  markSheetFee: "500",
  accountName: "St. Joseph University Tuition Fee",
  accountNumber: "5594831736",
  bankName: "Central Bank of India",
  ifsc: "CBIN0282740",
  branch: "Nandambakkam",
  deanName: "Dr. I. Neethi Manickam",
  deanTitle: "Dean Research, St. Joseph University",
  phone: "+91 96886 50939",
  documents: [
    "10th, H.S.C., U.G., and P.G. mark statements",
    "Degree certificates for the U.G. and P.G. programmes",
    "Transfer or migration certificate",
    "Research visa and passport, if a foreign national",
    "Recent passport size photographs (5 Nos.)",
    "Valid UGC-JRF, CSIR-JRF, UGC-NET, CSIR-NET, ICMR-JRF, DBT-BET, SLET, GATE, CAT, or other national level fellowship certificate or scorecard",
    "No objection certificate from the employer",
    "Undertaking on ₹100 stamp paper, in the enclosed format",
    "Fee payment receipt copy",
    "Cardboard A4 tag file, 15 transparent A4 leaflets, and 2 envelopes (2.5 in × 3.5 in)",
  ].join("\n"),
};
