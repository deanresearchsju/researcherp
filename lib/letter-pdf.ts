import type { jsPDF } from "jspdf";

import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import type { LetterDraft } from "@/lib/doctoral";

export type LetterSigner = { name: string; title: string; signature?: string };

const pageW = 210;
const pageH = 297;
const margin = 15;
const innerW = pageW - margin * 2;
const bottom = 276;
const ink: [number, number, number] = [28, 23, 48];
const purple: [number, number, number] = [91, 42, 134];
const gold: [number, number, number] = [242, 194, 48];
const muted: [number, number, number] = [110, 100, 130];
const baseLine = 4.9;

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

function footer(doc: jsPDF, refNo: string, systemGenerated = false) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(
      systemGenerated
        ? "System-generated letter. It does not need a signature."
        : `${university.researchOffice}, ${university.name}`,
      margin,
      pageH - 8,
    );
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

/**
 * Draws the letter at one size. `k` scales the text and spacing: 1 is the normal size, and
 * smaller values are tried so that an ordinary letter keeps its header, body, signature and
 * footer on one A4 page.
 */
function renderLetter(
  jsPDFClass: typeof import("jspdf").jsPDF,
  letter: LetterDraft,
  signer: LetterSigner | null,
  logo: string | null,
  k: number,
) {
  const doc = new jsPDFClass({ unit: "mm", format: "a4", orientation: "portrait" });
  letterhead(doc, logo);
  const line = baseLine * k;
  const size = 10.2 * k;

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
    doc.setFontSize((options.size ?? 10.2) * k);
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
    doc.setFontSize(12.5 * k);
    doc.setTextColor(...purple);
    doc.text(letter.title.toUpperCase(), pageW / 2, y, { align: "center" });
    y += 9 * k;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...ink);
  doc.text(`Ref: ${letter.refNo}`, margin, y);
  doc.text(`Dated: ${formatIsoDate(letter.issuedOn)}`, pageW - margin, y, {
    align: "right",
  });
  y += 10 * k;

  const to = letter.toLines.filter((row) => row.trim());
  if (to.length > 0) {
    write("To");
    to.forEach((row, index) => write(row, { bold: index === 0, indent: 6 }));
    y += 4 * k;
  }
  if (letter.subject.trim()) {
    write(`Sub.: ${letter.subject.trim()}`, { bold: true });
    y += 1 * k;
  }
  if (letter.reference.trim()) {
    write(`Ref.: ${letter.reference.trim()}`);
    y += 2 * k;
  }

  const details = letter.details.filter((row) => row.label.trim() || row.value.trim());
  if (details.length > 0) {
    y += 2 * k;
    const labelW = 52;
    for (const row of details) {
      doc.setFontSize(9.8 * k);
      const valueLines = doc.splitTextToSize(
        row.value || "—",
        innerW - labelW - 6,
      ) as string[];
      const height = Math.max(valueLines.length, 1) * 4.6 * k + 2.6 * k;
      room(height);
      doc.setFillColor(246, 242, 250);
      doc.rect(margin, y - 4.2 * k, labelW, height, "F");
      doc.setDrawColor(220, 210, 232);
      doc.setLineWidth(0.2);
      doc.rect(margin, y - 4.2 * k, innerW, height);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...purple);
      doc.text(row.label, margin + 2.5, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...ink);
      doc.text(valueLines, margin + labelW + 3, y);
      y += height;
    }
    y += 4 * k;
  }

  for (const paragraph of letter.body) {
    const rows = paragraph.split("\n").map((row) => row.trimEnd());
    for (const row of rows) {
      if (!row.trim()) continue;
      if (row.trimStart().startsWith("- ")) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
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
    y += 2.4 * k;
  }

  if (signer) {
    // The closing, signature, name and designation sit in one block on the right, all centred
    // on the same line so the signature lines up with the name beneath it.
    room(36 * k);
    y += 2 * k;
    const blockW = 70;
    const centre = pageW - margin - blockW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...ink);
    doc.text(letter.closing || "Best wishes,", centre, y, { align: "center" });
    const signY = y + 2 * k;
    if (signer.signature) fit(doc, signer.signature, centre - 25, signY, 50, 16 * k);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(signer.name || "Dean Research", centre, signY + 21 * k, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9 * k);
    const titleRows = doc.splitTextToSize(
      signer.title || "Dean Research",
      blockW,
    ) as string[];
    doc.text(titleRows, centre, signY + 25.5 * k, { align: "center" });
    y = signY + (25.5 + titleRows.length * 4) * k + 4 * k;
  }

  const copies = letter.copyTo.filter((row) => row.trim());
  if (copies.length > 0) {
    room(8 * k + copies.length * line);
    write("Copy to:", { bold: true, size: 9.5 });
    copies.forEach((row, index) =>
      write(`${index + 1}. ${row}`, { indent: 4, size: 9.5 }),
    );
  }

  footer(doc, letter.refNo, signer === null);
  return doc;
}

/**
 * Builds the letter. With no signer (a system-generated letter) there is no closing or
 * signature block, and the footer says the letter needs no signature.
 */
export async function buildLetter(source: LetterDraft, signer: LetterSigner | null) {
  const letter = printable(source);
  const { jsPDF } = await import("jspdf");
  const logo = await fetchAsDataUrl("/assets/logo-sju.jpg");
  // An ordinary letter is fitted onto one A4 page by trying slightly smaller text.
  for (const k of [1, 0.96, 0.92, 0.88, 0.84, 0.8]) {
    const doc = renderLetter(jsPDF, letter, signer, logo, k);
    if (doc.getNumberOfPages() === 1) return doc;
  }
  // A very long letter runs onto more pages, each with its header and footer inside A4.
  return renderLetter(jsPDF, letter, signer, logo, 1);
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
