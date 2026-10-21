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
  hours: "Monday to Friday, 8:30 AM – 4:00 PM",
  addressLines: ["Center for Research", "St. Joseph University", "Tamil Nadu, India"],
  bank: {
    accountName: "St. Joseph University - Tuition Fee A/C",
    accountNumber: "5594831736",
    ifsc: "CBIN0282740",
    bankName: "Central Bank of India",
    branch: "Nandambakkam",
  },
  social: [
    { label: "Facebook", href: "https://example.com" },
    { label: "X", href: "https://example.com" },
    { label: "YouTube", href: "https://example.com" },
    { label: "LinkedIn", href: "https://example.com" },
  ],
} as const;

export const copyrightYear = 2026;

export const footerCredit = {
  designedBy: "Dr.Kalaiarasan C, Assistant Professor",
} as const;

/** Stable preview date so pages do not call `new Date()` during prerender. */
export const referenceDate = "2026-10-13";

export const retirementAge = 70;

export const applicationFeeInr = 500;

export const researchWordLimit = { min: 150, max: 200 } as const;

export const researchAreaLimit = 200;

export const admissionYear = "2026";

export const admissionSessions = ["January", "July"] as const;

export const admissionSessionsCopy = {
  short: "January and July",
  hero: "Two sessions a year · January and July",
  sentence:
    "The University holds two Ph.D. admission sessions each year: January and July.",
} as const;

export const applicationNumbers = {
  scholarPattern: "SJU/PHD/Jan26/0001",
  scholarPatternJuly: "SJU/PHD/Jul26/0001",
  supervisorPattern: "SJU/PHD/SUP.App/MM/YY/001",
} as const;

export const storageKeys = {
  scholarDraft: "sju-phd-draft",
  scholarProgress: "sju-phd-progress",
  draftTokens: "sju-phd-draft-tokens",
  scholarReceipts: "sju-phd-receipts",
  scholarSubmissions: "sju-phd-submissions",
  scholarSeq: "sju-phd-seq",
  supervisorDraft: "sju-sup-draft",
  supervisorSeq: "sju-sup-seq",
  portalUsers: "sju-portal-users",
  mustReset: "sju-must-reset",
  scholarRecords: "sju-scholar-records",
  allocations: "sju-allocations",
  racProposals: "sju-rac-proposals",
  siteSettings: "sju-site-settings",
  doctoral: "sju-doctoral",
  thesisPanels: "sju-thesis-panels",
  admission: "sju-admission",
  register: "sju-research-register",
  officeView: "sju-office-view",
  newsBoard: "sju-news-board",
  researchAreas: "sju-research-areas",
  menuRights: "sju-menu-rights",
  profilePhotos: "sju-profile-photo",
  auditLog: "sju-audit-log",
  inbox: "sju-inbox",
  helpdesk: "sju-helpdesk",
} as const;

export const sessionStorageKey = "sju-research-session";
export const sessionEventName = "sju-session";
export const officeViewEventName = "sju-office-view-change";

const kb = (value: number) => value * 1024;
const mb = (value: number) => value * 1024 * 1024;

export const uploadStandards = {
  allowedTypes: ["application/pdf", "image/jpeg", "image/png"] as const,
  documents: {
    maxBytes: mb(1),
    types: ["application/pdf", "image/jpeg", "image/png"] as const,
    label: "PDF, JPG or PNG. PDF up to 1 MB",
  },
  photo: {
    maxBytes: kb(200),
    types: ["image/jpeg", "image/png"] as const,
    aspect: 3.5 / 4.5,
    label: "JPG or PNG, up to 200 KB (3.5 × 4.5 cm)",
  },
  signature: {
    maxBytes: kb(100),
    types: ["image/jpeg", "image/png"] as const,
    aspect: 3,
    label: "JPG or PNG, up to 100 KB",
  },
} as const;

export const fileLimits = {
  photo: {
    minBytes: 1,
    maxBytes: uploadStandards.photo.maxBytes,
    types: uploadStandards.photo.types,
    accept: "image/jpeg,image/png",
    label: uploadStandards.photo.label,
  },
  teamPhoto: {
    minBytes: 1,
    maxBytes: kb(100) - 1,
    types: ["image/jpeg", "image/png"],
    accept: "image/jpeg,image/png",
    label: "JPG or PNG, below 100 KB",
  },
  newsPoster: {
    minBytes: 1,
    maxBytes: kb(250),
    types: ["image/jpeg", "image/png"],
    accept: "image/jpeg,image/png",
    label: "JPG or PNG, up to 250 KB",
  },
  scholarSignature: {
    minBytes: 1,
    maxBytes: uploadStandards.signature.maxBytes,
    types: uploadStandards.signature.types,
    accept: "image/jpeg,image/png",
    label: uploadStandards.signature.label,
  },
  supervisorSignature: {
    minBytes: 1,
    maxBytes: uploadStandards.signature.maxBytes,
    types: uploadStandards.signature.types,
    accept: "image/jpeg,image/png",
    label: uploadStandards.signature.label,
  },
  document: {
    minBytes: 1,
    maxBytes: uploadStandards.documents.maxBytes,
    types: uploadStandards.documents.types,
    accept: "application/pdf,image/jpeg,image/png",
    label: uploadStandards.documents.label,
  },
  resume: {
    minBytes: 1,
    maxBytes: uploadStandards.documents.maxBytes,
    types: ["application/pdf"],
    accept: "application/pdf",
    label: "PDF, up to 1 MB",
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

export const newsPhotosMaxCount = 12;

export const titles = ["Mr", "Ms", "Mrs", "Dr"] as const;
export const genders = ["Male", "Female", "Other"] as const;
export const sexes = ["Male", "Female", "Other"] as const;
export const maritalStatuses = ["Single", "Married", "Other"] as const;
export const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
export const studyModes = [
  "Full time",
  "Part time (Internal)",
  "Part time (External)",
] as const;

export type StudyMode = (typeof studyModes)[number];

export const partTimeModes = ["Part time (Internal)", "Part time (External)"] as const;

export function isPartTimeMode(value: string) {
  return value.toLowerCase().replaceAll("-", " ").includes("part time");
}
export const yesNo = ["Yes", "No"] as const;
export const nationalities = ["Indian", "Non-Indian"] as const;
export const communities = [
  "General/OC",
  "BC",
  "BC-Muslim",
  "MBC/DNC",
  "SC",
  "SC-Arunthathiyar",
  "ST",
  "EWS",
  "Other",
] as const;
export const communitiesWithName: readonly (typeof communities)[number][] = [
  "BC",
  "BC-Muslim",
  "MBC/DNC",
  "SC",
  "SC-Arunthathiyar",
  "ST",
  "Other",
];
export const netQualifications = ["NET", "SET", "Both", "None"] as const;

export function isNetQualified(value: string) {
  const answer = value.trim();
  return answer === "NET" || answer === "SET" || answer === "Both" || answer === "Yes";
}

export function netIncludesNet(value: string) {
  const answer = value.trim();
  return answer === "NET" || answer === "Both" || answer === "Yes";
}

export function netIncludesSet(value: string) {
  const answer = value.trim();
  return answer === "SET" || answer === "Both";
}

export function communityNeedsName(value: string) {
  return communitiesWithName.includes(value as (typeof communitiesWithName)[number]);
}
export const paymentModes = ["UPI", "Net Banking"] as const;
export const indexingOptions = [
  "Scopus",
  "WOS",
  "SCI",
  "SCIE",
  "SEI",
  "Peer Reviewed",
  "None",
] as const;
export const qualityPanels = ["Q1", "Q2", "Q3", "Q4", "Not listed"] as const;

export const indexedSources = ["WOS", "SCI", "SCIE", "SEI"] as const;
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
