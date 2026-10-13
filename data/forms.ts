import { scholarDeclaration, supervisorDeclaration } from "@/data/declarations";
import { university } from "@/lib/constants";

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
  success: "An acknowledgement mail has been sent to your email.",
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
