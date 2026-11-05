import { cacheLife, cacheTag } from "next/cache";

import { valueText, type ResearchValues } from "@/lib/faculty-research";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Research toppers, to encourage the faculty: the three faculty members with the most Checked &
 * Approved publications and patents in the university, and the three in each department. Only
 * approved work counts. Equal counts share a rank (1, 1, 3). Read once a minute for everybody;
 * an approval clears it at once.
 */
export const toppersTag = "faculty-toppers";

export type Topper = {
  key: string;
  name: string;
  department: string;
  count: number;
  rank: number;
};

export type Toppers = {
  overall: Topper[];
  departments: { department: string; toppers: Topper[] }[];
  /** Everybody with at least one approved record, ranked, for a faculty member's own standing. */
  ranked: Topper[];
};

/** Ranks by count (most first); equal counts share a rank. */
export function rankFaculty(
  rows: { key: string; name: string; department: string; count: number }[],
) {
  const sorted = [...rows].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  let rank = 0;
  let previous = -1;
  return sorted.map((row, index) => {
    if (row.count !== previous) {
      rank = index + 1;
      previous = row.count;
    }
    return { ...row, rank };
  });
}

/** Counts approved publications and patents per faculty member and ranks them. */
export function buildToppers(
  records: { mobile: string; faculty_name: string; details: unknown }[],
): Toppers {
  const people = new Map<
    string,
    { key: string; name: string; department: string; count: number }
  >();
  for (const record of records) {
    const values = (record.details ?? {}) as ResearchValues;
    // Online courses are kept on the record but are not research output.
    if (valueText(values, "type") === "Online course") continue;
    const name = record.faculty_name || valueText(values, "facultyName");
    const key = record.mobile || name.toLowerCase();
    if (!key) continue;
    const entry = people.get(key) ?? {
      key,
      name,
      department: valueText(values, "department") || "Other",
      count: 0,
    };
    entry.count += 1;
    people.set(key, entry);
  }
  const ranked = rankFaculty([...people.values()]);
  const byDepartment = new Map<string, typeof ranked>();
  for (const person of ranked)
    byDepartment.set(person.department, [
      ...(byDepartment.get(person.department) ?? []),
      person,
    ]);
  return {
    overall: ranked.filter((person) => person.rank <= 3),
    departments: [...byDepartment.entries()]
      .map(([department, list]) => ({
        department,
        toppers: rankFaculty(list).filter((person) => person.rank <= 3),
      }))
      .sort((a, b) => a.department.localeCompare(b.department)),
    ranked,
  };
}

export async function facultyToppers(): Promise<Toppers> {
  "use cache";
  cacheLife("minutes");
  cacheTag(toppersTag);
  const empty: Toppers = { overall: [], departments: [], ranked: [] };
  const supabase = createAdminSupabase();
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("faculty_research_records")
    .select("mobile, faculty_name, details")
    .eq("kind", "publication")
    .not("approved_at", "is", null)
    .limit(10000);
  if (error) {
    console.error(error);
    return empty;
  }
  return buildToppers(data ?? []);
}

/** Where one faculty member stands, by their key (the mobile number). */
export function standingOf(toppers: Toppers, key: string) {
  const me = toppers.ranked.find((person) => person.key === key);
  if (!me) return null;
  const department = rankFaculty(
    toppers.ranked.filter((person) => person.department === me.department),
  ).find((person) => person.key === key);
  return {
    overall: me.rank,
    department: department?.rank ?? 0,
    departmentName: me.department,
    count: me.count,
    of: toppers.ranked.length,
  };
}

/** What the open page shows: names, departments and counts only (no mobile numbers). */
export function publicToppers(toppers: Toppers) {
  const strip = (person: Topper) => ({
    name: person.name,
    department: person.department,
    count: person.count,
    rank: person.rank,
  });
  return {
    overall: toppers.overall.map(strip),
    departments: toppers.departments.map((item) => ({
      department: item.department,
      toppers: item.toppers.map(strip),
    })),
  };
}
