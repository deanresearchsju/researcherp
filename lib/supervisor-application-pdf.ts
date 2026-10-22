import { supervisorDeclaration } from "@/data/declarations";
import { supervisorEnclosures } from "@/data/documents";
import { supervisorSheetCopy } from "@/data/supervisor-application-sheet";
import { retirementAge, university } from "@/lib/constants";
import {
  ageParts,
  clientToday,
  formatAge,
  formatIsoDate,
  serviceUntilAge,
  sumDuration,
} from "@/lib/dates";
import type { SupervisorReceipt } from "@/lib/supervisor-application";
import type { SupervisorFormValues } from "@/lib/validation";
import type { jsPDF } from "jspdf";

const margin = 12;
const pageW = 210;
const pageH = 297;
const innerW = pageW - margin * 2;
const ink: [number, number, number] = [28, 23, 48];
const purple: [number, number, number] = [91, 42, 134];
const gold: [number, number, number] = [242, 194, 48];
const muted: [number, number, number] = [78, 71, 98];
const fill: [number, number, number] = [244, 239, 248];
const line: [number, number, number] = [28, 23, 48];

const enclosed = supervisorEnclosures.filter(
  (spec) => spec.id !== "photo" && spec.id !== "signature",
);

export function supervisorPdfFileName(applicationNo: string) {
  return `${applicationNo.replaceAll("/", "-")}.pdf`;
}

function dash(value: string) {
  return value.trim() || supervisorSheetCopy.none;
}

function addressOf(address: SupervisorFormValues["permanent"]) {
  return [
    address.door,
    address.street,
    address.city,
    address.district,
    address.state,
    address.pin,
    address.country,
  ]
    .filter((part) => part.trim())
    .join(", ");
}

function span(years: string, months: string) {
  return `${years || "0"} yrs, ${months || "0"} mo`;
}

function qualificationFilled(row: SupervisorFormValues["postgraduate"]) {
  return [row.degree, row.university, row.discipline, row.year, row.percentage].some(
    (part) => part.trim(),
  );
}

function imageFormat(src: string) {
  if (src.includes("image/png")) return "PNG";
  if (src.includes("image/webp")) return "WEBP";
  return "JPEG";
}

async function fetchAsDataUrl(src: string) {
  if (src.startsWith("data:")) return src;
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
}

function fitImage(
  doc: jsPDF,
  src: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
) {
  const props = doc.getImageProperties(src);
  const ratio = props.width / Math.max(props.height, 1);
  let width = boxW;
  let height = boxW / ratio;
  if (height > boxH) {
    height = boxH;
    width = boxH * ratio;
  }
  const left = x + (boxW - width) / 2;
  const top = y + (boxH - height) / 2;
  doc.addImage(src, imageFormat(src), left, top, width, height);
}

function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

async function buildPdf(receipt: SupervisorReceipt) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const { values } = receipt;
  const applied = formatIsoDate(receipt.submittedOn.slice(0, 10) || receipt.submittedOn);
  const printed = formatIsoDate(clientToday());
  const ageLabel = formatAge(ageParts(values.dateOfBirth));
  const remaining = formatAge(serviceUntilAge(values.dateOfBirth, retirementAge));
  const teaching = formatAge(
    sumDuration(values.preYears, values.preMonths, values.postYears, values.postMonths),
  );
  const communication = values.sameAddress
    ? supervisorSheetCopy.sameAddress
    : addressOf(values.communication);
  const recognised =
    values.recognisedElsewhere === "Yes"
      ? values.recognitionDetails
      : values.recognisedElsewhere;
  const papers = values.publications.filter((paper) => paper.title.trim());
  const other = values.otherInformation.trim();
  const logo = await fetchAsDataUrl("/assets/logo-sju.jpg");

  doc.setFillColor(...gold);
  doc.rect(margin, 8, innerW, 0.6, "F");
  doc.setFillColor(...purple);
  doc.rect(margin, 8.6, innerW, 1, "F");

  const headerTop = 10.5;
  const photoW = 22;
  const photoH = 28;
  const photoX = pageW - margin - photoW;
  const photoY = headerTop;
  if (logo) {
    try {
      fitImage(doc, logo, margin, headerTop + 4, 56, 20);
    } catch {
      /* letterhead still prints without the crest */
    }
  }

  doc.setTextColor(...purple);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(supervisorSheetCopy.formTitle, pageW / 2, headerTop + 9.2, {
    align: "center",
  });
  doc.setFontSize(7.5);
  doc.text(university.researchOffice, pageW / 2, headerTop + 14.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(supervisorSheetCopy.applicationNo, pageW / 2, headerTop + 19.2, {
    align: "center",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...purple);
  doc.text(receipt.applicationNo, pageW / 2, headerTop + 23.4, { align: "center" });

  doc.setDrawColor(...ink);
  doc.setLineWidth(0.3);
  doc.rect(photoX, photoY, photoW, photoH);
  if (receipt.photo) {
    try {
      fitImage(
        doc,
        receipt.photo,
        photoX + 0.4,
        photoY + 0.4,
        photoW - 0.8,
        photoH - 0.8,
      );
    } catch {
      /* photo box stays empty */
    }
  }

  let y = Math.max(headerTop + 26, photoY + photoH) + 1.8;
  doc.setFillColor(...gold);
  doc.rect(margin, y, innerW, 0.35, "F");
  y += 0.9;
  doc.setFillColor(...purple);
  doc.rect(margin, y, innerW, 0.6, "F");
  y += 1.6;

  let serial = 1;
  const cellPad = 1.1;
  const serialW = 6.5;
  const bodyW = innerW - serialW;
  const lineH = 2.8;

  function drawBox(x: number, top: number, w: number, h: number, shade = false) {
    doc.setDrawColor(...line);
    doc.setLineWidth(0.2);
    if (shade) {
      doc.setFillColor(...fill);
      doc.rect(x, top, w, h, "FD");
    } else {
      doc.rect(x, top, w, h);
    }
  }

  function wrapPair(label: string, value: string, width: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    return doc.splitTextToSize(`${label} : ${dash(value)}`, Math.max(width, 12));
  }

  function writePair(x: number, top: number, w: number, label: string, value: string) {
    const lines = wrapPair(label, value, w - cellPad * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...ink);
    doc.text(lines, x + cellPad, top + 3.1);
    return Array.isArray(lines) ? lines.length : 1;
  }

  function numberedRow(
    cells: Array<{ label: string; value: string; span?: number }>,
    minH = 5.8,
  ) {
    const colCount = cells.reduce((sum, cell) => sum + (cell.span ?? 1), 0) || 1;
    const unit = bodyW / colCount;
    let tallest = 1;
    cells.forEach((cell) => {
      const w = unit * (cell.span ?? 1) - cellPad * 2;
      const lines = wrapPair(cell.label, cell.value, w);
      tallest = Math.max(tallest, Array.isArray(lines) ? lines.length : 1);
    });
    const h = Math.max(minH, tallest * lineH + 2.2);
    drawBox(margin, y, serialW, h, true);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...purple);
    doc.text(String(serial), margin + serialW / 2, y + h / 2 + 1, { align: "center" });
    let x = margin + serialW;
    cells.forEach((cell) => {
      const w = unit * (cell.span ?? 1);
      drawBox(x, y, w, h);
      writePair(x, y, w, cell.label, cell.value);
      x += w;
    });
    y += h;
    serial += 1;
  }

  function numberedTable(
    title: string,
    headers: string[],
    rows: string[][],
    widths: number[],
  ) {
    const headerH = 4.4;
    const rowH = 4.6;
    const h = headerH + Math.max(rows.length, 1) * rowH + 4.2;
    drawBox(margin, y, serialW, h, true);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...purple);
    doc.text(String(serial), margin + serialW / 2, y + 4.2, { align: "center" });
    drawBox(margin + serialW, y, bodyW, h);
    doc.setFillColor(...fill);
    doc.rect(margin + serialW, y, bodyW, headerH, "F");
    doc.setDrawColor(...line);
    doc.rect(margin + serialW, y, bodyW, h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...ink);
    doc.text(title, margin + serialW + cellPad, y + 3);
    const tableTop = y + headerH;
    const scale = bodyW / widths.reduce((sum, item) => sum + item, 0);
    const cols = widths.map((item) => item * scale);
    doc.setFillColor(...fill);
    doc.rect(margin + serialW, tableTop, bodyW, 4.2, "F");
    let x = margin + serialW;
    headers.forEach((heading, index) => {
      const w = cols[index] ?? 0;
      doc.setDrawColor(...line);
      doc.rect(x, tableTop, w, 4.2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...ink);
      doc.text(heading, x + 0.8, tableTop + 2.8);
      x += w;
    });
    rows.forEach((row, rowIndex) => {
      const top = tableTop + 4.2 + rowIndex * rowH;
      let cellX = margin + serialW;
      row.forEach((cell, index) => {
        const w = cols[index] ?? 0;
        doc.rect(cellX, top, w, rowH);
        doc.setFont("helvetica", index === 0 ? "bold" : "normal");
        doc.setFontSize(6);
        const lines = doc.splitTextToSize(dash(cell), Math.max(w - 1.6, 8));
        const shown = Array.isArray(lines) ? lines.slice(0, 2) : [String(lines)];
        doc.text(shown, cellX + 0.8, top + 2.6);
        cellX += w;
      });
    });
    y += h;
    serial += 1;
  }

  numberedRow([{ label: supervisorSheetCopy.name, value: values.name }]);
  numberedRow([
    { label: supervisorSheetCopy.designation, value: values.designation },
    { label: supervisorSheetCopy.department, value: values.department },
  ]);
  numberedRow([
    { label: supervisorSheetCopy.sex, value: values.sex },
    {
      label: supervisorSheetCopy.ageDob,
      value: `${ageLabel || supervisorSheetCopy.none} · ${formatIsoDate(values.dateOfBirth)}`,
    },
  ]);
  numberedRow([
    { label: supervisorSheetCopy.state, value: values.state },
    { label: supervisorSheetCopy.nationality, value: values.nationality },
  ]);
  numberedRow([
    { label: supervisorSheetCopy.permanent, value: addressOf(values.permanent) },
  ]);
  numberedRow([
    { label: supervisorSheetCopy.communication, value: communication, span: 5 },
    { label: supervisorSheetCopy.contact, value: values.phone, span: 3 },
    { label: supervisorSheetCopy.email, value: values.email, span: 4 },
  ]);

  const qualificationRows = (
    [
      [supervisorSheetCopy.postgraduate, values.postgraduate],
      [supervisorSheetCopy.mphil, values.mphil],
      [supervisorSheetCopy.phd, values.phd],
      [supervisorSheetCopy.dlitt, values.dlitt],
    ] as const
  ).filter(
    ([label, row]) =>
      label === supervisorSheetCopy.postgraduate ||
      label === supervisorSheetCopy.phd ||
      qualificationFilled(row),
  );
  numberedTable(
    supervisorSheetCopy.qualifications,
    [
      supervisorSheetCopy.exam,
      supervisorSheetCopy.degree,
      supervisorSheetCopy.university,
      supervisorSheetCopy.discipline,
      supervisorSheetCopy.year,
      supervisorSheetCopy.classObtained,
      supervisorSheetCopy.percentage,
    ],
    qualificationRows.map(([label, row]) => [
      label,
      row.degree,
      row.university,
      row.discipline,
      label === supervisorSheetCopy.phd ? values.phdAwardYear || row.year : row.year,
      row.classObtained,
      row.percentage,
    ]),
    [22, 22, 40, 32, 16, 20, 14],
  );

  numberedRow([
    { label: supervisorSheetCopy.faculty, value: values.faculty },
    { label: supervisorSheetCopy.subject, value: values.subject },
    { label: supervisorSheetCopy.expertise, value: values.expertise },
  ]);
  numberedRow([
    {
      label: supervisorSheetCopy.appointment,
      value: formatIsoDate(values.appointmentDate),
    },
    {
      label: supervisorSheetCopy.remaining,
      value: remaining || supervisorSheetCopy.none,
    },
  ]);
  numberedRow([
    {
      label: supervisorSheetCopy.teaching,
      value: `${supervisorSheetCopy.teachingPre} ${span(values.preYears, values.preMonths)} · ${supervisorSheetCopy.teachingPost} ${span(values.postYears, values.postMonths)} · ${supervisorSheetCopy.teachingTotal} ${teaching || supervisorSheetCopy.none}`,
      span: 3,
    },
    {
      label: supervisorSheetCopy.research,
      value: span(values.researchYears, values.researchMonths),
      span: 2,
    },
  ]);
  numberedRow([{ label: supervisorSheetCopy.recognised, value: recognised }]);
  numberedTable(
    supervisorSheetCopy.publications,
    [
      "#",
      supervisorSheetCopy.paperTitle,
      supervisorSheetCopy.journal,
      supervisorSheetCopy.yearIndex,
    ],
    papers.length === 0
      ? [["", supervisorSheetCopy.none, "", ""]]
      : papers.map((paper, index) => [
          String(index + 1),
          paper.title,
          paper.journal,
          [paper.month, paper.year, paper.indexing]
            .filter((part) => part.trim())
            .join(" · "),
        ]),
    [8, 78, 48, 32],
  );
  if (other) {
    numberedRow([{ label: supervisorSheetCopy.other, value: other }]);
  }
  const enclosedNow = enclosed.filter((spec) => receipt.attachments[spec.id]);
  numberedRow([
    {
      label: supervisorSheetCopy.documents,
      value:
        enclosedNow.length === 0
          ? supervisorSheetCopy.none
          : enclosedNow.map((spec, index) => `${index + 1}. ${spec.label}`).join("   "),
    },
  ]);

  const footerReserve = 38;
  if (y > pageH - footerReserve) {
    y = pageH - footerReserve;
  }

  y += 1.4;
  doc.setDrawColor(...purple);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, innerW, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...purple);
  doc.text(supervisorSheetCopy.declaration, pageW / 2, y + 3.6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...ink);
  const declarationLines = doc.splitTextToSize(supervisorDeclaration, innerW - 4);
  doc.text(declarationLines, margin + 2, y + 7);
  y += 13;

  const signW = 44;
  const signH = 10;
  const lineW = 32;
  const signX = pageW - margin - signW;
  const lineY = y + signH + 0.3;

  if (receipt.signature) {
    try {
      fitImage(doc, receipt.signature, signX, y, signW, signH);
    } catch {
      /* signature line still prints */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(`${supervisorSheetCopy.place} :`, margin, lineY - 1);
  const placeLabelW = doc.getTextWidth(`${supervisorSheetCopy.place} : `);
  const placeX = margin + placeLabelW;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  const placeText = doc.splitTextToSize(dash(values.place), lineW);
  doc.text(
    (Array.isArray(placeText) ? placeText[0] : placeText) || dash(values.place),
    placeX,
    lineY - 1,
  );
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.25);
  doc.line(placeX, lineY, placeX + lineW, lineY);

  const dateLabel = `${supervisorSheetCopy.date} :`;
  const dateLabelX = placeX + lineW + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(dateLabel, dateLabelX, lineY - 1);
  const dateLabelW = doc.getTextWidth(`${dateLabel} `);
  const dateX = dateLabelX + dateLabelW;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text(applied, dateX, lineY - 1);
  doc.line(dateX, lineY, dateX + lineW, lineY);
  doc.line(signX, lineY, signX + signW, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...muted);
  doc.text(supervisorSheetCopy.signature, signX + signW, lineY + 3.2, { align: "right" });
  doc.setFontSize(7.5);
  doc.setTextColor(...ink);
  const nameLines = doc.splitTextToSize(dash(values.name), signW);
  doc.text(
    (Array.isArray(nameLines) ? nameLines[0] : nameLines) || dash(values.name),
    signX + signW,
    lineY + 6.4,
    { align: "right" },
  );

  const footY = pageH - 10;
  doc.setFillColor(...gold);
  doc.rect(margin, footY - 3, innerW, 0.35, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(`${supervisorSheetCopy.dateApplied} : ${applied}`, margin, footY);
  doc.text(`${supervisorSheetCopy.printedOn} : ${printed}`, pageW - margin, footY, {
    align: "right",
  });

  return doc.output("blob");
}

export async function downloadSupervisorApplications(
  receipts: readonly SupervisorReceipt[],
) {
  if (receipts.length === 0) return;
  if (receipts.length === 1) {
    const receipt = receipts[0];
    const blob = await buildPdf(receipt);
    saveBlob(blob, supervisorPdfFileName(receipt.applicationNo));
    return;
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const receipt of receipts) {
    const blob = await buildPdf(receipt);
    const base = supervisorPdfFileName(receipt.applicationNo);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const name = seen === 0 ? base : base.replace(/\.pdf$/i, `-${seen + 1}.pdf`);
    zip.file(name, blob);
  }
  const packed = await zip.generateAsync({ type: "blob" });
  saveBlob(packed, "supervisor-applications.zip");
}
