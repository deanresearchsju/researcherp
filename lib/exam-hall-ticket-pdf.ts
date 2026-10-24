import type { jsPDF } from "jspdf";

import { hallTicketDeanTitle } from "@/data/admission";
import { currentAdmission } from "@/lib/admission";
import { university } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral } from "@/lib/doctoral";
import {
  centreOf,
  examBatchName,
  roomOf,
  type ExamSettings,
  type ExamTicket,
} from "@/lib/exam-office";
import { portraitFor, ensurePortraits } from "@/lib/portraits";
import { fetchProfilePhotos, profilePhotoKey } from "@/lib/profile-photo";

/**
 * The course-work examination hall ticket. It is the only hall ticket the ERP issues: one
 * ticket for a scholar and a semester, listing every paper with its date and time, the campus,
 * room and seat. It is available only after Accounts has approved the fee.
 */
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
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fitImage(doc: jsPDF, src: string, x: number, y: number, boxW: number, boxH: number) {
  try {
    const props = doc.getImageProperties(src);
    const ratio = props.width / Math.max(props.height, 1);
    let width = boxW;
    let height = boxW / ratio;
    if (height > boxH) {
      height = boxH;
      width = boxH * ratio;
    }
    doc.addImage(src, imageFormat(src), x + (boxW - width) / 2, y + (boxH - height) / 2, width, height);
  } catch {
    // The box stays empty.
  }
}

export type ExamTicketPaper = { code: string; name: string; date: string; time: string };

export type ExamTicketInput = {
  ticket: ExamTicket;
  papers: ExamTicketPaper[];
  photo: string | null;
};

/** The papers on a ticket with their dates and times from the timetable. */
export function ticketPapers(ticket: ExamTicket, settings: ExamSettings): ExamTicketPaper[] {
  const doctoral = currentDoctoral();
  return ticket.registrationIds
    .flatMap((id) => {
      const registration = doctoral?.registrations.find((row) => row.id === id);
      if (!registration) return [];
      const slot = settings.timetable.find(
        (entry) =>
          entry.batchId === ticket.batchId &&
          entry.semester === ticket.semester &&
          entry.subjectId === registration.subjectId,
      );
      return [
        {
          code: registration.code,
          name: registration.name,
          date: slot?.date ?? "",
          time: slot?.time ?? "",
        },
      ];
    })
    .sort((left, right) => (left.date || "9").localeCompare(right.date || "9"));
}

/** The scholars' photographs: the profile photo, else the one from the application. */
export async function ticketPhotos(tickets: readonly ExamTicket[]) {
  const found = new Map<string, string>();
  const [profiles, portraits] = await Promise.all([
    fetchProfilePhotos(
      "scholar",
      tickets.map((ticket) => ticket.scholarIdentifier),
    ).catch(() => new Map<string, string>()),
    ensurePortraits().catch(() => null),
  ]);
  for (const ticket of tickets) {
    const photo =
      profiles.get(profilePhotoKey("scholar", ticket.scholarIdentifier)) ??
      portraitFor(portraits, ticket.scholarIdentifier, ticket.scholarName);
    if (photo) found.set(ticket.id, photo);
  }
  return found;
}

function drawTicket(
  doc: jsPDF,
  input: ExamTicketInput,
  settings: ExamSettings,
  logo: string | null,
  deanName: string,
) {
  const { ticket, papers, photo } = input;
  const centre = centreOf(settings, ticket.centreId);
  const room = roomOf(centre, ticket.roomId);
  const batchName = examBatchName(ticket.batchId);
  let y = 10;

  doc.setFillColor(...gold);
  doc.rect(margin, y, innerW, 0.8, "F");
  doc.setFillColor(...purple);
  doc.rect(margin, y + 0.8, innerW, 1.4, "F");
  y += 5;
  if (logo) fitImage(doc, logo, margin, y, 52, 18);
  doc.setTextColor(...purple);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(university.researchOffice.toUpperCase(), pageW - margin, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("Controller of Examinations · Office of the Dean", pageW - margin, y + 9.5, {
    align: "right",
  });
  doc.text(university.email, pageW - margin, y + 13.5, { align: "right" });
  y += 22;

  doc.setFillColor(...purple);
  doc.roundedRect(margin, y, innerW, 15, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("HALL TICKET", pageW / 2, y + 6.5, { align: "center" });
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Ph.D. Course Work Examination · Semester ${ticket.semester}${batchName ? ` · ${batchName} batch` : ""}`,
    pageW / 2,
    y + 12,
    { align: "center" },
  );
  y += 20;

  const photoW = 34;
  const photoH = 42;
  const photoX = pageW - margin - photoW;
  const detailsW = innerW - photoW - 6;
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.35);
  doc.rect(photoX, y, photoW, photoH);
  if (photo) {
    fitImage(doc, photo, photoX + 0.6, y + 0.6, photoW - 1.2, photoH - 1.2);
  } else {
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(["Affix recent", "passport size", "photograph"], photoX + photoW / 2, y + 17, {
      align: "center",
    });
  }
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text("Photograph of the scholar", photoX + photoW / 2, y + photoH + 3.5, {
    align: "center",
  });

  doc.setFillColor(...tint);
  doc.setDrawColor(...purple);
  doc.roundedRect(margin, y, detailsW, 13, 1.5, 1.5, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("HALL TICKET NO.", margin + 4, y + 5);
  doc.text("REGISTRATION / APPLICATION NO.", margin + detailsW / 2 + 2, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...purple);
  doc.text(ticket.ticketNo, margin + 4, y + 10.5);
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(ticket.registration || "—", margin + detailsW / 2 + 2, y + 10.5);

  let ry = y + 17;
  const pairs: [string, string][] = [
    ["Name of the scholar", ticket.scholarName.toUpperCase()],
    ["Department", ticket.department || "—"],
    ["Batch", batchName || "—"],
    ["Issued on", formatIsoDate(ticket.issuedOn)],
  ];
  for (const [label, value] of pairs) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label, margin + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(value, detailsW - 40) as string[];
    doc.text(lines, margin + 38, ry);
    ry += Math.max(lines.length, 1) * 4.2 + 1.4;
  }
  y = Math.max(ry, y + photoH + 6) + 2;

  doc.setFillColor(...purple);
  doc.rect(margin, y, innerW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("EXAMINATION CENTRE", margin + 3, y + 4.8);
  y += 7;
  const cells: [string, string][] = [
    ["Campus", centre?.name || "—"],
    ["Hall / room", room?.name || "As displayed at the campus"],
    ["Seat number", ticket.seat || "As displayed at the campus"],
    ["Address", centre?.address || centre?.name || "—"],
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
  y += 22 + 4;

  doc.setFillColor(...purple);
  doc.rect(margin, y, innerW, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAPERS AND TIMETABLE", margin + 3, y + 4.8);
  y += 7;
  const columns = [10, 28, innerW - 10 - 28 - 38 - 44, 38, 44];
  const heads = ["S. No.", "Code", "Subject", "Date", "Time"];
  doc.setFillColor(...tint);
  doc.rect(margin, y, innerW, 6.5, "F");
  doc.setTextColor(...purple);
  doc.setFontSize(8);
  let x = margin;
  heads.forEach((head, index) => {
    doc.text(head, x + 2, y + 4.5);
    x += columns[index];
  });
  y += 6.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...ink);
  papers.forEach((paper, index) => {
    const cellsText = [
      String(index + 1),
      paper.code,
      paper.name,
      paper.date ? formatIsoDate(paper.date) : "To be announced",
      paper.time || "To be announced",
    ];
    const wrapped = cellsText.map(
      (value, at) => doc.splitTextToSize(value, columns[at] - 4) as string[],
    );
    const height = Math.max(...wrapped.map((lines) => lines.length)) * 4 + 3;
    doc.setDrawColor(210, 200, 225);
    doc.rect(margin, y, innerW, height);
    let cx = margin;
    wrapped.forEach((lines, at) => {
      doc.text(lines, cx + 2, y + 4.8);
      cx += columns[at];
    });
    y += height;
  });
  y += 8;

  doc.setFillColor(...tint);
  doc.setDrawColor(...purple);
  doc.roundedRect(margin, y, innerW, 11, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...purple);
  doc.text("FOR THE INVIGILATOR", margin + 3, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...ink);
  doc.text("Identity verified   [   ]          Photo matches   [   ]", margin + 3, y + 8.6);
  y += 15;

  const boxW = (innerW - 9) / 4;
  const boxH = 20;
  const boxes = [
    "Signature of the scholar\n(to be signed in the hall)",
    "Signature of the invigilator\nwith name",
    "Controller of Examinations",
    deanName ? `${deanName}\n${hallTicketDeanTitle}` : hallTicketDeanTitle,
  ];
  boxes.forEach((label, index) => {
    const bx = margin + index * (boxW + 3);
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.3);
    doc.rect(bx, y, boxW, boxH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    const lines = doc.splitTextToSize(label, boxW - 2) as string[];
    doc.text(lines, bx + boxW / 2, y + boxH + 3.2, { align: "center" });
  });
  y += boxH + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...purple);
  doc.text("INSTRUCTIONS TO THE SCHOLAR", margin, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...ink);
  settings.instructions.forEach((item, index) => {
    const lines = doc.splitTextToSize(`${index + 1}.  ${item}`, innerW - 2) as string[];
    doc.text(lines, margin + 1, y);
    y += lines.length * 3.6 + 0.8;
  });

  const footerY = 287;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4);
  doc.setFontSize(6.8);
  doc.setTextColor(...muted);
  doc.text(
    `${university.name} · ${university.researchOffice} · System-generated hall ticket · ${formatIsoDate(clientToday())}`,
    pageW / 2,
    footerY,
    { align: "center" },
  );
}

/** Downloads the hall tickets of the chosen scholars as one PDF, a page for each. */
export async function downloadExamHallTickets(
  inputs: readonly ExamTicketInput[],
  settings: ExamSettings,
  filename = "course-work-hall-tickets.pdf",
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const logo = await fetchAsDataUrl("/assets/logo-full.jpeg");
  const deanName = currentAdmission()?.letter.deanName?.trim() ?? "";
  inputs.forEach((input, index) => {
    if (index > 0) doc.addPage();
    drawTicket(doc, input, settings, logo, deanName);
  });
  doc.save(filename);
}
