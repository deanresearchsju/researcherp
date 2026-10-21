import type { jsPDF } from "jspdf";

import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import type { LetterDraft } from "@/lib/doctoral";

export type LetterSigner = { name: string; title: string; signature?: string };

const pageW = 210;
const pageH = 297;
const margin = 22;
const innerW = pageW - margin * 2;
const bottom = 276;
const ink: [number, number, number] = [28, 23, 48];
const purple: [number, number, number] = [91, 42, 134];
const gold: [number, number, number] = [242, 194, 48];
const muted: [number, number, number] = [110, 100, 130];
const line = 4.9;

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

function fit(doc: jsPDF, src: string, x: number, y: number, w: number, h: number) {
  try {
    const props = doc.getImageProperties(src);
    const ratio = props.width / Math.max(props.height, 1);
    let width = w;
    let height = w / ratio;
    if (height > h) {
      height = h;
      width = h * ratio;
    }
    doc.addImage(
      src,
      src.includes("image/png") ? "PNG" : "JPEG",
      x,
      y + (h - height) / 2,
      width,
      height,
    );
  } catch {
    /* printed without the image */
  }
}

function letterhead(doc: jsPDF, logo: string | null) {
  if (logo) fit(doc, logo, margin, 12, 60, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...purple);
  doc.text("Office of the Dean Research", pageW - margin, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  doc.text(`${university.researchOffice}, ${university.name}`, pageW - margin, 25, {
    align: "right",
  });
  doc.text(university.email, pageW - margin, 29.5, { align: "right" });
  doc.setFillColor(...gold);
  doc.rect(margin, 35, innerW, 0.8, "F");
  doc.setFillColor(...purple);
  doc.rect(margin, 35.8, innerW, 1.2, "F");
}

function footer(doc: jsPDF, refNo: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(`${university.researchOffice}, ${university.name}`, margin, pageH - 8);
    doc.text(
      `${refNo}${pages > 1 ? `  ·  Page ${page} of ${pages}` : ""}`,
      pageW - margin,
      pageH - 8,
      { align: "right" },
    );
  }
}

/** Renders any official letter of the research office as an A4 PDF. */
/** The standard PDF fonts have no rupee sign; print "Rs." instead. */
function printable(letter: LetterDraft): LetterDraft {
  const clean = (value: string) => value.replace(/₹\s?/g, "Rs. ");
  return {
    ...letter,
    title: clean(letter.title),
    toLines: letter.toLines.map(clean),
    subject: clean(letter.subject),
    reference: clean(letter.reference),
    details: letter.details.map((row) => ({
      label: clean(row.label),
      value: clean(row.value),
    })),
    body: letter.body.map(clean),
    closing: clean(letter.closing),
    copyTo: letter.copyTo.map(clean),
  };
}

export async function buildLetter(source: LetterDraft, signer: LetterSigner) {
  const letter = printable(source);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const logo = await fetchAsDataUrl("/assets/logo-sju.jpg");
  letterhead(doc, logo);

  let y = 46;
  const room = (needed: number) => {
    if (y + needed <= bottom) return;
    doc.addPage();
    y = 26;
  };
  const write = (
    text: string,
    options: { bold?: boolean; indent?: number; size?: number } = {},
  ) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size ?? 10.2);
    doc.setTextColor(...ink);
    const x = margin + (options.indent ?? 0);
    const lines = doc.splitTextToSize(text, innerW - (options.indent ?? 0)) as string[];
    for (const row of lines) {
      room(line);
      doc.text(row, x, y);
      y += line;
    }
  };

  if (letter.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...purple);
    doc.text(letter.title.toUpperCase(), pageW / 2, y, { align: "center" });
    y += 9;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.2);
  doc.setTextColor(...ink);
  doc.text(`Ref: ${letter.refNo}`, margin, y);
  doc.text(`Dated: ${formatIsoDate(letter.issuedOn)}`, pageW - margin, y, {
    align: "right",
  });
  y += 10;

  const to = letter.toLines.filter((row) => row.trim());
  if (to.length > 0) {
    write("To");
    to.forEach((row, index) => write(row, { bold: index === 0, indent: 6 }));
    y += 4;
  }
  if (letter.subject.trim()) {
    write(`Sub.: ${letter.subject.trim()}`, { bold: true });
    y += 1;
  }
  if (letter.reference.trim()) {
    write(`Ref.: ${letter.reference.trim()}`);
    y += 2;
  }

  const details = letter.details.filter((row) => row.label.trim() || row.value.trim());
  if (details.length > 0) {
    y += 2;
    const labelW = 52;
    for (const row of details) {
      doc.setFontSize(9.8);
      const valueLines = doc.splitTextToSize(
        row.value || "—",
        innerW - labelW - 6,
      ) as string[];
      const height = Math.max(valueLines.length, 1) * 4.6 + 2.6;
      room(height);
      doc.setFillColor(246, 242, 250);
      doc.rect(margin, y - 4.2, labelW, height, "F");
      doc.setDrawColor(220, 210, 232);
      doc.setLineWidth(0.2);
      doc.rect(margin, y - 4.2, innerW, height);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...purple);
      doc.text(row.label, margin + 2.5, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...ink);
      doc.text(valueLines, margin + labelW + 3, y);
      y += height;
    }
    y += 4;
  }

  for (const paragraph of letter.body) {
    const rows = paragraph.split("\n").map((row) => row.trimEnd());
    for (const row of rows) {
      if (!row.trim()) continue;
      if (row.trimStart().startsWith("- ")) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.2);
        const text = row.trimStart().slice(2);
        const wrapped = doc.splitTextToSize(text, innerW - 8) as string[];
        wrapped.forEach((part, index) => {
          room(line);
          if (index === 0) doc.text("•", margin + 2, y);
          doc.text(part, margin + 7, y);
          y += line;
        });
      } else {
        write(row);
      }
    }
    y += 2.4;
  }

  room(34);
  y += 1;
  write(letter.closing || "Best wishes,");
  const signY = y;
  if (signer.signature) fit(doc, signer.signature, pageW - margin - 50, signY, 50, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.text(signer.name || "Dean Research", pageW - margin, signY + 22, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(signer.title || "Dean Research", pageW - margin, signY + 27, {
    align: "right",
  });
  y = signY + 34;

  const copies = letter.copyTo.filter((row) => row.trim());
  if (copies.length > 0) {
    room(8 + copies.length * line);
    write("Copy to:", { bold: true, size: 9.5 });
    copies.forEach((row, index) =>
      write(`${index + 1}. ${row}`, { indent: 4, size: 9.5 }),
    );
  }

  footer(doc, letter.refNo);
  return doc;
}

export function letterFileName(letter: LetterDraft) {
  const who = (letter.recipientName || letter.recipientIdentifier).replace(
    /[^\w]+/g,
    "-",
  );
  return `${letter.kind}-letter-${who}.pdf`;
}

export async function downloadLetter(letter: LetterDraft, signer: LetterSigner) {
  const doc = await buildLetter(letter, signer);
  doc.save(letterFileName(letter));
}

/** Data URL of the letter, for the in-page preview. */
export async function letterDataUrl(letter: LetterDraft, signer: LetterSigner) {
  const doc = await buildLetter(letter, signer);
  return doc.output("datauristring");
}
