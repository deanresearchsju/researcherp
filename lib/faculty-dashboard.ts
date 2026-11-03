import {
  indexingOf,
  isApproved,
  isRejected,
  publicationTypes,
  receivedTotal,
  recordYear,
  valueText,
  type ResearchRecord,
} from "@/lib/faculty-research";

/**
 * The figures on a faculty member's own page: how many publications and proposals, of which
 * kind, in which year, and how many are Checked & Approved. Every figure can be clicked to show
 * the records behind it.
 */
export type Category =
  | { kind: "all" }
  | { kind: "type"; value: string }
  | { kind: "indexing"; value: string }
  | { kind: "proposals" }
  | { kind: "approved" }
  | { kind: "waiting" }
  | { kind: "rejected" };

export type DashboardFilter = { year: string; category: Category };

export const allRecords: DashboardFilter = { year: "", category: { kind: "all" } };

export const indexedIn = ["Scopus", "Web of Science", "UGC-CARE", "PubMed"] as const;

const isPublication = (record: ResearchRecord) => record.kind === "publication";

export function matchesCategory(record: ResearchRecord, category: Category) {
  switch (category.kind) {
    case "all":
      return true;
    case "type":
      return isPublication(record) && valueText(record.values, "type") === category.value;
    case "indexing":
      return isPublication(record) && indexingOf(record.values).includes(category.value);
    case "proposals":
      return record.kind === "proposal";
    case "approved":
      return isApproved(record);
    case "waiting":
      return !isApproved(record) && !isRejected(record);
    case "rejected":
      return isRejected(record);
  }
}

export function filterRecords(
  records: readonly ResearchRecord[],
  filter: DashboardFilter,
) {
  return records.filter(
    (record) =>
      (!filter.year || recordYear(record.kind, record.values) === filter.year) &&
      matchesCategory(record, filter.category),
  );
}

export function sameCategory(left: Category, right: Category) {
  return (
    left.kind === right.kind &&
    ("value" in left ? left.value : "") === ("value" in right ? right.value : "")
  );
}

export type YearBar = {
  year: string;
  total: number;
  /** Publications by type, in the order of publicationTypes, then proposals. */
  parts: { label: string; count: number }[];
};

export function facultySummary(records: readonly ResearchRecord[]) {
  const publications = records.filter(isPublication);
  const proposals = records.filter((record) => record.kind === "proposal");
  const byType = publicationTypes.map((type) => ({
    label: type,
    count: publications.filter((record) => valueText(record.values, "type") === type)
      .length,
  }));
  const byIndexing = indexedIn.map((name) => ({
    label: name,
    count: publications.filter((record) => indexingOf(record.values).includes(name))
      .length,
  }));
  const accepted = proposals.filter(
    (record) => valueText(record.values, "status") === "Accepted",
  );
  const sanctioned = accepted.reduce(
    (sum, record) => sum + (Number(valueText(record.values, "amountSanctioned")) || 0),
    0,
  );
  const received = accepted.reduce(
    (sum, record) => sum + receivedTotal(record.values),
    0,
  );
  const years = [
    ...new Set(
      records.map((record) => recordYear(record.kind, record.values)).filter(Boolean),
    ),
  ].sort();
  const bars: YearBar[] = years.map((year) => {
    const inYear = records.filter(
      (record) => recordYear(record.kind, record.values) === year,
    );
    const parts = [
      ...publicationTypes.map((type) => ({
        label: type,
        count: inYear.filter(
          (record) => isPublication(record) && valueText(record.values, "type") === type,
        ).length,
      })),
      {
        label: "Project proposals",
        count: inYear.filter((record) => record.kind === "proposal").length,
      },
    ];
    return { year, total: inYear.length, parts };
  });
  // Project money, overall and by the year the proposal was submitted.
  const amount = (record: ResearchRecord, key: string) =>
    Number(valueText(record.values, key)) || 0;
  const isAccepted = (record: ResearchRecord) =>
    valueText(record.values, "status") === "Accepted";
  const proposed = proposals.reduce(
    (sum, record) => sum + amount(record, "amountProposed"),
    0,
  );
  const fundingYears = [
    ...new Set(
      proposals.map((record) => recordYear(record.kind, record.values)).filter(Boolean),
    ),
  ].sort();
  const funding = fundingYears.map((year) => {
    const inYear = proposals.filter(
      (record) => recordYear(record.kind, record.values) === year,
    );
    const accepted = inYear.filter(isAccepted);
    return {
      year,
      count: inYear.length,
      proposed: inYear.reduce((sum, record) => sum + amount(record, "amountProposed"), 0),
      sanctioned: accepted.reduce(
        (sum, record) => sum + amount(record, "amountSanctioned"),
        0,
      ),
      received: accepted.reduce((sum, record) => sum + receivedTotal(record.values), 0),
    };
  });
  return {
    proposed,
    funding,
    largestYear: Math.max(
      0,
      ...funding.map((item) => Math.max(item.proposed, item.sanctioned)),
    ),
    publications: publications.length,
    proposals: proposals.length,
    accepted: accepted.length,
    sanctioned,
    received,
    approved: records.filter(isApproved).length,
    waiting: records.filter((record) => !isApproved(record) && !isRejected(record))
      .length,
    rejected: records.filter(isRejected).length,
    byType,
    byIndexing,
    bars,
    busiest: Math.max(0, ...bars.map((bar) => bar.total)),
  };
}

export const groupings = ["type", "year", "status", "indexing"] as const;
export type Grouping = (typeof groupings)[number];

export const groupingLabel: Record<Grouping, string> = {
  type: "By type",
  year: "By year",
  status: "By status",
  indexing: "By indexing",
};

const statusOrder = ["Waiting for approval", "Rejected", "Checked & Approved"];

/**
 * The records in sections, one criterion at a time: by type of work (proposals last), by year
 * (newest first), by review status, or by indexing (a paper in two indexes is in both; papers
 * in none, patents and proposals are listed apart).
 */
export function groupRecords(records: readonly ResearchRecord[], by: Grouping) {
  const groups = new Map<string, ResearchRecord[]>();
  const add = (label: string, record: ResearchRecord) =>
    groups.set(label, [...(groups.get(label) ?? []), record]);
  for (const record of records) {
    if (by === "type")
      add(
        record.kind === "proposal"
          ? "Project proposals"
          : valueText(record.values, "type") || "Other",
        record,
      );
    else if (by === "year")
      add(recordYear(record.kind, record.values) || "No year", record);
    else if (by === "status")
      add(
        isApproved(record)
          ? "Checked & Approved"
          : isRejected(record)
            ? "Rejected"
            : "Waiting for approval",
        record,
      );
    else {
      const list = record.kind === "publication" ? indexingOf(record.values) : [];
      if (record.kind === "proposal") add("Project proposals", record);
      else if (list.length === 0) add("Not indexed", record);
      else for (const name of list) add(name, record);
    }
  }
  const order = (label: string) => {
    if (by === "type") {
      const at = [...publicationTypes, "Other", "Project proposals"].indexOf(label);
      return at < 0 ? 99 : at;
    }
    if (by === "status") return statusOrder.indexOf(label);
    if (by === "indexing") {
      const at = [...indexedIn, "Not indexed", "Project proposals"].indexOf(label);
      return at < 0 ? 50 : at;
    }
    return 0;
  };
  return [...groups.entries()]
    .map(([label, items]) => ({ label, records: items }))
    .sort((a, b) =>
      by === "year"
        ? b.label.localeCompare(a.label)
        : order(a.label) - order(b.label) || a.label.localeCompare(b.label),
    );
}
