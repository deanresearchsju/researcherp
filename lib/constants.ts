export const university = {
  name: "St. Joseph University",
  shortName: "SJU",
  researchOffice: "Center for Research",
  productName: "Research ERP",
  tagline: "Fully Human & Fully Alive",
  affiliation:
    "A State Private University established under the Tamil Nadu Private Universities Act, 2019",
  unit: "A Unit of DMI Foundations",
  siteUrl: "https://research.sju.ac.in",
  email: "deanresearch.sju@dmifoundations.org",
  phone: "+914220000000",
  phoneDisplay: "+91 422 000 0000",
  hours: "Monday to Friday, 9:30 AM – 5:00 PM",
  addressLines: [
    "Center for Research",
    "St. Joseph University",
    "Campus address to be confirmed",
    "Tamil Nadu, India",
  ],
  bank: {
    accountName: "St. Joseph University",
    accountNumber: "To be confirmed",
    ifsc: "To be confirmed",
    bankName: "To be confirmed",
    branch: "To be confirmed",
  },
  social: [
    { label: "Facebook", href: "https://example.com" },
    { label: "X", href: "https://example.com" },
    { label: "YouTube", href: "https://example.com" },
    { label: "LinkedIn", href: "https://example.com" },
  ],
} as const;

export const copyrightYear = 2026;

/** Stable preview date so pages do not call `new Date()` during prerender. */
export const referenceDate = "2026-10-13";

export const retirementAge = 70;

export const applicationFeeInr = 500;

export const researchWordLimit = { min: 150, max: 200 } as const;

export const admissionYear = "2026";

export const admissionSessions = ["June", "January"] as const;

export const applicationNumbers = {
  scholarPattern: "SJU/PHD/YEAR/0001",
  supervisorPattern: "SJU/SUP/PHD/YEAR/001",
} as const;

export const storageKeys = {
  scholarDraft: "sju-phd-draft",
  scholarProgress: "sju-phd-progress",
  scholarReceipts: "sju-phd-receipts",
  scholarSubmissions: "sju-phd-submissions",
  scholarSeq: "sju-phd-seq",
  supervisorDraft: "sju-sup-draft",
  supervisorSeq: "sju-sup-seq",
  portalUsers: "sju-portal-users",
  scholarRecords: "sju-scholar-records",
} as const;

export const sessionStorageKey = "sju-research-session";
export const sessionEventName = "sju-session";

const kb = (value: number) => value * 1024;
const mb = (value: number) => value * 1024 * 1024;

export const fileLimits = {
  photo: {
    minBytes: kb(200),
    maxBytes: kb(600),
    types: ["image/jpeg", "image/png"],
    accept: "image/jpeg,image/png",
    label: "JPG or PNG, 200–600 KB",
  },
  scholarSignature: {
    minBytes: kb(20),
    maxBytes: kb(40),
    types: ["image/jpeg", "image/png"],
    accept: "image/jpeg,image/png",
    label: "JPG or PNG, 20–40 KB",
  },
  supervisorSignature: {
    minBytes: kb(20),
    maxBytes: kb(50),
    types: ["image/jpeg", "image/png"],
    accept: "image/jpeg,image/png",
    label: "JPG or PNG, 20–50 KB",
  },
  document: {
    minBytes: 1,
    maxBytes: mb(5),
    types: ["application/pdf", "image/jpeg", "image/png"],
    accept: "application/pdf,image/jpeg,image/png",
    label: "PDF, JPG, or PNG, up to 5 MB",
  },
  resume: {
    minBytes: 1,
    maxBytes: mb(5),
    types: ["application/pdf"],
    accept: "application/pdf",
    label: "PDF, up to 5 MB",
  },
  spreadsheet: {
    minBytes: 1,
    maxBytes: mb(2),
    types: ["text/csv", "application/vnd.ms-excel", "text/plain"],
    accept: ".csv,text/csv",
    label: "CSV, up to 2 MB",
  },
} as const;

export type FileLimitKey = keyof typeof fileLimits;

export const titles = ["Mr", "Ms", "Mrs", "Dr"] as const;
export const genders = ["Male", "Female", "Other"] as const;
export const sexes = ["Male", "Female", "Other"] as const;
export const maritalStatuses = ["Single", "Married", "Other"] as const;
export const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
export const studyModes = ["Full-Time", "Part-Time"] as const;
export const yesNo = ["Yes", "No"] as const;
export const paymentModes = ["UPI", "Net Banking"] as const;
export const indexingOptions = ["Scopus", "SCI", "WOS", "Peer Reviewed", "None"] as const;
export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const paymentStatus = "Pending verification";
export const programmeName = "Ph.D.";
