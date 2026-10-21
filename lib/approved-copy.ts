"use client";

import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";

export type ApprovalStep = { label: string; by: string; on: string; note?: string };

export type ApprovalStamp = {
  /** What was approved, e.g. "First doctoral committee report". */
  title: string;
  scholarName: string;
  scholarId?: string;
  reference?: string;
  approvedOn: string;
  approvedBy: string;
  steps?: readonly ApprovalStep[];
  details?: readonly { label: string; value: string }[];
};

function bytesFromDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function dateLabel(value: string) {
  return value ? formatIsoDate(value.slice(0, 10)) : "—";
}

async function logoBytes() {
  try {
    const response = await fetch("/assets/logo-full.jpeg");
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** Width-limited lines for pdf-lib text drawing. */
function wrap(
  text: string,
  width: number,
  size: number,
  measure: (t: string, s: number) => number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Downloads the approved document: the uploaded file with an APPROVED stamp on the first page,
 * an approval line on every page, and a closing approval record page.
 */
export async function buildApprovedCopy(
  fileData: string | null | undefined,
  fileName: string | null | undefined,
  stamp: ApprovalStamp,
  logo: Uint8Array | null = null,
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const purple = rgb(0.35, 0.16, 0.51);
  const gold = rgb(0.78, 0.6, 0.15);
  const green = rgb(0.1, 0.45, 0.25);
  const grey = rgb(0.35, 0.35, 0.35);

  let doc = await PDFDocument.create();
  const data = fileData ?? "";
  if (data.startsWith("data:application/pdf")) {
    doc = await PDFDocument.load(bytesFromDataUrl(data), { ignoreEncryption: true });
  } else if (data.startsWith("data:image/")) {
    const bytes = bytesFromDataUrl(data);
    const image = data.startsWith("data:image/png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    const page = doc.addPage([595.28, 841.89]);
    const scale = Math.min(515 / image.width, 720 / image.height, 1);
    page.drawImage(image, {
      x: (595.28 - image.width * scale) / 2,
      y: 841.89 - 60 - image.height * scale,
      width: image.width * scale,
      height: image.height * scale,
    });
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const measure = (text: string, size: number) => font.widthOfTextAtSize(text, size);
  const approvedLine = `Approved on ${dateLabel(stamp.approvedOn)} by ${stamp.approvedBy} · ${university.researchOffice}, ${university.name}${
    stamp.reference ? ` · Ref ${stamp.reference}` : ""
  }`;

  // Stamp the uploaded pages.
  const uploaded = doc.getPages();
  uploaded.forEach((page, index) => {
    const { width } = page.getSize();
    page.drawRectangle({ x: 0, y: 0, width, height: 18, color: rgb(0.96, 0.94, 0.98) });
    page.drawText(approvedLine.slice(0, 160), {
      x: 14,
      y: 6,
      size: 7,
      font,
      color: purple,
    });
    page.drawText(`Page ${index + 1} of ${uploaded.length}`, {
      x: width - 60,
      y: 6,
      size: 7,
      font,
      color: grey,
    });
    if (index === 0) {
      const boxWidth = 168;
      const x = width - boxWidth - 18;
      const y = page.getSize().height - 74;
      page.drawRectangle({
        x,
        y,
        width: boxWidth,
        height: 58,
        borderColor: green,
        borderWidth: 1.6,
        color: rgb(1, 1, 1),
        opacity: 0.92,
        borderOpacity: 1,
      });
      page.drawText("APPROVED", {
        x: x + 10,
        y: y + 38,
        size: 15,
        font: bold,
        color: green,
      });
      page.drawText(dateLabel(stamp.approvedOn), {
        x: x + 10,
        y: y + 24,
        size: 8.5,
        font,
        color: green,
      });
      page.drawText(stamp.approvedBy.slice(0, 34), {
        x: x + 10,
        y: y + 13,
        size: 8,
        font,
        color: green,
      });
      page.drawText("Office of the Dean · Center for Research", {
        x: x + 10,
        y: y + 3.5,
        size: 6.2,
        font,
        color: green,
      });
    }
  });

  // Approval record page.
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  let y = height - 50;
  if (logo) {
    try {
      const image = await doc.embedJpg(logo);
      const scale = 40 / image.height;
      page.drawImage(image, { x: 40, y: y - 30, width: image.width * scale, height: 40 });
    } catch {
      // Logo is decorative.
    }
  }
  page.drawText(university.researchOffice, {
    x: width - 40 - bold.widthOfTextAtSize(university.researchOffice, 13),
    y: y,
    size: 13,
    font: bold,
    color: purple,
  });
  page.drawText("Office of the Dean", {
    x: width - 40 - font.widthOfTextAtSize("Office of the Dean", 10),
    y: y - 15,
    size: 10,
    font,
    color: purple,
  });
  y -= 44;
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 1.4,
    color: gold,
  });
  page.drawLine({
    start: { x: 40, y: y - 3 },
    end: { x: width - 40, y: y - 3 },
    thickness: 0.4,
    color: purple,
  });
  y -= 30;
  const heading = "APPROVAL RECORD";
  page.drawText(heading, {
    x: (width - bold.widthOfTextAtSize(heading, 16)) / 2,
    y,
    size: 16,
    font: bold,
    color: purple,
  });
  y -= 18;
  for (const line of wrap(stamp.title, width - 120, 11, measure)) {
    page.drawText(line, {
      x: (width - measure(line, 11)) / 2,
      y,
      size: 11,
      font,
      color: grey,
    });
    y -= 14;
  }
  y -= 12;

  const rows: [string, string][] = [
    ["Scholar", stamp.scholarName],
    ...(stamp.scholarId ? ([["Scholar ID", stamp.scholarId]] as [string, string][]) : []),
    ...(stamp.details ?? []).map((item) => [item.label, item.value] as [string, string]),
    ["Document", fileName?.trim() || "Recorded by the research office"],
    ["Status", "APPROVED"],
    ["Approved on", dateLabel(stamp.approvedOn)],
    ["Approved by", stamp.approvedBy],
    ...(stamp.reference ? ([["Reference", stamp.reference]] as [string, string][]) : []),
  ];
  for (const [label, value] of rows) {
    page.drawRectangle({
      x: 40,
      y: y - 6,
      width: width - 80,
      height: 22,
      color: rgb(0.97, 0.96, 0.99),
    });
    page.drawText(label, { x: 50, y, size: 9.5, font: bold, color: purple });
    const lines = wrap(value || "—", width - 230, 9.5, measure);
    page.drawText(lines[0] ?? "—", {
      x: 190,
      y,
      size: 9.5,
      font: label === "Status" ? bold : font,
      color: label === "Status" ? green : rgb(0.1, 0.1, 0.1),
    });
    y -= 26;
  }

  if (stamp.steps && stamp.steps.length > 0) {
    y -= 8;
    page.drawText("Review trail", { x: 40, y, size: 11, font: bold, color: purple });
    y -= 18;
    stamp.steps.forEach((step, index) => {
      page.drawCircle({ x: 48, y: y + 3, size: 4, color: green });
      page.drawText(`${index + 1}. ${step.label}`, {
        x: 60,
        y,
        size: 9.5,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(`${step.by || "—"} · ${dateLabel(step.on)}`, {
        x: 300,
        y,
        size: 9.5,
        font,
        color: grey,
      });
      y -= 14;
      if (step.note) {
        for (const line of wrap(step.note, width - 120, 8.5, measure).slice(0, 3)) {
          page.drawText(line, { x: 60, y, size: 8.5, font, color: grey });
          y -= 11;
        }
      }
      y -= 4;
    });
  }

  // Signature and footer.
  page.drawLine({
    start: { x: width - 220, y: 130 },
    end: { x: width - 40, y: 130 },
    thickness: 0.6,
    color: grey,
  });
  page.drawText("Dean Research", {
    x: width - 170,
    y: 116,
    size: 10,
    font: bold,
    color: purple,
  });
  page.drawText(university.name, {
    x: width - 186,
    y: 103,
    size: 8.5,
    font,
    color: grey,
  });
  page.drawLine({
    start: { x: 40, y: 50 },
    end: { x: width - 40, y: 50 },
    thickness: 0.4,
    color: purple,
  });
  const footer = `System-generated approval record · ${university.name} · ${university.researchOffice} · Generated ${dateLabel(
    new Date().toISOString(),
  )}`;
  page.drawText(footer, {
    x: (width - measure(footer, 7.5)) / 2,
    y: 38,
    size: 7.5,
    font,
    color: grey,
  });

  return doc.save();
}

/** Builds the approved copy and saves it as "<file>-approved.pdf". */
export async function downloadApprovedCopy(
  fileData: string | null | undefined,
  fileName: string | null | undefined,
  stamp: ApprovalStamp,
) {
  const bytes = await buildApprovedCopy(fileData, fileName, stamp, await logoBytes());
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const base = (fileName?.replace(/\.[^.]+$/, "") || stamp.title).replace(
    /[^a-z0-9]+/gi,
    "-",
  );
  link.href = url;
  link.download = `${base.replace(/^-|-$/g, "")}-approved.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
