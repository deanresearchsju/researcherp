import { schools } from "@/data/schools";

/**
 * Faculty publications and project proposals: the fields each record holds, how a submitted
 * record is checked and cleaned, and how a change is described for the audit trail. The same
 * rules run in the browser (to show the errors) and on the server (to refuse a bad record).
 */
export type ResearchKind = "publication" | "proposal";
export const researchKinds: readonly ResearchKind[] = ["publication", "proposal"];

export type Instalment = { amount: string; receivedOn: string };
/** Uploaded evidence: checklist item id → stored file reference. */
export type Evidence = Record<string, string>;
export type ResearchValue = string | string[] | Instalment[] | Evidence;
export type ResearchValues = Record<string, ResearchValue>;

export type ResearchRecord = {
  id: string;
  kind: ResearchKind;
  createdAt: string;
  updatedAt: string;
  /** "public" (the open page), "scholar", "supervisor" or an office role. */
  source: string;
  ownerRole: string;
  ownerIdentifier: string;
  values: ResearchValues;
  /** Set when the Dean or the administrator approved the record ("Checked & Approved"). */
  approvedAt?: string | null;
  approvedBy?: string;
};

export const approvedLabel = "Checked & Approved";
export const pendingLabel = "Waiting for approval";
export const isApproved = (record: Pick<ResearchRecord, "approvedAt">) =>
  Boolean(record.approvedAt);

type FieldType =
  | "text"
  | "number"
  | "money"
  | "date"
  | "select"
  | "multi"
  | "instalments"
  /** A tick box: "Yes" when ticked. */
  | "confirm";

export type ResearchField = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  /** Suggestions offered while typing (a text field stays free). */
  suggestions?: readonly string[];
  max?: number;
  required?: (values: ResearchValues) => boolean;
  show?: (values: ResearchValues) => boolean;
  check?: (value: string, values: ResearchValues, today: string) => string | null;
  wide?: boolean;
};

export const researchMenus: Record<
  ResearchKind,
  {
    label: string;
    adminHref: string;
    publicHref: string;
    memberSlug: string;
    memberLabel: string;
  }
> = {
  publication: {
    label: "Faculty publications",
    adminHref: "/admin/faculty-publications",
    publicHref: "/faculty-research",
    memberSlug: "faculty-publications",
    memberLabel: "Publication records",
  },
  proposal: {
    label: "Project proposals",
    adminHref: "/admin/project-proposals",
    publicHref: "/faculty-research",
    memberSlug: "project-proposals",
    memberLabel: "Project proposals",
  },
};

export const designations = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Professor of Practice",
  "Other",
] as const;

export const campuses = [
  "Muttom",
  "Tindivanam",
  "Palanjur",
  "Aral",
  "Sri Perumbudur",
  "Other",
] as const;

export const schoolNames = [...schools.map((school) => school.name), "Other"];
export const departmentNames = [
  ...new Set(schools.flatMap((school) => school.areas)),
].sort((a, b) => a.localeCompare(b));

export const publicationTypes = [
  "Journal article",
  "Book",
  "Book chapter",
  "Conference proceedings",
  "Patent",
] as const;

export const indexingOptions = [
  "Scopus",
  "Web of Science",
  "UGC-CARE",
  "PubMed",
  "Others",
] as const;

export const authorRoles = ["First author", "Corresponding author", "Co-author"] as const;
export const patentStatuses = ["Filed", "Published", "Granted"] as const;

export const fundingAgencies = [
  "UGC",
  "DRDO",
  "ICSSR",
  "MSME",
  "DST",
  "SERB / ANRF",
  "CSIR",
  "ICMR",
  "DBT",
  "AICTE",
  "ICAR",
  "MoE",
  "Other",
] as const;

export const proposalStatuses = [
  "Submitted",
  "Under process",
  "Accepted",
  "Rejected",
] as const;
export const settlementStates = ["Open", "Settled", "Closed"] as const;

export const instalmentLimit = 20;

const text = (values: ResearchValues, key: string) => {
  const value = values[key];
  return typeof value === "string" ? value : "";
};
const list = (values: ResearchValues, key: string) => {
  const value = values[key];
  return Array.isArray(value)
    ? (value as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
};
export const instalmentsOf = (values: ResearchValues): Instalment[] => {
  const value = values.instalments;
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).flatMap((item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? [
          {
            amount: String((item as Record<string, unknown>).amount ?? ""),
            receivedOn: String((item as Record<string, unknown>).receivedOn ?? ""),
          },
        ]
      : [],
  );
};

const always = () => true;
const isPatent = (values: ResearchValues) => text(values, "type") === "Patent";
const notPatent = (values: ResearchValues) => !isPatent(values);
const accepted = (values: ResearchValues) => text(values, "status") === "Accepted";

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function notFuture(value: string, _values: ResearchValues, today: string) {
  return value > today ? "The date cannot be in the future." : null;
}

function ageCheck(value: string, _values: ResearchValues, today: string) {
  if (value >= today) return "Enter the date of birth.";
  const years = Number(today.slice(0, 4)) - Number(value.slice(0, 4));
  if (years < 15 || years > 100) return "Check the date of birth.";
  return null;
}

export const identityFields: readonly ResearchField[] = [
  { key: "facultyName", label: "Name", type: "text", max: 120, required: always },
  {
    key: "designation",
    label: "Designation",
    type: "select",
    options: designations,
    required: always,
  },
  {
    key: "department",
    label: "Department",
    type: "text",
    max: 120,
    suggestions: departmentNames,
    required: always,
  },
  {
    key: "school",
    label: "School",
    type: "select",
    options: schoolNames,
    required: always,
  },
  { key: "campus", label: "Campus", type: "select", options: campuses, required: always },
  {
    key: "mobile",
    label: "Mobile number",
    type: "text",
    max: 10,
    required: always,
    check: (value) =>
      /^[6-9]\d{9}$/.test(value) ? null : "Enter a 10-digit mobile number.",
  },
  { key: "dob", label: "Date of birth", type: "date", required: always, check: ageCheck },
  {
    // Faculty give it on the open page and in the portal; only work from this date is counted.
    key: "joinedOn",
    label: "Date of joining SJU",
    type: "date",
    check: (value, values, today) => {
      if (value > today) return "The date cannot be in the future.";
      const dob = text(values, "dob");
      if (dob && Number(value.slice(0, 4)) - Number(dob.slice(0, 4)) < 18)
        return "Check the date of joining.";
      return null;
    },
  },
];

const journalLike = (values: ResearchValues) =>
  ["Journal article", "Conference proceedings"].includes(text(values, "type"));
const hasPages = (values: ResearchValues) =>
  ["Journal article", "Conference proceedings", "Book chapter"].includes(
    text(values, "type"),
  );

export const publicationFields: readonly ResearchField[] = [
  {
    key: "type",
    label: "Type",
    type: "select",
    options: publicationTypes,
    required: always,
  },
  { key: "title", label: "Title", type: "text", max: 500, required: always, wide: true },
  {
    key: "source",
    label: "Journal / book / proceedings name",
    type: "text",
    max: 300,
    required: notPatent,
    show: notPatent,
    wide: true,
  },
  { key: "publisher", label: "Publisher", type: "text", max: 200, show: notPatent },
  {
    key: "doi",
    label: "DOI",
    type: "text",
    max: 200,
    show: notPatent,
    check: (value) =>
      /^10\.\d{4,9}\/\S+$/.test(value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ""))
        ? null
        : "Enter a DOI such as 10.1000/xyz123.",
  },
  {
    key: "indexing",
    label: "Indexing",
    type: "multi",
    options: indexingOptions,
    show: notPatent,
    wide: true,
  },
  {
    key: "indexingOther",
    label: "Other indexing",
    type: "text",
    max: 120,
    show: (values) => notPatent(values) && list(values, "indexing").includes("Others"),
    required: (values) => list(values, "indexing").includes("Others"),
  },
  {
    // The SCI incentive depends on it (policy bands 1–2, 2.1–4.0 and 4.1 and above).
    key: "impactFactor",
    label: "Impact factor",
    type: "text",
    max: 7,
    show: (values) =>
      notPatent(values) && list(values, "indexing").includes("Web of Science"),
    check: (value) =>
      /^\d{1,3}(\.\d{1,3})?$/.test(value)
        ? null
        : "Enter the impact factor, such as 2.45.",
  },
  { key: "volume", label: "Volume", type: "text", max: 40, show: journalLike },
  { key: "issue", label: "Issue", type: "text", max: 40, show: journalLike },
  { key: "pages", label: "Page numbers", type: "text", max: 40, show: hasPages },
  { key: "isbnIssn", label: "ISBN / ISSN", type: "text", max: 40, show: notPatent },
  {
    key: "authorRole",
    label: "Author position",
    type: "select",
    options: authorRoles,
    required: always,
  },
  {
    key: "authorPosition",
    label: "Position number",
    type: "number",
    required: always,
    check: (value) =>
      /^\d{1,3}$/.test(value) && Number(value) >= 1
        ? null
        : "Enter the position (1, 2, 3 …).",
  },
  {
    key: "authorCount",
    label: "Number of authors",
    type: "number",
    required: always,
    check: (value, values) => {
      if (!/^\d{1,3}$/.test(value) || Number(value) < 1)
        return "Enter the number of authors.";
      const position = Number(text(values, "authorPosition"));
      return position > Number(value) ? "Cannot be less than the position number." : null;
    },
  },
  {
    // Only work carrying the university affiliation counts; faculty tick it when adding.
    key: "sjuAffiliation",
    label: "This work carries the St. Joseph University affiliation",
    type: "confirm",
    wide: true,
  },
  {
    key: "link",
    label: "Web link",
    type: "text",
    max: 500,
    wide: true,
    check: (value) =>
      /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(value)
        ? null
        : "Enter a full link (https://…).",
  },
  {
    key: "publishedOn",
    label: "Date of publication",
    type: "date",
    required: notPatent,
    check: notFuture,
  },
  {
    key: "year",
    label: "Year",
    type: "number",
    required: always,
    check: (value, values, today) => {
      const year = Number(value);
      if (!/^\d{4}$/.test(value) || year < 1950 || year > Number(today.slice(0, 4)) + 1)
        return "Enter the year.";
      const date = text(values, "publishedOn");
      if (date && date.slice(0, 4) !== value)
        return "Does not match the date of publication.";
      return null;
    },
  },
  {
    key: "patentNumber",
    label: "Patent / application number",
    type: "text",
    max: 60,
    show: isPatent,
    required: isPatent,
  },
  {
    key: "patentStatus",
    label: "Patent status",
    type: "select",
    options: patentStatuses,
    show: isPatent,
    required: isPatent,
  },
  {
    key: "filedOn",
    label: "Filing date",
    type: "date",
    show: isPatent,
    required: isPatent,
    check: notFuture,
  },
  {
    key: "grantedOn",
    label: "Grant date",
    type: "date",
    show: isPatent,
    required: (values) => isPatent(values) && text(values, "patentStatus") === "Granted",
    check: (value, values, today) => {
      const filed = text(values, "filedOn");
      if (filed && value < filed) return "Cannot be before the filing date.";
      return notFuture(value, values, today);
    },
  },
];

function money(value: string) {
  return /^\d{1,12}(\.\d{1,2})?$/.test(value) ? null : "Enter the amount in rupees.";
}

export const proposalFields: readonly ResearchField[] = [
  {
    key: "projectTitle",
    label: "Project title",
    type: "text",
    max: 500,
    required: always,
    wide: true,
  },
  {
    key: "agency",
    label: "Submitted to",
    type: "select",
    options: fundingAgencies,
    required: always,
  },
  {
    key: "agencyOther",
    label: "Agency name",
    type: "text",
    max: 160,
    show: (values) => text(values, "agency") === "Other",
    required: (values) => text(values, "agency") === "Other",
  },
  {
    key: "amountProposed",
    label: "Amount proposed (₹)",
    type: "money",
    required: always,
    check: money,
  },
  {
    key: "submittedOn",
    label: "Submitted on",
    type: "date",
    required: always,
    check: notFuture,
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: proposalStatuses,
    required: always,
  },
  {
    key: "amountSanctioned",
    label: "Amount sanctioned (₹)",
    type: "money",
    show: accepted,
    required: accepted,
    check: money,
  },
  {
    key: "sanctionedOn",
    label: "Sanction date",
    type: "date",
    show: accepted,
    required: accepted,
    check: (value, values, today) => {
      const sent = text(values, "submittedOn");
      if (sent && value < sent) return "Cannot be before the submission date.";
      return notFuture(value, values, today);
    },
  },
  {
    key: "sanctionOrderNo",
    label: "Sanction order number",
    type: "text",
    max: 80,
    show: accepted,
  },
  {
    key: "bankAccountNo",
    label: "Bank account number",
    type: "text",
    max: 20,
    show: accepted,
    check: (value) =>
      /^\d{6,20}$/.test(value) ? null : "Enter the account number (digits only).",
  },
  {
    key: "instalments",
    label: "Instalments received",
    type: "instalments",
    show: accepted,
    wide: true,
  },
  {
    key: "amountUtilised",
    label: "Amount utilised (₹)",
    type: "money",
    show: accepted,
    check: money,
  },
  {
    key: "utilisationOn",
    label: "Utilisation certificate date",
    type: "date",
    show: accepted,
    check: notFuture,
  },
  {
    key: "settlement",
    label: "Settled / closed",
    type: "select",
    options: settlementStates,
    show: accepted,
  },
  {
    key: "closedOn",
    label: "Settled / closed on",
    type: "date",
    show: (values) =>
      accepted(values) && ["Settled", "Closed"].includes(text(values, "settlement")),
    required: (values) =>
      accepted(values) && ["Settled", "Closed"].includes(text(values, "settlement")),
    check: notFuture,
  },
];

export function recordFields(kind: ResearchKind) {
  return kind === "publication" ? publicationFields : proposalFields;
}

export function allFields(kind: ResearchKind) {
  return [...identityFields, ...recordFields(kind)];
}

export function isShown(field: ResearchField, values: ResearchValues) {
  return field.show ? field.show(values) : true;
}

export function emptyValues(kind: ResearchKind): ResearchValues {
  const values: ResearchValues = {};
  for (const field of allFields(kind)) {
    values[field.key] = field.type === "multi" || field.type === "instalments" ? [] : "";
  }
  if (kind === "proposal") values.settlement = "Open";
  return values;
}

export type CleanResult =
  { ok: true; values: ResearchValues } | { ok: false; errors: Record<string, string> };

const controlChars = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(controlChars, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Checks a record sent by a person and returns only the fields that belong to it, trimmed and
 * cut to size. Fields hidden by the current choices (patent fields on a journal article, funding
 * fields on a rejected proposal) are dropped so that no stale value is kept.
 */
export function cleanValues(
  kind: ResearchKind,
  input: unknown,
  today: string,
): CleanResult {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const fields = allFields(kind);
  const values: ResearchValues = {};
  // First pass: read every field as sent, so that show/required rules see the whole record.
  for (const field of fields) {
    const sent = raw[field.key];
    if (field.type === "multi") {
      values[field.key] = Array.isArray(sent)
        ? [...new Set(sent.map((item) => cleanText(item, 60)))].filter((item) =>
            field.options?.includes(item),
          )
        : [];
    } else if (field.type === "instalments") {
      values[field.key] = Array.isArray(sent)
        ? sent.slice(0, instalmentLimit + 1).map((item) => {
            const row =
              item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            return {
              amount: cleanText(row.amount, 15),
              receivedOn: cleanText(row.receivedOn, 10),
            };
          })
        : [];
    } else {
      let value = cleanText(
        sent,
        field.key === "mobile"
          ? 20
          : (field.max ??
              (field.type === "date" ? 10 : field.type === "select" ? 200 : 20)),
      );
      if (field.key === "mobile")
        value = value
          .replace(/[\s-]/g, "")
          .replace(/^(\+91|0)(?=\d{10}$)/, "")
          .slice(0, 13);
      if (field.type === "money") value = value.replace(/[,₹\s]/g, "");
      values[field.key] = value;
    }
  }
  const errors: Record<string, string> = {};
  const result: ResearchValues = {};
  for (const field of fields) {
    if (!isShown(field, values)) continue;
    const value = values[field.key];
    const needed = field.required?.(values) ?? false;
    if (field.type === "multi") {
      const chosen = value as string[];
      if (needed && chosen.length === 0)
        errors[field.key] = `Choose the ${field.label.toLowerCase()}.`;
      result[field.key] = chosen;
      continue;
    }
    if (field.type === "instalments") {
      const rows = (value as Instalment[]).filter((row) => row.amount || row.receivedOn);
      if (rows.length > instalmentLimit)
        errors[field.key] = `At most ${instalmentLimit} instalments.`;
      const bad = rows.findIndex(
        (row) =>
          money(row.amount) !== null ||
          !isIsoDate(row.receivedOn) ||
          row.receivedOn > today,
      );
      if (bad >= 0)
        errors[field.key] =
          `Instalment ${bad + 1}: enter the amount and a date that is not in the future.`;
      result[field.key] = rows;
      continue;
    }
    const textValue = value as string;
    if (field.type === "confirm") {
      result[field.key] = textValue === "Yes" || textValue === "true" ? "Yes" : "";
      if (needed && !result[field.key]) errors[field.key] = `Tick: ${field.label}.`;
      continue;
    }
    if (!textValue) {
      if (needed)
        errors[field.key] =
          field.type === "select"
            ? `Choose the ${field.label.toLowerCase()}.`
            : `Enter the ${field.label.toLowerCase()}.`;
      result[field.key] = "";
      continue;
    }
    if (field.type === "select" && !field.options?.includes(textValue)) {
      errors[field.key] = `Choose the ${field.label.toLowerCase()}.`;
    } else if (field.type === "date" && !isIsoDate(textValue)) {
      errors[field.key] = "Enter a valid date.";
    } else if (field.type === "number" && !/^\d+$/.test(textValue)) {
      errors[field.key] = `Enter the ${field.label.toLowerCase()}.`;
    } else {
      const problem = field.check?.(textValue, values, today);
      if (problem) errors[field.key] = problem;
    }
    result[field.key] = textValue;
  }
  if (kind === "proposal" && accepted(result) && !errors.instalments) {
    const sanctioned = Number(text(result, "amountSanctioned") || 0);
    const received = receivedTotal(result);
    if (received > sanctioned)
      errors.instalments = "The instalments add up to more than the amount sanctioned.";
    const sanctionedOn = text(result, "sanctionedOn");
    if (
      sanctionedOn &&
      instalmentsOf(result).some((row) => row.receivedOn < sanctionedOn)
    )
      errors.instalments = "An instalment cannot be before the sanction date.";
  }
  // Work done before joining the university is not counted.
  const joined = text(result, "joinedOn");
  if (joined && !errors.joinedOn) {
    const dateKey =
      kind === "proposal"
        ? "submittedOn"
        : text(result, "publishedOn")
          ? "publishedOn"
          : text(result, "type") === "Patent"
            ? "filedOn"
            : "";
    const date = dateKey ? text(result, dateKey) : "";
    if (date && date < joined && !errors[dateKey])
      errors[dateKey] =
        `Before your date of joining SJU (${formatDay(joined)}): only work from that date is counted.`;
  }
  const evidence = evidenceOf(raw);
  if (Object.keys(evidence).length > 0) result.evidence = evidence;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: result };
}

/** A file reference the ERP stored in the faculty research folder (nothing else is kept). */
export const evidenceRefPattern =
  /^\/api\/files\/research\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/;

/** The uploaded evidence of a record, keeping only well-formed item ids and stored references. */
export function evidenceOf(values: Record<string, unknown>): Evidence {
  const sent = values.evidence;
  if (!sent || typeof sent !== "object" || Array.isArray(sent)) return {};
  const evidence: Evidence = {};
  for (const [id, ref] of Object.entries(sent as Record<string, unknown>).slice(0, 30)) {
    if (
      /^[a-z0-9-]{1,60}$/.test(id) &&
      typeof ref === "string" &&
      evidenceRefPattern.test(ref)
    )
      evidence[id] = ref;
  }
  return evidence;
}

export function receivedTotal(values: ResearchValues) {
  return instalmentsOf(values).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export function balanceOf(values: ResearchValues) {
  return Math.max(
    0,
    (Number(text(values, "amountSanctioned")) || 0) - receivedTotal(values),
  );
}

/** Where a proposal stands: its status, or for an accepted one the funding step it has reached. */
export function fundingStage(values: ResearchValues) {
  const status = text(values, "status");
  if (status !== "Accepted") return status;
  const settlement = text(values, "settlement");
  if (settlement === "Settled" || settlement === "Closed") return settlement;
  if (text(values, "utilisationOn") || text(values, "amountUtilised"))
    return "Utilisation";
  if (instalmentsOf(values).length > 0) return "Instalments";
  return "Sanctioned";
}

/** The date a record is filed under in date-wise lists. */
export function recordDate(kind: ResearchKind, values: ResearchValues) {
  if (kind === "proposal") return text(values, "submittedOn");
  return (
    text(values, "publishedOn") ||
    text(values, "filedOn") ||
    (text(values, "year") ? `${text(values, "year")}-01-01` : "")
  );
}

export function recordYear(kind: ResearchKind, values: ResearchValues) {
  if (kind === "publication") return text(values, "year");
  return text(values, "submittedOn").slice(0, 4);
}

export function agencyOf(values: ResearchValues) {
  const agency = text(values, "agency");
  return agency === "Other" ? text(values, "agencyOther") || "Other" : agency;
}

export function indexingOf(values: ResearchValues) {
  return list(values, "indexing").map((item) =>
    item === "Others" ? text(values, "indexingOther") || "Others" : item,
  );
}

export function rupees(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);
  if (value === "" || !Number.isFinite(amount)) return "";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDay(iso: string) {
  if (!isIsoDate(iso)) return iso;
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

/** A field's value as text for a table, a PDF or the audit trail. */
export function displayValue(field: ResearchField, values: ResearchValues) {
  const value = values[field.key];
  if (field.type === "instalments") {
    return instalmentsOf(values)
      .map(
        (row, index) =>
          `${index + 1}) ${rupees(row.amount)} on ${formatDay(row.receivedOn)}`,
      )
      .join("; ");
  }
  if (field.key === "indexing") return indexingOf(values).join(", ");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value !== "string") return "";
  if (field.type === "date") return formatDay(value);
  if (field.type === "money") return rupees(value);
  return value;
}

/** Shows only the last four digits of a bank account (for the public look-up). */
export function maskAccount(value: string) {
  return value.length > 4
    ? `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`
    : value;
}

/** What changed between two versions of a record, one line per field, for the audit trail. */
export function describeChanges(
  kind: ResearchKind,
  before: ResearchValues,
  after: ResearchValues,
) {
  const lines: string[] = [];
  for (const field of allFields(kind)) {
    const from = displayValue(field, before);
    const to = displayValue(field, after);
    if (from === to) continue;
    const show = (value: string) =>
      field.key === "bankAccountNo"
        ? maskAccount(value) || "—"
        : (value || "—").slice(0, 160);
    lines.push(`${field.label}: ${show(from)} → ${show(to)}`);
  }
  const was = evidenceOf(before);
  const now = evidenceOf(after);
  for (const id of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (was[id] === now[id]) continue;
    lines.push(
      `Evidence ${id}: ${now[id] ? (was[id] ? "replaced" : "uploaded") : "removed"}`,
    );
  }
  return lines;
}

/** A one-line name for a record in lists and in the audit trail. */
export function recordTitle(kind: ResearchKind, values: ResearchValues) {
  return (
    kind === "publication" ? text(values, "title") : text(values, "projectTitle")
  ).slice(0, 160);
}

export function valueText(values: ResearchValues, key: string) {
  return text(values, key);
}

const squash = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/**
 * The values that must not repeat: the same title (of the same kind), the same DOI or the same
 * patent number is one record, however it is spaced, cased or punctuated.
 */
export function duplicateKeys(kind: ResearchKind, values: ResearchValues) {
  const title = squash(recordTitle(kind, values));
  if (kind === "proposal") return { title, doi: "", patent: "" };
  const doi = text(values, "doi")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
  const patent =
    text(values, "type") === "Patent" ? squash(text(values, "patentNumber")) : "";
  return { title, doi, patent };
}

export type DuplicateKey = keyof ReturnType<typeof duplicateKeys>;

export const duplicateMessages: Record<DuplicateKey, string> = {
  title: "A record with this title is already saved.",
  doi: "A record with this DOI is already saved.",
  patent: "A record with this patent number is already saved.",
};

/** The form field that carries each unique value, for showing the message beside it. */
export function duplicateField(kind: ResearchKind, key: DuplicateKey) {
  if (key === "doi") return "doi";
  if (key === "patent") return "patentNumber";
  return kind === "publication" ? "title" : "projectTitle";
}

/** The personal details of a record (name, designation, department, school, campus, mobile, date of birth). */
export function identityOf(values: ResearchValues): ResearchValues {
  const identity: ResearchValues = {};
  for (const field of identityFields) identity[field.key] = text(values, field.key);
  return identity;
}

/**
 * What faculty must give when they add a record themselves (the open page and the portal): the
 * date of joining SJU and, for publications and patents, the confirmation that the work carries
 * the university affiliation. Records the office adds or imports are not held to it.
 */
export function facultyChecks(kind: ResearchKind, values: ResearchValues) {
  const errors: Record<string, string> = {};
  if (!text(values, "joinedOn")) errors.joinedOn = "Enter your date of joining SJU.";
  if (kind === "publication" && text(values, "sjuAffiliation") !== "Yes")
    errors.sjuAffiliation =
      "Only work with the St. Joseph University affiliation is counted: tick to confirm.";
  return errors;
}
