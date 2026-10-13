"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { FileUpload } from "@/components/forms/FileUpload";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { newsKinds, newsSeed } from "@/data/announcements";
import { fileLimits } from "@/lib/constants";
import { formatIsoDate, isValidIsoDate } from "@/lib/dates";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { currentNewsLoad, newsMigrationHint, saveNews, subscribeNews } from "@/lib/news";
import type { NewsItem } from "@/types";

const newsSchema = z.object({
  kind: z.enum(newsKinds),
  title: z.string().trim().min(2, "Enter the title.").max(140, "Use 140 characters or fewer."),
  isoDate: z.string().refine(isValidIsoDate, "Enter the date."),
  summary: z
    .string()
    .trim()
    .min(10, "Enter a short summary.")
    .max(500, "Use 500 characters or fewer."),
});

type NewsValues = z.infer<typeof newsSchema>;

const emptyValues: NewsValues = {
  kind: "News",
  title: "",
  isoDate: "",
  summary: "",
};

export function NewsManager() {
  const stored = useSyncExternalStore(subscribeNews, currentNewsLoad, currentNewsLoad);
  const items = stored?.items ?? newsSeed;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [poster, setPoster] = useState<StoredFile | null>(null);
  const [keepImage, setKeepImage] = useState(true);
  const [notice, setNotice] = useState<string | null>(stored?.detail ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = items.find((item) => item.id === editingId) ?? null;

  async function publish(next: NewsItem[], message: string) {
    setBusy(true);
    setError(null);
    const saved = await saveNews(next);
    setBusy(false);
    if (!saved.ok) {
      setError("That item could not be saved.");
      return;
    }
    setNotice(message);
    setEditingId(null);
    setPoster(null);
    setKeepImage(true);
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
    const item: NewsItem = {
      id: editing?.id ?? crypto.randomUUID(),
      kind: values.kind,
      title: values.title.trim(),
      isoDate: values.isoDate,
      summary: values.summary.trim(),
      image,
    };
    const next = [item, ...items.filter((row) => row.id !== item.id)];
    await publish(
      next,
      editing ? `${item.title} is updated.` : `${item.title} is on the announcements page.`,
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">News and events</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        Publish a news item or an event. It appears on News &amp; Announcements.
      </p>
      {stored?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{newsMigrationHint}</p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <NewsForm
        key={editing?.id ?? "new"}
        initial={
          editing
            ? {
                kind: editing.kind,
                title: editing.title,
                isoDate: editing.isoDate,
                summary: editing.summary,
              }
            : emptyValues
        }
        poster={poster}
        onPoster={setPoster}
        keepImage={keepImage && Boolean(editing?.image)}
        onClearImage={() => setKeepImage(false)}
        busy={busy}
        error={error}
        editing={Boolean(editing)}
        onCancel={() => {
          setEditingId(null);
          setPoster(null);
          setKeepImage(true);
          setError(null);
        }}
        onSubmit={(values) => void onSubmit(values)}
      />

      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-secondary uppercase">
                  {item.kind} · {formatIsoDate(item.isoDate)}
                </p>
                <h2 className="mt-1 font-semibold text-primary">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
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
                    setError(null);
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

  return (
    <form
      className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <h2 className="font-semibold text-primary">{editing ? "Edit item" : "Add news or an event"}</h2>
      <FormField label="Kind" htmlFor="news-kind" required error={form.formState.errors.kind?.message}>
        <NativeSelect id="news-kind" {...form.register("kind")}>
          {newsKinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Title" htmlFor="news-title" required error={form.formState.errors.title?.message}>
        <Input id="news-title" {...form.register("title")} />
      </FormField>
      <FormField label="Date" htmlFor="news-date" required error={form.formState.errors.isoDate?.message}>
        <Input id="news-date" type="date" {...form.register("isoDate")} />
      </FormField>
      <FormField
        label="Summary"
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
      <FormField label="Poster" htmlFor="news-poster" hint={fileLimits.newsPoster.label}>
        <FileUpload id="news-poster" acceptRule="newsPoster" value={poster} onChange={onPoster} />
      </FormField>
      {keepImage ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">The current poster stays unless you upload another.</p>
          <Button type="button" variant="outline" size="sm" onClick={onClearImage}>
            Remove poster
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="gold" disabled={busy}>
          {editing ? "Save changes" : "Publish"}
        </Button>
        {editing ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
