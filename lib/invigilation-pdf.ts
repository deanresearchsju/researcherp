"use client";

import type { jsPDF } from "jspdf";

import { university } from "@/lib/constants";
import {
  scopeLabel,
  shortDate,
  type InvigilationPlan,
  type InvigilatorLetter,
} from "@/lib/invigilation-core";

const pageW = 210;
const margin = 18;
const innerW = pageW - margin * 2;

/** The instructions printed on every letter. The Chief Superintendent's name is added. */
export function letterInstructions(chiefSuperintendent: string) {
  return [
    {
      heading: "Reporting",
      text: "Report to the Chief Superintendent at the examination hall 15 minutes before the examination begins, and collect the attendance sheet, the answer books and the question papers.",
    },
    {
      heading: "Exchange of duty",
      text: "Only the Chief Superintendent may permit an exchange of duty, and only when it is asked for in writing before the day. Invigilators on reserved duty report at the same time and stay until the Chief Superintendent releases them.",
    },
    {
      heading: "Checking at the start",
      text: "Check the hall tickets and photo identity cards of the candidates, the seat numbers and the attendance sheet before the question papers are given out. A candidate without a hall ticket is not admitted without the Chief Superintendent's order.",
    },
    {
      heading: "Responsibility",
      text: "Invigilators remain in the hall throughout, are watchful, and do not read, write or use a mobile phone during the examination. Candidates leave the hall only with permission and under watch.",
    },
    {
      heading: "Corrections",
      text: `Any doubt about a question paper is referred to the Controller's Office and the Chief Superintendent${chiefSuperintendent ? `, ${chiefSuperintendent}` : ""}. The invigilator does not explain or alter a question.`,
    },
    {
      heading: "Answer papers",
      text: "At the end the answer books are counted against the attendance sheet, arranged in the order of the seat numbers, tied and handed to the Chief Superintendent. No candidate takes an answer book out of the hall.",
    },
    {
      heading: "Malpractice",
      text: "In a case of malpractice the invigilator takes the material, obtains the candidate's statement, informs the Chief Superintendent at once and signs the report. The candidate is allowed to finish the paper.",
    },
    {
      heading: "Mobile phones",
      text: "Switch off your mobile phone before entering the hall.",
    },
  ];
}

let logoCache: Promise<string | null> | null = null;

function loadLogo() {
  if (!logoCache) {
    logoCache = fetch("/assets/logo-full.jpeg")
      .then((response) => (response.ok ? response.blob() : null))
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            if (!blob) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => null);
  }
  return logoCache;
}

function timeLabel(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

function generatedStamp() {
  const now = new Date();
  return `${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function dateRange(plan: InvigilationPlan) {
  const days = [...new Set(plan.duties.map((duty) => duty.date))].sort();
  if (days.length === 0) return "";
  return days.length === 1
    ? shortDate(days[0])
    : `${shortDate(days[0])} to ${shortDate(days[days.length - 1])}`;
}

function drawLetter(
  doc: jsPDF,
  logo: string | null,
  plan: InvigilationPlan,
  letter: InvigilatorLetter,
  reference: string,
) {
  const { invigilator, lines } = letter;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const width = Math.min(48, (14 * props.width) / Math.max(1, props.height));
      doc.addImage(logo, "JPEG", margin, 10, width, (width * props.height) / props.width);
    } catch {
      /* printed without the logo */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${university.researchOffice} · ${university.name}`, pageW - margin, 15, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(university.email, pageW - margin, 19.5, { align: "right" });
  doc.setLineWidth(0.4);
  doc.line(margin, 27, pageW - margin, 27);

  let y = 35;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text((plan.examination || scopeLabel[plan.scope]).toUpperCase(), pageW / 2, y, {
    align: "center",
  });
  y += 7;
  doc.setFontSize(11);
  doc.text("INVIGILATION ASSIGNMENT", pageW / 2, y, { align: "center" });
  y += 4;
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 30, y, pageW / 2 + 30, y);

  y += 9;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Ref: ${reference}`, margin, y);
  doc.text(`Date: ${shortDate(plan.finalisedOn)}`, pageW - margin, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Dear ${invigilator.name} (${invigilator.id}),`, margin, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text(
    "Thank you for your continued support to the examinations of the University.",
    margin,
    y,
  );
  y += 6;
  doc.text(
    "You are assigned the following invigilations on the dates and sessions indicated below:",
    margin,
    y,
  );
  y += 4;

  const columns = [
    { title: "Date", width: 32 },
    { title: "Session", width: 52 },
    { title: "Hall", width: innerW - 84 },
  ];
  const rowHeight = 7;
  const drawRow = (cells: string[], bold: boolean) => {
    let x = margin;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    cells.forEach((cell, index) => {
      doc.rect(x, y, columns[index].width, rowHeight);
      const text = doc.splitTextToSize(cell, columns[index].width - 3)[0] as string;
      doc.text(text, x + 1.5, y + 4.8);
      x += columns[index].width;
    });
    y += rowHeight;
  };
  drawRow(
    columns.map((column) => column.title),
    true,
  );
  for (const line of lines) {
    if (y > 235) {
      doc.addPage();
      y = 20;
      drawRow(
        columns.map((column) => column.title),
        true,
      );
    }
    drawRow(
      [shortDate(line.date), line.time ? timeLabel(line.time) : "", line.hall],
      line.reserved,
    );
  }

  y += 5;
  doc.setLineWidth(0.3);
  doc.rect(margin, y, innerW, 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Examination dates: ${dateRange(plan)}`, pageW / 2, y + 4.8, {
    align: "center",
  });
  y += 12;

  doc.setFontSize(9);
  for (const item of letterInstructions(plan.chiefSuperintendent)) {
    const body = doc.splitTextToSize(item.text, innerW - 3) as string[];
    if (y + 4 + body.length * 4 > 268) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${item.heading}:`, margin, y);
    y += 4.2;
    doc.setFont("helvetica", "normal");
    doc.text(body, margin, y, { align: "left" });
    y += body.length * 4 + 1.8;
  }
}

function drawFooters(doc: jsPDF, reference: (page: number) => string) {
  const pages = doc.getNumberOfPages();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, height - 14, pageW - margin, height - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(
      "This is a system-generated letter and does not need a signature.",
      margin,
      height - 9.5,
    );
    doc.text(
      `${reference(page)} · Generated ${generatedStamp()}`,
      pageW - margin,
      height - 9.5,
      {
        align: "right",
      },
    );
  }
}

/**
 * One A4 letter for each invigilator, in one PDF, in the University's plain black-and-white
 * style. There are no signature blocks: the footer says the letter is system-generated.
 */
export async function downloadInvigilatorLetters(
  plan: InvigilationPlan,
  letters: readonly InvigilatorLetter[],
  filename: string,
) {
  if (letters.length === 0) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  const pageOwner: string[] = [];
  letters.forEach((letter, index) => {
    if (index > 0) doc.addPage();
    const before = doc.getNumberOfPages();
    drawLetter(
      doc,
      logo,
      plan,
      letter,
      `INV/${plan.scope === "entrance" ? "ENT" : "CW"}/${letter.invigilator.id}`,
    );
    for (let page = before; page <= doc.getNumberOfPages(); page += 1) {
      pageOwner[page] =
        `INV/${plan.scope === "entrance" ? "ENT" : "CW"}/${letter.invigilator.id}`;
    }
  });
  drawFooters(doc, (page) => pageOwner[page] ?? "");
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
