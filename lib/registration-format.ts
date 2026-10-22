import { researchRegister } from "@/data/research-register";
import type { AdmissionCase, EntranceSchedule } from "@/lib/admission";
import { sameGuide } from "@/lib/register";

/**
 * Research scholar register number: YY S CC M SS DD NN
 *   YY year of admission, S session (1 January, 2 July), CC campus code of the guide
 *   (before July 2026 the letters "CR" stood here), M mode of study, SS school code,
 *   DD department code, NN scholar roll number within that group.
 * Example: 262 02 1 01 01 01 (July 2026, Muttom, full time, school 01, department 01, roll 01).
 */

export const campusCodes: readonly { name: string; code: string; match: RegExp }[] = [
  { name: "Tindivanam", code: "01", match: /tindivanam/i },
  { name: "Muttom", code: "02", match: /muttom/i },
  { name: "Panaljur", code: "03", match: /pa[nl]a[nl]?jur|panalur/i },
  { name: "Sriperumbudur", code: "04", match: /perumbudur|srp/i },
  { name: "Aral", code: "05", match: /aral/i },
];

/** Mode of study digit. To be confirmed by the research office. */
export const modeCodes: Readonly<Record<string, string>> = {
  "full time": "1",
  "part time (internal)": "2",
  "part time (external)": "3",
};

/** School and department codes, keyed by lower-case name. Filled in as the office supplies them. */
export const schoolCodes: Readonly<Record<string, string>> = {};
export const departmentCodes: Readonly<Record<string, string>> = {};

const key = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function campusCodeOf(campus: string) {
  return campusCodes.find((item) => item.match.test(campus)) ?? null;
}

/** The campus of the allotted guide, from the supervisor register. */
export function guideCampus(guideName: string) {
  if (!guideName.trim()) return "";
  return (
    researchRegister.supervisors.find((item) => sameGuide(item.name, guideName))
      ?.campus ?? ""
  );
}

export function modeCodeOf(studyMode: string) {
  const mode = key(studyMode).replace(/-/g, " ");
  if (mode.startsWith("full")) return modeCodes["full time"] ?? "";
  if (mode.includes("external")) return modeCodes["part time (external)"] ?? "";
  if (mode.includes("part")) return modeCodes["part time (internal)"] ?? "";
  return "";
}

/** Year and session digits from the intake month ("2027-01" is 27 / 1, "2026-07" is 26 / 2). */
export function yearSessionOf(schedule: Pick<EntranceSchedule, "monthYear" | "session">) {
  const [year = "", month = ""] = schedule.monthYear.split("-");
  if (year.length !== 4) return null;
  const session = month
    ? Number(month) <= 6
      ? "1"
      : "2"
    : /jul/i.test(schedule.session)
      ? "2"
      : "1";
  return { year: year.slice(2), session };
}

export type RegistrationSuggestion =
  { ok: true; number: string } | { ok: false; missing: string[] };

export function suggestRegistration(
  row: Pick<AdmissionCase, "applicationId" | "department" | "studyMode" | "guideName">,
  context: {
    schoolName: string;
    schedule: Pick<EntranceSchedule, "monthYear" | "session">;
    /** Registration numbers already in use (admission files and the register). */
    taken: readonly string[];
  },
): RegistrationSuggestion {
  const missing: string[] = [];
  const intake = yearSessionOf(context.schedule);
  if (!intake) missing.push("the admission session and year");
  const campus = campusCodeOf(guideCampus(row.guideName));
  if (!campus) missing.push("the campus of the allotted guide");
  const mode = modeCodeOf(row.studyMode);
  if (!mode) missing.push("the mode of study code");
  const school = schoolCodes[key(context.schoolName)] ?? "";
  if (!school)
    missing.push(
      `the school code${context.schoolName ? ` for ${context.schoolName}` : ""}`,
    );
  const department = departmentCodes[key(row.department)] ?? "";
  if (!department) missing.push(`the department code for ${row.department}`);
  if (missing.length > 0 || !intake || !campus) return { ok: false, missing };

  const prefix = `${intake.year}${intake.session}${campus.code}${mode}${school}${department}`;
  const used = context.taken
    .map((number) => number.trim().toUpperCase())
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter((value) => Number.isInteger(value));
  const roll = Math.max(0, ...used) + 1;
  return { ok: true, number: `${prefix}${String(roll).padStart(2, "0")}` };
}
