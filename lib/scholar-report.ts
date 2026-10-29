import type { ResearchScholar } from "@/data/research-register";
import { isPartTimeMode } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  attendanceKey,
  colloquiumMarked,
  currentDoctoral,
  enrollmentFor,
  latestCommittee,
  latestPlagiarism,
  latestSynopsis,
  latestThesis,
  latestViva,
  lettersOf,
  reportPeriodsFor,
  resultFor,
  scholarSemester,
  type Colloquium,
  type CommitteeReport,
  type DoctoralState,
} from "@/lib/doctoral";
import { feeLedger } from "@/lib/fee-ledger";
import { racStanding, sameId, type RacProposal } from "@/lib/office";
import {
  originalScholar,
  scholarBySignIn,
  scholarSignInId,
  supervisorForGuide,
} from "@/lib/register";
import { researchTitleOf } from "@/lib/research-title";
import type { ScholarRecord } from "@/lib/scholar-records";
import type { ScholarRow } from "@/lib/supervision";
import { admissionCaseForIdentifier, currentAdmission } from "@/lib/admission";
import { allBatches, batchById, intakeOfCase } from "@/lib/batches";

/** University regulation: colloquia a scholar must attend during the programme. */
export const colloquiumRule = {
  "Full time": { required: 3, total: 6 },
  "Part time": { required: 4, total: 8 },
} as const;

export const colloquiumRuleText =
  "Attend the colloquia until you submit your synopsis. The research office checks your attendance when it verifies the synopsis and thesis checklists.";

/** The minimum read out at the synopsis and thesis checklists (not shown on the colloquium pages). */
export const colloquiumMinimumText = (mode: StudyMode) =>
  `${mode === "Full time" ? "Full-time" : "Part-time"} scholar: at least ${colloquiumRule[mode].required} of ${colloquiumRule[mode].total} colloquia`;

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
  /** The scholar's department on the register (the subject when it has none). */
  department: string;
  /** The campus of the scholar's guide. */
  campus: string;
  mode: StudyMode;
  guideName: string;
  guideIdentifier: string;
  /** Research title as fixed by the committees (or the register for earlier batches). */
  title: string;
  titleStage: string;
  /** Area of research: the guide's area on the supervisor register. */
  researchArea: string;
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
  /** Scholar information entered by the office (area of research and more). */
  personal?: readonly ScholarRecord[];
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
  const admitted = register
    ? null
    : admissionCaseForIdentifier(identifier, currentAdmission()?.cases ?? []);
  const batchId =
    register?.batchId ||
    enrollment?.batchId ||
    (admitted ? intakeOfCase(currentAdmission(), admitted) : "");
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
  const researchTitle = researchTitleOf(doctoral, identifier);
  const paid = ledger.plan
    .filter((year) => year.status !== "Upcoming")
    .reduce((sum, year) => sum + year.paid, 0);
  const base: Omit<ScholarReport, "stage"> = {
    identifier,
    name: row.name,
    registration: row.registration,
    batchId,
    batchName: row.batchName || batchById(batchId)?.name || ledger.batchName || "",
    subject: row.subject || register?.department || enrollment?.school || "",
    department: register?.department || row.subject || enrollment?.school || "",
    campus:
      supervisorForGuide(row.currentName || register?.guideName || "")?.campus || "",
    mode,
    guideName: row.currentName,
    guideIdentifier: row.currentIdentifier,
    title: researchTitle.title,
    titleStage: researchTitle.stage,
    researchArea:
      mineRecords(sources.personal ?? [])
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
        ?.payload.researchArea?.trim() ||
      supervisorForGuide(row.currentName || register?.guideName || "")?.researchArea ||
      "",
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

export type RegisterMilestones = {
  firstDc: string;
  secondDc: string;
  confirmation: string;
  colloquium1: string;
  colloquium2: string;
  colloquium: string;
  synopsis: string;
  thesis: string;
  viva: string;
};

function when(value: string) {
  const text = value.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? formatIsoDate(text.slice(0, 10)) : text;
}

function joined(...parts: string[]) {
  return parts.filter((part) => part.trim()).join(" · ");
}

/**
 * The register's milestone columns, filled from the scholar's ERP records (committees,
 * confirmation letter, colloquium attendance, synopsis, thesis, viva). The register's own entry
 * is used only where the ERP has nothing yet.
 */
export function registerMilestones(
  scholar: ResearchScholar,
  doctoral: DoctoralState,
  keys: readonly string[],
  today: string,
): RegisterMilestones {
  const live = keys.filter((key) => key.trim());
  const find = <T>(read: (key: string) => T | null | undefined) => {
    for (const key of live) {
      const found = read(key);
      if (found) return found;
    }
    return null;
  };
  const committee = (kind: "first" | "second", register: string) => {
    const report = find((key) => latestCommittee(doctoral, kind, key));
    if (report?.status === "Approved") {
      return joined("Held", when(report.meetingOn || report.decidedOn));
    }
    if (report) return report.status === "Rejected" ? "Returned" : "Report submitted";
    return register.trim();
  };
  const decision = (
    item: { status: string; decidedOn: string; createdAt: string } | null,
    register: string,
  ) => {
    if (!item) return register.trim();
    if (item.status === "Approved") return joined("Approved", when(item.decidedOn));
    if (item.status === "Rejected") return "Returned";
    return joined("Submitted", when(item.createdAt));
  };

  const letter = lettersOf(doctoral, "scholar", live)
    .filter((item) => item.kind === "confirmation")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const second = find((key) => latestCommittee(doctoral, "second", key));
  const confirmation = letter
    ? joined("Letter issued", letter.refNo, when(letter.issuedOn))
    : scholar.confirmation.trim() || (second?.status === "Approved" ? "Letter due" : "");

  // Colloquia attended: those in the register first, then each marked present in the ERP.
  const attendedOn = [
    scholar.colloquium1.trim(),
    scholar.colloquium2.trim(),
    ...doctoral.colloquia
      .filter(
        (item) =>
          colloquiumMarked(item) &&
          live.some(
            (key) => item.attendance[attendanceKey("scholar", key)] === "Present",
          ),
      )
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((item) => joined(item.name, when(item.date))),
  ].filter(Boolean);
  const mode = studyModeOf(live[0] ?? scholar.id, doctoral);
  const standing = live.length
    ? colloquiumStanding(doctoral.colloquia, live[0], mode, today)
    : null;

  const viva = find((key) => latestViva(doctoral, key));
  return {
    firstDc: committee("first", scholar.firstDc),
    secondDc: committee("second", scholar.secondDc),
    confirmation,
    colloquium1: attendedOn[0] ?? "",
    colloquium2: attendedOn[1] ?? "",
    colloquium: standing ? `${standing.attended} attended` : "",
    synopsis: decision(
      find((key) => latestSynopsis(doctoral, key)),
      scholar.synopsis,
    ),
    thesis: decision(
      find((key) => latestThesis(doctoral, key)),
      scholar.thesis,
    ),
    viva: viva
      ? joined(
          viva.status === "Scheduled" ? "Scheduled" : viva.status,
          when(viva.scheduledOn),
        )
      : scholar.viva.trim(),
  };
}

/** Every key the scholar's ERP records may be filed under. */
export function registerScholarKeys(scholar: ResearchScholar) {
  const original = originalScholar(scholar.id);
  return [
    ...new Set(
      [
        scholarSignInId(scholar),
        scholar.email,
        scholar.registrationNumber,
        scholar.applicationNumber,
        scholar.fileNumber,
        scholar.id,
        original?.email ?? "",
      ].filter((key) => key.trim()),
    ),
  ];
}

/** Milestones from the loaded ERP records; null until they have loaded. */
export function liveMilestones(scholar: ResearchScholar, doctoral = currentDoctoral()) {
  return doctoral
    ? registerMilestones(scholar, doctoral, registerScholarKeys(scholar), clientToday())
    : null;
}

export function batchNames() {
  return [...allBatches()]
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
  if (row.courseArrears > 0) alerts.push(`${row.courseArrears} course-work arrear(s)`);
  if (row.feeBalance > 0)
    alerts.push(`Fee due ₹${row.feeBalance.toLocaleString("en-IN")}`);
  if (!row.guideName) alerts.push("No supervisor allotted");
  return alerts;
}
