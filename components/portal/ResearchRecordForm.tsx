"use client";

import { AlertTriangle, Check, Link2, Plus, Trash2, Upload } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  balanceOf,
  formatDay,
  identityFields,
  instalmentLimit,
  instalmentsOf,
  isShown,
  receivedTotal,
  recordFields,
  rupees,
  type Instalment,
  type ResearchField,
  type ResearchKind,
  type ResearchValues,
} from "@/lib/faculty-research";
import { useChecklist } from "@/lib/use-checklist";
import { evidenceItemsFor, evidenceList } from "@/lib/faculty-evidence";
import { evidenceOf } from "@/lib/faculty-research";
import { cn } from "@/lib/utils";

const evidenceMaxBytes = 2 * 1024 * 1024;

/** Sends one evidence file to the ERP's file store (Amazon S3) and returns its reference. */
async function uploadEvidence(file: File) {
  if (file.size > evidenceMaxBytes) return { error: "The file must be 2 MB or smaller." };
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name))
    return { error: "Use a PDF, JPG or PNG file." };
  try {
    const body = new FormData();
    body.set("file", file);
    body.set("folder", "research");
    const response = await fetch("/api/files", { method: "POST", body });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      ref?: string;
      message?: string;
    } | null;
    if (response.ok && data?.ok && data.ref) return { ref: data.ref };
    return { error: data?.message ?? "The file could not be uploaded." };
  } catch {
    return { error: "Check the connection and try again." };
  }
}

/** The files asked for with this record (kept by the administrator under Checklists). */
function EvidenceUploads({
  kind,
  values,
  error,
  idPrefix,
  onChange,
  canView,
}: {
  kind: ResearchKind;
  values: ResearchValues;
  error?: string;
  idPrefix: string;
  onChange: (next: ResearchValues) => void;
  canView: boolean;
}) {
  const list = useChecklist(evidenceList(kind));
  const items = evidenceItemsFor(kind, values, list);
  const uploaded = evidenceOf(values);
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  if (items.length === 0) return null;

  async function choose(id: string, file: File | undefined) {
    if (!file) return;
    setBusy(id);
    setProblem("");
    const result = await uploadEvidence(file);
    setBusy("");
    if (result.ref) onChange({ ...values, evidence: { ...uploaded, [id]: result.ref } });
    else setProblem(result.error ?? "");
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
        Evidence (PDF, JPG or PNG, up to 2 MB)
      </legend>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map((item) => {
          const id = `${idPrefix}-evidence-${item.id}`;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <label htmlFor={id} className="text-sm font-medium">
                {item.title}
                {item.required ? (
                  <span className="text-secondary" aria-hidden="true">
                    {" "}
                    *
                  </span>
                ) : null}
              </label>
              <div className="flex items-center gap-2">
                {uploaded[item.id] ? (
                  canView ? (
                    <a
                      href={uploaded[item.id]}
                      target="_blank"
                      rel="noreferrer"
                      data-readonly-allow
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      <Check className="size-4" /> View
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Check className="size-4" /> Uploaded
                    </span>
                  )
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary/40">
                  <Upload className="size-3.5" />
                  {busy === item.id
                    ? "Uploading…"
                    : uploaded[item.id]
                      ? "Replace"
                      : "Upload"}
                  <input
                    id={id}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    disabled={Boolean(busy)}
                    onChange={(event) => {
                      void choose(item.id, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      {problem || error ? (
        <p role="alert" className="text-sm text-secondary">
          {problem || error}
        </p>
      ) : null}
    </fieldset>
  );
}

const fundingKeys = new Set([
  "amountSanctioned",
  "sanctionedOn",
  "sanctionOrderNo",
  "bankAccountNo",
  "instalments",
  "amountUtilised",
  "utilisationOn",
  "settlement",
  "closedOn",
]);

/** Fills the year from a date the first time, or when it still follows the old date. */
function withYear(values: ResearchValues, key: string, next: string): ResearchValues {
  const updated = { ...values, [key]: next };
  if (key !== "publishedOn" && key !== "filedOn") return updated;
  const year = typeof values.year === "string" ? values.year : "";
  const old = typeof values[key] === "string" ? (values[key] as string).slice(0, 4) : "";
  if (/^\d{4}-/.test(next) && (!year || year === old)) {
    if (key === "filedOn" && values.publishedOn) return updated;
    updated.year = next.slice(0, 4);
  }
  return updated;
}

function Instalments({
  values,
  onChange,
  id,
}: {
  values: ResearchValues;
  onChange: (rows: Instalment[]) => void;
  id: string;
}) {
  const rows = instalmentsOf(values);
  const set = (index: number, patch: Partial<Instalment>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-2" id={id}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No instalment yet.</p>
      ) : null}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
          <Input
            aria-label={`Instalment ${index + 1} amount`}
            inputMode="decimal"
            placeholder="Amount (₹)"
            className="max-w-44"
            value={row.amount}
            onChange={(event) => set(index, { amount: event.target.value })}
          />
          <Input
            type="date"
            aria-label={`Instalment ${index + 1} date`}
            className="max-w-44"
            value={row.receivedOn}
            onChange={(event) => set(index, { receivedOn: event.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Remove instalment ${index + 1}`}
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= instalmentLimit}
          onClick={() => onChange([...rows, { amount: "", receivedOn: "" }])}
        >
          <Plus className="size-4" /> Add instalment
        </Button>
        <p className="text-sm">
          Received <strong>{rupees(receivedTotal(values)) || "₹0"}</strong> · Balance{" "}
          <strong>{rupees(balanceOf(values)) || "₹0"}</strong>
        </p>
      </div>
    </div>
  );
}

/** Where the DOI and link checks are sent: the open page or the ERP. */
const CheckUrl = createContext("/api/faculty-research");

type Checked = { status: "ok" | "missing" | "unknown"; message: string };

/** Checks a DOI at doi.org, or that a web link opens, from the server. */
function LinkCheckButton({ kind, value }: { kind: "doi" | "link"; value: string }) {
  const url = useContext(CheckUrl);
  const [result, setResult] = useState<{ value: string; check: Checked } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = result && result.value === value ? result.check : null;

  async function check() {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-links", [kind]: value }),
      });
      const data = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      const check = (data?.[kind] as Checked | null) ?? {
        status: "unknown",
        message: String(data?.message ?? "The check could not be made now."),
      };
      setResult({ value, check });
    } catch {
      setResult({
        value,
        check: { status: "unknown", message: "Check the connection." },
      });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || !value.trim()}
        onClick={() => void check()}
      >
        <Link2 className="size-3.5" aria-hidden="true" />
        {busy ? "Checking…" : kind === "doi" ? "Check DOI" : "Check link"}
      </Button>
      {shown ? (
        <span
          role="status"
          className={cn(
            "text-xs font-semibold",
            shown.status === "ok"
              ? "text-primary"
              : shown.status === "missing"
                ? "text-secondary"
                : "text-muted-foreground",
          )}
        >
          {shown.status === "ok" ? "✓ " : shown.status === "missing" ? "✗ " : ""}
          {shown.message}
        </span>
      ) : null}
    </div>
  );
}

function Field({
  field,
  values,
  error,
  idPrefix,
  onChange,
}: {
  field: ResearchField;
  values: ResearchValues;
  error?: string;
  idPrefix: string;
  onChange: (next: ResearchValues) => void;
}) {
  const id = `${idPrefix}-${field.key}`;
  const required = field.required?.(values) ?? false;
  const value = values[field.key];
  const textValue = typeof value === "string" ? value : "";
  const wide = field.wide || field.type === "instalments" || field.type === "multi";
  if (field.type === "confirm") {
    return (
      <div className="space-y-2 sm:col-span-2">
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            textValue === "Yes"
              ? "border-primary/40 bg-primary/5"
              : "border-secondary/30 bg-secondary/5",
          )}
        >
          <input
            id={id}
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={textValue === "Yes"}
            aria-invalid={Boolean(error)}
            onChange={(event) =>
              onChange({ ...values, [field.key]: event.target.checked ? "Yes" : "" })
            }
          />
          <span className="font-medium">{field.label}</span>
        </label>
        {error ? (
          <p role="alert" className="text-sm text-secondary">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
  let control;
  if (field.type === "select") {
    control = (
      <NativeSelect
        id={id}
        value={textValue}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
      >
        <option value="">Choose</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    );
  } else if (field.type === "multi") {
    const chosen = Array.isArray(value) ? (value as string[]) : [];
    control = (
      <div id={id} className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        {field.options?.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={chosen.includes(option)}
              onChange={() =>
                onChange({
                  ...values,
                  [field.key]: chosen.includes(option)
                    ? chosen.filter((item) => item !== option)
                    : [...chosen, option],
                })
              }
            />
            {option}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "instalments") {
    control = (
      <Instalments
        id={id}
        values={values}
        onChange={(rows) => onChange({ ...values, instalments: rows })}
      />
    );
  } else {
    control = (
      <Input
        id={id}
        type={field.type === "date" ? "date" : "text"}
        inputMode={
          field.key === "mobile" || field.type === "number"
            ? "numeric"
            : field.type === "money"
              ? "decimal"
              : undefined
        }
        maxLength={field.max}
        list={field.suggestions ? `${id}-list` : undefined}
        value={textValue}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(withYear(values, field.key, event.target.value))}
      />
    );
    if (field.key === "doi" || field.key === "link")
      control = (
        <div>
          {control}
          <LinkCheckButton kind={field.key} value={textValue} />
        </div>
      );
  }
  return (
    <FormField
      label={field.label}
      htmlFor={id}
      required={required}
      error={error}
      className={cn(wide && "sm:col-span-2")}
    >
      {control}
      {field.suggestions ? (
        <datalist id={`${id}-list`}>
          {field.suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </FormField>
  );
}

function Group({
  title,
  fields,
  ...rest
}: {
  title: string;
  fields: readonly ResearchField[];
  values: ResearchValues;
  errors: Record<string, string>;
  idPrefix: string;
  onChange: (next: ResearchValues) => void;
}) {
  const shown = fields.filter((field) => isShown(field, rest.values));
  if (shown.length === 0) return null;
  return (
    <fieldset className="space-y-3">
      <legend className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map((field) => (
          <Field
            key={field.key}
            field={field}
            values={rest.values}
            error={rest.errors[field.key]}
            idPrefix={rest.idPrefix}
            onChange={rest.onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Every field of one publication or proposal, grouped: personal details, the record, funding. */
export function ResearchRecordForm({
  kind,
  values,
  errors,
  onChange,
  idPrefix = "research",
  lockIdentity = false,
  hiddenKeys = [],
  canViewFiles = true,
  checkUrl = "/api/faculty-research",
}: {
  kind: ResearchKind;
  values: ResearchValues;
  errors: Record<string, string>;
  onChange: (next: ResearchValues) => void;
  idPrefix?: string;
  /** Hides the personal details (shown above the form instead). */
  lockIdentity?: boolean;
  /** Fields already given elsewhere (the mobile number and date of birth on the open page). */
  hiddenKeys?: readonly string[];
  /** Uploaded files open only for a signed-in ERP user, not on the open website. */
  canViewFiles?: boolean;
  /** Where the DOI and link checks go (the open page uses its own address). */
  checkUrl?: string;
}) {
  const fields = recordFields(kind);
  const identity = identityFields.filter((field) => !hiddenKeys.includes(field.key));
  const common = { values, errors, idPrefix, onChange };
  const joined = typeof values.joinedOn === "string" ? values.joinedOn : "";
  return (
    <CheckUrl.Provider value={checkUrl}>
      <div className="space-y-6">
        {kind === "publication" ? (
          <p className="flex items-start gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-foreground">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <span>
              Only papers, books, book chapters and patents that carry the{" "}
              <strong>St. Joseph University affiliation</strong>
              {joined ? (
                <>
                  {" "}
                  and are dated on or after your joining date (
                  <strong>{formatDay(joined)}</strong>)
                </>
              ) : null}{" "}
              are taken into account. The DOI and the web link are checked.
            </span>
          </p>
        ) : null}
        {lockIdentity ? null : (
          <Group title="Personal details" fields={identity} {...common} />
        )}
        <Group
          title={kind === "publication" ? "Publication" : "Project"}
          fields={fields.filter((field) => !fundingKeys.has(field.key))}
          {...common}
        />
        {kind === "proposal" ? (
          <Group
            title="Sanction and funding"
            fields={fields.filter((field) => fundingKeys.has(field.key))}
            {...common}
          />
        ) : null}
        <EvidenceUploads
          kind={kind}
          values={values}
          error={errors.evidence}
          idPrefix={idPrefix}
          onChange={onChange}
          canView={canViewFiles}
        />
      </div>
    </CheckUrl.Provider>
  );
}
