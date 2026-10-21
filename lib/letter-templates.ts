import {
  displayName,
  modeLabel,
  type AdmissionCase,
  type LetterConfig,
} from "@/lib/admission";
import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import {
  latestThesis,
  nextLetterSerial,
  type DoctoralState,
  type LetterDraft,
  type VivaRecord,
} from "@/lib/doctoral";
import { currentAllotments, registrationOf, scholarBySignIn } from "@/lib/register";
import type { StoredApplication } from "@/lib/records";

const pad = (value: number, size = 3) => String(value).padStart(size, "0");

/** "10/09/2026" → "2026-09-10"; ISO dates pass through. */
export function isoFromDisplay(value: string, fallback: string) {
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value.trim());
  if (match)
    return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

/** Subject code for references: "Management" → "MGT", "Computer Science" → "CS". */
export function subjectCode(subject: string) {
  const words = subject
    .replace(/[^A-Za-z ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !/^(and|of|the|for)$/i.test(word));
  if (words.length === 0) return "GEN";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function registrationNo(identifier: string) {
  const scholar = scholarBySignIn(identifier);
  return scholar
    ? registrationOf(scholar, currentAllotments()) ||
        scholar.registrationNumber ||
        scholar.fileNumber
    : "";
}

/* ------------------------------ Provisional ------------------------------ */

export function provisionalDraft(
  row: AdmissionCase,
  letter: LetterConfig,
  serial: number,
  today: string,
): LetterDraft {
  const documents = letter.documents
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    kind: "provisional",
    sourceId: row.applicationId,
    recipientRole: "scholar",
    recipientIdentifier: row.email || row.applicationNo,
    recipientName: displayName(row),
    refNo: `${letter.refPrefix}/${String(row.letterNo ?? serial).padStart(2, "0")}`,
    issuedOn: row.letterIssuedOn || isoFromDisplay(letter.issueDate, today),
    title: `Provisional Admission Letter · ${letter.programme}`,
    toLines: [displayName(row), `App. No.: ${row.applicationNo}`, row.email],
    subject: `Provisional selection for admission to the ${letter.programme} (${letter.sessionLabel})`,
    reference: `Your application No. ${row.applicationNo} for admission to the ${letter.programme}.`,
    details: [
      { label: "Application No.", value: row.applicationNo },
      { label: "Subject / department", value: row.department },
      { label: "Mode of study", value: modeLabel(row.studyMode) },
      { label: "Report on or before", value: letter.reportBy },
      { label: "For office use", value: "Roll Number: ____________" },
    ],
    body: [
      `${displayName(row)} is informed that you have been provisionally selected for admission to the ${letter.programme} in ${row.department} under ${modeLabel(row.studyMode)} registration, subject to the eligibility conditions as per the Ph.D. regulations of the University.`,
      "You are required to produce all the original certificates and one self-attested photocopy for verification upon admission. To complete your enrolment, please submit the following documents and materials:",
      documents.map((item) => `- ${item}`).join("\n"),
      `Please report to the office of the Dean-Research on or before ${letter.reportBy}. Your admission will be officially confirmed after the verification of your original certificates and the subsequent payment of the tuition fee.`,
      `Tuition fee details: Full Time ₹${letter.fullTimeFee} per year, Part Time ₹${letter.partTimeFee} per year. The tuition fee must be paid by ${letter.reportBy}. You can make the payment through ${letter.accountName} A/C No. ${letter.accountNumber}, ${letter.bankName} (IFSC Code: ${letter.ifsc}), ${letter.branch}. Failure to pay the required tuition fee by the stipulated deadline (${letter.reportBy}) may result in the cancellation of your provisional admission.`,
      `We congratulate you on your selection and look forward to welcoming you to our programme. Feel free to call ${letter.phone} if you need any help.`,
    ],
    closing: "Best wishes,",
    copyTo: [],
  };
}

/* ------------------------------ Confirmation ----------------------------- */

export function confirmationDraft(input: {
  doctoral: DoctoralState;
  sourceId: string;
  identifier: string;
  name: string;
  subject: string;
  provisionalRef: string;
  provisionalOn: string;
  today: string;
}): LetterDraft {
  const year = input.today.slice(0, 4);
  const registration = registrationNo(input.identifier);
  const name = scholarBySignIn(input.identifier)?.name || input.name;
  return {
    kind: "confirmation",
    sourceId: input.sourceId,
    recipientRole: "scholar",
    recipientIdentifier: input.identifier,
    recipientName: name,
    refNo: `SJU/DR/PHD-CONF/${subjectCode(input.subject)}/${year}/${pad(nextLetterSerial(input.doctoral, "confirmation", year))}`,
    issuedOn: input.today,
    title: "",
    toLines: [name.toUpperCase(), `Reg. No.: ${registration || "—"}`],
    subject: `Confirmation of provisional registration for the Ph.D. degree in ${input.subject} in respect of ${name} [Reg. No.: ${registration || "—"}]`,
    reference: `Provisional registration communication no. ${input.provisionalRef || "—"}${input.provisionalOn ? ` dated ${formatIsoDate(input.provisionalOn)}` : ""}, issued by this office.`,
    details: [],
    body: [
      "The competent authorities considered the report of the Doctoral Committee in connection with the Course Work Examination conducted for the above candidate, as per this office letter cited above, and approved the recommendations of the Committee that the scholar is fit to proceed with the Ph.D. Degree Programme.",
      "The Provisional Registration of the candidate for the Ph.D. Degree is hereby confirmed.",
      "The candidate should submit the thesis after the expiry of 4 (Four) years and before the completion of 6 (Six) years, from the date of Provisional registration.",
      "All the members of the Doctoral Committee are informed accordingly.",
      "The Candidate is required to submit a Six-Month Progress Report by June and December of each academic year. Each report must include a brief statement of research progress and a validating comment from the supervisor. Failure to submit two consecutive reports may result in a formal review of candidacy.",
      "The exact title of the thesis must be informed to the University through the Supervisor at the time of submission of the synopsis, and the same is to be recorded in the minutes of the Doctoral Committee.",
      "The candidate should submit, through the Supervisor, three (3) copies of the synopsis of the thesis together with the title of the thesis in the prescribed application form, along with the prescribed fee and the necessary certificates, not less than three months before the submission of the thesis.",
      "The number and date of this communication should be quoted in future correspondence.",
    ],
    closing: "Best wishes,",
    copyTo: [],
  };
}

/* ------------------------------ Recognition ------------------------------ */

function payloadText(application: StoredApplication, key: string) {
  const payload = application.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string"
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : "";
}

export function recognitionDraft(
  doctoral: DoctoralState,
  application: StoredApplication,
  today: string,
): LetterDraft {
  const year = today.slice(0, 4);
  const field = (key: string) => payloadText(application, key);
  const name = field("name") || application.applicantName;
  const subject = field("subject") || field("proposedDepartment") || field("department");
  const quota = field("approvedQuota");
  return {
    kind: "recognition",
    sourceId: application.id,
    recipientRole: "supervisor",
    recipientIdentifier: field("email") || application.email || name,
    recipientName: name,
    refNo: `SJU/DR/SR/${year}/${pad(nextLetterSerial(doctoral, "recognition", year))}`,
    issuedOn: today,
    title: "",
    toLines: [
      name,
      field("designation"),
      [field("department"), field("faculty")].filter(Boolean).join(", "),
      university.name,
    ],
    subject: `Recognition as Research Supervisor for the Ph.D. Degree Programme in ${subject}`,
    reference: `Your application No. ${application.applicationNo} dated ${formatIsoDate(application.createdAt.slice(0, 10))} for recognition as Research Supervisor.`,
    details: [
      { label: "Name", value: name },
      { label: "Designation", value: field("designation") },
      {
        label: "Department / School",
        value: [field("department"), field("faculty")].filter(Boolean).join(", "),
      },
      { label: "Recognised in", value: subject },
      { label: "Area of research", value: field("expertise") },
      { label: "Scholars at a time", value: quota ? `Up to ${quota}` : "" },
      { label: "With effect from", value: formatIsoDate(today) },
    ],
    body: [
      "With reference to your application cited above, the competent authority of the University is pleased to recognise you as a Research Supervisor for the Ph.D. Degree Programme of the University, as detailed above.",
      "This recognition is subject to the Ph.D. Regulations of the University in force and to the following conditions:",
      [
        "- You may guide Ph.D. scholars only in the subject stated above and up to the number of scholars approved, at any point of time.",
        "- Scholars are allotted to you by the Center for Research against the vacancy available with you.",
        "- You shall initiate the Research Advisory Committee for each scholar and ensure that the six-month progress reports are submitted on time.",
        "- Any change in your designation, department or contact details shall be informed to the office of the Dean Research without delay.",
        "- The recognition may be withdrawn if the conditions of the Regulations are not met.",
      ].join("\n"),
      "We congratulate you on the recognition and look forward to your contribution to research at the University.",
    ],
    closing: "Best wishes,",
    copyTo: ["The Head of the Department", "The Center for Research (file)"],
  };
}

/* --------------------------------- Viva ---------------------------------- */

export function vivaDraft(input: {
  doctoral: DoctoralState;
  viva: VivaRecord;
  subject: string;
  title: string;
  supervisor: string;
  today: string;
}): LetterDraft {
  const { viva } = input;
  const year = input.today.slice(0, 4);
  const thesis = latestThesis(input.doctoral, viva.scholarIdentifier);
  const registration = registrationNo(viva.scholarIdentifier);
  return {
    kind: "viva",
    sourceId: viva.id,
    recipientRole: "scholar",
    recipientIdentifier: viva.scholarIdentifier,
    recipientName: viva.scholarName,
    refNo: `SJU/DR/PHD-VIVA/${subjectCode(input.subject)}/${year}/${pad(nextLetterSerial(input.doctoral, "viva", year))}`,
    issuedOn: input.today,
    title: "",
    toLines: [viva.scholarName.toUpperCase(), `Reg. No.: ${registration || "—"}`],
    subject: `Public viva-voce examination of the Ph.D. thesis of ${viva.scholarName} [Reg. No.: ${registration || "—"}]`,
    reference: thesis
      ? `Ph.D. thesis submitted on ${formatIsoDate(thesis.createdAt.slice(0, 10))}.`
      : "Ph.D. thesis submitted to this office.",
    details: [
      { label: "Name of the scholar", value: viva.scholarName },
      { label: "Subject", value: input.subject },
      { label: "Title of the thesis", value: input.title || thesis?.title || "" },
      { label: "Supervisor", value: input.supervisor },
      { label: "Date", value: viva.scheduledOn ? formatIsoDate(viva.scheduledOn) : "" },
      { label: "Time", value: "10:30 AM" },
      { label: "Venue / mode", value: viva.venue },
      { label: "Examination board", value: viva.panel },
    ],
    body: [
      "The reports of the examiners on the above thesis have been received and considered by the competent authority. You are hereby informed that your public viva-voce examination has been arranged as detailed above.",
      [
        "- Report at the venue at least 30 minutes before the examination.",
        "- Present your research in about 30 to 40 minutes, followed by questions from the examiners and the audience.",
        "- Bring two copies of the thesis and the original copies of your publications.",
        "- The viva-voce is open to the faculty members and research scholars of the University.",
      ].join("\n"),
      "Please confirm your availability to the office of the Dean Research. The number and date of this communication should be quoted in future correspondence.",
    ],
    closing: "Best wishes,",
    copyTo: [
      `The Supervisor${input.supervisor ? ` (${input.supervisor})` : ""}`,
      "The Members of the Examination Board",
      "The Controller of Examinations",
    ],
  };
}

/* ------------------------------ Completion ------------------------------- */

export function completionDraft(input: {
  doctoral: DoctoralState;
  viva: VivaRecord;
  subject: string;
  title: string;
  supervisor: string;
  today: string;
}): LetterDraft {
  const { viva } = input;
  const year = input.today.slice(0, 4);
  const registration = registrationNo(viva.scholarIdentifier);
  const held = viva.scheduledOn ? formatIsoDate(viva.scheduledOn) : "—";
  return {
    kind: "completion",
    sourceId: viva.id,
    recipientRole: "scholar",
    recipientIdentifier: viva.scholarIdentifier,
    recipientName: viva.scholarName,
    refNo: `SJU/DR/PHD-COMP/${subjectCode(input.subject)}/${year}/${pad(nextLetterSerial(input.doctoral, "completion", year))}`,
    issuedOn: input.today,
    title: "Ph.D. Completion Letter",
    toLines: [viva.scholarName.toUpperCase(), `Reg. No.: ${registration || "—"}`],
    subject: `Completion of the Ph.D. Degree Programme in ${input.subject}`,
    reference: `Public viva-voce examination held on ${held}.`,
    details: [
      { label: "Name of the scholar", value: viva.scholarName },
      { label: "Registration No.", value: registration },
      { label: "Subject", value: input.subject },
      { label: "Title of the thesis", value: input.title },
      { label: "Supervisor", value: input.supervisor },
      { label: "Viva-voce held on", value: held },
    ],
    body: [
      `This is to inform you that you have successfully completed all the requirements of the Ph.D. Degree Programme of ${university.name}. Your public viva-voce examination held on ${held} was successful, and the Board of Examiners has recommended the award of the Degree of Doctor of Philosophy in ${input.subject}.`,
      "The degree will be conferred at the convocation of the University. Until the provisional certificate or the degree certificate is issued, this letter may be produced as proof of completion of the Ph.D. programme.",
      "We congratulate you on this achievement and wish you every success in your career.",
    ],
    closing: "With best wishes,",
    copyTo: [
      `The Supervisor${input.supervisor ? ` (${input.supervisor})` : ""}`,
      "The Controller of Examinations",
    ],
  };
}
