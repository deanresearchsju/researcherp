"use client";

import { Images, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { newsBoardCopy, newsSeed } from "@/data/announcements";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  collectEventPhotos,
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

export function NewsBoard() {
  const stored = useSyncExternalStore(subscribeNews, currentNewsLoad, currentNewsLoad);
  const items = stored?.items ?? newsSeed;
  const [tab, setTab] = useState<NewsKind>("Announcement");
  const [photosOpen, setPhotosOpen] = useState(false);

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
                setPhotosOpen(false);
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
        {tab === "Event" && photosOpen ? (
          <EventPhotoGallery items={items} onBack={() => setPhotosOpen(false)} />
        ) : (
          <NewsList kind={tab} items={items} onOpenPhotos={() => setPhotosOpen(true)} />
        )}
      </div>
    </div>
  );
}

function NewsList({
  kind,
  items,
  onOpenPhotos,
}: {
  kind: NewsKind;
  items: readonly NewsItem[];
  onOpenPhotos: () => void;
}) {
  const rows = newestNewsFirst(items.filter((item) => item.kind === kind));
  const today = clientToday();

  return (
    <div className="space-y-4">
      {kind === "Event" ? (
        <button
          type="button"
          className="flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={onOpenPhotos}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
            <Images className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="font-heading text-xl text-primary sm:text-2xl">
              {newsBoardCopy.photosEntry}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {newsBoardCopy.photosTitle}
            </span>
          </span>
        </button>
      ) : null}

      {rows.length === 0 ? (
        kind === "Announcement" ? (
          <p className="text-sm text-muted-foreground">
            {newsBoardCopy.emptyAnnouncement}
          </p>
        ) : null
      ) : (
        <ul className="space-y-4">
          {rows.map((item, index) => {
            const latest = index === 0 && Boolean(item.createdAt);
            const isNew = isNewNewsItem(item, today);
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
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="mt-4 max-h-72 w-full rounded-xl object-cover"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EventPhotoGallery({
  items,
  onBack,
}: {
  items: readonly NewsItem[];
  onBack: () => void;
}) {
  const photos = collectEventPhotos(items);
  const [active, setActive] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl text-primary">
          {newsBoardCopy.photosTitle}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {newsBoardCopy.photosBack}
        </Button>
      </div>
      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{newsBoardCopy.emptyPhotos}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                className="block w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => setActive(photo.src)}
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="h-52 w-full object-cover"
                />
                <span className="block px-4 py-3 text-left text-sm font-semibold text-primary">
                  {photo.title}
                </span>
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
          aria-label={newsBoardCopy.photosTitle}
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
