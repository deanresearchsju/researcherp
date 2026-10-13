"use client";

import { useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { formatIsoDate } from "@/lib/dates";
import { currentNewsLoad, subscribeNews } from "@/lib/news";
import { newsSeed } from "@/data/announcements";
import type { NewsItem, NewsKind } from "@/types";

function byDate(items: readonly NewsItem[]) {
  return [...items].sort(
    (left, right) => right.isoDate.localeCompare(left.isoDate) || left.title.localeCompare(right.title),
  );
}

function NewsList({ kind, items }: { kind: NewsKind; items: readonly NewsItem[] }) {
  const rows = byDate(items.filter((item) => item.kind === kind));
  return (
    <section className="mt-10" aria-labelledby={`${kind.toLowerCase()}-title`}>
      <h2 id={`${kind.toLowerCase()}-title`} className="font-heading text-3xl text-primary">
        {kind === "News" ? "News" : "Events"}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {kind === "News" ? "No news has been published." : "No events have been published."}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gold">
                  <time dateTime={item.isoDate}>{formatIsoDate(item.isoDate)}</time>
                </Badge>
                <Badge>{item.kind}</Badge>
              </div>
              <h3 className="mt-3 font-heading text-2xl text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="mt-4 max-h-72 w-full rounded-xl object-cover"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NewsBoard() {
  const stored = useSyncExternalStore(subscribeNews, currentNewsLoad, currentNewsLoad);
  const items = stored?.items ?? newsSeed;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <NewsList kind="News" items={items} />
      <NewsList kind="Event" items={items} />
    </div>
  );
}
