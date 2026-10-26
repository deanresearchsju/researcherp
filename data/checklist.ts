import type { ChecklistItem } from "@/types";
import { uploadStandards } from "@/lib/constants";

export const checklist: ChecklistItem[] = [
  {
    id: "photo",
    title: "Passport photograph",
    detail: `Recent colour photograph. ${uploadStandards.photo.label}.`,
    required: true,
  },
  {
    id: "receipt",
    title: "Fee receipt",
    detail: "Proof of the ₹500 application fee paid to the college account.",
    required: true,
  },
  {
    id: "sslc & hsc",
    title: "SSLC & HSC",
    detail: "Marksheet.",
    required: true,
  },
  {
    id: "Transfer Certificate",
    title: "Transfer Certificate",
    detail: "Last Studied College's Transfer Certificate.",
    required: true,
  },
  {
    id: "ug",
    title: "Undergraduate degree",
    detail: "Degree certificate and Marksheet.",
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
