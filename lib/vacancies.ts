import { vacancySeed, type VacancySeed } from "@/data/vacancies";
import { createSupabase } from "@/lib/supabase/client";
import {
  netAllotments,
  sameGuide,
  supervisorForGuide,
  type GuideAllotment,
} from "@/lib/register";

export type Vacancy = VacancySeed & { id: string };

export type VacancySource = "database" | "empty" | "office-copy";

export type VacancyLoad = {
  rows: Vacancy[];
  source: VacancySource;
  detail: string | null;
};

export const vacancyMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013133000_research_office_records.sql.";

export function officeVacancies(): Vacancy[] {
  return vacancySeed.map((row) => ({ ...row, id: `office-${row.serialNo}` }));
}

export function groupVacancies(rows: Vacancy[]) {
  const groups: { department: string; rows: Vacancy[] }[] = [];
  for (const row of rows) {
    const current = groups.at(-1);
    if (current && current.department === row.department) current.rows.push(row);
    else groups.push({ department: row.department, rows: [row] });
  }
  return groups;
}

export function vacancyTotal(rows: Vacancy[]) {
  return rows.reduce((sum, row) => sum + row.vacancyCount, 0);
}

type VacancyRow = {
  id: string;
  serial_no: number;
  supervisor_name: string;
  designation: string;
  department: string;
  research_area: string;
  vacancy_count: number;
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

  const { data, error } = await supabase
    .from("supervisor_vacancies")
    .select(
      "id, serial_no, supervisor_name, designation, department, research_area, vacancy_count",
    )
    .order("serial_no", { ascending: true });

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
    if (!seed) continue;
    const supervisor = supervisorForGuide(row.supervisor_name);
    const extra = supervisor ? netAllotments(supervisor, allocations) : 0;
    const vacancy = Math.max(0, seed.vacancyCount - extra);
    if (vacancy === row.vacancy_count) continue;
    await supabase
      .from("supervisor_vacancies")
      .update({ vacancy_count: vacancy })
      .eq("id", row.id);
  }
}
