import {
  indexingOf,
  isApproved,
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
  | { kind: "waiting" };

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
      return !isApproved(record);
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
  return {
    publications: publications.length,
    proposals: proposals.length,
    accepted: accepted.length,
    sanctioned,
    received,
    approved: records.filter(isApproved).length,
    waiting: records.filter((record) => !isApproved(record)).length,
    byType,
    byIndexing,
    bars,
    busiest: Math.max(0, ...bars.map((bar) => bar.total)),
  };
}
