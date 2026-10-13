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
