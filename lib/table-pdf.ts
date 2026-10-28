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

const margin = 10;
const fontSize = 7.5;
const lineHeight = 3.2;
const cellPadding = 1.1;
const headerTop = 25;
const footerHeight = 18;

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
  const logo = await loadLogo();

  // A table too wide for one sheet is printed in column groups, each page group repeating the
  // serial number and the name, so no column is squeezed until its text breaks letter by letter.
  const nameColumn = Math.max(
    1,
    headers.findIndex(
      (header, index) => index > 0 && /name|scholar|candidate/i.test(header),
    ),
  );
  const keyColumns = headers.length > 2 ? [0, nameColumn] : [0];
  const keyWidth = keyColumns.reduce((sum, column) => sum + natural[column], 0);
  const groups: number[][] = [];
  if (total <= usable * 1.02) {
    groups.push(headers.map((_, column) => column));
  } else {
    let current: number[] = [];
    let used = keyWidth;
    headers.forEach((_, column) => {
      if (keyColumns.includes(column)) return;
      const width = Math.min(natural[column], usable - keyWidth);
      if (current.length > 0 && used + width > usable) {
        groups.push([...keyColumns, ...current]);
        current = [];
        used = keyWidth;
      }
      current.push(column);
      used += width;
    });
    if (current.length > 0) groups.push([...keyColumns, ...current]);
  }

  const drawLetterhead = () => {
    if (logo) {
      const height = 9;
      const width = Math.min(height * logo.ratio, 50);
      doc.addImage(logo.data, "JPEG", margin, 6, width, width / logo.ratio);
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `${university.researchOffice} · Office of the Dean`,
      pageWidth - margin,
      9.5,
      {
        align: "right",
      },
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(university.email, pageWidth - margin, 13.5, { align: "right" });
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, 17, pageWidth - margin, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(input.title.toUpperCase(), pageWidth / 2, 22.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
  };

  /** The filters and totals as a row of small boxes, label above value. */
  const drawDetailBoxes = (
    items: readonly { label: string; value: string }[],
    top: number,
  ) => {
    const perRow = Math.min(items.length, 4);
    const boxWidth = usable / perRow;
    let bottomY = top;
    for (let start = 0; start < items.length; start += perRow) {
      const row = items.slice(start, start + perRow);
      const wrapped = row.map((item) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        return doc.splitTextToSize(item.value, boxWidth - 4) as string[];
      });
      const height = 5.5 + Math.max(...wrapped.map((lines) => lines.length)) * 3.6 + 1.2;
      row.forEach((item, index) => {
        const x = margin + index * boxWidth;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(x, bottomY, boxWidth, height);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(90, 90, 90);
        doc.text(item.label.toUpperCase(), x + boxWidth / 2, bottomY + 3.2, {
          align: "center",
        });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(wrapped[index], x + boxWidth / 2, bottomY + 7, { align: "center" });
      });
      doc.setTextColor(0, 0, 0);
      bottomY += height;
    }
    return bottomY;
  };

  const bottom = pageHeight - footerHeight - 2;
  let y = headerTop + 2;

  groups.forEach((group, groupIndex) => {
    const groupNatural = group.map((column) => Math.min(natural[column], usable));
    const groupTotal = groupNatural.reduce((sum, width) => sum + width, 0);
    const scale = Math.min(usable / groupTotal, 3);
    const widths = groupNatural.map((width) => width * scale);
    const tableWidth = groupTotal * scale;
    const groupHeaders = group.map((column) => headers[column]);

    const drawTableHeader = (top: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize);
      const lines = groupHeaders.map(
        (header, column) =>
          doc.splitTextToSize(header, widths[column] - cellPadding * 2) as string[],
      );
      const height =
        Math.max(...lines.map((item) => item.length)) * lineHeight + cellPadding * 2;
      doc.setFillColor(242, 242, 242);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.rect(margin, top, tableWidth, height, "F");
      doc.setTextColor(0, 0, 0);
      let x = margin;
      lines.forEach((cell, column) => {
        doc.rect(x, top, widths[column], height);
        doc.text(cell, x + widths[column] / 2, top + cellPadding + lineHeight - 0.8, {
          align: "center",
        });
        x += widths[column];
      });
      return top + height;
    };

    if (groupIndex === 0) {
      drawLetterhead();
      y = headerTop + 2;
    } else {
      doc.addPage();
      drawLetterhead();
      y = headerTop + 2;
    }
    const details: { label: string; value: string }[] = [];
    if (groupIndex === 0) {
      const criteria = input.criteria.length > 0 ? input.criteria : ["All records"];
      for (const line of criteria) {
        const match = /^([^:]{1,30}):\s*(.+)$/.exec(line);
        details.push(
          match
            ? { label: match[1], value: match[2] }
            : { label: "Selection", value: line },
        );
      }
    }
    details.push({
      label: "Records",
      value:
        groups.length > 1
          ? `${rows.length} · Columns, part ${groupIndex + 1} of ${groups.length}`
          : String(rows.length),
    });
    y = drawDetailBoxes(details, y) + 3;
    y = drawTableHeader(y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    rows.forEach((row) => {
      const cells = group.map(
        (column, position) =>
          doc.splitTextToSize(
            row[column] ?? "",
            widths[position] - cellPadding * 2,
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
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      let x = margin;
      cells.forEach((cell, position) => {
        doc.rect(x, y, widths[position], height);
        doc.text(cell, x + cellPadding, y + cellPadding + lineHeight - 0.8);
        x += widths[position];
      });
      y += height;
    });
    if (rows.length === 0) {
      doc.text("No records match the selected filters.", margin, y + 6);
      y += 8;
    }
  });

  // Signature block on the last page.
  if (y + 18 > bottom) {
    doc.addPage();
    drawLetterhead();
    y = headerTop + 4;
  }
  y += 12;
  doc.setFontSize(8);
  const slots = ["Prepared by", "Verified by", "Dean Research"];
  const slotWidth = usable / slots.length;
  slots.forEach((label, index) => {
    const x = margin + slotWidth * index;
    doc.setDrawColor(0, 0, 0);
    doc.line(x + 6, y, x + slotWidth - 6, y);
    doc.text(label, x + slotWidth / 2, y + 4.5, { align: "center" });
  });

  const pages = doc.getNumberOfPages();
  const generated = `Generated on ${stamp()}${input.generatedBy ? ` by ${input.generatedBy}` : ""}`;
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const footerY = pageHeight - footerHeight + 4;
    doc.setDrawColor(0, 0, 0);
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
