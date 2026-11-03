import { cacheLife, cacheTag } from "next/cache";

import { newsSeed } from "@/data/announcements";
import { parseItems } from "@/lib/news";
import { defaultSiteSettings, settingsFromRow, type SiteSettings } from "@/lib/office";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { NewsItem } from "@/types";

/**
 * What every public page shows from the database: whether applications are open (with the
 * admission session) and the news and announcements. It is read once on the server and kept
 * for a minute, so a crowd of visitors costs one database read a minute, and the answer is in the
 * page itself instead of arriving after it. A save by the office clears it at once (/api/db).
 */
export const publicSiteTag = "public-site";

export type PublicSite = {
  settings: SiteSettings;
  news: NewsItem[];
  /** False when the database could not be read; the page then shows the written defaults. */
  live: boolean;
};

export async function publicSite(): Promise<PublicSite> {
  "use cache";
  cacheLife("minutes");
  cacheTag(publicSiteTag);
  const supabase = createAdminSupabase();
  if (!supabase) return { settings: defaultSiteSettings, news: newsSeed, live: false };
  const [settings, news] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", "office").maybeSingle(),
    supabase.from("news_board").select("payload").eq("id", "board").maybeSingle(),
  ]);
  const payload = news.data?.payload;
  const items =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? parseItems((payload as { items?: unknown }).items)
      : null;
  return {
    settings: settings.data ? settingsFromRow(settings.data) : defaultSiteSettings,
    news: items ?? newsSeed,
    live: !settings.error && !news.error,
  };
}

/** Does this write through /api/db change what the public pages show? */
export function touchesPublicSite(path: string, body: unknown) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (clean === "rest/v1/site_settings" || clean === "rest/v1/news_board") return true;
  if (clean === "rest/v1/rpc/save_json_blob") {
    const table =
      body && typeof body === "object" ? (body as Record<string, unknown>).p_table : null;
    return table === "news_board";
  }
  return false;
}
