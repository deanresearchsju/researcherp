"use client";

import { formatIsoDate } from "@/lib/dates";
import type { LetterDraft } from "@/lib/doctoral";
import { buildLetter } from "@/lib/letter-pdf";
import {
  chiefNames,
  scopeLabel,
  shortDate,
  type Chief,
  type InvigilationPlan,
  type InvigilatorLetter,
} from "@/lib/invigilation-core";

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

function timeLabel(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

function dateRange(plan: InvigilationPlan) {
  const days = [...new Set(plan.duties.map((duty) => duty.date))].sort();
  if (days.length === 0) return "";
  return days.length === 1
    ? shortDate(days[0])
    : `${shortDate(days[0])} to ${shortDate(days[days.length - 1])}`;
}

/** The letter as the same kind of letter the research office issues: its letterhead, boxes and footer. */
export function invigilationLetterDraft(
  plan: InvigilationPlan,
  letter: InvigilatorLetter,
): LetterDraft {
  const { invigilator, lines } = letter;
  const prefix = plan.scope === "entrance" ? "ENT" : "CW";
  return {
    kind: "invigilation" as LetterDraft["kind"],
    sourceId: `${plan.scope}:${invigilator.id}`,
    recipientRole: "supervisor",
    recipientIdentifier: invigilator.id,
    recipientName: invigilator.name,
    refNo: `INV/${prefix}/${invigilator.id}`,
    issuedOn: plan.finalisedOn,
    title: "Invigilation assignment",
    toLines: [
      `${invigilator.name} (${invigilator.id})`,
      invigilator.designation,
      invigilator.department,
    ].filter(Boolean),
    subject: `${plan.examination || scopeLabel[plan.scope]} · Invigilation duty`,
    reference: "",
    details: [
      ...lines.map((line) => ({
        label: `${shortDate(line.date)} · ${line.time ? timeLabel(line.time) : "—"}`,
        value: line.hall,
      })),
      { label: "Examination dates", value: dateRange(plan) },
    ],
    body: [
      `Dear ${invigilator.name},`,
      "Thank you for your continued support to the examinations of the University. You are assigned the invigilation duties shown above, on the dates and sessions indicated.",
      ...letterInstructions(plan.chiefSuperintendent).map(
        (item) => `- ${item.heading}: ${item.text}`,
      ),
    ],
    closing: "",
    copyTo: [],
  };
}

/** The sittings of the plan in words: date, session and where, for the order. */
function sittingLines(plan: InvigilationPlan) {
  const seen = new Map<string, Set<string>>();
  for (const duty of plan.duties) {
    const key = `${shortDate(duty.date)} · ${duty.time ? timeLabel(duty.time) : "—"}`;
    seen.set(key, (seen.get(key) ?? new Set()).add(duty.venue));
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([when, venues]) => ({ label: when, value: [...venues].sort().join("; ") }));
}

/**
 * The order appointing a Chief Superintendent (one order for each person appointed, up to two
 * for an examination), in the research office letter layout. System-generated: no signature.
 */
export function chiefOrderDraft(
  plan: InvigilationPlan,
  chief: Chief,
  issuedOn: string,
): LetterDraft {
  const others = plan.chiefs.filter((item) => item.name !== chief.name);
  const prefix = plan.scope === "entrance" ? "ENT" : "CW";
  const heading = plan.examination || scopeLabel[plan.scope];
  const index = plan.chiefs.findIndex((item) => item.name === chief.name) + 1;
  return {
    kind: "order" as LetterDraft["kind"],
    sourceId: `${plan.scope}:chief:${index}`,
    recipientRole: "supervisor",
    recipientIdentifier: chief.name,
    recipientName: chief.name,
    refNo: `ORD/${prefix}/CS/${index}`,
    issuedOn,
    title: "Order · Appointment of Chief Superintendent",
    toLines: [chief.name, chief.designation, chief.department].filter(Boolean),
    subject: `${heading} · Chief Superintendent`,
    reference: "",
    details: [
      { label: "Examination", value: heading },
      { label: "Examination dates", value: dateRange(plan) || "To be notified" },
      ...sittingLines(plan),
      ...(others.length > 0
        ? [{ label: "Together with", value: chiefNames(others) }]
        : []),
    ],
    body: [
      `You are appointed Chief Superintendent for the ${heading}, on the dates, sessions and at the venues shown above.`,
      "The Chief Superintendent is responsible for the conduct of the examination at the venue. In particular:",
      "- Receive the question papers, answer books and attendance sheets from the Controller's Office and keep them in safe custody until the examination.",
      "- Direct the invigilators and the reserved invigilators, and decide any exchange of duty, which is allowed only in writing before the day.",
      "- See that candidates are admitted only with the hall ticket and a photo identity card, and that the seating plan is followed.",
      "- Deal with doubts about a question paper through the Controller's Office, and with any malpractice by the University procedure, informing the Controller of Examinations the same day.",
      "- Collect the answer books at the end, check them against the attendance sheet and hand them over to the Controller's Office with the report of the examination.",
      ...(others.length > 0
        ? [
            `You will work together with ${chiefNames(others)}, the other Chief Superintendent.`,
          ]
        : []),
    ],
    closing: "",
    copyTo: [
      "The Controller of Examinations",
      "The Invigilators of the examination",
      "Office copy",
    ],
  };
}

/** One order for each Chief Superintendent in one PDF; no signature. */
export async function downloadChiefOrders(
  plan: InvigilationPlan,
  filename: string,
  issuedOn: string,
) {
  if (plan.chiefs.length === 0) return;
  await mergeAndSave(
    plan.chiefs.map((chief) => chiefOrderDraft(plan, chief, issuedOn)),
    filename,
  );
}

/** The date of the letter as printed, e.g. for file names and tests. */
export const letterDate = (plan: InvigilationPlan) => formatIsoDate(plan.finalisedOn);

/**
 * One A4 letter for each invigilator, in one PDF, built with the research office's own letter
 * layout. There is no signature block: the footer says the letter is system-generated.
 */
async function mergeAndSave(drafts: readonly LetterDraft[], filename: string) {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const draft of drafts) {
    const doc = await buildLetter(draft, null);
    const part = await PDFDocument.load(doc.output("arraybuffer"));
    const pages = await merged.copyPages(part, part.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const bytes = await merged.save();
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadInvigilatorLetters(
  plan: InvigilationPlan,
  letters: readonly InvigilatorLetter[],
  filename: string,
) {
  if (letters.length === 0) return;
  await mergeAndSave(
    letters.map((letter) => invigilationLetterDraft(plan, letter)),
    filename,
  );
}
