"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { newsBoardCopy, newsSeed } from "@/data/announcements";
import { clientToday } from "@/lib/dates";
import {
  currentNewsLoad,
  isNewNewsItem,
  newestNewsFirst,
  subscribeNews,
} from "@/lib/news";

export function AnnouncementTicker() {
  const stored = useSyncExternalStore(subscribeNews, currentNewsLoad, currentNewsLoad);
  const items = stored?.items ?? newsSeed;
  const rows = newestNewsFirst(items.filter((item) => item.kind === "Announcement"));
  if (rows.length === 0) return null;

  const loop =
    rows.length < 3 ? [...rows, ...rows, ...rows, ...rows] : [...rows, ...rows];
  const today = clientToday();
  const newestId = rows[0]?.id;

  return (
    <section
      className="border-y border-border bg-card"
      aria-label={newsBoardCopy.tickerLabel}
    >
      <div className="mx-auto flex w-full max-w-6xl items-stretch">
        <Link
          href="/announcements"
          className="flex shrink-0 items-center bg-secondary px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.14em] text-secondary-foreground uppercase"
        >
          {newsBoardCopy.tickerLabel}
        </Link>
        <div className="ticker min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex w-max items-center gap-8 py-1.5 pr-8">
            {loop.map((item, index) => {
              const isNew = item.id === newestId || isNewNewsItem(item, today);
              return (
                <Link
                  key={`${item.id}-${index}`}
                  href="/announcements"
                  className="inline-flex items-center gap-2 text-xs whitespace-nowrap text-foreground hover:text-primary"
                >
                  <span className="font-semibold text-primary">{item.title}</span>
                  {isNew ? (
                    <span className="notice-blink inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-accent-foreground uppercase">
                      <Sparkles className="size-3" aria-hidden="true" />
                      {newsBoardCopy.newBadge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
