import { researchRegister, type ResearchScholar } from "@/data/research-register";
import { downloadCsv, toCsv } from "@/lib/csv";
import { currentOffice } from "@/lib/office";
import {
  currentAllotments,
  currentQuotas,
  registrationOf,
  scholarBySignIn,
  scholarDownloadHeaders,
  scholarDownloadRow,
  scholarSignInId,
  supervisorBySignIn,
  supervisorDownloadHeaders,
  supervisorDownloadRow,
} from "@/lib/register";
import { formatNetQualification } from "@/lib/net-exam";
import { currentApplications, type StoredApplication } from "@/lib/records";
import { scholarSemesterLabel } from "@/lib/scholar-identity";
import { currentScholarRecords } from "@/lib/scholar-records";
import type { Json } from "@/types/database";

export type PersonFilePair = {
  label: string;
  value: string;
};

export type PersonFileSection = {
  heading: string;
  pairs: PersonFilePair[];
};

export const scholarApplicationHeaders = [
  "Application title",
  "Date of birth",
  "Gender",
  "Nationality",
  "Community",
  "Blood group",
  "Marital status",
  "Study mode (application)",
  "School",
  "Subject",
  "UG",
  "PG",
  "NET / SET / SLET",
  "Communication address",
  "Permanent address",
  "Experience",
  "Research area",
  "Research outline",
  "Father's name",
  "Mother's name",
  "Parent contact",
  "Parent email",
] as const;

export const supervisorApplicationHeaders = [
  "Sex",
  "Date of birth",
  "Religion",
  "Community",
  "State",
  "Nationality",
  "Permanent address",
  "Communication address",
  "Faculty",
  "Subject",
  "Area of expertise",
  "Date of appointment",
  "Postgraduate",
  "M.Phil.",
  "Ph.D.",
  "Ph.D. award year",
  "D.Litt.",
  "Proposed department",
  "Recognised elsewhere",
  "Recognition details",
  "Other information",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function payloadRecord(payload: Json) {
  return asRecord(payload) ?? {};
}

function pair(label: string, value: string): PersonFilePair | null {
  const trimmed = value.trim();
  return trimmed ? { label, value: trimmed } : null;
}

function section(
  heading: string,
  items: Array<PersonFilePair | null>,
): PersonFileSection | null {
  const pairs = items.filter((item): item is PersonFilePair => item !== null);
  return pairs.length > 0 ? { heading, pairs } : null;
}

function addressLine(value: unknown) {
  const row = asRecord(value);
  if (!row) return "";
  return [row.door, row.street, row.city, row.district, row.state, row.pin, row.country]
    .map(textOf)
    .filter(Boolean)
    .join(", ");
}

function educationLine(value: unknown) {
  const row = asRecord(value);
  if (!row) return "";
  return [
    row.degree,
    row.specialisation,
    row.institution,
    row.university,
    row.year,
    row.score,
  ]
    .map(textOf)
    .filter(Boolean)
    .join(" · ");
}

function qualificationLine(value: unknown) {
  const row = asRecord(value);
  if (!row) return "";
  return [
    row.exam,
    row.degree,
    row.university,
    row.discipline,
    row.year,
    row.classObtained,
    row.percentage,
    row.awardYear,
  ]
    .map(textOf)
    .filter(Boolean)
    .join(" · ");
}

function experienceLine(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      const row = asRecord(item);
      if (!row) return "";
      return [row.organization, row.designation, row.from, row.to]
        .map(textOf)
        .filter(Boolean)
        .join(" · ");
    })
    .filter(Boolean)
    .join("; ");
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function fileSlug(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

export function matchPhdApplication(
  identifier: string,
  name: string,
  applications: readonly StoredApplication[],
) {
  const rows = applications.filter((item) => item.kind === "phd");
  const id = identifier.trim().toLowerCase();
  const scholar = scholarBySignIn(identifier);
  return (
    rows.find((item) => sameText(item.email, identifier)) ??
    (scholar?.email
      ? rows.find((item) => sameText(item.email, scholar.email))
      : undefined) ??
    (scholar?.applicationNumber
      ? rows.find((item) => sameText(item.applicationNo, scholar.applicationNumber))
      : undefined) ??
    rows.find((item) => sameText(item.applicationNo, identifier)) ??
    rows.find((item) => sameText(item.applicantName, name)) ??
    rows.find((item) => id.length > 0 && item.applicantName.toLowerCase() === id) ??
    null
  );
}

export function matchSupervisorApplication(
  identifier: string,
  name: string,
  applications: readonly StoredApplication[],
) {
  const rows = applications.filter((item) => item.kind === "supervisor");
  const supervisor = supervisorBySignIn(identifier) ?? supervisorBySignIn(name);
  return (
    rows.find((item) => sameText(item.email, identifier)) ??
    (supervisor?.email
      ? rows.find((item) => sameText(item.email, supervisor.email))
      : undefined) ??
    rows.find((item) => sameText(item.applicantName, name)) ??
    rows.find((item) => sameText(item.applicantName, identifier)) ??
    null
  );
}

function overlayPayload(identifier: string) {
  const personal = currentScholarRecords("personal_details");
  const saved = personal?.records.find(
    (record) =>
      record.scholarIdentifier.trim().toLowerCase() === identifier.trim().toLowerCase(),
  );
  return saved?.payload ?? {};
}

function scholarApplicationCellsFromPayload(
  payload: Record<string, unknown>,
  overlay: Record<string, string>,
) {
  const net = formatNetQualification({
    netQualified: textOf(payload.netQualified),
    netRoll: textOf(payload.netRoll),
    netYear: textOf(payload.netYear),
    netAgency: textOf(payload.netAgency),
    setRoll: textOf(payload.setRoll),
    setYear: textOf(payload.setYear),
    setAgency: textOf(payload.setAgency),
  });
  return [
    textOf(payload.title),
    textOf(payload.dateOfBirth) || overlay.dateOfBirth || "",
    textOf(payload.gender) || overlay.gender || "",
    textOf(payload.nationality) || overlay.nationality || "",
    textOf(payload.community),
    textOf(payload.bloodGroup) || overlay.bloodGroup || "",
    textOf(payload.maritalStatus),
    textOf(payload.studyMode) || overlay.studyMode || "",
    textOf(payload.school),
    textOf(payload.specialization),
    educationLine(payload.ug),
    educationLine(payload.pg),
    net,
    addressLine(payload.communication),
    addressLine(payload.permanent),
    experienceLine(payload.experience),
    textOf(payload.researchArea),
    textOf(payload.outline),
    overlay.fatherName ?? "",
    overlay.motherName ?? "",
    overlay.parentContact ?? "",
    overlay.parentEmail ?? "",
  ];
}

export function scholarApplicationCells(
  identifier: string,
  name: string,
  applications: readonly StoredApplication[],
) {
  const application = matchPhdApplication(identifier, name, applications);
  const overlay = overlayPayload(identifier);
  const payload = application ? payloadRecord(application.payload) : {};
  return scholarApplicationCellsFromPayload(payload, overlay);
}

export function supervisorApplicationCells(
  identifier: string,
  name: string,
  applications: readonly StoredApplication[],
) {
  const application = matchSupervisorApplication(identifier, name, applications);
  const payload = application ? payloadRecord(application.payload) : {};
  return [
    textOf(payload.sex),
    textOf(payload.dateOfBirth) || application?.dateOfBirth || "",
    textOf(payload.religion),
    textOf(payload.community),
    textOf(payload.state),
    textOf(payload.nationality),
    addressLine(payload.permanent),
    addressLine(payload.communication),
    textOf(payload.faculty),
    textOf(payload.subject),
    textOf(payload.expertise),
    textOf(payload.appointmentDate),
    qualificationLine(payload.postgraduate),
    qualificationLine(payload.mphil),
    qualificationLine(payload.phd),
    textOf(payload.phdAwardYear),
    qualificationLine(payload.dlitt),
    textOf(payload.proposedDepartment),
    textOf(payload.recognisedElsewhere),
    textOf(payload.recognitionDetails),
    textOf(payload.otherInformation),
  ];
}

export function scholarPersonSections(
  identifier: string,
  name: string,
  applications: readonly StoredApplication[],
): PersonFileSection[] {
  const scholar = scholarBySignIn(identifier);
  const allotments = currentAllotments();
  const application = matchPhdApplication(identifier, name, applications);
  const payload = application ? payloadRecord(application.payload) : {};
  const overlay = overlayPayload(identifier);
  const cells = scholarApplicationCellsFromPayload(payload, overlay);
  const [
    title,
    dateOfBirth,
    gender,
    nationality,
    community,
    bloodGroup,
    maritalStatus,
    studyMode,
    school,
    specialization,
    ug,
    pg,
    net,
    communication,
    permanent,
    experience,
    researchArea,
    ,
    fatherName,
    motherName,
    parentContact,
    parentEmail,
  ] = cells;

  return [
    section("Register", [
      pair("Name", scholar?.name || textOf(payload.fullName) || name),
      pair("Title", title),
      pair("Registration number", scholar ? registrationOf(scholar, allotments) : ""),
      pair("File number", scholar?.fileNumber ?? ""),
      pair(
        "Application number",
        scholar?.applicationNumber || application?.applicationNo || "",
      ),
      pair("Email", scholar?.email || textOf(payload.email) || overlay.email || ""),
      pair("Mobile", scholar?.phone || textOf(payload.mobile) || overlay.mobile || ""),
      pair("Working institution", scholar?.institution ?? ""),
      pair("Category", scholar?.category ?? ""),
      pair("Title of research", scholar?.title ?? ""),
      pair("Guide", scholar?.guideName ?? ""),
      pair("Semester", scholarSemesterLabel(identifier)),
    ]),
    section("Personal details", [
      pair("Date of birth", dateOfBirth),
      pair("Gender", gender),
      pair("Nationality", nationality),
      pair("Country", textOf(payload.country)),
      pair(
        "Community",
        [community, textOf(payload.communityName)].filter(Boolean).join(" · "),
      ),
      pair("Blood group", bloodGroup),
      pair("Marital status", maritalStatus),
      pair("Father's name", fatherName),
      pair("Mother's name", motherName),
      pair("Parent contact", parentContact),
      pair("Parent email", parentEmail),
    ]),
    section("Programme", [
      pair(
        "Programme",
        textOf(payload.programme) || overlay.programme || scholar?.department || "",
      ),
      pair("Study mode", studyMode),
      pair("School", school),
      pair("Subject", specialization),
      pair(
        "Admission session",
        [textOf(payload.session), textOf(payload.year)].filter(Boolean).join(" "),
      ),
    ]),
    section("Education", [pair("UG", ug), pair("PG", pg), pair("NET / SET / SLET", net)]),
    section("Address", [
      pair("Communication address", communication || overlay.address || ""),
      pair("Permanent address", permanent),
      pair("District", overlay.district ?? ""),
      pair("State", overlay.state ?? ""),
      pair("Pincode", overlay.pincode ?? ""),
    ]),
    section("Research", [
      pair("Research area", researchArea),
      pair("Experience", experience),
    ]),
  ].filter((item): item is PersonFileSection => item !== null);
}

export function supervisorPersonSections(
  identifier: string,
  name: string,
  applications: readonly StoredApplication[],
): PersonFileSection[] {
  const supervisor = supervisorBySignIn(identifier) ?? supervisorBySignIn(name);
  const application = matchSupervisorApplication(identifier, name, applications);
  const payload = application ? payloadRecord(application.payload) : {};
  const cells = supervisorApplicationCells(identifier, name, applications);
  const [
    sex,
    dateOfBirth,
    religion,
    community,
    state,
    nationality,
    permanent,
    communication,
    faculty,
    subject,
    expertise,
    appointmentDate,
    postgraduate,
    mphil,
    phd,
    phdAwardYear,
    dlitt,
    proposedDepartment,
    recognisedElsewhere,
    recognitionDetails,
    otherInformation,
  ] = cells;

  return [
    section("Register", [
      pair("Name", supervisor?.name || textOf(payload.name) || name),
      pair("Supervisor ID", supervisor?.supervisorId ?? ""),
      pair("Application number", application?.applicationNo ?? ""),
      pair(
        "Email",
        supervisor?.email || textOf(payload.email) || application?.email || "",
      ),
      pair("Phone", supervisor?.phone || textOf(payload.phone) || ""),
      pair("Department", supervisor?.department || textOf(payload.department) || ""),
      pair("Designation", supervisor?.designation || textOf(payload.designation) || ""),
      pair("Campus", supervisor?.campus ?? ""),
      pair("Area of research", supervisor?.researchArea || expertise),
    ]),
    section("Personal details", [
      pair("Sex", sex),
      pair("Date of birth", dateOfBirth),
      pair("Religion", religion),
      pair("Community", community),
      pair("State", state),
      pair("Nationality", nationality),
    ]),
    section("Address", [
      pair("Permanent address", permanent),
      pair("Communication address", communication),
    ]),
    section("Academic", [
      pair("Faculty", faculty),
      pair("Subject", subject),
      pair("Area of expertise", expertise),
      pair("Date of appointment", appointmentDate),
      pair("Postgraduate", postgraduate),
      pair("M.Phil.", mphil),
      pair("Ph.D.", phd),
      pair("Ph.D. award year", phdAwardYear),
      pair("D.Litt.", dlitt),
    ]),
    section("Recognition", [
      pair("Proposed department", proposedDepartment),
      pair("Recognised elsewhere", recognisedElsewhere),
      pair("Recognition details", recognitionDetails),
      pair("Other information", otherInformation),
    ]),
  ].filter((item): item is PersonFileSection => item !== null);
}

function sectionsToRows(sections: readonly PersonFileSection[]) {
  return sections.flatMap((item) =>
    item.pairs.map((pairRow) => [item.heading, pairRow.label, pairRow.value] as const),
  );
}

export function downloadPersonSections(
  filename: string,
  sections: readonly PersonFileSection[],
) {
  downloadCsv(filename, toCsv(["Section", "Field", "Value"], sectionsToRows(sections)));
}

export function downloadScholarPersonFile(identifier: string, name: string) {
  const applications = currentApplications() ?? [];
  downloadPersonSections(
    `scholar-personal-details-${fileSlug(name || identifier, "scholar")}.csv`,
    scholarPersonSections(identifier, name, applications),
  );
}

export function downloadSupervisorPersonFile(identifier: string, name: string) {
  const applications = currentApplications() ?? [];
  downloadPersonSections(
    `supervisor-personal-details-${fileSlug(name || identifier, "supervisor")}.csv`,
    supervisorPersonSections(identifier, name, applications),
  );
}

function scholarWideRow(
  scholar: ResearchScholar,
  applications: readonly StoredApplication[],
) {
  const allotments = currentAllotments();
  const quotas = currentQuotas();
  const allocations = currentOffice()?.allocations ?? [];
  return [
    ...scholarDownloadRow(scholar, allotments, quotas, allocations),
    ...scholarApplicationCells(scholarSignInId(scholar), scholar.name, applications),
  ];
}

export function scholarWideHeaders() {
  return [...scholarDownloadHeaders, ...scholarApplicationHeaders];
}

export function supervisorWideHeaders() {
  return [...supervisorDownloadHeaders, ...supervisorApplicationHeaders];
}

export function downloadAllScholarDetails() {
  const applications = currentApplications() ?? [];
  downloadCsv(
    "all-scholar-details.csv",
    toCsv(
      scholarWideHeaders(),
      researchRegister.scholars.map((scholar) => scholarWideRow(scholar, applications)),
    ),
  );
}

export function downloadAllSupervisorDetails() {
  const applications = currentApplications() ?? [];
  const quotas = currentQuotas();
  const allocations = currentOffice()?.allocations ?? [];
  downloadCsv(
    "all-supervisor-details.csv",
    toCsv(
      supervisorWideHeaders(),
      researchRegister.supervisors.map((supervisor) => [
        ...supervisorDownloadRow(supervisor, quotas, allocations),
        ...supervisorApplicationCells(
          supervisor.email.trim() || supervisor.supervisorId.trim() || supervisor.name,
          supervisor.name,
          applications,
        ),
      ]),
    ),
  );
}

export function scholarWideDownloadRow(
  scholar: ResearchScholar,
  applications: readonly StoredApplication[],
) {
  return scholarWideRow(scholar, applications);
}
