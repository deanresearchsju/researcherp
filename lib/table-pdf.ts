"use client";

import type { jsPDF } from "jspdf";

import { university } from "@/lib/constants";

export type TablePdfInput = {
  title: string;
  /** Filters and search applied, one line each. */
  criteria: readonly string[];
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  filename: string;
  generatedBy?: string;
};

const margin = 12;
const fontSize = 8;
const lineHeight = 3.6;
const cellPadding = 1.6;
const headerTop = 34;
const footerHeight = 14;

let logoCache: Promise<{ data: string; ratio: number } | null> | null = null;

function loadLogo() {
  if (!logoCache) {
    logoCache = fetch("/assets/logo-full.jpeg")
      .then((response) => (response.ok ? response.blob() : null))
      .then(
        (blob) =>
          new Promise<{ data: string; ratio: number } | null>((resolve) => {
            if (!blob) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => {
              const data = String(reader.result ?? "");
              const image = new Image();
              image.onload = () =>
                resolve({
                  data,
                  ratio: image.naturalWidth / Math.max(1, image.naturalHeight),
                });
              image.onerror = () => resolve(null);
              image.src = data;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => null);
  }
  return logoCache;
}

function stamp() {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** "supervisor_name" → "Supervisor Name"; headings that already read well are kept. */
function readableHeader(header: string) {
  if (!/_/.test(header) && header !== header.toLowerCase()) return header;
  return header
    .replace(/_/g, " ")
    .trim()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

/** A first column that is already a serial number, so the report does not add a second. */
function isSerialHeader(header: string) {
  const key = header.toLowerCase().replace(/[^a-z]/g, "");
  return ["sno", "slno", "serialno", "serialnumber", "serial", "no"].includes(key);
}

/** Natural width of each column in mm, capped so one long cell cannot take the page. */
function naturalWidths(
  doc: jsPDF,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
) {
  doc.setFontSize(fontSize);
  return headers.map((header, column) => {
    doc.setFont("helvetica", "bold");
    let width = doc.getTextWidth(header);
    doc.setFont("helvetica", "normal");
    for (const row of rows.slice(0, 400)) {
      width = Math.max(width, doc.getTextWidth(row[column] ?? ""));
    }
    return Math.min(Math.max(width + cellPadding * 2, 10), 70);
  });
}

/**
 * A printable report of the rows on screen: letterhead, title, applied filters, a table that
 * repeats its header on each page, signature lines, and a footer with page numbers.
 * Portrait or landscape is chosen from the width the columns need.
 */
export async function downloadTablePdf(input: TablePdfInput) {
  const { jsPDF } = await import("jspdf");
  const named = input.headers.map(readableHeader);
  const hasSerial = named.length > 0 && isSerialHeader(named[0]);
  const headers = hasSerial ? ["S. No.", ...named.slice(1)] : ["S. No.", ...named];
  const rows = hasSerial
    ? input.rows.map((row) => [...row])
    : input.rows.map((row, index) => [String(index + 1), ...row]);

  const probe = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const natural = naturalWidths(probe, headers, rows);
  const total = natural.reduce((sum, width) => sum + width, 0);
  const portraitWidth = 210 - margin * 2;
  const orientation =
    total > portraitWidth * 1.05 || headers.length > 8 ? "landscape" : "portrait";

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usable = pageWidth - margin * 2;
  const scale = usable / total;
  const widths = natural.map((width) => width * scale);
  const logo = await loadLogo();

  const drawLetterhead = () => {
    if (logo) {
      const height = 13;
      const width = Math.min(height * logo.ratio, 60);
      doc.addImage(logo.data, "JPEG", margin, 8, width, width / logo.ratio);
    }
    doc.setTextColor(60, 20, 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(university.researchOffice, pageWidth - margin, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("Office of the Dean", pageWidth - margin, 17, { align: "right" });
    doc.text(university.email, pageWidth - margin, 21.5, { align: "right" });
    doc.setDrawColor(200, 160, 40);
    doc.setLineWidth(0.6);
    doc.line(margin, 25, pageWidth - margin, 25);
    doc.setDrawColor(90, 40, 130);
    doc.setLineWidth(0.2);
    doc.line(margin, 26, pageWidth - margin, 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 20, 70);
    doc.text(input.title.toUpperCase(), pageWidth / 2, 31.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
  };

  const drawTableHeader = (y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    const lines = headers.map(
      (header, column) =>
        doc.splitTextToSize(header, widths[column] - cellPadding * 2) as string[],
    );
    const height =
      Math.max(...lines.map((item) => item.length)) * lineHeight + cellPadding * 2;
    doc.setFillColor(90, 40, 130);
    doc.rect(margin, y, usable, height, "F");
    doc.setTextColor(255, 255, 255);
    let x = margin;
    lines.forEach((cell, column) => {
      doc.text(cell, x + cellPadding, y + cellPadding + lineHeight - 0.8);
      x += widths[column];
    });
    doc.setTextColor(0, 0, 0);
    return y + height;
  };

  drawLetterhead();
  let y = headerTop + 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const criteria = input.criteria.length > 0 ? input.criteria : ["All records"];
  for (const line of criteria) {
    const wrapped = doc.splitTextToSize(line, usable) as string[];
    doc.text(wrapped, margin, y);
    y += wrapped.length * 3.8;
  }
  doc.text(`Records: ${rows.length}`, margin, y);
  y += 4;
  y = drawTableHeader(y);

  const bottom = pageHeight - footerHeight - 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  rows.forEach((row, index) => {
    const cells = headers.map(
      (_, column) =>
        doc.splitTextToSize(
          row[column] ?? "",
          widths[column] - cellPadding * 2,
        ) as string[],
    );
    const height =
      Math.max(...cells.map((item) => item.length)) * lineHeight + cellPadding * 2;
    if (y + height > bottom) {
      doc.addPage();
      drawLetterhead();
      y = drawTableHeader(headerTop + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
    }
    if (index % 2 === 1) {
      doc.setFillColor(246, 243, 250);
      doc.rect(margin, y, usable, height, "F");
    }
    doc.setDrawColor(220, 215, 230);
    doc.setLineWidth(0.1);
    doc.line(margin, y + height, margin + usable, y + height);
    let x = margin;
    cells.forEach((cell, column) => {
      doc.text(cell, x + cellPadding, y + cellPadding + lineHeight - 0.8);
      x += widths[column];
    });
    y += height;
  });
  if (rows.length === 0) {
    doc.text("No records match the selected filters.", margin, y + 6);
    y += 8;
  }

  // Signature block on the last page.
  if (y + 24 > bottom) {
    doc.addPage();
    drawLetterhead();
    y = headerTop + 4;
  }
  y += 18;
  doc.setFontSize(9);
  const slots = ["Prepared by", "Verified by", "Dean Research"];
  const slotWidth = usable / slots.length;
  slots.forEach((label, index) => {
    const x = margin + slotWidth * index;
    doc.setDrawColor(120, 120, 120);
    doc.line(x + 6, y, x + slotWidth - 6, y);
    doc.text(label, x + slotWidth / 2, y + 4.5, { align: "center" });
  });

  const pages = doc.getNumberOfPages();
  const generated = `Generated on ${stamp()}${input.generatedBy ? ` by ${input.generatedBy}` : ""}`;
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const footerY = pageHeight - footerHeight + 4;
    doc.setDrawColor(90, 40, 130);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(generated, margin, footerY + 1);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, footerY + 1, {
      align: "right",
    });
    doc.text(
      `${university.name} · ${university.researchOffice} · System-generated report`,
      pageWidth / 2,
      footerY + 5.5,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);
  }

  doc.save(input.filename.replace(/\.csv$/i, "") + ".pdf");
}
