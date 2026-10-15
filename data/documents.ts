import type { FileLimitKey } from "@/lib/constants";

export type DocumentRequirement = "always" | "part-time" | "optional";

export type DocumentSpec = {
  id: string;
  label: string;
  rule: FileLimitKey;
  required: DocumentRequirement;
  remarks: string;
};

const office = "For office use";

export const scholarDocuments: DocumentSpec[] = [
  {
    id: "photo",
    label: "Recent Passport-size Photograph",
    rule: "photo",
    required: "always",
    remarks: office,
  },
  {
    id: "signature",
    label: "Student Signature",
    rule: "scholarSignature",
    required: "always",
    remarks: office,
  },
  {
    id: "dobProof",
    label: "DOB proof",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "ug",
    label: "UG Degree / Consolidated Statement",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "pg",
    label: "PG Degree / Consolidated Statement",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "feeReceipt",
    label: "Fee receipt",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "noc",
    label: "No Objection Certificate from present employer",
    rule: "document",
    required: "part-time",
    remarks: office,
  },
  {
    id: "net",
    label: "NET/SET certificate",
    rule: "document",
    required: "optional",
    remarks: office,
  },
];

export const supervisorEnclosures: DocumentSpec[] = [
  {
    id: "photo",
    label: "Recent passport-size photograph",
    rule: "photo",
    required: "always",
    remarks: office,
  },
  {
    id: "signature",
    label: "Signature",
    rule: "supervisorSignature",
    required: "always",
    remarks: office,
  },
  {
    id: "sslc",
    label: "Copy of SSLC Certificate (date of birth)",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "appointment",
    label: "Copy of Appointment Order",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "ug",
    label: "Copy of U.G. Certificate",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "pg",
    label: "Copy of P.G. Certificate",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "phd",
    label: "Copy of Ph.D. Certificate",
    rule: "document",
    required: "always",
    remarks: office,
  },
  {
    id: "resume",
    label: "Brief Resume",
    rule: "resume",
    required: "always",
    remarks: office,
  },
];
