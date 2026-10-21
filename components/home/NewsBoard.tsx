"use client";

import { Calendar, MapPin, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { newsBoardCopy, newsSeed } from "@/data/announcements";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  currentNewsLoad,
  isNewNewsItem,
  newestNewsFirst,
  subscribeNews,
} from "@/lib/news";
import { cn } from "@/lib/utils";
import type { NewsItem, NewsKind } from "@/types";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function eventGallery(item: NewsItem) {
  const seen = new Set<string>();
  const photos: string[] = [];
  for (const src of [item.image, ...item.photos]) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    photos.push(src);
  }
  return photos;
}

export function NewsBoard() {
  const stored = useSyncExternalStore(subscribeNews, currentNewsLoad, currentNewsLoad);
  const items = stored?.items ?? newsSeed;
  const [tab, setTab] = useState<NewsKind>("Announcement");
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const openEvent =
    tab === "Event"
      ? (items.find((item) => item.id === openEventId && item.kind === "Event") ?? null)
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div
        className="inline-flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border bg-muted/50 p-2"
        role="tablist"
        aria-label={newsBoardCopy.tabsLabel}
      >
        {(
          [
            { id: "Announcement", label: newsBoardCopy.announcementTab },
            { id: "Event", label: newsBoardCopy.eventsTab },
          ] as const
        ).map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`news-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`news-panel-${item.id}`}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "bg-card text-primary hover:bg-muted",
              )}
              onClick={() => {
                setTab(item.id);
                setOpenEventId(null);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id={`news-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`news-tab-${tab}`}
        className="mt-6"
      >
        {openEvent ? (
          <EventPhotos item={openEvent} onBack={() => setOpenEventId(null)} />
        ) : (
          <NewsList kind={tab} items={items} onOpenEvent={(id) => setOpenEventId(id)} />
        )}
      </div>
    </div>
  );
}

function NewsList({
  kind,
  items,
  onOpenEvent,
}: {
  kind: NewsKind;
  items: readonly NewsItem[];
  onOpenEvent: (id: string) => void;
}) {
  const rows = newestNewsFirst(items.filter((item) => item.kind === kind));
  const today = clientToday();

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {kind === "Event" ? newsBoardCopy.emptyEvent : newsBoardCopy.emptyAnnouncement}
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((item, index) => {
            const latest = index === 0 && Boolean(item.createdAt);
            const isNew = isNewNewsItem(item, today);
            if (kind === "Event") {
              return (
                <li key={item.id}>
                  <EventRow
                    item={item}
                    latest={latest}
                    isNew={isNew}
                    onOpen={() => onOpenEvent(item.id)}
                  />
                </li>
              );
            }
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {latest ? (
                      <Badge variant="gold" className="notice-blink">
                        {newsBoardCopy.latestBadge}
                      </Badge>
                    ) : null}
                    {isNew ? (
                      <Badge variant="maroon" className="notice-blink">
                        {newsBoardCopy.newBadge}
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-2 font-heading text-xl text-primary sm:text-2xl">
                    {item.href ? (
                      <a
                        href={item.href}
                        className="underline-offset-4 hover:underline"
                        target={isExternalHref(item.href) ? "_blank" : undefined}
                        rel={isExternalHref(item.href) ? "noreferrer" : undefined}
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <div>
                      <dt className="inline font-semibold text-primary">
                        {newsBoardCopy.postedDate}:{" "}
                      </dt>
                      <dd className="inline text-muted-foreground">
                        <time dateTime={item.isoDate}>{formatIsoDate(item.isoDate)}</time>
                      </dd>
                    </div>
                    {item.lastDate ? (
                      <div>
                        <dt className="inline font-semibold text-primary">
                          {newsBoardCopy.lastDate}:{" "}
                        </dt>
                        <dd className="inline text-muted-foreground">
                          <time dateTime={item.lastDate}>
                            {formatIsoDate(item.lastDate)}
                          </time>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EventRow({
  item,
  latest,
  isNew,
  onOpen,
}: {
  item: NewsItem;
  latest: boolean;
  isNew: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-colors hover:border-primary/25 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-center gap-2">
        {latest ? (
          <Badge variant="gold" className="notice-blink">
            {newsBoardCopy.latestBadge}
          </Badge>
        ) : null}
        {isNew ? (
          <Badge variant="maroon" className="notice-blink">
            {newsBoardCopy.newBadge}
          </Badge>
        ) : null}
      </div>
      <h2 className="mt-2 font-heading text-xl text-primary sm:text-2xl">{item.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
      <EventDetails item={item} />
    </button>
  );
}

function EventDetails({ item }: { item: NewsItem }) {
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
      <div className="inline-flex items-center gap-1.5">
        <Calendar className="size-3.5 text-secondary" aria-hidden="true" />
        <dt className="font-semibold text-primary">{newsBoardCopy.eventDate}:</dt>
        <dd className="text-muted-foreground">
          <time dateTime={item.isoDate}>{formatIsoDate(item.isoDate)}</time>
        </dd>
      </div>
      {item.venue ? (
        <div className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5 text-secondary" aria-hidden="true" />
          <dt className="font-semibold text-primary">{newsBoardCopy.venue}:</dt>
          <dd className="text-muted-foreground">{item.venue}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function EventPhotos({ item, onBack }: { item: NewsItem; onBack: () => void }) {
  const [active, setActive] = useState<string | null>(null);
  const photos = eventGallery(item);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl text-primary">{item.title}</h2>
          <EventDetails item={item} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {newsBoardCopy.photosBack}
        </Button>
      </div>
      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {newsBoardCopy.emptyEventPhotos}
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((src) => (
            <li key={src}>
              <button
                type="button"
                className="block w-full overflow-hidden rounded-xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => setActive(src)}
              >
                <SafeImage src={src} alt="" className="h-52 w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {active ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-purple-deep/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
        >
          <button
            type="button"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-card text-primary"
            onClick={() => setActive(null)}
            aria-label={newsBoardCopy.photosClose}
          >
            <X className="size-5" />
          </button>
          <img
            src={active}
            alt=""
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <img src={src} alt={alt} className={className} onError={() => setVisible(false)} />
  );
}
