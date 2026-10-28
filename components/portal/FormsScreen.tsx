"use client";

import { Download, Eye, FileText, PencilLine, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DeskModal, FormDialog, GateBanner, PageTitle } from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatIsoDate } from "@/lib/dates";
import { fileToDataUrl } from "@/lib/files";
import {
  deleteForm,
  formAudienceLabels,
  formAudiences,
  formCategories,
  formDownloadHref,
  formFileAccept,
  formFileRule,
  formFileType,
  formKindLabel,
  formMaxBytes,
  formSizeLabel,
  listForms,
  saveForm,
  type FormAudience,
  type PortalForm,
} from "@/lib/portal-forms";
import { usePreviewSession } from "@/lib/use-preview-session";

type Load = { forms: PortalForm[]; error: string | null } | null;

export function FormsScreen({ mode }: { mode: "office" | "reader" }) {
  const session = usePreviewSession();
  const isAdmin = session?.role === "admin";
  const [load, setLoad] = useState<Load>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<PortalForm | "new" | null>(null);
  const [viewing, setViewing] = useState<PortalForm | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await listForms();
    setLoad(
      result.ok
        ? { forms: result.forms, error: null }
        : { forms: [], error: result.message },
    );
  }, []);

  useEffect(() => {
    let live = true;
    void listForms().then((result) => {
      if (!live) return;
      setLoad(
        result.ok
          ? { forms: result.forms, error: null }
          : { forms: [], error: result.message },
      );
    });
    return () => {
      live = false;
    };
  }, []);

  async function remove(form: PortalForm) {
    if (
      !window.confirm(
        `Remove "${form.title}"? Scholars and supervisors will no longer see it.`,
      )
    ) {
      return;
    }
    setRemoving(form.id);
    const result = await deleteForm(form.id);
    setRemoving(null);
    setNotice(
      result.ok
        ? `${form.title} removed.`
        : (result.message ?? "That form could not be removed."),
    );
    if (result.ok) await refresh();
  }

  const office = mode === "office";
  const forms = load?.forms ?? [];
  const shown = forms.filter(
    (form) =>
      filterMatches(category, form.category) &&
      (!audience || form.audience.includes(audience as FormAudience)) &&
      textMatches(query, [form.title, form.category, form.fileName]),
  );
  const categories = [...new Set(shown.map((form) => form.category || "General"))].sort(
    (left, right) =>
      formCategories.indexOf(left as (typeof formCategories)[number]) -
      formCategories.indexOf(right as (typeof formCategories)[number]),
  );

  return (
    <section className="space-y-5">
      <PageTitle
        kicker={office ? "Letters & reports" : "Downloads"}
        title="Forms & formats"
        actions={
          office ? (
            <Button type="button" variant="gold" onClick={() => setEditing("new")}>
              <Upload className="size-4" aria-hidden="true" />
              Upload form
            </Button>
          ) : null
        }
      />
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}
      {load?.error ? <GateBanner tone="danger">{load.error}</GateBanner> : null}

      {!load ? (
        <p className="text-sm text-muted-foreground">Loading forms…</p>
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "category",
                label: "Category",
                value: category,
                options: formCategories
                  .filter((item) => forms.some((form) => form.category === item))
                  .map((item) => ({ value: item, label: item })),
                onChange: setCategory,
              },
              ...(office
                ? [
                    {
                      id: "audience",
                      label: "For",
                      value: audience,
                      options: formAudiences.map((item) => ({
                        value: item,
                        label: formAudienceLabels[item],
                      })),
                      onChange: setAudience,
                    },
                  ]
                : []),
            ]}
            shown={shown.length}
            total={forms.length}
            filename="forms-and-formats.csv"
            title="Forms & formats"
            headers={["Title", "Category", "For", "File", "Size", "Updated"]}
            rows={shown.map((form) => [
              form.title,
              form.category,
              form.audience.map((item) => formAudienceLabels[item]).join(", "),
              form.fileName,
              formSizeLabel(form.fileSize),
              formatIsoDate(form.updatedAt.slice(0, 10)),
            ])}
          />

          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <FileText
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {forms.length === 0
                  ? "No form has been published yet."
                  : "No form matches."}
              </p>
            </div>
          ) : (
            categories.map((name) => (
              <div key={name} className="space-y-2">
                <h2 className="text-xs font-bold tracking-[0.16em] text-secondary uppercase">
                  {name}
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
                  {shown
                    .filter((form) => (form.category || "General") === name)
                    .map((form) => (
                      <li
                        key={form.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
                      >
                        <span
                          className={
                            formKindLabel(form.fileName) === "PDF"
                              ? "grid size-10 shrink-0 place-items-center rounded-lg bg-secondary/10 text-[0.65rem] font-bold text-secondary"
                              : "grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-[0.65rem] font-bold text-primary"
                          }
                          aria-hidden="true"
                        >
                          {formKindLabel(form.fileName) === "PDF" ? "PDF" : "DOC"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold break-words text-primary">
                            {form.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formKindLabel(form.fileName)} ·{" "}
                            {formSizeLabel(form.fileSize)} · Updated{" "}
                            {formatIsoDate(form.updatedAt.slice(0, 10))}
                          </p>
                          {office ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {form.audience.map((item) => (
                                <Badge key={item} variant="purple">
                                  {formAudienceLabels[item]}
                                </Badge>
                              ))}
                              {!form.complete ? (
                                <Badge variant="maroon">Upload incomplete</Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {form.complete && formKindLabel(form.fileName) === "PDF" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-readonly-allow
                              onClick={() => setViewing(form)}
                            >
                              <Eye className="size-4" aria-hidden="true" />
                              View
                            </Button>
                          ) : null}
                          {form.complete ? (
                            <a
                              href={formDownloadHref(form.id)}
                              data-readonly-allow
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-primary hover:bg-muted"
                            >
                              <Download className="size-4" aria-hidden="true" />
                              Download
                            </a>
                          ) : null}
                          {office ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing(form)}
                            >
                              <PencilLine className="size-4" aria-hidden="true" />
                              Edit
                            </Button>
                          ) : null}
                          {office && isAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={removing === form.id}
                              onClick={() => void remove(form)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </>
      )}

      {editing ? (
        <FormEditor
          key={editing === "new" ? "new" : editing.id}
          form={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
            void refresh();
          }}
        />
      ) : null}
      {viewing ? (
        <DeskModal title={viewing.title} size="lg" onClose={() => setViewing(null)}>
          <iframe
            title={viewing.title}
            src={`${formDownloadHref(viewing.id)}&view=1`}
            className="h-[70vh] w-full rounded-lg border border-border"
          />
        </DeskModal>
      ) : null}
    </section>
  );
}

function FormEditor({
  form,
  onClose,
  onDone,
}: {
  form: PortalForm | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [title, setTitle] = useState(form?.title ?? "");
  const [category, setCategory] = useState(form?.category || "General");
  const [audience, setAudience] = useState<FormAudience[]>(
    form?.audience ?? ["scholar", "supervisor"],
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  function pick(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!formFileType(next.name)) {
      setError("Choose a Word (.doc, .docx) or PDF file.");
      return;
    }
    if (next.size > formMaxBytes) {
      setError("That file is larger than 10 MB.");
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3) {
      setError("Enter the form title.");
      return;
    }
    if (audience.length === 0) {
      setError("Choose who can download this form.");
      return;
    }
    if (!form && !file) {
      setError("Choose the Word or PDF file to upload.");
      return;
    }
    setError(null);
    setProgress(0);
    let fileData = "";
    if (file) {
      try {
        fileData = await fileToDataUrl(file);
      } catch {
        setProgress(null);
        setError("That file could not be read.");
        return;
      }
    }
    const result = await saveForm(
      {
        id: form?.id,
        title: title.trim(),
        category,
        audience,
        ...(file ? { fileName: file.name, fileData, fileSize: file.size } : {}),
      },
      setProgress,
    );
    setProgress(null);
    if (!result.ok) {
      setError(result.message ?? "That form could not be saved.");
      return;
    }
    onDone(result.message ?? "Saved.");
  }

  const busy = progress !== null;
  return (
    <FormDialog
      title={form ? `Edit · ${form.title}` : "Upload form"}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel={busy ? `Uploading ${progress}%` : form ? "Save" : "Upload"}
    >
      <FormField label="Title" htmlFor="formTitle" required>
        <Input
          id="formTitle"
          value={title}
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormField>
      <FormField label="Category" htmlFor="formCategory" required>
        <NativeSelect
          id="formCategory"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {formCategories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          Available to <span className="text-secondary">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {formAudiences.map((item) => {
            const checked = audience.includes(item);
            return (
              <label
                key={item}
                className={
                  checked
                    ? "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 text-sm font-medium text-primary"
                    : "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                }
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={checked}
                  onChange={() =>
                    setAudience((current) =>
                      current.includes(item)
                        ? current.filter((value) => value !== item)
                        : formAudiences.filter(
                            (value) => value === item || current.includes(value),
                          ),
                    )
                  }
                />
                {formAudienceLabels[item]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <FormField
        label={form ? "Replace file" : "File"}
        htmlFor="formFile"
        required={!form}
        hint={
          form && !file
            ? `Current: ${form.fileName} (${formSizeLabel(form.fileSize)}). ${formFileRule}`
            : formFileRule
        }
      >
        <Input
          id="formFile"
          type="file"
          accept={formFileAccept}
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}
