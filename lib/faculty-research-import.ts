import {
  allFields,
  type Instalment,
  type ResearchKind,
  type ResearchValues,
} from "@/lib/faculty-research";

/**
 * Turns the rows of an Excel or CSV sheet into faculty research records. The first row holds the
 * headings: a field is found by its label on the form ("Date of birth"), by its name ("dob") or by
 * a common heading used in the office sheets ("Faculty name", "Journal name").
 */
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const aliases: Record<string, readonly string[]> = {
  facultyName: [
    "facultyname",
    "nameofthefaculty",
    "fullname",
    "faculty",
    "author",
    "authorname",
  ],
  mobile: ["mobile", "mobileno", "phone", "phonenumber", "contactnumber", "mobilenumber"],
  dob: ["dob", "dateofbirth", "birthdate"],
  joinedOn: ["doj", "dateofjoining", "joiningdate", "dateofjoiningsju", "joinedon"],
  sjuAffiliation: ["affiliation", "sjuaffiliation", "universityaffiliation"],
  type: ["publicationtype", "typeofpublication", "category"],
  title: ["titleofthepaper", "papertitle", "titleofpublication", "articletitle"],
  source: [
    "journalname",
    "journal",
    "bookname",
    "proceedingsname",
    "nameofthejournal",
    "conference",
  ],
  doi: ["doinumber"],
  indexing: ["indexedin", "indexed", "index"],
  isbnIssn: ["isbn", "issn", "isbnissn"],
  pages: ["pages", "pageno", "pagenumbers"],
  authorRole: ["authorship", "authortype", "role"],
  authorPosition: ["positionnumber", "authorpositionnumber", "authororder"],
  authorCount: ["numberofauthors", "noofauthors", "totalauthors"],
  link: ["url", "weblink", "link"],
  publishedOn: ["dateofpublication", "publicationdate", "publishedon"],
  year: ["year", "yearofpublication"],
  patentNumber: ["patentno", "patentnumber", "applicationnumber"],
  projectTitle: ["titleoftheproject", "project", "projecttitle"],
  agency: ["fundingagency", "agency", "submittedto"],
  amountProposed: ["amountproposed", "proposedamount", "budget"],
  submittedOn: ["submittedon", "dateofsubmission", "submissiondate"],
  amountSanctioned: ["sanctionedamount", "amountsanctioned"],
  sanctionedOn: ["sanctiondate", "dateofsanction", "sanctionedon"],
  bankAccountNo: ["accountnumber", "bankaccount", "accountno"],
};

const shortMonths = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** A date as typed in a sheet (2026-03-10, 10-03-2026, 10/3/26, 10 Mar 2026) as an ISO date. */
export function sheetDate(value: string, birth = false) {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text);
  const named = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,.-]*(\d{2}|\d{4})$/.exec(text);
  let day = 0;
  let month = 0;
  let yearText = "";
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    yearText = numeric[3];
  } else if (named) {
    day = Number(named[1]);
    month = shortMonths.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    yearText = named[3];
  } else return text;
  let year = Number(yearText);
  // Two-digit years: a birth year is in the 1900s; anything else in the 2000s (up to 2050).
  if (yearText.length === 2) year += birth || year > 50 ? 1900 : 2000;
  if (!day || !month) return text;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function matchOption(value: string, options: readonly string[]) {
  const wanted = key(value);
  if (!wanted) return "";
  return (
    options.find((option) => key(option) === wanted) ??
    options.find(
      (option) => key(option).startsWith(wanted) || wanted.startsWith(key(option)),
    ) ??
    value.trim()
  );
}

/** "400000 on 2025-07-01; 250000 on 01-12-2025" as instalments. */
export function sheetInstalments(value: string): Instalment[] {
  return value
    .split(/[;\n|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^([₹\d,.\s]+?)\s*(?:on|@|:)\s*(.+)$/i.exec(part);
      if (!match) return { amount: part.replace(/[₹,\s]/g, ""), receivedOn: "" };
      return {
        amount: match[1].replace(/[₹,\s]/g, ""),
        receivedOn: sheetDate(match[2]),
      };
    });
}

/** The heading each field is written under in the blank sheet. */
export function templateHeaders(kind: ResearchKind) {
  return allFields(kind).map((field) =>
    field.type === "instalments"
      ? `${field.label} (amount on date; …)`
      : field.type === "multi"
        ? `${field.label} (separate with ;)`
        : field.label,
  );
}

/** Which column of the sheet feeds each field; columns that match nothing are left out. */
export function columnMap(kind: ResearchKind, headers: readonly string[]) {
  const map = new Map<string, string>();
  const used = new Set<string>();
  const fields = allFields(kind);
  const pass = (test: (header: string, field: (typeof fields)[number]) => boolean) => {
    for (const field of fields) {
      if (map.has(field.key)) continue;
      const header = headers.find(
        (item) => !used.has(item) && test(key(item.replace(/\(.*\)\s*$/, "")), field),
      );
      if (header) {
        map.set(field.key, header);
        used.add(header);
      }
    }
  };
  pass((header, field) => header === key(field.label) || header === key(field.key));
  pass((header, field) => (aliases[field.key] ?? []).includes(header));
  return map;
}

export function rowValues(
  kind: ResearchKind,
  row: Record<string, string>,
  map: Map<string, string>,
): ResearchValues {
  const values: ResearchValues = {};
  for (const field of allFields(kind)) {
    const header = map.get(field.key);
    const cell = header ? String(row[header] ?? "").trim() : "";
    if (field.type === "multi") {
      values[field.key] = cell
        .split(/[;,|/]+/)
        .map((part) => matchOption(part, field.options ?? []))
        .filter(Boolean);
    } else if (field.type === "instalments") {
      values[field.key] = sheetInstalments(cell);
    } else if (field.type === "select") {
      values[field.key] = matchOption(cell, field.options ?? []);
    } else if (field.type === "confirm") {
      values[field.key] = /^(y|yes|true|1|✓)$/i.test(cell) ? "Yes" : "";
    } else if (field.type === "date") {
      values[field.key] = cell ? sheetDate(cell, field.key === "dob") : "";
    } else values[field.key] = cell;
  }
  // A year left empty is taken from the date of publication (or the filing date of a patent).
  if (kind === "publication" && !values.year) {
    const date = String(values.publishedOn || values.filedOn || "");
    if (/^\d{4}-/.test(date)) values.year = date.slice(0, 4);
  }
  if (kind === "proposal" && !values.settlement)
    values.settlement = values.status === "Accepted" ? "Open" : "";
  return values;
}
