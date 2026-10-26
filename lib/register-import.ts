import {
  researchRegister,
  type ResearchScholar,
  type ResearchSupervisor,
} from "@/data/research-register";
import { studyModes } from "@/lib/constants";
import { looseDateToIso } from "@/lib/dates";
import { allBatches } from "@/lib/batches";
import {
  bioWordLimit,
  currentAllotments,
  editedFields,
  importRegisterBatch,
  nextScholarSerial,
  nextSupervisorSerial,
  originalScholar,
  originalSupervisorKey,
  personalDetailsOf,
  sameGuide,
  scholarBySignIn,
  scholarEditFields,
  scholarSignInId,
  supervisorEditFields,
  wordCount,
  type RegisterBatch,
  type ScholarEditField,
  type SupervisorEditField,
} from "@/lib/register";
import { saveScholarRecord, currentScholarRecords } from "@/lib/scholar-records";
import { proposedQuota } from "@/lib/supervisor-approval";
import { sameDepartment } from "@/lib/department-areas";
import { currentResearchAreas } from "@/lib/research-areas";
import { addApprovedSupervisorVacancy } from "@/lib/vacancies";
import { sameId } from "@/lib/office";
import type { SheetTable } from "@/lib/spreadsheet";

export type ImportKind = "supervisors" | "scholars";

export type PlannedRow = {
  /** The row number in the file, counting the heading row as 1. */
  line: number;
  label: string;
  action: "update" | "add" | "same" | "skip";
  changes: string[];
  notes: string[];
};

type PersonalWrite = {
  identifier: string;
  name: string;
  payload: Record<string, string>;
};

type VacancyWrite = {
  name: string;
  designation: string;
  school: string;
  department: string;
  researchArea: string;
  quota: number;
};

export type ImportPlan = {
  kind: ImportKind;
  rows: PlannedRow[];
  /** Columns of the file that are not used. */
  unused: string[];
  /** Headings that are needed but not found. */
  missing: string[];
  batch: RegisterBatch;
  personal: PersonalWrite[];
  vacancies: VacancyWrite[];
};

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

type Spec = Record<string, readonly string[]>;

const supervisorSpec = {
  name: [
    "guidename",
    "name",
    "supervisorname",
    "nameofthesupervisor",
    "nameoftheguide",
    "supervisor",
  ],
  supervisorId: ["supervisorid", "guideid", "employeeid", "empid", "id"],
  department: ["department", "dept", "subject"],
  designation: ["designation"],
  researchArea: [
    "areaofresearch",
    "researcharea",
    "specialisation",
    "specialization",
    "area",
  ],
  campus: ["campus"],
  phone: ["phoneno", "phone", "phonenumber", "mobile", "mobileno", "contactno"],
  email: ["mailid", "email", "emailid", "mail"],
  active: ["active"],
  quota: ["quota"],
  currentScholars: ["currentscholars"],
  vidwan: ["vidwanid", "vidwan", "vidwanprofile"],
  bio: ["biography", "bio", "profile"],
} satisfies Spec;

const scholarSpec = {
  name: [
    "name",
    "scholarname",
    "nameofthecandidate",
    "nameofthescholar",
    "candidate",
    "fullname",
  ],
  email: ["mail", "mailid", "email", "emailid"],
  phone: ["phone", "phonenumber", "phoneno", "mobile", "mobileno"],
  registrationNumber: ["regno", "registrationnumber", "registrationno", "regnumber"],
  applicationNumber: ["applicationnumber", "applicationno"],
  fileNumber: ["filenumber", "fileno"],
  department: ["department", "dept", "subject", "programme"],
  batch: ["batch", "batchid", "session", "intake"],
  mode: ["category", "modeofstudy", "mode", "studymode"],
  guide: ["guide", "guidename", "guideallotted", "supervisor", "nameoftheguide"],
  institution: ["workinginstitution", "institution", "employer"],
  title: ["title", "researchtitle", "titleofresearch"],
  firstDc: ["1stdc", "firstdc"],
  secondDc: ["2nddc", "seconddc"],
  confirmation: ["confirmation"],
  colloquium1: ["colloq1", "colloquium1"],
  colloquium2: ["colloq2", "colloquium2"],
  synopsis: ["synopsis"],
  thesis: ["thesis"],
  viva: ["viva"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate"],
  gender: ["gender", "sex"],
  nationality: ["nationality"],
  bloodGroup: ["bloodgroup"],
  fatherName: ["fathername", "father"],
  motherName: ["mothername", "mother"],
  parentContact: ["parentcontactno", "parentcontact", "parentphone", "parentmobile"],
  parentEmail: ["parentemail"],
  address: ["address", "communicationaddress"],
  pincode: ["pincode", "pin", "postalcode"],
  district: ["district"],
  state: ["state"],
  community: ["community"],
  admissionDate: ["dateofadmission", "admissiondate"],
  researchArea: ["areaofresearch", "researcharea"],
  ugDegree: ["ugdegree"],
  ugUniversity: ["uguniversity"],
  pgDegree: ["pgdegree"],
  pgUniversity: ["pguniversity"],
  netQualification: ["netsetgate", "netqualification", "net"],
} satisfies Spec;

const personalFields = [
  "dateOfBirth",
  "gender",
  "nationality",
  "bloodGroup",
  "fatherName",
  "motherName",
  "parentContact",
  "parentEmail",
  "address",
  "pincode",
  "district",
  "state",
  "community",
  "admissionDate",
  "researchArea",
  "ugDegree",
  "ugUniversity",
  "pgDegree",
  "pgUniversity",
  "netQualification",
] as const;

function resolve(headers: string[], spec: Spec) {
  const byNorm = new Map(headers.map((header) => [norm(header), header]));
  const found: Record<string, string> = {};
  const used = new Set<string>();
  for (const [field, names] of Object.entries(spec)) {
    const hit = names.map((name) => byNorm.get(name)).find(Boolean);
    if (hit && !used.has(hit)) {
      found[field] = hit;
      used.add(hit);
    }
  }
  return { found, unused: headers.filter((header) => !used.has(header)) };
}

/** Only the cells that have something in them: an empty cell never blanks a stored value. */
function filled<T extends string>(values: Partial<Record<T, string>>) {
  return Object.fromEntries(
    Object.entries<string | undefined>(values).filter(
      ([, value]) => (value ?? "").trim() !== "",
    ),
  ) as Partial<Record<T, string>>;
}

function clean(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function phoneOf(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 12);
}

function modeOf(value: string) {
  const text = value.toLowerCase();
  if (!text) return "";
  if (text.includes("full")) return studyModes[0];
  if (text.includes("part") && text.includes("ext")) return studyModes[2];
  if (text.includes("part") && text.includes("int")) return studyModes[1];
  return value;
}

function batchOf(value: string) {
  const text = value.trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const batches = allBatches();
  const exact = batches.find(
    (batch) => batch.id === lower || batch.name.toLowerCase() === lower,
  );
  if (exact) return exact.id;
  const dated = /^(\d{4})-(\d{2})-\d{2}$/.exec(text);
  if (dated) {
    const month = Number(dated[2]);
    const id = `${dated[1]}-${month <= 3 ? "january" : "june"}`;
    return batches.some((batch) => batch.id === id) ? id : "";
  }
  const named = /^(january|july)\s+(\d{4})$/i.exec(text);
  if (named) {
    const id = `${named[2]}-${named[1].toLowerCase() === "july" ? "june" : "january"}`;
    return batches.some((batch) => batch.id === id) ? id : "";
  }
  return "";
}

function cellDate(value: string, warn: (message: string) => void, label: string) {
  if (!value) return "";
  const iso = looseDateToIso(value);
  if (!iso) warn(`${label}: "${value}" is not a date I can read; enter it by hand.`);
  return iso;
}

/** The school a department belongs to, from Research areas (an abbreviation such as CSE is matched). */
function schoolOf(department: string) {
  const text = department.trim();
  if (!text) return "";
  const schools = currentResearchAreas();
  const found =
    schools.find((school) => school.areas.some((area) => sameDepartment(text, area))) ??
    schools.find((school) =>
      sameDepartment(text, school.name.replace(/^school of\s+/i, "")),
    );
  return found?.name ?? "";
}

function guideMatch(name: string) {
  const text = clean(name);
  if (!text) return null;
  const exact = researchRegister.supervisors.find(
    (item) => norm(item.name) === norm(text),
  );
  if (exact) return exact;
  // A looser match is used only when it can be nobody else.
  const near = researchRegister.supervisors.filter((item) => sameGuide(item.name, text));
  return near.length === 1 ? near[0] : null;
}

/* ------------------------------------------------------------------ supervisors -- */

export function planSupervisors(table: SheetTable): ImportPlan {
  const { found, unused } = resolve(table.headers, supervisorSpec);
  const plan: ImportPlan = {
    kind: "supervisors",
    rows: [],
    unused,
    missing: found.name ? [] : ["Name of the supervisor"],
    batch: {},
    personal: [],
    vacancies: [],
  };
  if (!found.name) return plan;
  let serial = nextSupervisorSerial();
  const seen = new Set<string>();
  table.rows.forEach((row, index) => {
    const get = (field: keyof typeof supervisorSpec) =>
      clean(found[field] ? row[found[field]] : "");
    const name = get("name");
    const line = index + 2;
    if (!name && !get("email") && !get("supervisorId")) return;
    const notes: string[] = [];
    if (name.length < 3) {
      plan.rows.push({
        line,
        label: name || "(no name)",
        action: "skip",
        changes: [],
        notes: ["The name is missing."],
      });
      return;
    }
    const email = get("email").toLowerCase();
    const id = get("supervisorId");
    const dupKey = norm(id || email || name);
    if (seen.has(dupKey)) {
      plan.rows.push({
        line,
        label: name,
        action: "skip",
        changes: [],
        notes: ["Listed twice in the file."],
      });
      return;
    }
    seen.add(dupKey);

    const wanted: Partial<Record<SupervisorEditField, string>> = {
      name,
      supervisorId: id,
      department: get("department"),
      designation: get("designation"),
      researchArea: get("researchArea"),
      campus: get("campus"),
      phone: phoneOf(get("phone")),
      email,
    };
    const contradicts = (item: ResearchSupervisor) =>
      Boolean(id && item.supervisorId.trim() && norm(item.supervisorId) !== norm(id)) ||
      Boolean(email && item.email.trim() && norm(item.email) !== norm(email));
    const live =
      researchRegister.supervisors.find(
        (item) =>
          (id && norm(item.supervisorId) === norm(id)) ||
          (email && norm(item.email) === norm(email)),
      ) ??
      researchRegister.supervisors.find(
        (item) => norm(item.name) === norm(name) && !contradicts(item),
      ) ??
      (name.length >= 5
        ? (() => {
            const near = researchRegister.supervisors.filter(
              (item) => sameGuide(item.name, name) && !contradicts(item),
            );
            return near.length === 1 ? near[0] : undefined;
          })()
        : undefined);
    const vidwan = get("vidwan");
    let bio = get("bio");
    if (vidwan && !/^(https?:\/\/\S+|[A-Za-z0-9_-]{3,40})$/.test(vidwan)) {
      notes.push("The Vidwan ID is not in a form I can use; enter it by hand.");
    }
    if (bio && wordCount(bio) > bioWordLimit) {
      notes.push(
        `The biography is over ${bioWordLimit} words; enter a shorter one by hand.`,
      );
      bio = "";
    }
    const profileKey = (live?.email || email || live?.supervisorId || id || name).trim();
    const profile =
      vidwan || bio
        ? [
            {
              key: profileKey,
              name: live?.name ?? name,
              designation: live?.designation ?? wanted.designation ?? "",
              department: live?.department ?? wanted.department ?? "",
              researchArea: wanted.researchArea ?? "",
              vidwan: /^(https?:\/\/\S+|[A-Za-z0-9_-]{3,40})$/.test(vidwan) ? vidwan : "",
              bio,
            },
          ]
        : [];

    if (live) {
      // A name that matched only loosely is not renamed.
      const sure = Boolean(
        (id && norm(live.supervisorId) === norm(id)) ||
        (email && norm(live.email) === norm(email)),
      );
      const fields = realChanges(
        live,
        editedFields(
          live,
          filled(sure ? wanted : { ...wanted, name: "" }),
          supervisorEditFields,
        ),
      );
      const changes = Object.entries(fields).map(
        ([field, value]) =>
          `${field}: ${String((live as Record<string, unknown>)[field] || "—")} → ${value}`,
      );
      if (profile.length) changes.push("Vidwan ID / biography");
      if (Object.keys(fields).length) {
        plan.batch.supervisorEdits = [
          ...(plan.batch.supervisorEdits ?? []),
          { key: originalSupervisorKey(live), fields },
        ];
      }
      if (profile.length)
        plan.batch.profiles = [...(plan.batch.profiles ?? []), ...profile];
      plan.rows.push({
        line,
        label: name,
        action: changes.length ? "update" : "same",
        changes,
        notes,
      });
      return;
    }

    const designation = get("designation");
    const quotaFile = Number(get("quota"));
    const quota = designation
      ? proposedQuota(designation)
      : Number.isInteger(quotaFile) && quotaFile > 0
        ? quotaFile
        : proposedQuota("");
    if (!designation)
      notes.push("No designation: a quota of 4 is given; correct it by hand.");
    const current = Math.min(
      quota,
      Math.max(0, Math.floor(Number(get("currentScholars")) || 0)),
    );
    const active = !/^(no|n|false|inactive)$/i.test(get("active"));
    const entry: ResearchSupervisor = {
      serialNo: serial,
      name,
      supervisorId: id,
      department: get("department"),
      designation,
      researchArea: get("researchArea"),
      active,
      currentScholars: current,
      quota,
      vacancy: Math.max(0, quota - current),
      june2026Allotment: 0,
      balance: Math.max(0, quota - current),
      campus: get("campus"),
      phone: phoneOf(get("phone")),
      email,
      onVacancyList: true,
    };
    serial += 1;
    plan.batch.addedSupervisors = [...(plan.batch.addedSupervisors ?? []), entry];
    plan.batch.quotas = [
      ...(plan.batch.quotas ?? []),
      { name, quota, department: entry.department, designation },
    ];
    if (profile.length)
      plan.batch.profiles = [...(plan.batch.profiles ?? []), ...profile];
    plan.vacancies.push({
      name,
      designation,
      school: schoolOf(entry.department),
      department: entry.department,
      researchArea: entry.researchArea,
      quota: Math.max(0, quota - current),
    });
    if (!entry.department) notes.push("No department; enter it by hand.");
    plan.rows.push({
      line,
      label: name,
      action: "add",
      changes: [`New supervisor, quota ${quota}`],
      notes,
    });
  });
  return plan;
}

/* -------------------------------------------------------------------- scholars -- */

export function planScholars(table: SheetTable): ImportPlan {
  const { found, unused } = resolve(table.headers, scholarSpec);
  const plan: ImportPlan = {
    kind: "scholars",
    rows: [],
    unused,
    missing: found.name ? [] : ["Name of the scholar"],
    batch: {},
    personal: [],
    vacancies: [],
  };
  if (!found.name) return plan;
  let serial = nextScholarSerial();
  let fresh = 0;
  const seen = new Set<string>();
  const allotments = currentAllotments();
  const records = currentScholarRecords("personal_details")?.records ?? [];
  table.rows.forEach((row, index) => {
    const get = (field: keyof typeof scholarSpec) =>
      clean(found[field] ? row[found[field]] : "");
    const line = index + 2;
    const name = get("name");
    const email = get("email").toLowerCase();
    if (!name && !email) return;
    const notes: string[] = [];
    const warn = (message: string) => notes.push(message);
    if (name.length < 2) {
      plan.rows.push({
        line,
        label: name || "(no name)",
        action: "skip",
        changes: [],
        notes: ["The name is missing."],
      });
      return;
    }
    const regNo = get("registrationNumber");
    const appNo = get("applicationNumber");
    const fileNo = get("fileNumber");
    const dupKey = norm(email || regNo || appNo || name);
    if (seen.has(dupKey)) {
      plan.rows.push({
        line,
        label: name,
        action: "skip",
        changes: [],
        notes: ["Listed twice in the file."],
      });
      return;
    }
    seen.add(dupKey);

    const live: ResearchScholar | null =
      [email, regNo, appNo, fileNo]
        .filter(Boolean)
        .map((value) => scholarBySignIn(value))
        .find(Boolean) ??
      (regNo
        ? (researchRegister.scholars.find((item) =>
            allotments.some(
              (entry) =>
                entry.scholarId === item.id &&
                norm(entry.registrationNumber) === norm(regNo),
            ),
          ) ?? null)
        : null);

    const guideText = get("guide");
    const guide = guideMatch(guideText);
    if (guideText && !guide)
      warn(`Guide "${guideText}" is not on the supervisor register; kept as typed.`);
    const batchText = get("batch");
    const batchId = batchOf(batchText);
    if (batchText && !batchId) warn(`Batch "${batchText}" is not a batch I know.`);

    const wanted: Partial<Record<ScholarEditField, string>> = {
      name,
      email,
      phone: phoneOf(get("phone")),
      department: get("department"),
      batchId,
      category: modeOf(get("mode")),
      institution: get("institution"),
      guideName: guide?.name ?? guideText,
      title: get("title"),
      fileNumber: fileNo,
      applicationNumber: appNo,
      firstDc: cellDate(get("firstDc"), warn, "1st DC") || get("firstDc"),
      secondDc: cellDate(get("secondDc"), () => undefined, "2nd DC") || get("secondDc"),
      confirmation:
        cellDate(get("confirmation"), () => undefined, "Confirmation") ||
        get("confirmation"),
      colloquium1:
        cellDate(get("colloquium1"), () => undefined, "Colloquium 1") ||
        get("colloquium1"),
      colloquium2:
        cellDate(get("colloquium2"), () => undefined, "Colloquium 2") ||
        get("colloquium2"),
      synopsis: cellDate(get("synopsis"), () => undefined, "Synopsis") || get("synopsis"),
      thesis: cellDate(get("thesis"), () => undefined, "Thesis") || get("thesis"),
      viva: cellDate(get("viva"), () => undefined, "Viva") || get("viva"),
    };

    // Personal details: dates and numbers are checked, whatever is not understood is left to hand entry.
    const personal: Record<string, string> = {};
    for (const field of personalFields) {
      const value = get(field);
      if (!value) continue;
      if (field === "dateOfBirth" || field === "admissionDate") {
        const iso = cellDate(
          value,
          warn,
          field === "dateOfBirth" ? "Date of birth" : "Date of admission",
        );
        if (iso) personal[field] = iso;
      } else if (field === "parentContact") {
        const digits = phoneOf(value);
        if (digits) personal[field] = digits;
      } else if (field === "pincode") {
        const digits = value.replace(/\D/g, "").slice(0, 6);
        if (digits) personal[field] = digits;
      } else {
        personal[field] = value;
      }
    }

    if (live) {
      const fields = realChanges(
        live,
        editedFields(live, filled(wanted), scholarEditFields),
      );
      // The first load of a scholar is the base; only real differences count.
      const original = originalScholar(live.id);
      const changes = Object.entries(fields).map(
        ([field, value]) =>
          `${field}: ${String((live as Record<string, unknown>)[field] || "—")} → ${value}`,
      );
      if (original && Object.keys(fields).length) {
        plan.batch.scholarEdits = [
          ...(plan.batch.scholarEdits ?? []),
          { scholarId: live.id, fields },
        ];
      }
      if (Object.keys(personal).length) {
        const identifier = scholarSignInId(live);
        const current = personalDetailsOf(live);
        const differing = Object.entries(personal).filter(
          ([key, value]) => (current[key] ?? "") !== value,
        );
        if (differing.length) {
          changes.push(`Personal details: ${differing.map(([key]) => key).join(", ")}`);
          const existing = records
            .filter((item) => sameId(item.scholarIdentifier, identifier))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          plan.personal.push({
            identifier,
            name: live.name,
            payload: {
              fullName: live.name,
              email: live.email,
              mobile: live.phone,
              programme: live.department,
              studyMode: live.category,
              ...(existing?.payload ?? current),
              ...personal,
            },
          });
        }
      }
      plan.rows.push({
        line,
        label: name,
        action: changes.length ? "update" : "same",
        changes,
        notes,
      });
      return;
    }

    // Not on the register: added, when there is enough to sign them in and place them in a batch.
    if (!email) {
      plan.rows.push({
        line,
        label: name,
        action: "skip",
        changes: [],
        notes: ["Not on the register, and no e-mail to add them with."],
      });
      return;
    }
    if (!batchId) {
      plan.rows.push({
        line,
        label: name,
        action: "skip",
        changes: [],
        notes: ["Not on the register, and the batch is missing or not recognised."],
      });
      return;
    }
    fresh += 1;
    const scholar: ResearchScholar = {
      id: `upload-${Date.now().toString(36)}-${fresh}`,
      serialNo: serial,
      registrationNumber: regNo,
      fileNumber: fileNo,
      applicationNumber: appNo,
      name,
      department: wanted.department ?? "",
      batchId,
      phone: wanted.phone ?? "",
      email,
      title: wanted.title ?? "",
      category: wanted.category ?? "",
      institution: wanted.institution ?? "",
      guideName: wanted.guideName ?? "",
      firstDc: wanted.firstDc ?? "",
      secondDc: wanted.secondDc ?? "",
      confirmation: wanted.confirmation ?? "",
      colloquium1: wanted.colloquium1 ?? "",
      colloquium2: wanted.colloquium2 ?? "",
      synopsis: wanted.synopsis ?? "",
      thesis: wanted.thesis ?? "",
      viva: wanted.viva ?? "",
    };
    serial += 1;
    plan.batch.addedScholars = [...(plan.batch.addedScholars ?? []), scholar];
    if (Object.keys(personal).length) {
      plan.personal.push({
        identifier: email,
        name,
        payload: {
          fullName: name,
          email,
          mobile: scholar.phone,
          programme: scholar.department,
          studyMode: scholar.category,
          ...personal,
        },
      });
    }
    if (!scholar.department) notes.push("No department; enter it by hand.");
    plan.rows.push({ line, label: name, action: "add", changes: ["New scholar"], notes });
  });
  return plan;
}

/* --------------------------------------------------------------------- applying -- */

const milestoneFields = [
  "firstDc",
  "secondDc",
  "confirmation",
  "colloquium1",
  "colloquium2",
  "synopsis",
  "thesis",
  "viva",
] as const;

/** Drops "changes" that are only a different way of writing the same thing (a date, extra spaces). */
function realChanges<K extends string>(
  live: Record<string, unknown>,
  fields: Partial<Record<K, string>>,
) {
  const kept: Partial<Record<K, string>> = {};
  for (const [field, value] of Object.entries<string | undefined>(fields)) {
    if (value === undefined) continue;
    const old = String(live[field] ?? "");
    const sameSpaces = old.replace(/\s+/g, " ").trim() === value;
    const sameDate =
      (milestoneFields as readonly string[]).includes(field) &&
      looseDateToIso(old) !== "" &&
      looseDateToIso(old) === looseDateToIso(value);
    if (!sameSpaces && !sameDate) kept[field as K] = value;
  }
  return kept;
}

export type ImportResult = { ok: boolean; message: string; problems: string[] };

/** Saves the plan: the register in one step, then the scholars' personal details, then the vacancy list. */
export async function applyPlan(
  plan: ImportPlan,
  progress: (done: number, total: number) => void,
) {
  const changed = plan.rows.filter(
    (row) => row.action === "update" || row.action === "add",
  ).length;
  if (changed === 0 && plan.personal.length === 0) {
    return {
      ok: true,
      message: "Nothing needed to change.",
      problems: [],
    } satisfies ImportResult;
  }
  const saved = await importRegisterBatch(plan.batch);
  if (!saved.ok) {
    return {
      ok: false,
      message: "message" in saved ? saved.message : "The register could not be saved.",
      problems: [],
    } satisfies ImportResult;
  }
  const problems: string[] = [];
  let done = 0;
  const total = plan.personal.length + plan.vacancies.length;
  progress(0, total);
  for (const item of plan.personal) {
    const existing = (currentScholarRecords("personal_details")?.records ?? [])
      .filter((record) => sameId(record.scholarIdentifier, item.identifier))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const result = await saveScholarRecord(
      {
        kind: "personal_details",
        scholarIdentifier: item.identifier,
        scholarName: item.name,
        payload: item.payload,
        fileName: null,
        fileData: null,
        status: "Approved",
      },
      existing?.id,
    );
    if (!result.ok)
      problems.push(
        `${item.name}: ${"message" in result ? result.message : "not saved"}`,
      );
    done += 1;
    progress(done, total);
  }
  for (const item of plan.vacancies) {
    const result = await addApprovedSupervisorVacancy(item);
    if (!result.ok) problems.push(`${item.name}: not added to the vacancy list`);
    done += 1;
    progress(done, total);
  }
  return {
    ok: true,
    message: `${changed} row(s) saved.`,
    problems,
  } satisfies ImportResult;
}

/* ---------------------------------------------------------------------- template -- */

export function templateCsv(kind: ImportKind) {
  const headers =
    kind === "supervisors"
      ? [
          "Name",
          "Supervisor ID",
          "Department",
          "Designation",
          "Area of research",
          "Campus",
          "Phone",
          "Email",
          "Vidwan ID",
          "Biography",
        ]
      : [
          "Name",
          "Email",
          "Phone",
          "Registration number",
          "Application number",
          "File number",
          "Department",
          "Batch",
          "Mode of study",
          "Guide",
          "Working institution",
          "Title",
          "Date of birth",
          "Gender",
          "Nationality",
          "Blood group",
          "Father name",
          "Mother name",
          "Parent contact",
          "Parent email",
          "Address",
          "Pincode",
          "District",
          "State",
          "Community",
          "Date of admission",
          "Area of research",
          "UG degree",
          "UG university",
          "PG degree",
          "PG university",
          "NET / SET / GATE",
        ];
  return `${headers.join(",")}\r\n`;
}
