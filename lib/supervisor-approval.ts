import type { StoredApplication } from "@/lib/records";
import type { Json } from "@/types/database";

/** Bodies whose approval the Dean's office records before a recognition is final. */
export const recognitionBodies = ["Research Advisory Board", "Vice Chancellor"] as const;

/** The eligibility conditions the Dean's office ticks for each supervisor applicant. */
export const eligibilityCriteria = [
  {
    id: "phd",
    label: "Holds a Ph.D. degree in the subject (or a related discipline)",
  },
  {
    id: "appointment",
    label: "Regular full-time appointment; designation and date of appointment verified",
  },
  {
    id: "experience",
    label:
      "Post-Ph.D. teaching / research experience as required by the Ph.D. Regulations",
  },
  {
    id: "publications",
    label:
      "Research publications in refereed (UGC-CARE / Scopus / Web of Science) journals",
  },
  {
    id: "quota",
    label: "Number of scholars proposed is within the limit for the designation",
  },
] as const;

export type CriterionId = (typeof eligibilityCriteria)[number]["id"];

export type SupervisorEligibility = {
  checks: Partial<Record<CriterionId, boolean>>;
  quota: number;
  verifiedOn: string;
  remarks: string;
};

export type SupervisorRecognition = {
  body: string;
  reference: string;
  approvedOn: string;
  /** Reference number printed on the recognition letter. */
  refNo: string;
  issuedOn: string;
  preparedBy: string;
  verifiedBy: string;
};

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function eligibilityOf(payload: Json): SupervisorEligibility | null {
  const stored = record(record(payload)?.eligibility);
  if (!stored) return null;
  const checks = record(stored.checks) ?? {};
  const quota = Number(stored.quota);
  return {
    checks: Object.fromEntries(
      eligibilityCriteria.map((item) => [item.id, checks[item.id] === true]),
    ),
    quota: Number.isInteger(quota) && quota >= 0 ? quota : 0,
    verifiedOn: text(stored.verifiedOn),
    remarks: text(stored.remarks),
  };
}

export function recognitionOf(payload: Json): SupervisorRecognition | null {
  const stored = record(record(payload)?.recognition);
  if (!stored || !text(stored.approvedOn)) return null;
  return {
    body: text(stored.body),
    reference: text(stored.reference),
    approvedOn: text(stored.approvedOn),
    refNo: text(stored.refNo),
    issuedOn: text(stored.issuedOn),
    preparedBy: text(stored.preparedBy),
    verifiedBy: text(stored.verifiedBy),
  };
}

export function eligibilityMet(eligibility: SupervisorEligibility | null) {
  return Boolean(
    eligibility && eligibilityCriteria.every((item) => eligibility.checks[item.id]),
  );
}

/** Guide quota proposed from the designation (UGC: Professor 8, Associate 6, Assistant 4). */
export function proposedQuota(designation: string) {
  const value = designation.toLowerCase();
  if (/assoc/.test(value)) return 6;
  if (/asst|assistant/.test(value)) return 4;
  if (/prof/.test(value)) return 8;
  return 4;
}

export function payloadText(
  application: Pick<StoredApplication, "payload">,
  key: string,
) {
  return text(record(application.payload)?.[key]);
}

/** Applicants whose eligibility is verified and who wait for the RAB / Vice Chancellor. */
export function awaitingRecognition(rows: readonly StoredApplication[]) {
  return rows.filter((row) => row.kind === "supervisor" && row.status === "Accepted");
}

/** Next free serial for recognition letter numbers of the year, across stored approvals. */
export function highestRecognitionSerial(
  rows: readonly StoredApplication[],
  year: string,
) {
  let highest = 0;
  for (const row of rows) {
    const refNo = recognitionOf(row.payload)?.refNo ?? "";
    const match = new RegExp(`/SR/${year}/(\\d+)$`).exec(refNo);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}
