import type { FileLimitKey } from "@/lib/constants";

export const scholarRecordKinds = [
  "abc_id",
  "hall_ticket",
  "personal_details",
  "payment",
  "phd_cancellation",
  "supervisor_change",
  "study_mode_change",
] as const;

export type ScholarRecordKind = (typeof scholarRecordKinds)[number];

export const recordStatuses = ["Submitted", "Approved", "Returned"] as const;

export type RecordStatus = (typeof recordStatuses)[number];

export type RecordFieldKind =
  "text" | "email" | "tel" | "date" | "amount" | "textarea" | "select";

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
  fields: readonly RecordField[];
};

const studyModes = ["Full-Time", "Part-Time"] as const;
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
    fields: [
      {
        name: "fullName",
        label: "Full name",
        kind: "text",
        required: true,
        minLength: 2,
      },
      { name: "dateOfBirth", label: "Date of birth", kind: "date", required: true },
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
        label: "Study mode",
        kind: "select",
        required: true,
        options: studyModes,
      },
      {
        name: "address",
        label: "Address",
        kind: "textarea",
        required: true,
        minLength: 8,
      },
    ],
  },
  {
    slug: "payment-history",
    kind: "payment",
    label: "Payment history",
    summary: "Add each fee payment and upload the receipt.",
    single: false,
    fileLabel: "Payment receipt",
    fileRequired: true,
    fileRule: "document",
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
    summary: "Ask the research office to cancel the Ph.D. registration.",
    single: false,
    fileLabel: "Supporting document",
    fileRequired: false,
    fileRule: "document",
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
    summary: "Ask to move from the present supervisor to another recognised supervisor.",
    single: false,
    fileLabel: "Supporting document",
    fileRequired: false,
    fileRule: "document",
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
    fields: [
      { name: "effectiveDate", label: "Requested date", kind: "date", required: true },
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
];

export function menuBySlug(slug: string) {
  return scholarRecordMenus.find((item) => item.slug === slug) ?? null;
}

export function menuByKind(kind: ScholarRecordKind) {
  const menu = scholarRecordMenus.find((item) => item.kind === kind);
  if (!menu) throw new Error(`Unknown scholar record: ${kind}`);
  return menu;
}
