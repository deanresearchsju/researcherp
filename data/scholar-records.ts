import {
  bloodGroups,
  indexingOptions,
  months,
  partTimeModes,
  qualityPanels,
  sexes,
  studyModes,
  yesNo,
  type FileLimitKey,
} from "@/lib/constants";

export const scholarRecordKinds = [
  "abc_id",
  "hall_ticket",
  "personal_details",
  "payment",
  "phd_cancellation",
  "supervisor_change",
  "study_mode_change",
  "leave",
  "extension",
  "title_change",
  "publication",
  "six_month_report",
] as const;

export type ScholarRecordKind = (typeof scholarRecordKinds)[number];

export const recordStatuses = [
  "Submitted",
  "Supervisor approved",
  "Approved",
  "Returned",
] as const;

export type RecordStatus = (typeof recordStatuses)[number];

export type RecordFieldKind =
  "text" | "email" | "tel" | "date" | "amount" | "textarea" | "select" | "doi";

export type RecordField = {
  name: string;
  label: string;
  kind: RecordFieldKind;
  required: boolean;
  options?: readonly string[];
  minLength?: number;
};

export type ScholarRecordMenu = {
  slug: string;
  kind: ScholarRecordKind;
  label: string;
  summary: string;
  single: boolean;
  fileLabel: string | null;
  fileRequired: boolean;
  fileRule: FileLimitKey;
  needsSupervisor: boolean;
  fields: readonly RecordField[];
};

const paymentModes = ["UPI", "Net Banking"] as const;

export const scholarRecordMenus: readonly ScholarRecordMenu[] = [
  {
    slug: "abc-id",
    kind: "abc_id",
    label: "ABC ID",
    summary: "Upload the Academic Bank of Credits ID and a copy of the card.",
    single: true,
    fileLabel: "ABC ID card",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: false,
    fields: [
      { name: "abcId", label: "ABC ID", kind: "text", required: true, minLength: 6 },
      {
        name: "nameOnCard",
        label: "Name on the card",
        kind: "text",
        required: true,
        minLength: 2,
      },
    ],
  },
  {
    slug: "hall-ticket",
    kind: "hall_ticket",
    label: "Hall ticket",
    summary: "Upload the hall ticket for a written test or interview.",
    single: false,
    fileLabel: "Hall ticket",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: false,
    fields: [
      { name: "examName", label: "Exam", kind: "text", required: true, minLength: 2 },
      { name: "examDate", label: "Exam date", kind: "date", required: true },
    ],
  },
  {
    slug: "personal-details",
    kind: "personal_details",
    label: "Personal details",
    summary: "Keep the name, contact, and programme details on the scholar record.",
    single: true,
    fileLabel: null,
    fileRequired: false,
    fileRule: "document",
    needsSupervisor: false,
    fields: [
      {
        name: "fullName",
        label: "Full name",
        kind: "text",
        required: true,
        minLength: 2,
      },
      { name: "dateOfBirth", label: "Date of birth", kind: "date", required: true },
      {
        name: "gender",
        label: "Gender",
        kind: "select",
        required: false,
        options: sexes,
      },
      {
        name: "nationality",
        label: "Nationality",
        kind: "text",
        required: false,
        minLength: 2,
      },
      {
        name: "bloodGroup",
        label: "Blood group",
        kind: "select",
        required: false,
        options: bloodGroups,
      },
      { name: "mobile", label: "Mobile", kind: "tel", required: true },
      { name: "email", label: "Email", kind: "email", required: true },
      {
        name: "programme",
        label: "Programme",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "studyMode",
        label: "Mode of study",
        kind: "select",
        required: true,
        options: studyModes,
      },
      {
        name: "fatherName",
        label: "Father name",
        kind: "text",
        required: false,
        minLength: 2,
      },
      {
        name: "motherName",
        label: "Mother name",
        kind: "text",
        required: false,
        minLength: 2,
      },
      {
        name: "parentContact",
        label: "Parent contact no.",
        kind: "tel",
        required: false,
      },
      {
        name: "parentEmail",
        label: "Parent email",
        kind: "email",
        required: false,
      },
      {
        name: "address",
        label: "Address",
        kind: "textarea",
        required: true,
        minLength: 8,
      },
      { name: "pincode", label: "Pincode", kind: "text", required: false, minLength: 6 },
      {
        name: "district",
        label: "District",
        kind: "text",
        required: false,
        minLength: 2,
      },
      { name: "state", label: "State", kind: "text", required: false, minLength: 2 },
    ],
  },
  {
    slug: "payment-history",
    kind: "payment",
    label: "Payment history",
    summary:
      "Record the annual research fee and other payments. The research office approves each receipt. Approved payments show on your portal.",
    single: false,
    fileLabel: "Payment receipt",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: false,
    fields: [
      { name: "paidOn", label: "Date of payment", kind: "date", required: true },
      { name: "amount", label: "Amount (INR)", kind: "amount", required: true },
      {
        name: "mode",
        label: "Mode",
        kind: "select",
        required: true,
        options: paymentModes,
      },
      {
        name: "transactionNumber",
        label: "Transaction number",
        kind: "text",
        required: true,
        minLength: 4,
      },
      { name: "purpose", label: "Purpose", kind: "text", required: true, minLength: 2 },
    ],
  },
  {
    slug: "phd-cancellation",
    kind: "phd_cancellation",
    label: "Ph.D. cancellation request",
    summary:
      "Ask to cancel the Ph.D. registration. Attach the request letter. Your supervisor reviews it, then the research office.",
    single: false,
    fileLabel: "Request letter",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: true,
    fields: [
      { name: "effectiveDate", label: "Requested date", kind: "date", required: true },
      {
        name: "reason",
        label: "Reason",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
  {
    slug: "supervisor-change",
    kind: "supervisor_change",
    label: "Supervisor change request",
    summary:
      "Ask to move to another recognised supervisor. Your present supervisor reviews it, then the research office.",
    single: false,
    fileLabel: "Request letter",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: true,
    fields: [
      {
        name: "currentSupervisor",
        label: "Present supervisor",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "requestedSupervisor",
        label: "Requested supervisor",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "reason",
        label: "Reason",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
  {
    slug: "study-mode-change",
    kind: "study_mode_change",
    label: "Full-time to part-time request",
    summary:
      "Ask to change from full-time to part-time and upload the employer no-objection certificate.",
    single: false,
    fileLabel: "No-objection certificate",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: false,
    fields: [
      { name: "effectiveDate", label: "Requested date", kind: "date", required: true },
      {
        name: "requestedMode",
        label: "Requested mode of study",
        kind: "select",
        required: true,
        options: partTimeModes,
      },
      { name: "employer", label: "Employer", kind: "text", required: true, minLength: 2 },
      {
        name: "reason",
        label: "Reason",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
  {
    slug: "leave",
    kind: "leave",
    label: "Leave request",
    summary: "Ask for leave from the research programme.",
    single: false,
    fileLabel: "Request letter",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: true,
    fields: [
      { name: "fromDate", label: "From", kind: "date", required: true },
      { name: "toDate", label: "To", kind: "date", required: true },
      {
        name: "reason",
        label: "Reason",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
  {
    slug: "extension",
    kind: "extension",
    label: "Extension request",
    summary: "Ask to extend the period of registration.",
    single: false,
    fileLabel: "Request letter",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: true,
    fields: [
      { name: "currentEnd", label: "Present end date", kind: "date", required: true },
      {
        name: "requestedUntil",
        label: "Requested until",
        kind: "date",
        required: true,
      },
      {
        name: "reason",
        label: "Reason",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
  {
    slug: "title-change",
    kind: "title_change",
    label: "Title-change request",
    summary: "Ask to change the approved thesis title.",
    single: false,
    fileLabel: "Request letter",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: true,
    fields: [
      {
        name: "currentTitle",
        label: "Present title",
        kind: "textarea",
        required: true,
        minLength: 8,
      },
      {
        name: "proposedTitle",
        label: "Proposed title",
        kind: "textarea",
        required: true,
        minLength: 8,
      },
      {
        name: "reason",
        label: "Reason",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
  {
    slug: "publications",
    kind: "publication",
    label: "Publications",
    summary:
      "Upload a journal article, book, book chapter, or conference paper. Your supervisor reviews it, then the research office. A DOI is checked before it is saved.",
    single: false,
    fileLabel: "First page of the paper",
    fileRequired: false,
    fileRule: "document",
    needsSupervisor: true,
    fields: [
      {
        name: "kind",
        label: "Publication type",
        kind: "select",
        required: true,
        options: ["Journal Article", "Book", "Book Chapter", "Conference Proceedings"],
      },
      {
        name: "title",
        label: "Title of paper",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "authors",
        label: "Name of the authors",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "correspondingAuthor",
        label: "Corresponding author",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "firstAuthor",
        label: "1st author",
        kind: "select",
        required: false,
        options: yesNo,
      },
      {
        name: "position",
        label: "Your position",
        kind: "select",
        required: true,
        options: ["First Author", "Second Author", "Third Author"],
      },
      {
        name: "journal",
        label: "Title of journal, book, or conference",
        kind: "text",
        required: true,
        minLength: 2,
      },
      { name: "volume", label: "Volume", kind: "text", required: false },
      { name: "issue", label: "Issue", kind: "text", required: false },
      { name: "pageFrom", label: "Page from", kind: "text", required: false },
      { name: "pageTo", label: "Page to", kind: "text", required: false },
      { name: "issn", label: "ISSN", kind: "text", required: false },
      { name: "eissn", label: "eISSN", kind: "text", required: false },
      {
        name: "indexing",
        label: "Indexed in",
        kind: "select",
        required: true,
        options: indexingOptions,
      },
      {
        name: "qualityPanel",
        label: "Quality panel",
        kind: "select",
        required: false,
        options: qualityPanels,
      },
      {
        name: "impactFactor",
        label: "Impact factor",
        kind: "text",
        required: false,
      },
      { name: "doi", label: "DOI", kind: "doi", required: false },
      { name: "webUrl", label: "Web URL", kind: "text", required: false },
      {
        name: "month",
        label: "Month",
        kind: "select",
        required: true,
        options: months,
      },
      { name: "year", label: "Year", kind: "text", required: true, minLength: 4 },
      {
        name: "remarks",
        label: "Remarks",
        kind: "textarea",
        required: false,
      },
    ],
  },
  {
    slug: "six-month-report",
    kind: "six_month_report",
    label: "Six-month report",
    summary:
      "January admissions report in June and December. July admissions report in January and July. The research office approves the report or returns it with remarks.",
    single: false,
    fileLabel: "Report",
    fileRequired: true,
    fileRule: "document",
    needsSupervisor: false,
    fields: [
      {
        name: "period",
        label: "Reporting period",
        kind: "text",
        required: true,
        minLength: 2,
      },
      {
        name: "progress",
        label: "Work done in this period",
        kind: "textarea",
        required: true,
        minLength: 10,
      },
    ],
  },
];

export function menuBySlug(slug: string) {
  return scholarRecordMenus.find((item) => item.slug === slug) ?? null;
}

export function menuByKind(kind: ScholarRecordKind) {
  const menu = scholarRecordMenus.find((item) => item.kind === kind);
  if (!menu) throw new Error(`Unknown scholar record: ${kind}`);
  return menu;
}
