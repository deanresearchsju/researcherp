import { schools as schoolSeed } from "@/data/schools";
import { storageKeys } from "@/lib/constants";
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
  detail: string | null;
};

function parseSchools(value: unknown): School[] {
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
    return [
      {
        id: record.id,
        name: record.name.trim(),
        summary: record.summary?.trim() ?? "",
        icon: record.icon,
        areas,
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
    return { schools: browser ?? schoolSeed, source: "browser", detail: null };
  }
  const { data, error } = await supabase
    .from("research_areas")
    .select("payload")
    .eq("id", rowId)
    .maybeSingle();
  if (error) {
    return {
      schools: browser ?? schoolSeed,
      source: "browser",
      detail: researchAreaMigrationHint,
    };
  }
  if (data?.payload && typeof data.payload === "object" && !Array.isArray(data.payload)) {
    const schools = parseSchools((data.payload as { schools?: unknown }).schools);
    return { schools, source: "database", detail: null };
  }
  return { schools: browser ?? schoolSeed, source: "browser", detail: null };
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
    const { error } = await supabase.from("research_areas").upsert({
      id: rowId,
      payload: toJson({ schools }),
    });
    if (!error) {
      if (typeof window !== "undefined") writeBrowser(schools);
      publish({ schools, source: "database", detail: null });
      return { ok: true as const };
    }
  }
  if (typeof window === "undefined") return { ok: false as const };
  writeBrowser(schools);
  publish({ schools, source: "browser", detail: researchAreaMigrationHint });
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
