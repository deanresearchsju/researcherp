import { schools as schoolSeed } from "@/data/schools";
import { vacancySeed, type VacancySeed } from "@/data/vacancies";
import { createSupabase } from "@/lib/supabase/client";
import type { School } from "@/types";
import {
  currentRegister,
  exitFor,
  isPassedOut,
  netAllotments,
  sameGuide,
  supervisorForGuide,
  type GuideAllotment,
} from "@/lib/register";

export type Vacancy = VacancySeed & { id: string; school: string };

export type VacancySource = "database" | "empty" | "office-copy";

export type VacancyLoad = {
  rows: Vacancy[];
  source: VacancySource;
  detail: string | null;
};

export const vacancyMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013133000_research_office_records.sql.";

function sameLabel(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function vacancySchoolName(row: { school?: string | null; department: string }) {
  const named = row.school?.trim() ?? "";
  if (named) return named;
  const subject = row.department.trim();
  if (!subject) return "";
  const byName = schoolSeed.find((school) => sameLabel(school.name, subject));
  if (byName) return byName.name;
  const bySubject = schoolSeed.find((school) =>
    school.areas.some((area) => sameLabel(area, subject)),
  );
  return bySubject?.name ?? "";
}

export function officeVacancies(): Vacancy[] {
  return vacancySeed.map((row) => ({
    ...row,
    id: `office-${row.serialNo}`,
    school: vacancySchoolName(row),
  }));
}

export function groupVacancies(
  rows: Vacancy[],
  catalogue: readonly School[] = schoolSeed,
) {
  const groups = new Map<string, Vacancy[]>();
  for (const row of rows) {
    const school = vacancySchoolName(row) || "Other";
    const list = groups.get(school) ?? [];
    list.push(row);
    groups.set(school, list);
  }
  const ordered: string[] = [];
  for (const school of catalogue) {
    const key = [...groups.keys()].find((name) => sameLabel(name, school.name));
    if (key && !ordered.includes(key)) ordered.push(key);
  }
  for (const name of groups.keys()) {
    if (!ordered.some((item) => sameLabel(item, name))) ordered.push(name);
  }
  return ordered.map((school) => ({ school, rows: groups.get(school) ?? [] }));
}

export function vacancyTotal(rows: Vacancy[]) {
  return rows.reduce((sum, row) => sum + row.vacancyCount, 0);
}

export function openSpecializations(rows: readonly Vacancy[]) {
  return openSubjects(rows);
}

export function hasAnyOpenVacancy(rows: readonly Vacancy[]) {
  return rows.some((row) => row.vacancyCount > 0);
}

export function openSchools(rows: readonly Vacancy[]) {
  const names = new Set<string>();
  for (const row of rows) {
    if (row.vacancyCount <= 0) continue;
    const school = vacancySchoolName(row);
    if (school) names.add(school);
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

export function openSubjects(rows: readonly Vacancy[], school = "") {
  const names = new Set<string>();
  const wanted = school.trim();
  for (const row of rows) {
    if (row.vacancyCount <= 0) continue;
    if (wanted && !sameLabel(vacancySchoolName(row), wanted)) continue;
    const subject = row.department.trim();
    if (subject) names.add(subject);
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

/** Every school, whether or not a seat is open (the applicant is told when there is none). */
export function allSchools(rows: readonly Vacancy[]) {
  const names = new Set<string>();
  for (const row of rows) {
    const school = vacancySchoolName(row);
    if (school) names.add(school);
  }
  return [...names];
}

/** Every department of a school, in the order of the list. */
export function allSubjects(rows: readonly Vacancy[], school = "") {
  const names: string[] = [];
  const wanted = school.trim();
  for (const row of rows) {
    if (wanted && !sameLabel(vacancySchoolName(row), wanted)) continue;
    const subject = row.department.trim();
    if (subject && !names.includes(subject)) names.push(subject);
  }
  return names;
}

export function hasOpenVacancy(
  rows: readonly Vacancy[],
  school: string,
  subject: string,
) {
  return rows.some(
    (row) =>
      row.vacancyCount > 0 &&
      sameLabel(vacancySchoolName(row), school) &&
      sameLabel(row.department, subject),
  );
}

type VacancyRow = {
  id: string;
  serial_no: number;
  supervisor_name: string;
  designation: string;
  department: string;
  research_area: string;
  vacancy_count: number;
  school?: string | null;
};

export function mapVacancy(row: VacancyRow): Vacancy {
  return {
    id: row.id,
    serialNo: row.serial_no,
    supervisorName: row.supervisor_name,
    designation: row.designation,
    department: row.department,
    researchArea: row.research_area,
    vacancyCount: row.vacancy_count,
    school: vacancySchoolName({
      school: row.school,
      department: row.department,
    }),
  };
}

export async function loadVacancies(): Promise<VacancyLoad> {
  const supabase = createSupabase();
  if (!supabase) {
    return {
      rows: officeVacancies(),
      source: "office-copy",
      detail: "Supabase is not configured.",
    };
  }

  const withSchool = await supabase
    .from("supervisor_vacancies")
    .select(
      "id, serial_no, supervisor_name, designation, department, research_area, vacancy_count, school",
    )
    .order("serial_no", { ascending: true });
  const { data, error } = withSchool.error
    ? await supabase
        .from("supervisor_vacancies")
        .select(
          "id, serial_no, supervisor_name, designation, department, research_area, vacancy_count",
        )
        .order("serial_no", { ascending: true })
    : withSchool;

  if (error || !data) {
    return {
      rows: officeVacancies(),
      source: "office-copy",
      detail: "The vacancy table is not in the database yet.",
    };
  }

  if (data.length === 0) {
    return { rows: [], source: "empty", detail: null };
  }

  return { rows: data.map(mapVacancy), source: "database", detail: null };
}

export async function syncAllottedVacancies(
  allocations: readonly GuideAllotment[],
  names: readonly string[],
) {
  const supabase = createSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("supervisor_vacancies")
    .select("id, supervisor_name, vacancy_count");
  if (error || !data) return;
  for (const row of data) {
    if (
      !names.some(
        (name) => name === row.supervisor_name || sameGuide(name, row.supervisor_name),
      )
    ) {
      continue;
    }
    const seed = vacancySeed.find(
      (item) =>
        item.supervisorName === row.supervisor_name ||
        sameGuide(item.supervisorName, row.supervisor_name),
    );
    const leaving = exitFor([], row.supervisor_name);
    let vacancy: number;
    if (leaving) {
      vacancy = 0;
    } else if (seed) {
      const supervisor = supervisorForGuide(row.supervisor_name);
      const extra = supervisor ? netAllotments(supervisor, allocations) : 0;
      vacancy = Math.max(0, seed.vacancyCount - extra);
    } else {
      // Approved after the register was built: approved number minus scholars now with them.
      const quota = currentRegister()?.quotas.find((item) =>
        sameGuide(item.name, row.supervisor_name),
      );
      if (!quota) continue;
      const load = allocations.filter(
        (item) =>
          sameGuide(item.supervisorName, row.supervisor_name) &&
          !isPassedOut(item.scholarIdentifier, item.scholarName),
      ).length;
      vacancy = Math.max(0, quota.quota - load);
    }
    if (vacancy === row.vacancy_count) continue;
    await supabase
      .from("supervisor_vacancies")
      .update({ vacancy_count: vacancy })
      .eq("id", row.id);
  }
}

/** Puts a newly approved supervisor on the vacancy list (and the public page) with the approved number. */
export async function addApprovedSupervisorVacancy(entry: {
  name: string;
  designation: string;
  school: string;
  department: string;
  researchArea: string;
  quota: number;
}) {
  const supabase = createSupabase();
  if (!supabase || !entry.name.trim()) return { ok: false as const };
  const { data, error } = await supabase
    .from("supervisor_vacancies")
    .select("id, serial_no, supervisor_name");
  if (error || !data) return { ok: false as const };
  const existing = data.find((row) => sameGuide(row.supervisor_name, entry.name));
  if (existing) {
    const { error: updateError } = await supabase
      .from("supervisor_vacancies")
      .update({ vacancy_count: Math.max(0, entry.quota) })
      .eq("id", existing.id);
    return { ok: !updateError };
  }
  const serial = data.reduce((max, row) => Math.max(max, row.serial_no ?? 0), 0) + 1;
  const columns = {
    serial_no: serial,
    supervisor_name: entry.name.trim(),
    designation: entry.designation.trim(),
    department: entry.department.trim(),
    research_area: entry.researchArea.trim(),
    vacancy_count: Math.max(0, entry.quota),
  };
  const withSchool = await supabase
    .from("supervisor_vacancies")
    .insert({ ...columns, school: entry.school.trim() });
  if (!withSchool.error) return { ok: true as const };
  const plain = await supabase.from("supervisor_vacancies").insert(columns);
  return { ok: !plain.error };
}

/** Sets a supervisor's vacancy to 0 (leaving) or removes them from the list (past). */
export async function closeSupervisorVacancy(name: string, remove: boolean) {
  const supabase = createSupabase();
  if (!supabase) return;
  const { data } = await supabase
    .from("supervisor_vacancies")
    .select("id, supervisor_name");
  for (const row of data ?? []) {
    if (!sameGuide(row.supervisor_name, name)) continue;
    if (remove) {
      await supabase.from("supervisor_vacancies").delete().eq("id", row.id);
    } else {
      await supabase
        .from("supervisor_vacancies")
        .update({ vacancy_count: 0 })
        .eq("id", row.id);
    }
  }
}
