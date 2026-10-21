import { researchRegister } from "@/data/research-register";
import { isPartTimeMode } from "@/lib/constants";
import {
  attendanceKey,
  colloquiumMarked,
  enrollmentFor,
  latestCommittee,
  latestPlagiarism,
  latestSynopsis,
  latestThesis,
  latestViva,
  reportPeriodsFor,
  resultFor,
  scholarSemester,
  type Colloquium,
  type CommitteeReport,
  type DoctoralState,
} from "@/lib/doctoral";
import { feeLedger } from "@/lib/fee-ledger";
import { racStanding, sameId, type RacProposal } from "@/lib/office";
import { batchOf, scholarBySignIn } from "@/lib/register";
import type { ScholarRecord } from "@/lib/scholar-records";
import type { ScholarRow } from "@/lib/supervision";

/** University regulation: colloquia a scholar must attend during the programme. */
export const colloquiumRule = {
  "Full time": { required: 3, total: 6 },
  "Part time": { required: 4, total: 8 },
} as const;

export const colloquiumRuleText =
  "As per the University Ph.D. regulations, attendance at the colloquium is mandatory: a full-time scholar must attend at least 3 of 6 colloquia and a part-time scholar at least 4 of 8.";

export type StudyMode = keyof typeof colloquiumRule;

export type ColloquiumStanding = {
  attended: number;
  absent: number;
  /** Events held for this scholar (attendance marked). */
  held: number;
  upcoming: number;
  /** Attended before the ERP, from the register. */
  earlier: number;
  required: number;
  total: number;
  met: boolean;
  /** Met, on track, or short: short when the colloquia left cannot reach the minimum. */
  status: "Met" | "On track" | "At risk";
};

export type ScholarReport = {
  identifier: string;
  name: string;
  registration: string;
  batchId: string;
  batchName: string;
  subject: string;
  mode: StudyMode;
  guideName: string;
  guideIdentifier: string;
  email: string;
  phone: string;
  semester: number;
  coursePapers: number;
  coursePassed: number;
  courseArrears: number;
  firstDc: string;
  confirmation: string;
  thirdDc: string;
  rac: string;
  sixMonthApproved: number;
  sixMonthDue: number;
  colloquium: ColloquiumStanding;
  publications: number;
  plagiarism: string;
  synopsis: string;
  thesis: string;
  viva: string;
  feePaid: number;
  feeBalance: number;
  /** The milestone the scholar is at now, in plain words. */
  stage: string;
};

export type ReportSources = {
  doctoral: DoctoralState;
  proposals: readonly RacProposal[];
  payments: readonly ScholarRecord[];
  sixMonth: readonly ScholarRecord[];
  publications: readonly ScholarRecord[];
  today: string;
};

export function studyModeOf(identifier: string, doctoral: DoctoralState): StudyMode {
  const value =
    enrollmentFor(doctoral, identifier)?.studyMode ||
    scholarBySignIn(identifier)?.category ||
    "";
  return isPartTimeMode(value) ? "Part time" : "Full time";
}

function committeeText(report: CommitteeReport | null, register: string) {
  if (report?.status === "Approved") {
    return `Approved${report.meetingOn ? ` · ${report.meetingOn}` : ""}`;
  }
  if (report) return report.status === "Rejected" ? "Returned" : "Submitted";
  return register.trim() ? `Completed · ${register.trim()}` : "Pending";
}

function decisionText(status: string | undefined, register = "") {
  if (status) return status === "Rejected" ? "Returned" : status;
  return register.trim() ? `Completed · ${register.trim()}` : "Not started";
}

function belongsTo(person: { identifier: string }, identifier: string) {
  return sameId(person.identifier, identifier);
}

export function colloquiumStanding(
  colloquia: readonly Colloquium[],
  identifier: string,
  mode: StudyMode,
  today: string,
): ColloquiumStanding {
  const rule = colloquiumRule[mode];
  const mine = colloquia.filter((item) =>
    item.scholars.some((person) => belongsTo(person, identifier)),
  );
  const key = attendanceKey("scholar", identifier);
  const held = mine.filter(colloquiumMarked);
  const attendedHere = held.filter((item) => item.attendance[key] === "Present").length;
  const absent = held.filter((item) => item.attendance[key] === "Absent").length;
  const upcoming = mine.filter(
    (item) => !colloquiumMarked(item) && (!item.date || item.date >= today),
  ).length;
  const scholar = scholarBySignIn(identifier);
  const earlier = scholar
    ? [scholar.colloquium1, scholar.colloquium2].filter((value) => value.trim()).length
    : 0;
  const attended = attendedHere + earlier;
  const used = held.length + earlier;
  const left = Math.max(rule.total - used, 0);
  const met = attended >= rule.required;
  return {
    attended,
    absent,
    held: held.length,
    upcoming,
    earlier,
    required: rule.required,
    total: rule.total,
    met,
    status: met ? "Met" : attended + left >= rule.required ? "On track" : "At risk",
  };
}

/** Supervisor's own attendance at the colloquia they were invited to. */
export function supervisorColloquium(
  colloquia: readonly Colloquium[],
  keys: readonly string[],
) {
  const invited = colloquia.filter((item) =>
    item.supervisors.some((person) =>
      keys.some((key) => key.trim() && sameId(person.identifier, key)),
    ),
  );
  const marks = invited.filter(colloquiumMarked).map((item) => {
    const person = item.supervisors.find((entry) =>
      keys.some((key) => key.trim() && sameId(entry.identifier, key)),
    );
    return person
      ? item.attendance[attendanceKey("supervisor", person.identifier)]
      : undefined;
  });
  return {
    invited: invited.length,
    present: marks.filter((mark) => mark === "Present").length,
    absent: marks.filter((mark) => mark === "Absent").length,
  };
}

function stageOf(report: Omit<ScholarReport, "stage">) {
  if (report.viva.startsWith("Passed")) return "Viva passed";
  if (report.viva === "Scheduled") return "Viva scheduled";
  if (report.thesis !== "Not started") return `Thesis ${report.thesis.toLowerCase()}`;
  if (report.synopsis !== "Not started")
    return `Synopsis ${report.synopsis.toLowerCase()}`;
  if (report.thirdDc.startsWith("Approved") || report.thirdDc.startsWith("Completed")) {
    return "Third committee done";
  }
  if (
    report.confirmation.startsWith("Approved") ||
    report.confirmation.startsWith("Completed")
  ) {
    return "Ph.D. confirmed";
  }
  if (report.coursePapers > 0) return `Course work · semester ${report.semester || 1}`;
  if (report.firstDc.startsWith("Approved") || report.firstDc.startsWith("Completed")) {
    return "First committee done";
  }
  return "Admitted";
}

export function scholarReport(row: ScholarRow, sources: ReportSources): ScholarReport {
  const { doctoral, today } = sources;
  const identifier = row.identifier;
  const register = scholarBySignIn(identifier);
  const enrollment = enrollmentFor(doctoral, identifier);
  const batchId = register?.batchId || enrollment?.batchId || "";
  const mode = studyModeOf(identifier, doctoral);
  const papers = doctoral.registrations.filter((item) =>
    sameId(item.scholarIdentifier, identifier),
  );
  const outcomes = papers.map((item) => resultFor(doctoral, item.id)?.outcome);
  const mineRecords = (list: readonly ScholarRecord[]) =>
    list.filter(
      (record) =>
        sameId(record.scholarIdentifier, identifier) ||
        (register?.email ? sameId(record.scholarIdentifier, register.email) : false),
    );
  const periods = reportPeriodsFor(doctoral, identifier);
  const rac = racStanding(sources.proposals, identifier, today);
  const plagiarism =
    latestPlagiarism(doctoral, identifier, "thesis") ??
    latestPlagiarism(doctoral, identifier, "synopsis");
  const viva = latestViva(doctoral, identifier);
  const ledger = feeLedger(identifier, row.name, sources.payments, today);
  const paid = ledger.plan
    .filter((year) => year.status !== "Upcoming")
    .reduce((sum, year) => sum + year.paid, 0);
  const base: Omit<ScholarReport, "stage"> = {
    identifier,
    name: row.name,
    registration: row.registration,
    batchId,
    batchName: row.batchName || batchOf(batchId)?.name || ledger.batchName || "",
    subject: row.subject || register?.department || enrollment?.school || "",
    mode,
    guideName: row.currentName,
    guideIdentifier: row.currentIdentifier,
    email: register?.email || (identifier.includes("@") ? identifier : ""),
    phone: register?.phone || "",
    semester: scholarSemester(doctoral, identifier),
    coursePapers: papers.length,
    coursePassed: outcomes.filter((outcome) => outcome === "Pass").length,
    courseArrears: outcomes.filter((outcome) => outcome === "RA" || outcome === "AAA")
      .length,
    firstDc: committeeText(
      latestCommittee(doctoral, "first", identifier),
      register?.firstDc ?? "",
    ),
    confirmation: committeeText(
      latestCommittee(doctoral, "second", identifier),
      register?.confirmation || register?.secondDc || "",
    ),
    thirdDc: committeeText(latestCommittee(doctoral, "third", identifier), ""),
    rac: rac.approved
      ? "Constituted"
      : rac.pending
        ? "Waiting for the Dean"
        : "Not constituted",
    sixMonthApproved: mineRecords(sources.sixMonth).filter(
      (record) => record.status === "Approved",
    ).length,
    sixMonthDue: periods.filter((period) => period.due <= today).length,
    colloquium: colloquiumStanding(doctoral.colloquia, identifier, mode, today),
    publications: mineRecords(sources.publications).filter(
      (record) => record.status === "Approved",
    ).length,
    plagiarism: plagiarism
      ? `${plagiarism.stage === "thesis" ? "Thesis" : "Synopsis"} · ${plagiarism.status}`
      : "Not issued",
    synopsis: decisionText(
      latestSynopsis(doctoral, identifier)?.status,
      register?.synopsis,
    ),
    thesis: decisionText(latestThesis(doctoral, identifier)?.status, register?.thesis),
    viva: viva
      ? viva.status === "Passed"
        ? `Passed${viva.scheduledOn ? ` · ${viva.scheduledOn}` : ""}`
        : viva.status
      : register?.viva.trim()
        ? `Passed · ${register.viva.trim()}`
        : "Not scheduled",
    feePaid: paid,
    feeBalance: ledger.outstanding,
  };
  return { ...base, stage: stageOf(base) };
}

export function batchNames() {
  return [...researchRegister.batches]
    .sort((left, right) => left.order - right.order)
    .map((batch) => batch.name);
}

/** Open items that need attention for a scholar. */
export function alertsOf(row: ScholarReport) {
  const alerts: string[] = [];
  if (row.rac === "Not constituted") alerts.push("RAC not constituted");
  if (row.sixMonthDue > row.sixMonthApproved) {
    alerts.push(`${row.sixMonthDue - row.sixMonthApproved} six-month report(s) pending`);
  }
  if (row.colloquium.status === "At risk") alerts.push("Colloquium attendance short");
  if (row.courseArrears > 0) alerts.push(`${row.courseArrears} course-work arrear(s)`);
  if (row.feeBalance > 0)
    alerts.push(`Fee due ₹${row.feeBalance.toLocaleString("en-IN")}`);
  if (!row.guideName) alerts.push("No supervisor allotted");
  return alerts;
}
