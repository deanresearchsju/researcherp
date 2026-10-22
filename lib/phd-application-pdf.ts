import { scholarDeclaration } from "@/data/declarations";
import { scholarDocuments } from "@/data/documents";
import { phdSheetCopy } from "@/data/phd-application-sheet";
import { applicationFeeInr, university } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { formatNetQualification } from "@/lib/net-exam";
import { subjectLine, type PhdReceipt } from "@/lib/scholar-progress";
import { formatInr } from "@/lib/utils";
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

const enclosed = scholarDocuments.filter(
  (spec) => spec.id !== "photo" && spec.id !== "signature",
);

export function phdPdfFileName(applicationNo: string) {
  return `${applicationNo.replaceAll("/", "-")}.pdf`;
}

function dash(value: string) {
  return value.trim() || phdSheetCopy.none;
}

function addressOf(address: PhdReceipt["values"]["communication"]) {
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

async function buildPdf(receipt: PhdReceipt) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const { values } = receipt;
  const applied = formatIsoDate(receipt.submittedOn.slice(0, 10) || receipt.submittedOn);
  const printed = formatIsoDate(clientToday());
  const sessionLine = [values.session, values.year].filter(Boolean).join(" ");
  const name = [values.title, values.fullName || values.applicantName]
    .filter(Boolean)
    .join(" ");
  const community = [values.community, values.communityName].filter(Boolean).join(" · ");
  const net = formatNetQualification(values, phdSheetCopy.none);
  const experience = values.experience.filter((row) => row.organization.trim());
  const permanent = values.sameAddress ? values.communication : values.permanent;
  const logo = await fetchAsDataUrl("/assets/logo-sju.jpg");

  doc.setFillColor(...gold);
  doc.rect(margin, 8, innerW, 0.7, "F");
  doc.setFillColor(...purple);
  doc.rect(margin, 8.7, innerW, 1.1, "F");

  const headerTop = 11;
  const photoW = 24;
  const photoH = 30;
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
  doc.setFontSize(12);
  doc.text(phdSheetCopy.formTitle, pageW / 2, headerTop + 8, { align: "center" });
  doc.setFontSize(8);
  doc.text(
    sessionLine
      ? `${university.researchOffice}  ·  ${sessionLine}`
      : university.researchOffice,
    pageW / 2,
    headerTop + 13.2,
    { align: "center" },
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(phdSheetCopy.applicationNo, pageW / 2, headerTop + 18.4, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...purple);
  doc.text(receipt.applicationNo, pageW / 2, headerTop + 23.6, { align: "center" });

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

  let y = Math.max(headerTop + 27, photoY + photoH) + 2.5;
  doc.setFillColor(...gold);
  doc.rect(margin, y, innerW, 0.4, "F");
  y += 1.1;
  doc.setFillColor(...purple);
  doc.rect(margin, y, innerW, 0.7, "F");
  y += 2.4;

  let serial = 1;
  const cellPad = 1.4;

  function drawBox(x: number, top: number, w: number, h: number, shade = false) {
    if (shade) {
      doc.setFillColor(...fill);
      doc.rect(x, top, w, h, "FD");
    } else {
      doc.setDrawColor(...line);
      doc.rect(x, top, w, h);
    }
  }

  function writePair(x: number, top: number, w: number, label: string, value: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...ink);
    const labelText = `${label} : `;
    const labelW = doc.getTextWidth(labelText);
    doc.text(labelText, x + cellPad, top + 4);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(dash(value), w - cellPad * 2 - labelW);
    doc.text(lines, x + cellPad + labelW, top + 4);
    return Array.isArray(lines) ? lines.length : 1;
  }

  function numberedRow(
    cells: Array<{ label: string; value: string; span?: number }>,
    minH = 7,
  ) {
    const colCount = cells.reduce((sum, cell) => sum + (cell.span ?? 1), 0) || 1;
    const serialW = 7;
    const bodyW = innerW - serialW;
    const unit = bodyW / colCount;
    let tallest = 1;
    cells.forEach((cell) => {
      const w = unit * (cell.span ?? 1) - cellPad * 2;
      const labelW = doc.getTextWidth(`${cell.label} : `);
      const lines = doc.splitTextToSize(dash(cell.value), Math.max(w - labelW, 20));
      tallest = Math.max(tallest, Array.isArray(lines) ? lines.length : 1);
    });
    const h = Math.max(minH, tallest * 3.4 + 3);
    drawBox(margin, y, serialW, h, true);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...purple);
    doc.text(String(serial), margin + serialW / 2, y + h / 2 + 1.2, { align: "center" });
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

  numberedRow([{ label: phdSheetCopy.name, value: name }]);
  numberedRow([
    { label: phdSheetCopy.dateOfBirth, value: formatIsoDate(values.dateOfBirth) },
    { label: phdSheetCopy.gender, value: values.gender },
    { label: phdSheetCopy.bloodGroup, value: values.bloodGroup },
  ]);
  numberedRow([
    { label: phdSheetCopy.nationality, value: values.nationality },
    {
      label: phdSheetCopy.country,
      value: values.nationality === "Non-Indian" ? values.country : values.nationality,
    },
    { label: phdSheetCopy.maritalStatus, value: values.maritalStatus },
  ]);
  numberedRow([{ label: phdSheetCopy.community, value: community }]);
  numberedRow([
    { label: phdSheetCopy.studyMode, value: values.studyMode },
    { label: phdSheetCopy.appliedOn, value: applied },
  ]);
  numberedRow([
    { label: phdSheetCopy.discipline, value: values.school },
    { label: phdSheetCopy.specialization, value: subjectLine(values) },
  ]);

  function education(label: string, row: PhdReceipt["values"]["ug"]) {
    numberedRow([
      { label, value: `${row.degree} · ${row.specialisation}`.trim() },
      { label: "Year", value: row.year },
      { label: "% / CGPA", value: row.score },
    ]);
    numberedRow([
      { label: "Institution", value: row.institution, span: 1 },
      { label: "University", value: row.university, span: 1 },
    ]);
  }
  education(phdSheetCopy.ug, values.ug);
  education(phdSheetCopy.pg, values.pg);

  numberedRow([{ label: phdSheetCopy.net, value: net }]);
  numberedRow([
    { label: phdSheetCopy.email, value: values.email },
    { label: phdSheetCopy.mobile, value: values.mobile },
  ]);
  numberedRow([
    { label: phdSheetCopy.communication, value: addressOf(values.communication) },
    {
      label: phdSheetCopy.permanent,
      value: values.sameAddress ? "Same as communication address" : addressOf(permanent),
    },
  ]);
  numberedRow([
    {
      label: phdSheetCopy.experience,
      value:
        experience.length === 0
          ? phdSheetCopy.none
          : experience
              .map(
                (row, index) =>
                  `${index + 1}. ${[row.organization, row.designation, row.from, row.to].filter(Boolean).join(" · ")}`,
              )
              .join("  "),
    },
  ]);
  numberedRow([{ label: phdSheetCopy.research, value: values.researchArea }]);
  numberedRow([
    { label: phdSheetCopy.paymentMode, value: values.paymentMode, span: 5 },
    {
      label: phdSheetCopy.amount,
      value: `Rs. ${formatInr(applicationFeeInr)}`,
      span: 3,
    },
    { label: phdSheetCopy.transactionNo, value: values.transactionNumber, span: 5 },
    {
      label: phdSheetCopy.paymentDate,
      value: formatIsoDate(values.paymentDate),
      span: 8,
    },
  ]);
  const enclosedNow = enclosed.filter((spec) => receipt.attachments[spec.id]);
  numberedRow([
    {
      label: phdSheetCopy.documents,
      value:
        enclosedNow.length === 0
          ? phdSheetCopy.none
          : enclosedNow.map((spec, index) => `${index + 1}. ${spec.label}`).join("\n"),
    },
  ]);

  y += 2;
  doc.setDrawColor(...purple);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, innerW, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...purple);
  doc.text(phdSheetCopy.declaration, pageW / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  const declarationLines = doc.splitTextToSize(scholarDeclaration, innerW - 4);
  doc.text(declarationLines, margin + 2, y + 9);
  y += 24;

  const signW = 48;
  const signH = 14;
  const dateLineW = 42;
  const signX = pageW - margin - signW;
  const lineY = y + signH + 0.4;

  if (receipt.signature) {
    try {
      fitImage(doc, receipt.signature, signX, y, signW, signH);
    } catch {
      /* signature line still prints */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(`${phdSheetCopy.date} :`, margin, lineY - 1.2);
  const dateLabelW = doc.getTextWidth(`${phdSheetCopy.date} : `);
  const dateX = margin + dateLabelW;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ink);
  doc.text(applied, dateX, lineY - 1.2);
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.25);
  doc.line(dateX, lineY, dateX + dateLineW, lineY);
  doc.line(signX, lineY, signX + signW, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(phdSheetCopy.signature, signX + signW, lineY + 3.6, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text(name || phdSheetCopy.none, signX + signW, lineY + 7.4, { align: "right" });

  y = pageH - 12;
  doc.setFillColor(...gold);
  doc.rect(margin, y - 3, innerW, 0.4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(`${phdSheetCopy.dateApplied} : ${applied}`, margin, y);
  doc.text(`${phdSheetCopy.printedOn} : ${printed}`, pageW - margin, y, {
    align: "right",
  });

  return doc.output("blob");
}

export async function downloadPhdApplications(receipts: readonly PhdReceipt[]) {
  if (receipts.length === 0) return;
  if (receipts.length === 1) {
    const receipt = receipts[0];
    const blob = await buildPdf(receipt);
    saveBlob(blob, phdPdfFileName(receipt.applicationNo));
    return;
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const receipt of receipts) {
    const blob = await buildPdf(receipt);
    const base = phdPdfFileName(receipt.applicationNo);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const name = seen === 0 ? base : base.replace(/\.pdf$/i, `-${seen + 1}.pdf`);
    zip.file(name, blob);
  }
  const packed = await zip.generateAsync({ type: "blob" });
  saveBlob(packed, "phd-applications.zip");
}
