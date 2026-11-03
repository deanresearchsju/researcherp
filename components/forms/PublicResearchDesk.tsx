"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { FacultyDashboard } from "@/components/forms/FacultyDashboard";
import { ResearchRecordForm } from "@/components/portal/ResearchRecordForm";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  emptyValues,
  identityFields,
  type ResearchKind,
  type ResearchRecord,
  type ResearchValues,
} from "@/lib/faculty-research";
import { cn } from "@/lib/utils";

type Reply = { ok: boolean; data: Record<string, unknown> };

async function post(body: Record<string, unknown>): Promise<Reply> {
  try {
    const response = await fetch("/api/faculty-research/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return { ok: response.ok && Boolean(data?.ok), data: data ?? {} };
  } catch {
    return {
      ok: false,
      data: { message: "Check the connection and try again." } as Record<string, unknown>,
    };
  }
}

const kindLabel: Record<ResearchKind, string> = {
  publication: "Publication",
  proposal: "Project proposal",
};

type Faculty = {
  mobile: string;
  dob: string;
  profile: ResearchValues | null;
  records: ResearchRecord[];
};

/** Step 1: the mobile number and date of birth open the faculty member's file. */
function Identify({ onOpen }: { onOpen: (faculty: Faculty) => void }) {
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { ok, data } = await post({ action: "lookup", mobile, dob });
    setBusy(false);
    if (ok) {
      onOpen({
        mobile: mobile.replace(/\D/g, "").slice(-10),
        dob,
        profile: (data.profile as ResearchValues | null) ?? null,
        records: (data.records as ResearchRecord[]) ?? [],
      });
      return;
    }
    setErrors((data.errors as Record<string, string>) ?? {});
    setMessage(String(data.message ?? "Try again."));
  }

  return (
    <form
      noValidate
      onSubmit={open}
      className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <FormField
        label="Mobile number"
        htmlFor="faculty-mobile"
        required
        error={errors.mobile}
      >
        <Input
          id="faculty-mobile"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={13}
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
        />
      </FormField>
      <FormField label="Date of birth" htmlFor="faculty-dob" required error={errors.dob}>
        <Input
          id="faculty-dob"
          type="date"
          value={dob}
          onChange={(event) => setDob(event.target.value)}
        />
      </FormField>
      <Button type="submit" disabled={busy} className="sm:mb-0.5">
        {busy ? "Opening…" : "Continue"}
      </Button>
      {message ? (
        <p role="alert" className="text-sm text-secondary sm:col-span-3">
          {message}
        </p>
      ) : null}
    </form>
  );
}

/** A new record. The personal details are asked only when none are saved yet. */
function AddRecord({
  faculty,
  kind,
  onSaved,
  onCancel,
}: {
  faculty: Faculty;
  kind: ResearchKind;
  onSaved: (faculty: Faculty) => void;
  onCancel: () => void;
}) {
  const first = !faculty.profile;
  // Only the personal details not saved yet are asked (the date of joining SJU, for records
  // saved before it was asked); the rest come from the saved record.
  const savedKeys = identityFields
    .map((field) => field.key)
    .filter((key) => {
      const value = faculty.profile?.[key];
      return typeof value === "string" && value !== "";
    });
  const [values, setValues] = useState<ResearchValues>(() => ({
    ...emptyValues(kind),
    ...(faculty.profile ?? {}),
    mobile: faculty.mobile,
    dob: faculty.dob,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { ok, data } = await post({
      action: "submit",
      kind,
      mobile: faculty.mobile,
      dob: faculty.dob,
      record: values,
      website,
    });
    setBusy(false);
    if (ok) {
      onSaved({
        ...faculty,
        profile: (data.profile as ResearchValues | null) ?? faculty.profile,
        records: (data.records as ResearchRecord[]) ?? faculty.records,
      });
      return;
    }
    setErrors((data.errors as Record<string, string>) ?? {});
    setMessage(String(data.message ?? "The record could not be saved."));
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="space-y-6 rounded-xl border border-border p-4 sm:p-6"
    >
      <h3 className="font-heading text-xl text-primary">
        Add {kindLabel[kind].toLowerCase()}
      </h3>
      {first ? (
        <p className="text-sm text-muted-foreground">
          First record: enter your details once. They are kept for your next records.
        </p>
      ) : null}
      <ResearchRecordForm
        kind={kind}
        values={values}
        errors={errors}
        onChange={setValues}
        idPrefix="public"
        hiddenKeys={["mobile", "dob", ...savedKeys]}
        canViewFiles={false}
        checkUrl="/api/faculty-research/public"
      />
      <label
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>
      {message ? (
        <p role="alert" className="text-sm text-secondary">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="gold" disabled={busy}>
          {busy ? "Saving…" : "Submit"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The open page for faculty: mobile number and date of birth first; then the saved details, the
 * records already saved and buttons to add a publication or a project proposal. Records can be
 * added here, never changed or deleted.
 */
export function PublicResearchDesk() {
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [adding, setAdding] = useState<ResearchKind | null>(null);
  const [notice, setNotice] = useState("");

  if (!faculty) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-8">
        <h2 className="font-heading text-xl text-primary">
          Enter your mobile number and date of birth
        </h2>
        <Identify
          onOpen={(opened) => {
            setFaculty(opened);
            setNotice("");
            setAdding(opened.profile ? null : "publication");
          }}
        />
      </div>
    );
  }

  const startAdding = (kind: ResearchKind) => {
    setAdding(kind);
    setNotice("");
  };

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl text-primary">
          {faculty.profile ? "Your research records" : "First record"}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setFaculty(null);
            setAdding(null);
          }}
        >
          Change mobile number
        </Button>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-primary/10 px-4 py-3 text-sm text-primary"
        >
          {notice}
        </p>
      ) : null}
      {adding ? (
        <>
          {!faculty.profile ? (
            <div
              role="radiogroup"
              aria-label="Record type"
              className="flex flex-wrap gap-2"
            >
              {(Object.keys(kindLabel) as ResearchKind[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={adding === id}
                  onClick={() => setAdding(id)}
                  className={cn(
                    "min-h-10 rounded-xl border px-4 text-sm font-semibold transition",
                    adding === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-primary hover:border-primary/40",
                  )}
                >
                  {kindLabel[id]}
                </button>
              ))}
            </div>
          ) : null}
          <AddRecord
            key={adding}
            faculty={faculty}
            kind={adding}
            onCancel={() => setAdding(faculty.profile ? null : adding)}
            onSaved={(saved) => {
              setFaculty(saved);
              setAdding(null);
              setNotice("Saved. You can add another record.");
            }}
          />
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => startAdding("publication")}>
            <Plus className="size-4" /> Add publication
          </Button>
          <Button type="button" variant="outline" onClick={() => startAdding("proposal")}>
            <Plus className="size-4" /> Add project proposal
          </Button>
        </div>
      )}
      {faculty.profile ? (
        <FacultyDashboard profile={faculty.profile} records={faculty.records} />
      ) : null}
    </div>
  );
}
