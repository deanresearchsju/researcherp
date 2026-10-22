import { scholarDeclaration, supervisorDeclaration } from "@/data/declarations";
import { university } from "@/lib/constants";

export { scholarDeclaration, supervisorDeclaration };

export const netExamCopy = {
  question: "Qualified in NET / SET / SLET?",
  net: "NET",
  set: "SET / SLET",
  certificateNo: "Certificate No.",
  year: "Year of passing",
  agency: "Agency name",
} as const;

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
  success:
    "Keep the application number from the receipt. The office uses it to track this form.",
  draftNote:
    "A draft of your answers is saved in this browser. Uploads stay only for this visit.",
  pageTitle: "PhD Application",
  noVacancy:
    "Ph.D. applications can be submitted only when a school and subject currently have a vacancy.",
  track: "Track application",
  trackResultPending:
    "Your application is under review. The result will be published here once the selection list is approved.",
  trackSelected:
    "Congratulations! You have been provisionally selected for admission to the Ph.D. programme.",
  trackSelectedNext:
    "Please submit your original documents at the Center for Research. Portal sign-in opens after the documents are verified.",
  trackSelectedLetterWaiting:
    "Your provisional selection letter will appear here once the office issues it.",
  trackAdmitted:
    "Your documents are verified and you are admitted. Sign in to the scholar ERP portal with the sign-in details given by the office, and pay the fee under Fee.",
  trackWaiting:
    "You are on the waiting list for your subject. If a selected candidate does not report, the next candidate on the waiting list is offered the seat and the research office will write to you.",
  letterReady:
    "Your provisional selection letter is ready. Please download it and report to the office of the Dean on or before the date stated in the letter.",
  letterDownload: "Download provisional selection letter",
  trackShortlisted:
    "You are shortlisted for the entrance test. Your hall ticket will appear here once the research office publishes it.",
  trackShortlistedTicket:
    "You are shortlisted for the entrance test. Download your hall ticket above and carry it to the examination hall.",
  trackNotReported:
    "The provisional admission was cancelled because the candidate did not report or declined the seat.",
  hallTicketReady:
    "Your hall ticket for the Ph.D. entrance examination is ready. Hall ticket No.",
  hallTicket: "Download hall ticket",
  trackArchived: "This application is not in the current admission session.",
  trackMissing: "No current-session application matches that number and date of birth.",
  download: "Download application",
  scholarLogin: "Sign in to the ERP portal",
};

export const supervisorFormCopy = {
  title: "Application for Recognition as Research Supervisor",
  photoLabel: "Affix recent passport size photograph",
  successNote: `Supporting documents may also be emailed to ${university.email}`,
  draftNote:
    "A draft of your answers is saved in this browser. Uploads stay only for this visit.",
};
