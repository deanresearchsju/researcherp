"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { FileUpload } from "@/components/forms/FileUpload";
import { FormDialog, PageTitle } from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { newsFormCopy, newsKinds, newsSeed } from "@/data/announcements";
import { fileLimits, newsPhotosMaxCount } from "@/lib/constants";
import { clientNowIso, formatIsoDate, isValidIsoDate } from "@/lib/dates";
import {
  fileError,
  fileToDataUrl,
  releaseFile,
  takeFile,
  type StoredFile,
} from "@/lib/files";
import {
  currentNewsLoad,
  isNewsHref,
  newestNewsFirst,
  newsMigrationHint,
  saveNews,
  subscribeNews,
} from "@/lib/news";
import type { NewsItem } from "@/types";

const newsSchema = z
  .object({
    kind: z.enum(newsKinds),
    title: z
      .string()
      .trim()
      .min(2, "Enter the title.")
      .max(140, "Use 140 characters or fewer."),
    isoDate: z.string().refine(isValidIsoDate, "Enter the date."),
    lastDate: z.string(),
    href: z.string(),
    venue: z.string().max(160, "Use 160 characters or fewer."),
    summary: z
      .string()
      .trim()
      .min(10, "Enter a short summary.")
      .max(500, "Use 500 characters or fewer."),
  })
  .superRefine((value, ctx) => {
    const lastDate = value.kind === "Event" ? "" : value.lastDate.trim();
    if (lastDate && !isValidIsoDate(lastDate)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the last date.",
        path: ["lastDate"],
      });
    }
    if (lastDate && isValidIsoDate(lastDate) && lastDate < value.isoDate) {
      ctx.addIssue({
        code: "custom",
        message: "The last date cannot be before the posted date.",
        path: ["lastDate"],
      });
    }
    if (value.kind === "Event" && !value.venue.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the venue.",
        path: ["venue"],
      });
    }
    const href = value.href.trim();
    if (href && !isNewsHref(href)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid http or https URL.",
        path: ["href"],
      });
    }
  });

type NewsValues = z.infer<typeof newsSchema>;

const emptyValues: NewsValues = {
  kind: "Announcement",
  title: "",
  isoDate: "",
  lastDate: "",
  href: "",
  venue: "",
  summary: "",
};

export function NewsManager() {
  const stored = useSyncExternalStore(subscribeNews, currentNewsLoad, currentNewsLoad);
  const items = stored?.items ?? newsSeed;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [poster, setPoster] = useState<StoredFile | null>(null);
  const [keepImage, setKeepImage] = useState(true);
  const [galleryFiles, setGalleryFiles] = useState<StoredFile[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(stored?.detail ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = items.find((item) => item.id === editingId) ?? null;
  const shownItems = newestNewsFirst(items).filter(
    (item) =>
      filterMatches(kindFilter, item.kind) &&
      textMatches(query, [item.title, item.summary, item.venue ?? "", item.kind]),
  );

  async function publish(next: NewsItem[], message: string) {
    setBusy(true);
    setError(null);
    const saved = await saveNews(next);
    setBusy(false);
    if (!saved.ok) {
      setError(
        "message" in saved && saved.message
          ? saved.message
          : "That item could not be saved.",
      );
      return;
    }
    setNotice(message);
    setFormOpen(false);
    setEditingId(null);
    setPoster(null);
    setKeepImage(true);
    galleryFiles.forEach(releaseFile);
    setGalleryFiles([]);
    setKeptPhotos([]);
  }

  async function onSubmit(values: NewsValues) {
    const fileProblem = fileError(poster?.file ?? null, "newsPoster", false);
    if (fileProblem) {
      setError(fileProblem);
      return;
    }
    const image = poster?.file
      ? await fileToDataUrl(poster.file).catch(() => "")
      : keepImage
        ? (editing?.image ?? null)
        : null;
    if (poster?.file && !image) {
      setError("The poster could not be read.");
      return;
    }
    for (const slot of galleryFiles) {
      const photoProblem = fileError(slot.file, "newsPoster", true);
      if (photoProblem) {
        setError(photoProblem);
        return;
      }
    }
    const added =
      values.kind === "Event"
        ? (
            await Promise.all(
              galleryFiles.map((slot) => fileToDataUrl(slot.file).catch(() => "")),
            )
          ).filter((src) => src.length > 0)
        : [];
    if (
      values.kind === "Event" &&
      galleryFiles.length > 0 &&
      added.length !== galleryFiles.length
    ) {
      setError("An event photo could not be read.");
      return;
    }
    const photos =
      values.kind === "Event"
        ? [...keptPhotos, ...added].slice(0, newsPhotosMaxCount)
        : [];
    const item: NewsItem = {
      id: editing?.id ?? crypto.randomUUID(),
      kind: values.kind,
      title: values.title.trim(),
      isoDate: values.isoDate,
      lastDate: values.kind === "Event" ? null : values.lastDate.trim() || null,
      href: values.href.trim() || null,
      summary: values.summary.trim(),
      venue: values.kind === "Event" ? values.venue.trim() : "",
      image,
      photos,
      createdAt: editing?.createdAt ?? clientNowIso(),
    };
    const next = newestNewsFirst([item, ...items.filter((row) => row.id !== item.id)]);
    await publish(
      next,
      editing
        ? `${item.title} is updated.`
        : `${item.title} is on the announcements page.`,
    );
  }

  return (
    <div>
      <PageTitle
        kicker="Website"
        title={newsFormCopy.title}
        actions={
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              setEditingId(null);
              setPoster(null);
              setKeepImage(true);
              setKeptPhotos([]);
              setError(null);
              setFormOpen(true);
            }}
          >
            {newsFormCopy.addTitle}
          </Button>
        }
      />
      {stored?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{newsMigrationHint}</p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      {formOpen ? (
        <NewsForm
          key={editing?.id ?? "new"}
          initial={
            editing
              ? {
                  kind: editing.kind,
                  title: editing.title,
                  isoDate: editing.isoDate,
                  lastDate: editing.lastDate ?? "",
                  href: editing.href ?? "",
                  venue: editing.venue ?? "",
                  summary: editing.summary,
                }
              : emptyValues
          }
          poster={poster}
          onPoster={setPoster}
          keepImage={keepImage && Boolean(editing?.image)}
          onClearImage={() => setKeepImage(false)}
          keptPhotos={keptPhotos}
          onRemoveKept={(src) =>
            setKeptPhotos((current) => current.filter((item) => item !== src))
          }
          galleryFiles={galleryFiles}
          onGalleryFiles={setGalleryFiles}
          busy={busy}
          error={error}
          editing={Boolean(editing)}
          onCancel={() => {
            setEditingId(null);
            setPoster(null);
            setKeepImage(true);
            galleryFiles.forEach(releaseFile);
            setGalleryFiles([]);
            setKeptPhotos([]);
            setError(null);
            setFormOpen(false);
          }}
          onSubmit={(values) => void onSubmit(values)}
        />
      ) : null}

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "kind",
            label: newsFormCopy.kind,
            value: kindFilter,
            options: newsKinds.map((kind) => ({ value: kind, label: kind })),
            onChange: setKindFilter,
          },
        ]}
        shown={shownItems.length}
        total={items.length}
        filename="news-and-events.csv"
        headers={["Kind", "Title", "Date", "Last date", "Venue", "Link", "Summary"]}
        rows={shownItems.map((item) => [
          item.kind,
          item.title,
          formatIsoDate(item.isoDate),
          item.lastDate ? formatIsoDate(item.lastDate) : "",
          item.venue ?? "",
          item.href ?? "",
          item.summary,
        ])}
      />
      <ul className="mt-6 space-y-3">
        {shownItems.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-secondary uppercase">
                  {item.kind} · {formatIsoDate(item.isoDate)}
                  {item.kind === "Event" && item.venue ? ` · ${item.venue}` : ""}
                  {item.lastDate
                    ? ` · ${newsFormCopy.lastDate} ${formatIsoDate(item.lastDate)}`
                    : ""}
                </p>
                <h2 className="mt-1 font-semibold text-primary">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.summary}
                </p>
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-1 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {item.href}
                  </a>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(item.id);
                    setPoster(null);
                    setKeepImage(true);
                    galleryFiles.forEach(releaseFile);
                    setGalleryFiles([]);
                    setKeptPhotos(item.photos);
                    setError(null);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="maroon"
                  onClick={() => {
                    if (!window.confirm(`Remove ${item.title}?`)) return;
                    void publish(
                      items.filter((row) => row.id !== item.id),
                      `${item.title} is removed.`,
                    );
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewsForm({
  initial,
  poster,
  onPoster,
  keepImage,
  onClearImage,
  keptPhotos,
  onRemoveKept,
  galleryFiles,
  onGalleryFiles,
  busy,
  error,
  editing,
  onCancel,
  onSubmit,
}: {
  initial: NewsValues;
  poster: StoredFile | null;
  onPoster: (file: StoredFile | null) => void;
  keepImage: boolean;
  onClearImage: () => void;
  keptPhotos: string[];
  onRemoveKept: (src: string) => void;
  galleryFiles: StoredFile[];
  onGalleryFiles: (files: StoredFile[]) => void;
  busy: boolean;
  error: string | null;
  editing: boolean;
  onCancel: () => void;
  onSubmit: (values: NewsValues) => void;
}) {
  const form = useForm<NewsValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: initial,
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const remaining = newsPhotosMaxCount - keptPhotos.length - galleryFiles.length;

  return (
    <FormDialog
      title={editing ? newsFormCopy.editTitle : newsFormCopy.addTitle}
      onClose={onCancel}
      onSubmit={form.handleSubmit(onSubmit)}
      busy={busy}
      submitLabel={editing ? "Save changes" : "Publish"}
    >
      <FormField
        label={newsFormCopy.kind}
        htmlFor="news-kind"
        required
        error={form.formState.errors.kind?.message}
      >
        <NativeSelect id="news-kind" {...form.register("kind")}>
          {newsKinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label={newsFormCopy.itemTitle}
        htmlFor="news-title"
        required
        error={form.formState.errors.title?.message}
      >
        <Input id="news-title" {...form.register("title")} />
      </FormField>
      <FormField
        label={kind === "Event" ? newsFormCopy.eventDate : newsFormCopy.postedDate}
        htmlFor="news-date"
        required
        error={form.formState.errors.isoDate?.message}
      >
        <Input id="news-date" type="date" {...form.register("isoDate")} />
      </FormField>
      {kind === "Event" ? (
        <FormField
          label={newsFormCopy.venue}
          htmlFor="news-venue"
          required
          error={form.formState.errors.venue?.message}
        >
          <Input id="news-venue" {...form.register("venue")} />
        </FormField>
      ) : (
        <FormField
          label={newsFormCopy.lastDate}
          htmlFor="news-last-date"
          error={form.formState.errors.lastDate?.message}
        >
          <Input id="news-last-date" type="date" {...form.register("lastDate")} />
        </FormField>
      )}
      <FormField
        label={newsFormCopy.link}
        htmlFor="news-href"
        hint={newsFormCopy.linkHint}
        error={form.formState.errors.href?.message}
      >
        <Input
          id="news-href"
          type="url"
          inputMode="url"
          placeholder="https://"
          {...form.register("href")}
        />
      </FormField>
      <FormField
        label={newsFormCopy.summary}
        htmlFor="news-summary"
        required
        error={form.formState.errors.summary?.message}
      >
        <textarea
          id="news-summary"
          className="min-h-28 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          {...form.register("summary")}
        />
      </FormField>
      <FormField
        label={kind === "Event" ? newsFormCopy.invitation : newsFormCopy.poster}
        htmlFor="news-poster"
        hint={fileLimits.newsPoster.label}
      >
        <FileUpload
          id="news-poster"
          acceptRule="newsPoster"
          value={poster}
          onChange={onPoster}
        />
      </FormField>
      {keepImage ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            The current poster stays unless you upload another.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onClearImage}>
            Remove poster
          </Button>
        </div>
      ) : null}
      {kind === "Event" ? (
        <FormField
          label={newsFormCopy.photos}
          htmlFor="news-photos"
          hint={`${fileLimits.newsPoster.label}. ${newsPhotosMaxCount} photos.`}
        >
          <input
            id="news-photos"
            type="file"
            accept={fileLimits.newsPoster.accept}
            multiple
            disabled={remaining <= 0}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              const accepted: StoredFile[] = [];
              for (const file of picked.slice(0, Math.max(0, remaining))) {
                if (fileError(file, "newsPoster", true)) continue;
                const slot = takeFile(file);
                if (slot) accepted.push(slot);
              }
              if (accepted.length) onGalleryFiles([...galleryFiles, ...accepted]);
            }}
          />
          {keptPhotos.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {keptPhotos.map((src) => (
                <li key={src} className="relative">
                  <img src={src} alt="" className="h-20 w-full rounded-lg object-cover" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 w-full"
                    onClick={() => onRemoveKept(src)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {galleryFiles.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {galleryFiles.map((slot, index) => (
                <li key={`${slot.file.name}-${index}`} className="relative">
                  {slot.previewUrl ? (
                    <img
                      src={slot.previewUrl}
                      alt=""
                      className="h-20 w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 w-full"
                    onClick={() => {
                      releaseFile(slot);
                      onGalleryFiles(
                        galleryFiles.filter((_, itemIndex) => itemIndex !== index),
                      );
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </FormField>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}
