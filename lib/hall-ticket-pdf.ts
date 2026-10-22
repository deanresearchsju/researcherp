import type { jsPDF } from "jspdf";

import {
  hallTicketDeanTitle,
  hallTicketInstructions,
  interviewMax,
  writtenMax,
} from "@/data/admission";
import {
  campusFor,
  clockLabel,
  displayName,
  modeLabel,
  type AdmissionCase,
  type EntranceSchedule,
  type LetterConfig,
} from "@/lib/admission";
import { university } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import type { PhdReceipt } from "@/lib/scholar-progress";

export type HallTicketInput = {
  row: AdmissionCase;
  receipt: PhdReceipt | null;
  schedule: EntranceSchedule;
  letter: Pick<LetterConfig, "deanName" | "deanTitle">;
};

const pageW = 210;
const margin = 14;
const innerW = pageW - margin * 2;
const ink: [number, number, number] = [28, 23, 48];
const purple: [number, number, number] = [91, 42, 134];
const gold: [number, number, number] = [242, 194, 48];
const muted: [number, number, number] = [96, 88, 118];
const tint: [number, number, number] = [246, 242, 250];

function imageFormat(src: string) {
  if (src.includes("image/png")) return "PNG";
  if (src.includes("image/webp")) return "WEBP";
  return "JPEG";
}

async function fetchAsDataUrl(src: string) {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fitImage(
  doc: jsPDF,
  src: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
) {
  try {
    const props = doc.getImageProperties(src);
    const ratio = props.width / Math.max(props.height, 1);
    let width = boxW;
    let height = boxW / ratio;
    if (height > boxH) {
      height = boxH;
      width = boxH * ratio;
    }
    doc.addImage(
      src,
      imageFormat(src),
      x + (boxW - width) / 2,
      y + (boxH - height) / 2,
      width,
      height,
    );
  } catch {
    /* the box stays empty */
  }
}

function longDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatIsoDate(iso);
  const weekday = date.toLocaleDateString("en-IN", { weekday: "long" });
  return `${formatIsoDate(iso)} (${weekday})`;
}

function sessionLine(schedule: EntranceSchedule) {
  const year = schedule.monthYear.slice(0, 4);
  return [schedule.session, year].filter(Boolean).join(" ");
}

function drawTicket(doc: jsPDF, input: HallTicketInput, logo: string | null) {
  const { row, receipt, schedule, letter } = input;
  const values = receipt?.values;
  const campus = campusFor(schedule, row.examCampusId);
  let y = 10;

  // Letterhead
  doc.setFillColor(...gold);
  doc.rect(margin, y, innerW, 0.8, "F");
  doc.setFillColor(...purple);
  doc.rect(margin, y + 0.8, innerW, 1.4, "F");
  y += 5;
  if (logo) fitImage(doc, logo, margin, y, 52, 18);
  doc.setTextColor(...purple);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(university.researchOffice.toUpperCase(), pageW - margin, y + 5, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("Office of the Dean", pageW - margin, y + 9.5, { align: "right" });
  doc.text(university.email, pageW - margin, y + 13.5, { align: "right" });
  y += 22;

  // Title band
  doc.setFillColor(...purple);
  doc.roundedRect(margin, y, innerW, 15, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("HALL TICKET", pageW / 2, y + 6.5, { align: "center" });
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const session = sessionLine(schedule);
  doc.text(
    `Ph.D. Entrance Examination${session ? ` · ${session} Session` : ""}`,
    pageW / 2,
    y + 12,
    { align: "center" },
  );
  y += 20;

  // Photo and hall ticket number
  const photoW = 34;
  const photoH = 42;
  const photoX = pageW - margin - photoW;
  const detailsW = innerW - photoW - 6;
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.35);
  doc.rect(photoX, y, photoW, photoH);
  if (receipt?.photo) {
    fitImage(doc, receipt.photo, photoX + 0.6, y + 0.6, photoW - 1.2, photoH - 1.2);
  } else {
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(
      ["Affix recent", "passport size", "photograph"],
      photoX + photoW / 2,
      y + 17,
      {
        align: "center",
      },
    );
  }
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text("Photograph of the candidate", photoX + photoW / 2, y + photoH + 3.5, {
    align: "center",
  });

  doc.setFillColor(...tint);
  doc.setDrawColor(...purple);
  doc.roundedRect(margin, y, detailsW, 13, 1.5, 1.5, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("HALL TICKET NO.", margin + 4, y + 5);
  doc.text("APPLICATION NO.", margin + detailsW / 2 + 2, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...purple);
  doc.text(row.hallTicketNo || "—", margin + 4, y + 10.5);
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(row.applicationNo, margin + detailsW / 2 + 2, y + 10.5);

  // Candidate details
  let ry = y + 17;
  const pairs: [string, string][] = [
    ["Name of the candidate", displayName(row).toUpperCase()],
    ["Date of birth", values?.dateOfBirth ? formatIsoDate(values.dateOfBirth) : "—"],
    ["Gender", values?.gender || "—"],
    ["Subject / discipline", row.department],
    ["School", values?.school || "—"],
    ["Mode of study", modeLabel(row.studyMode)],
  ];
  for (const [label, value] of pairs) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label, margin + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(value, detailsW - 46) as string[];
    doc.text(lines, margin + 44, ry);
    ry += Math.max(lines.length, 1) * 4.2 + 1.4;
  }
  y = Math.max(ry, y + photoH + 6) + 2;

  // Examination details
  doc.setFillColor(...purple);
  doc.rect(margin, y, innerW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("EXAMINATION DETAILS", margin + 3, y + 4.8);
  y += 7;
  const cells: [string, string][] = [
    ["Date of examination", schedule.date ? longDate(schedule.date) : "—"],
    ["Reporting time", clockLabel(schedule.reportingTime) || "—"],
    ["Written test begins", clockLabel(schedule.examTime) || "—"],
    ["Marks", `Written test ${writtenMax} + Interview ${interviewMax}`],
    ["Examination centre", campus?.name || "—"],
    ["Hall / room", row.examRoom || "As displayed at the centre"],
  ];
  const cellW = innerW / 2;
  doc.setDrawColor(210, 200, 225);
  doc.setLineWidth(0.25);
  cells.forEach(([label, value], index) => {
    const cx = margin + (index % 2) * cellW;
    const cy = y + Math.floor(index / 2) * 11;
    doc.rect(cx, cy, cellW, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(label.toUpperCase(), cx + 3, cy + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...ink);
    doc.text(doc.splitTextToSize(value, cellW - 6)[0] ?? "", cx + 3, cy + 8.6);
  });
  y += Math.ceil(cells.length / 2) * 11;
  doc.rect(margin, y, innerW, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("CENTRE ADDRESS", margin + 3, y + 3.6);
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  doc.text(
    doc.splitTextToSize(campus?.address || campus?.name || "—", innerW - 6)[0] ?? "",
    margin + 3,
    y + 7.4,
  );
  y += 13;

  // Invigilator verification
  doc.setFillColor(...tint);
  doc.setDrawColor(...purple);
  doc.roundedRect(margin, y, innerW, 11, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...purple);
  doc.text("FOR THE INVIGILATOR", margin + 3, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...ink);
  doc.text(
    "Identity verified   [   ]          Photo matches   [   ]",
    margin + 3,
    y + 8.6,
  );
  y += 15;

  // Signatures
  const boxW = (innerW - 9) / 4;
  const boxH = 22;
  const superintendent = schedule.superintendentName.trim();
  const dean = letter.deanName.trim();
  const boxes: [string, string | null][] = [
    ["Signature of the candidate\n(to be signed in the hall)", null],
    ["Signature of the invigilator\nwith name", null],
    [
      superintendent ? `${superintendent}\nExam Superintendent` : "Exam Superintendent",
      schedule.superintendentSignature || null,
    ],
    [
      dean ? `${dean}\n${hallTicketDeanTitle}` : hallTicketDeanTitle,
      schedule.deanSignature || null,
    ],
  ];
  boxes.forEach(([label, image], index) => {
    const bx = margin + index * (boxW + 3);
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.3);
    doc.rect(bx, y, boxW, boxH);
    if (image) fitImage(doc, image, bx + 2, y + 2, boxW - 4, boxH - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    const lines = doc.splitTextToSize(label, boxW - 2) as string[];
    doc.text(lines, bx + boxW / 2, y + boxH + 3.2, { align: "center" });
  });
  y += boxH + 14;

  // Instructions
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...purple);
  doc.text("INSTRUCTIONS TO THE CANDIDATE", margin, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...ink);
  hallTicketInstructions.forEach((item, index) => {
    const lines = doc.splitTextToSize(`${index + 1}.  ${item}`, innerW - 2) as string[];
    doc.text(lines, margin + 1, y);
    y += lines.length * 3.6 + 0.8;
  });

  // Footer
  const footerY = 287;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4);
  doc.setFontSize(6.8);
  doc.setTextColor(...muted);
  doc.text(
    `Computer-generated hall ticket · Issued ${formatIsoDate(row.hallTicketOn || clientToday())} · ${university.researchOffice}, ${university.name}`,
    margin,
    footerY,
  );
  doc.text("Not valid without the candidate's photograph", pageW - margin, footerY, {
    align: "right",
  });
}

export async function buildHallTickets(inputs: readonly HallTicketInput[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const logo = await fetchAsDataUrl("/assets/logo-sju.jpg");
  inputs.forEach((input, index) => {
    if (index > 0) doc.addPage();
    drawTicket(doc, input, logo);
  });
  return doc;
}

export async function downloadHallTickets(inputs: readonly HallTicketInput[]) {
  if (inputs.length === 0) return;
  const doc = await buildHallTickets(inputs);
  const name =
    inputs.length === 1
      ? `hall-ticket-${(inputs[0].row.hallTicketNo || inputs[0].row.applicationNo).replaceAll("/", "-")}.pdf`
      : `hall-tickets-${inputs.length}.pdf`;
  doc.save(name);
}
