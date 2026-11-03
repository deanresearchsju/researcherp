"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import { newsSeed } from "@/data/announcements";
import { currentNewsLoad, subscribeNews } from "@/lib/news";
import {
  currentSiteSettings,
  defaultSiteSettings,
  subscribeSiteSettings,
  type SiteSettings,
} from "@/lib/office";
import type { NewsItem } from "@/types";

/**
 * The application window and the news, sent with the public page by the server (read once a
 * minute for all visitors). Public components read them from here, so they are right in the
 * first paint and no visitor's browser asks the database for them.
 */
type PublicSiteValue = { settings: SiteSettings; news: NewsItem[] } | null;

const PublicSiteContext = createContext<PublicSiteValue>(null);

export function PublicSiteProvider({
  settings,
  news,
  children,
}: {
  settings: SiteSettings;
  news: NewsItem[];
  children: ReactNode;
}) {
  return (
    <PublicSiteContext.Provider value={{ settings, news }}>
      {children}
    </PublicSiteContext.Provider>
  );
}

const quiet = () => () => undefined;

/** The application window: from the page when sent with it, else loaded (portal pages). */
export function usePublicSettings(): SiteSettings {
  const site = useContext(PublicSiteContext);
  const loaded = useSyncExternalStore(
    site ? quiet : subscribeSiteSettings,
    () => (site ? null : currentSiteSettings()),
    () => null,
  );
  return site?.settings ?? loaded ?? defaultSiteSettings;
}

/** The news and announcements: from the page when sent with it, else loaded. */
export function usePublicNews(): NewsItem[] {
  const site = useContext(PublicSiteContext);
  const loaded = useSyncExternalStore(
    site ? quiet : subscribeNews,
    () => (site ? null : currentNewsLoad()),
    () => null,
  );
  return site?.news ?? loaded?.items ?? newsSeed;
}
