import { newsSeed } from "@/data/announcements";
import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";
import type { NewsItem } from "@/types";

export const newsMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013240000_news_board.sql. Until then, news and events stay in this browser.";

const rowId = "board";

export type NewsLoad = {
  items: NewsItem[];
  source: "database" | "browser";
  detail: string | null;
};

function parseItems(value: unknown): NewsItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<NewsItem>;
    if (!record.id || !record.title?.trim() || !record.isoDate || !record.summary?.trim()) {
      return [];
    }
    if (record.kind !== "News" && record.kind !== "Event") return [];
    return [
      {
        id: record.id,
        kind: record.kind,
        title: record.title.trim(),
        isoDate: record.isoDate,
        summary: record.summary.trim(),
        image: typeof record.image === "string" && record.image ? record.image : null,
      },
    ];
  });
}

function readBrowser(): NewsItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKeys.newsBoard);
    if (!raw) return null;
    return parseItems(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeBrowser(items: NewsItem[]) {
  window.localStorage.setItem(storageKeys.newsBoard, JSON.stringify(items));
}

export async function loadNews(): Promise<NewsLoad> {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) {
    return { items: browser ?? newsSeed, source: "browser", detail: null };
  }
  const { data, error } = await supabase
    .from("news_board")
    .select("payload")
    .eq("id", rowId)
    .maybeSingle();
  if (error) {
    return {
      items: browser ?? newsSeed,
      source: "browser",
      detail: newsMigrationHint,
    };
  }
  if (data?.payload && typeof data.payload === "object" && !Array.isArray(data.payload)) {
    const items = parseItems((data.payload as { items?: unknown }).items);
    return { items, source: "database", detail: null };
  }
  return { items: browser ?? newsSeed, source: "browser", detail: null };
}

let memory: NewsLoad | null = null;
let loading = false;
let request = 0;
const listeners = new Set<() => void>();

function publish(next: NewsLoad) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function subscribeNews(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    const ticket = ++request;
    void loadNews().then((value) => {
      loading = false;
      if (ticket !== request) return;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

export function currentNews() {
  return memory?.items ?? newsSeed;
}

export function currentNewsLoad() {
  return memory;
}

export async function saveNews(items: NewsItem[]) {
  request += 1;
  const supabase = createSupabase();
  if (supabase) {
    const { error } = await supabase.from("news_board").upsert({
      id: rowId,
      payload: toJson({ items }),
    });
    if (!error) {
      if (typeof window !== "undefined") writeBrowser(items);
      publish({ items, source: "database", detail: null });
      return { ok: true as const };
    }
  }
  if (typeof window === "undefined") return { ok: false as const };
  writeBrowser(items);
  publish({ items, source: "browser", detail: newsMigrationHint });
  return { ok: true as const };
}
