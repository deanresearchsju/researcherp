import { scholarDeclaration, supervisorDeclaration } from "@/data/declarations";
import { admissionSessionsCopy, university } from "@/lib/constants";

export { scholarDeclaration, supervisorDeclaration };

export const scholarFormCopy = {
  university: "St. JOSEPH UNIVERSITY",
  unit: "A Unit of DMI Foundations",
  title: "PhD APPLICATION FORM",
  photoLabel: "Affix Passport Size Photograph",
  officeTitle: "For Office Use Only",
  applicationNo: "Application No.",
  applicationDate: "Date of Application",
  session: "Session & Year",
  issued: "Issued on submission",
  success: "Keep the application number from the receipt. The office uses it to track this form.",
  startHint: `${admissionSessionsCopy.sentence} Use a mobile number and email you can reach. A draft stays in this browser until you submit.`,
  draftNote:
    "A draft of your answers is saved in this browser. Uploads stay only for this visit.",
};

export const supervisorFormCopy = {
  title: "Application for Recognition as Research Supervisor",
  photoLabel: "Affix recent passport size photograph",
  successNote: `Supporting documents may also be emailed to ${university.email}`,
  draftNote:
    "A draft of your answers is saved in this browser. Uploads stay only for this visit.",
};
