import {
  designations,
  indexingOf,
  valueText,
  type ResearchRecord,
  type ResearchValues,
} from "@/lib/faculty-research";

/**
 * Publication incentives under the Research Promotion Policy. The rates and the ceiling of each
 * cadre are set for each academic year (June to May) by the administrator; a year without its own
 * rules uses those of the latest earlier year, or the policy's rates below. The total approved
 * for a faculty member in an academic year never goes above the ceiling of the cadre.
 */
export const sciBands = ["IF ≥ 4.1", "IF 2.1–4.0", "IF 1–2"] as const;
export const positions = ["First", "Second", "Third", "Fourth"] as const;

export type IncentiveRules = {
  /** SCI / Web of Science journals and book chapters: [author position][impact-factor band]. */
  sci: number[][];
  /** Scopus journals and book chapters: by author position. */
  scopus: number[];
  /** Technical book with ISBN (shared by the authors by mutual consent). */
  book: number;
  /** Product patent grant (one applicant claims). */
  patentGrant: number;
  /** The most a faculty member of each designation may receive in the academic year (0: not set). */
  ceilings: Record<string, number>;
};

export const policyRules: IncentiveRules = {
  sci: [
    [10000, 8000, 5000],
    [8000, 6000, 4000],
    [6000, 5000, 3000],
    [4000, 3000, 2000],
  ],
  scopus: [2500, 2000, 1500, 1000],
  book: 5000,
  patentGrant: 5000,
  ceilings: Object.fromEntries(designations.map((designation) => [designation, 0])),
};

export const claimStatuses = ["Claimed", "Approved", "Paid", "Rejected"] as const;
export type ClaimStatus = (typeof claimStatuses)[number];

export type IncentiveClaim = {
  id: string;
  recordId: string;
  facultyKey: string;
  facultyName: string;
  designation: string;
  academicYear: string;
  basis: string;
  computed: number;
  claimed: number;
  approved: number;
  status: ClaimStatus;
  remarks: string;
  updatedAt: string;
  updatedBy: string;
};

/** The academic year (June to May) of a date: 2026-06-01 → "2026-27", 2026-05-31 → "2025-26". */
export function academicYearOf(iso: string) {
  if (!/^\d{4}-\d{2}/.test(iso)) return "";
  const year = Number(iso.slice(0, 4));
  const start = Number(iso.slice(5, 7)) >= 6 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function isAcademicYear(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const start = Number(value.slice(0, 4));
  return start >= 2000 && start <= 2100 && Number(value.slice(5)) === (start + 1) % 100;
}

export function nextAcademicYear(year: string) {
  const start = Number(year.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The date a record's incentive belongs to: the grant date of a patent, else the publication date. */
export function incentiveDate(values: ResearchValues) {
  if (valueText(values, "type") === "Patent") return valueText(values, "grantedOn");
  return valueText(values, "publishedOn") || `${valueText(values, "year")}-06-01`;
}

const amount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
};

/** Rules as saved by the administrator, with every value checked and every cell present. */
export function cleanRules(input: unknown): IncentiveRules {
  const raw =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const sci = Array.isArray(raw.sci) ? raw.sci : [];
  const scopus = Array.isArray(raw.scopus) ? raw.scopus : [];
  const ceilings =
    raw.ceilings && typeof raw.ceilings === "object"
      ? (raw.ceilings as Record<string, unknown>)
      : {};
  return {
    sci: positions.map((_, row) =>
      sciBands.map((__, column) => {
        const line = Array.isArray(sci[row]) ? (sci[row] as unknown[]) : [];
        return amount(line[column] ?? policyRules.sci[row][column]);
      }),
    ),
    scopus: positions.map((_, row) => amount(scopus[row] ?? policyRules.scopus[row])),
    book: amount(raw.book ?? policyRules.book),
    patentGrant: amount(raw.patentGrant ?? policyRules.patentGrant),
    ceilings: Object.fromEntries(
      designations.map((designation) => [
        designation,
        amount(ceilings[designation] ?? 0),
      ]),
    ),
  };
}

function band(impactFactor: number): 0 | 1 | 2 | null {
  if (impactFactor >= 4.1) return 0;
  if (impactFactor >= 2.1) return 1;
  if (impactFactor >= 1) return 2;
  return null;
}

/** The incentive the policy gives a publication or patent, with the reason. */
export function computeIncentive(record: ResearchRecord, rules: IncentiveRules) {
  const v = record.values;
  const type = valueText(v, "type");
  const position = Number(valueText(v, "authorPosition"));
  const positionName = positions[position - 1];
  if (type === "Patent") {
    return valueText(v, "patentStatus") === "Granted"
      ? { amount: rules.patentGrant, basis: "Patent grant" }
      : { amount: 0, basis: "Patent not yet granted" };
  }
  if (type === "Book") {
    return valueText(v, "isbnIssn")
      ? {
          amount: rules.book,
          basis: "Technical book with ISBN (shared by mutual consent)",
        }
      : { amount: 0, basis: "Book without ISBN" };
  }
  if (type !== "Journal article" && type !== "Book chapter")
    return { amount: 0, basis: `${type || "This type"} is not in the incentive policy` };
  const indexing = indexingOf(v);
  const impact = band(Number(valueText(v, "impactFactor")));
  if (!positionName) return { amount: 0, basis: "Only the first four author positions" };
  if (indexing.includes("Web of Science") && impact !== null) {
    return {
      amount: rules.sci[position - 1][impact],
      basis: `SCI / WoS · ${sciBands[impact]} · ${positionName} position`,
    };
  }
  if (indexing.includes("Scopus")) {
    return {
      amount: rules.scopus[position - 1],
      basis: `Scopus · ${positionName} position`,
    };
  }
  return { amount: 0, basis: "Not SCI / Scopus indexed (or impact factor below 1)" };
}

/** The claims that count against the ceiling: approved or paid. */
export const countsAgainstCeiling = (status: ClaimStatus) =>
  status === "Approved" || status === "Paid";

/**
 * How much of a claim can be approved, given the ceiling of the cadre for the year and what is
 * already approved for the faculty member in that year (other claims). A ceiling of 0 is not set
 * yet, so nothing is approved until it is.
 */
export function approvable(claimed: number, ceiling: number, approvedSoFar: number) {
  if (ceiling <= 0) return { amount: 0, remaining: 0, capped: true };
  const remaining = Math.max(0, ceiling - approvedSoFar);
  const value = Math.min(claimed, remaining);
  return { amount: Math.round(value * 100) / 100, remaining, capped: value < claimed };
}

/** The key a faculty member's claims are counted under: the mobile number, else the name. */
export function facultyKeyOf(values: ResearchValues) {
  return valueText(values, "mobile") || valueText(values, "facultyName").toLowerCase();
}
