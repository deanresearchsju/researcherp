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
  { id: "fee", title: "Fee payment receipt", required: true },
] as const;

export type ChecklistId = (typeof admissionChecklist)[number]["id"];

export const defaultLetter = {
  programme: "Ph.D. Degree Programme",
  sessionLabel: "Provisional Admission Letter (June 2026)",
  refPrefix: "SJU/Research/Adm/2026",
  issueDate: "10/09/2026",
  reportBy: "26 September 2026",
  fullTimeFee: "70000",
  partTimeFee: "50000",
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
