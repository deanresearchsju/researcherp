import { university } from "@/lib/constants";

export type MailBody = { subject: string; text: string; html: string };

const site = university.siteUrl;
const signature = [
  "With regards,",
  `${university.researchOffice}, ${university.name}`,
  university.email,
].join("\n");

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function compose(subject: string, lines: readonly string[]): MailBody {
  const text = [...lines, "", signature].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222">${text
    .split("\n")
    .map((line) => (line ? `<p style="margin:0 0 8px">${escapeHtml(line)}</p>` : "<br>"))
    .join("")}</div>`;
  return { subject, text, html };
}

function details(rows: readonly (readonly [string, string])[]) {
  return rows.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
}

export function phdAcknowledgement(input: {
  name: string;
  applicationNo: string;
  school: string;
  subject: string;
  studyMode: string;
  submittedOn: string;
}) {
  return compose(`Ph.D. application received · ${input.applicationNo}`, [
    `Dear ${input.name},`,
    "",
    `Thank you for applying to the Ph.D. programme of ${university.name}. We have received your application.`,
    "",
    ...details([
      ["Application No.", input.applicationNo],
      ["School", input.school],
      ["Subject", input.subject],
      ["Mode of study", input.studyMode],
      ["Submitted on", input.submittedOn],
    ]),
    "",
    "Please keep your application number safe. You can track your application, and later download your hall ticket and letters, at:",
    `${site}/apply/status`,
    "(Use your application number and date of birth.)",
    "",
    "Kindly note that the application fee, once paid, is non-refundable.",
  ]);
}

export function supervisorAcknowledgement(input: {
  name: string;
  applicationNo: string;
  designation: string;
  department: string;
  submittedOn: string;
}) {
  return compose(`Supervisor recognition application received · ${input.applicationNo}`, [
    `Dear ${input.name},`,
    "",
    `Thank you for applying for recognition as a research supervisor at ${university.name}. We have received your application.`,
    "",
    ...details([
      ["Application No.", input.applicationNo],
      ["Designation", input.designation],
      ["Department", input.department],
      ["Submitted on", input.submittedOn],
    ]),
    "",
    "You can follow the progress of your application at:",
    `${site}/supervisor-recognition/status`,
    "(Use your application number and date of birth.)",
  ]);
}

export function hallTicketReady(input: {
  name: string;
  applicationNo: string;
  hallTicketNo: string;
}) {
  return compose(`Your Ph.D. entrance hall ticket is ready · ${input.hallTicketNo}`, [
    `Dear ${input.name},`,
    "",
    `Your hall ticket for the Ph.D. entrance examination is ready (Hall ticket No. ${input.hallTicketNo}).`,
    "Kindly download it from the link below and carry a printed copy, along with a photo ID, to the examination.",
    "",
    `${site}/apply/status`,
    `(Use your application number ${input.applicationNo} and your date of birth.)`,
  ]);
}

export function selectionLetterReady(input: {
  name: string;
  applicationNo: string;
  reportBy: string;
}) {
  return compose(`Provisional selection letter · ${input.applicationNo}`, [
    `Dear ${input.name},`,
    "",
    "Congratulations! You have been provisionally selected for admission to the Ph.D. programme.",
    "Kindly download your provisional selection letter from the link below and complete the formalities stated in it.",
    input.reportBy
      ? `Please report to the office of the Dean on or before ${input.reportBy} with your original certificates.`
      : "Please report to the office of the Dean with your original certificates on the date stated in the letter.",
    "",
    `${site}/apply/status`,
    `(Use your application number ${input.applicationNo} and your date of birth.)`,
  ]);
}

export function loginDetails(input: {
  name: string;
  role: "scholar" | "supervisor";
  username: string;
  password: string;
}) {
  const loginUrl = `${site}/login/${input.role}`;
  return compose(`Your ${university.productName} sign-in details`, [
    `Dear ${input.name},`,
    "",
    input.role === "scholar"
      ? `Your ${university.productName} access has been activated.`
      : `Your recognition as a research supervisor is approved, and your ${university.productName} access has been activated.`,
    "",
    `Sign in at: ${loginUrl}`,
    `Username: ${input.username}`,
    `Temporary password: ${input.password}`,
    "",
    "You will be asked to set a new password when you sign in for the first time. Please do not share this password with anyone.",
  ]);
}

export function recognitionReady(input: { name: string; applicationNo: string }) {
  return compose(`Supervisor recognition approved · ${input.applicationNo}`, [
    `Dear ${input.name},`,
    "",
    "We are pleased to inform you that your recognition as a research supervisor has been approved.",
    "You can download your recognition letter from the status page:",
    `${site}/supervisor-recognition/status`,
    `(Use your application number ${input.applicationNo} and your date of birth.)`,
  ]);
}
