import { newsNewWindowDays, newsSeed } from "@/data/announcements";
import { storageKeys } from "@/lib/constants";
import { isValidIsoDate, isWithinLastDays } from "@/lib/dates";
import { createSupabase } from "@/lib/supabase/client";
import { saveJsonBlob } from "@/lib/json-lock";
import { toJson } from "@/lib/records";
import type { NewsItem, NewsKind } from "@/types";

export const newsMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013240000_news_board.sql. Until then, news and events stay in this browser.";

const rowId = "board";

export type NewsLoad = {
  items: NewsItem[];
  source: "database" | "browser";
  updatedAt: string | null;
  detail: string | null;
};

export function isNewsHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("://")) {
    return true;
  }
  return /^https?:\/\/\S+$/i.test(trimmed);
}

function parseKind(value: unknown): NewsKind | null {
  if (value === "Event") return "Event";
  if (value === "Announcement" || value === "News") return "Announcement";
  return null;
}

function asTrimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPhotoSrc(value: string) {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("/") ||
    /^https?:\/\//i.test(value)
  );
}

function parsePhotos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const src = asTrimmed(entry);
    return src && isPhotoSrc(src) ? [src] : [];
  });
}

export type EventPhoto = {
  id: string;
  src: string;
  title: string;
};

export function collectEventPhotos(items: readonly NewsItem[]): EventPhoto[] {
  const seen = new Set<string>();
  const photos: EventPhoto[] = [];
  for (const item of newestNewsFirst(items.filter((row) => row.kind === "Event"))) {
    const sources = [...(item.photos ?? []), ...(item.image ? [item.image] : [])];
    for (const src of sources) {
      if (!src || seen.has(src)) continue;
      seen.add(src);
      photos.push({ id: `${item.id}-${photos.length}`, src, title: item.title });
    }
  }
  return photos;
}

function parseItems(value: unknown): NewsItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = asTrimmed(record.id);
    const title = asTrimmed(record.title);
    const isoDate = asTrimmed(record.isoDate);
    const summary = asTrimmed(record.summary);
    const kind = parseKind(record.kind);
    if (!id || !title || !isoDate || !summary || !kind) return [];
    const hrefValue = asTrimmed(record.href);
    const lastDateValue = asTrimmed(record.lastDate);
    const image = asTrimmed(record.image) || null;
    return [
      {
        id,
        kind,
        title,
        isoDate,
        lastDate: isValidIsoDate(lastDateValue) ? lastDateValue : null,
        href: isNewsHref(hrefValue) ? hrefValue : null,
        summary,
        image,
        photos: parsePhotos(record.photos),
        createdAt: asTrimmed(record.createdAt) || null,
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
    return {
      items: browser ?? newsSeed,
      source: "browser",
      updatedAt: null,
      detail: null,
    };
  }
  const { data, error } = await supabase
    .from("news_board")
    .select("payload, updated_at")
    .eq("id", rowId)
    .maybeSingle();
  if (error) {
    return {
      items: browser ?? newsSeed,
      source: "browser",
      updatedAt: null,
      detail: newsMigrationHint,
    };
  }
  if (data?.payload && typeof data.payload === "object" && !Array.isArray(data.payload)) {
    const items = parseItems((data.payload as { items?: unknown }).items);
    return {
      items,
      source: "database",
      updatedAt: data.updated_at ?? null,
      detail: null,
    };
  }
  return {
    items: browser ?? newsSeed,
    source: "browser",
    updatedAt: null,
    detail: null,
  };
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

export function isNewNewsItem(item: NewsItem, today: string) {
  const createdDay = item.createdAt?.slice(0, 10);
  if (!createdDay) return false;
  return isWithinLastDays(createdDay, today, newsNewWindowDays);
}

export function newestNewsFirst(items: readonly NewsItem[]) {
  return [...items].sort((left, right) => {
    if (left.createdAt && right.createdAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    if (left.createdAt && !right.createdAt) return -1;
    if (!left.createdAt && right.createdAt) return 1;
    return (
      right.isoDate.localeCompare(left.isoDate) || left.title.localeCompare(right.title)
    );
  });
}

export async function saveNews(items: NewsItem[]) {
  request += 1;
  const supabase = createSupabase();
  if (supabase) {
    const saved = await saveJsonBlob(
      "news_board",
      rowId,
      toJson({ items }),
      memory?.updatedAt ?? null,
    );
    if (saved.ok) {
      if (typeof window !== "undefined") writeBrowser(items);
      publish({
        items,
        source: "database",
        updatedAt: saved.updatedAt,
        detail: null,
      });
      return { ok: true as const };
    }
    if (saved.conflict) return { ok: false as const, message: saved.message };
  }
  if (typeof window === "undefined") return { ok: false as const };
  writeBrowser(items);
  publish({
    items,
    source: "browser",
    updatedAt: memory?.updatedAt ?? null,
    detail: newsMigrationHint,
  });
  return { ok: true as const };
}
