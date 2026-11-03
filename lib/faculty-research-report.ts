import {
  agencyOf,
  balanceOf,
  fundingStage,
  indexingOf,
  receivedTotal,
  recordDate,
  recordYear,
  rupees,
  valueText,
  type ResearchKind,
  type ResearchRecord,
} from "@/lib/faculty-research";

/**
 * Cross-wise reports on faculty publications and project proposals: any one or two fields down
 * the side, any field across the top, and a count or an amount in each cell, with totals.
 */
export type ReportDimension = {
  id: string;
  label: string;
  /** A record may fall under several values (a paper indexed in Scopus and in PubMed). */
  values: (record: ResearchRecord) => string[];
};

export type ReportMeasure = {
  id: string;
  label: string;
  value: (record: ResearchRecord) => number;
  money?: boolean;
};

const one = (value: string) => [value.trim() || "Not given"];
const field = (key: string) => (record: ResearchRecord) =>
  one(valueText(record.values, key));
const accepted = (record: ResearchRecord) =>
  valueText(record.values, "status") === "Accepted";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function reportDimensions(kind: ResearchKind): ReportDimension[] {
  const common: ReportDimension[] = [
    { id: "faculty", label: "Faculty", values: field("facultyName") },
    { id: "department", label: "Department", values: field("department") },
    { id: "school", label: "School", values: field("school") },
    { id: "campus", label: "Campus", values: field("campus") },
    { id: "designation", label: "Designation", values: field("designation") },
    {
      id: "year",
      label: "Year",
      values: (record) => one(recordYear(record.kind, record.values)),
    },
    {
      id: "month",
      label: "Month",
      values: (record) => {
        const date = recordDate(record.kind, record.values);
        return one(
          date
            ? `${date.slice(0, 4)}-${date.slice(5, 7)} ${months[Number(date.slice(5, 7)) - 1] ?? ""}`.trim()
            : "",
        );
      },
    },
  ];
  if (kind === "publication") {
    return [
      ...common,
      { id: "type", label: "Type", values: field("type") },
      {
        id: "indexing",
        label: "Indexing",
        values: (record) => {
          const list = indexingOf(record.values);
          return list.length ? list : ["Not indexed"];
        },
      },
      { id: "authorRole", label: "Author position", values: field("authorRole") },
      { id: "publisher", label: "Publisher", values: field("publisher") },
      { id: "source", label: "Journal / book", values: field("source") },
      { id: "patentStatus", label: "Patent status", values: field("patentStatus") },
    ];
  }
  return [
    ...common,
    { id: "agency", label: "Agency", values: (record) => one(agencyOf(record.values)) },
    { id: "status", label: "Status", values: field("status") },
    {
      id: "stage",
      label: "Funding stage",
      values: (record) => one(fundingStage(record.values)),
    },
  ];
}

export function reportMeasures(kind: ResearchKind): ReportMeasure[] {
  const count: ReportMeasure = {
    id: "count",
    label: "Number of records",
    value: () => 1,
  };
  if (kind === "publication") return [count];
  return [
    count,
    {
      id: "proposed",
      label: "Amount proposed",
      money: true,
      value: (record) => Number(valueText(record.values, "amountProposed")) || 0,
    },
    {
      id: "sanctioned",
      label: "Amount sanctioned",
      money: true,
      value: (record) =>
        accepted(record) ? Number(valueText(record.values, "amountSanctioned")) || 0 : 0,
    },
    {
      id: "received",
      label: "Amount received",
      money: true,
      value: (record) => (accepted(record) ? receivedTotal(record.values) : 0),
    },
    {
      id: "balance",
      label: "Balance to receive",
      money: true,
      value: (record) => (accepted(record) ? balanceOf(record.values) : 0),
    },
  ];
}

export type CrossReport = { headers: string[]; rows: string[][]; title: string };

function sortKeys(values: Iterable<string>) {
  return [...values].sort((left, right) => {
    if (left === "Not given") return 1;
    if (right === "Not given") return -1;
    return left.localeCompare(right, "en", { numeric: true });
  });
}

/**
 * Builds the table. Rows are every combination of the row fields that occurs; columns are the
 * values of the column field (or one column when none is chosen); the last column and the last
 * row are totals. A record under several values is counted under each of them, and once in the
 * totals.
 */
export function crossReport(
  records: readonly ResearchRecord[],
  rowDims: readonly ReportDimension[],
  colDim: ReportDimension | null,
  measure: ReportMeasure,
): CrossReport {
  const format = (value: number) =>
    measure.money ? rupees(value) || "₹0" : String(Math.round(value * 100) / 100);
  const cells = new Map<string, Map<string, number>>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  const rowLabels = new Map<string, string[]>();
  let grand = 0;
  for (const record of records) {
    const amount = measure.value(record);
    grand += amount;
    let combos: string[][] = [[]];
    for (const dim of rowDims) {
      const values = [...new Set(dim.values(record))];
      combos = combos.flatMap((combo) => values.map((value) => [...combo, value]));
    }
    const columns = colDim ? [...new Set(colDim.values(record))] : ["Total"];
    for (const combo of combos) {
      const key = combo.join("\u001f");
      rowLabels.set(key, combo);
      rowTotals.set(key, (rowTotals.get(key) ?? 0) + amount);
      const row = cells.get(key) ?? new Map<string, number>();
      for (const column of columns) row.set(column, (row.get(column) ?? 0) + amount);
      cells.set(key, row);
    }
    for (const column of columns)
      colTotals.set(column, (colTotals.get(column) ?? 0) + amount);
  }
  const columnKeys = colDim ? sortKeys(colTotals.keys()) : [];
  const rowKeys = [...rowLabels.keys()].sort((left, right) => {
    const a = rowLabels.get(left) ?? [];
    const b = rowLabels.get(right) ?? [];
    for (let at = 0; at < a.length; at += 1) {
      const order = sortKeys([a[at], b[at]]);
      if (a[at] !== b[at]) return order[0] === a[at] ? -1 : 1;
    }
    return 0;
  });
  const headers = [
    ...rowDims.map((dim) => dim.label),
    ...columnKeys,
    colDim ? "Total" : measure.label,
  ];
  const rows = rowKeys.map((key) => [
    ...(rowLabels.get(key) ?? []),
    ...columnKeys.map((column) => format(cells.get(key)?.get(column) ?? 0)),
    format(rowTotals.get(key) ?? 0),
  ]);
  rows.push([
    "Total",
    ...rowDims.slice(1).map(() => ""),
    ...columnKeys.map((column) => format(colTotals.get(column) ?? 0)),
    format(grand),
  ]);
  const title = [rowDims.map((dim) => dim.label).join(" › "), colDim ? colDim.label : ""]
    .filter(Boolean)
    .join(" × ");
  return { headers, rows, title: `${measure.label} by ${title}` };
}
