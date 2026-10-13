import type { ChecklistItem } from "@/types";

export const checklist: ChecklistItem[] = [
  {
    id: "photo",
    title: "Passport photograph",
    detail: "Recent colour photograph, file size 200–600 KB.",
    required: true,
  },
  {
    id: "signature",
    title: "Signature",
    detail: "Scanned signature on a plain background, file size 20–40 KB.",
    required: true,
  },
  {
    id: "receipt",
    title: "Fee receipt",
    detail: "Proof of the ₹500 application fee paid to the college account.",
    required: true,
  },
  {
    id: "ug",
    title: "Undergraduate degree",
    detail: "Degree certificate or provisional certificate.",
    required: true,
  },
  {
    id: "pg",
    title: "Postgraduate record",
    detail: "Consolidated marksheet, provisional certificate, or degree.",
    required: true,
  },
  {
    id: "net",
    title: "SET or NET",
    detail: "Certificate, where the applicant holds one.",
    required: false,
  },
  {
    id: "dob",
    title: "Date of birth proof",
    detail: "A document that states the date of birth.",
    required: true,
  },
  {
    id: "noc",
    title: "No objection certificate",
    detail: "Required from the present employer when the study mode is part-time.",
    required: false,
    badge: "Part-time",
  },
];
