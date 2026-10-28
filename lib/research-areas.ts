import { schools as schoolSeed } from "@/data/schools";
import { storageKeys } from "@/lib/constants";
import { saveJsonBlob } from "@/lib/json-lock";
import { toJson } from "@/lib/records";
import { createSupabase } from "@/lib/supabase/client";
import type { School, SchoolIcon } from "@/types";

export const researchAreaMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261014010000_research_areas.sql. Until then, research areas stay in this browser.";

const rowId = "areas";
const icons = new Set<SchoolIcon>([
  "cpu",
  "flask",
  "briefcase",
  "building",
  "sprout",
  "scale",
  "heart-pulse",
]);

export type AreaLoad = {
  schools: School[];
  source: "database" | "browser";
  updatedAt: string | null;
  detail: string | null;
};

export function parseSchools(value: unknown): School[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<School>;
    if (!record.id || !record.name?.trim() || !record.icon || !icons.has(record.icon)) {
      return [];
    }
    const areas = Array.isArray(record.areas)
      ? record.areas.flatMap((area) =>
          typeof area === "string" && area.trim() ? [area.trim()] : [],
        )
      : [];
    const topics: Record<string, string[]> = {};
    if (
      record.topics &&
      typeof record.topics === "object" &&
      !Array.isArray(record.topics)
    ) {
      for (const [department, list] of Object.entries(record.topics)) {
        if (!Array.isArray(list)) continue;
        const clean = [
          ...new Set(
            list.flatMap((item) =>
              typeof item === "string" && item.trim() ? [item.trim()] : [],
            ),
          ),
        ];
        if (clean.length > 0) topics[department] = clean;
      }
    }
    return [
      {
        id: record.id,
        name: record.name.trim(),
        summary: record.summary?.trim() ?? "",
        icon: record.icon,
        areas,
        ...(Object.keys(topics).length > 0 ? { topics } : {}),
      },
    ];
  });
}

function readBrowser(): School[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKeys.researchAreas);
    if (!raw) return null;
    return parseSchools(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeBrowser(schools: School[]) {
  window.localStorage.setItem(storageKeys.researchAreas, JSON.stringify(schools));
}

export async function loadResearchAreas(): Promise<AreaLoad> {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) {
    return {
      schools: browser ?? schoolSeed,
      source: "browser",
      updatedAt: null,
      detail: null,
    };
  }
  const { data, error } = await supabase
    .from("research_areas")
    .select("payload, updated_at")
    .eq("id", rowId)
    .maybeSingle();
  if (error) {
    return {
      schools: browser ?? schoolSeed,
      source: "browser",
      updatedAt: null,
      detail: researchAreaMigrationHint,
    };
  }
  if (data?.payload && typeof data.payload === "object" && !Array.isArray(data.payload)) {
    const schools = parseSchools((data.payload as { schools?: unknown }).schools);
    return {
      schools,
      source: "database",
      updatedAt: data.updated_at ?? null,
      detail: null,
    };
  }
  return {
    schools: browser ?? schoolSeed,
    source: "browser",
    updatedAt: null,
    detail: null,
  };
}

let memory: AreaLoad | null = null;
let loading = false;
let request = 0;
const listeners = new Set<() => void>();

function publish(next: AreaLoad) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function subscribeResearchAreas(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    const ticket = ++request;
    void loadResearchAreas().then((value) => {
      loading = false;
      if (ticket !== request) return;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

export function currentResearchAreas() {
  return memory?.schools ?? schoolSeed;
}

export function currentAreaLoad() {
  return memory;
}

export async function saveResearchAreas(schools: School[]) {
  request += 1;
  const supabase = createSupabase();
  if (supabase) {
    const saved = await saveJsonBlob(
      "research_areas",
      rowId,
      toJson({ schools }),
      memory?.updatedAt ?? null,
    );
    if (saved.ok) {
      if (typeof window !== "undefined") writeBrowser(schools);
      publish({
        schools,
        source: "database",
        updatedAt: saved.updatedAt,
        detail: null,
      });
      return { ok: true as const };
    }
    if (saved.conflict) return { ok: false as const, message: saved.message };
  }
  if (typeof window === "undefined") return { ok: false as const };
  writeBrowser(schools);
  publish({
    schools,
    source: "browser",
    updatedAt: memory?.updatedAt ?? null,
    detail: researchAreaMigrationHint,
  });
  return { ok: true as const };
}

export function schoolId(name: string, taken: readonly string[]) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "school";
  let id = base;
  let count = 2;
  while (taken.includes(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

/* ------------------------- editing the school > department > area tree ------------------- */

const sameName = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

export type TreeResult = { ok: true; schools: School[] } | { ok: false; message: string };

/** The key areas of a department as kept in the ERP (empty when none are entered). */
export function managedAreas(school: School, department: string) {
  const key = Object.keys(school.topics ?? {}).find((name) => sameName(name, department));
  return key ? (school.topics?.[key] ?? []) : [];
}

export function addDepartment(
  schools: School[],
  schoolId: string,
  name: string,
): TreeResult {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, message: "Enter the department name." };
  const school = schools.find((item) => item.id === schoolId);
  if (!school) return { ok: false, message: "Choose a school." };
  if (school.areas.some((item) => sameName(item, clean))) {
    return { ok: false, message: `${clean} is already a department of this school.` };
  }
  return {
    ok: true,
    schools: schools.map((item) =>
      item.id === schoolId ? { ...item, areas: [...item.areas, clean] } : item,
    ),
  };
}

/** Renames a department; its key areas move with it. */
export function renameDepartment(
  schools: School[],
  schoolId: string,
  from: string,
  to: string,
): TreeResult {
  const clean = to.trim();
  if (clean.length < 2) return { ok: false, message: "Enter the department name." };
  const school = schools.find((item) => item.id === schoolId);
  if (!school) return { ok: false, message: "Choose a school." };
  if (school.areas.some((item) => !sameName(item, from) && sameName(item, clean))) {
    return { ok: false, message: `${clean} is already a department of this school.` };
  }
  return {
    ok: true,
    schools: schools.map((item) => {
      if (item.id !== schoolId) return item;
      const topics = { ...(item.topics ?? {}) };
      const key = Object.keys(topics).find((name) => sameName(name, from));
      if (key) {
        topics[clean] = topics[key];
        if (key !== clean) delete topics[key];
      }
      return {
        ...item,
        areas: item.areas.map((name) => (sameName(name, from) ? clean : name)),
        topics: Object.keys(topics).length > 0 ? topics : undefined,
      };
    }),
  };
}

export function removeDepartment(
  schools: School[],
  schoolId: string,
  name: string,
): School[] {
  return schools.map((item) => {
    if (item.id !== schoolId) return item;
    const topics = Object.fromEntries(
      Object.entries(item.topics ?? {}).filter(([key]) => !sameName(key, name)),
    );
    return {
      ...item,
      areas: item.areas.filter((entry) => !sameName(entry, name)),
      topics: Object.keys(topics).length > 0 ? topics : undefined,
    };
  });
}

/** Sets the key areas of a department (no repeats, no empty lines). */
export function setDepartmentAreas(
  schools: School[],
  schoolId: string,
  department: string,
  areas: readonly string[],
): School[] {
  const seen = new Set<string>();
  const clean = areas
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return schools.map((item) => {
    if (item.id !== schoolId) return item;
    const topics = Object.fromEntries(
      Object.entries(item.topics ?? {}).filter(([key]) => !sameName(key, department)),
    );
    if (clean.length > 0) topics[department] = clean;
    return {
      ...item,
      ...(Object.keys(topics).length > 0 ? { topics } : { topics: undefined }),
    };
  });
}

/** Changes a school's name, summary or icon; the departments and areas stay with it. */
export function editSchool(
  schools: School[],
  schoolId: string,
  values: { name: string; summary: string; icon: School["icon"] },
): TreeResult {
  const name = values.name.trim();
  if (name.length < 2) return { ok: false, message: "Enter the school name." };
  if (schools.some((item) => item.id !== schoolId && sameName(item.name, name))) {
    return { ok: false, message: `${name} is already listed.` };
  }
  return {
    ok: true,
    schools: schools.map((item) =>
      item.id === schoolId
        ? { ...item, name, summary: values.summary.trim(), icon: values.icon }
        : item,
    ),
  };
}
