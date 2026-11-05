"use client";

import { motion } from "framer-motion";
import { BookOpenCheck, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FacultyDashboard } from "@/components/forms/FacultyDashboard";
import { ToppersStrip, type PublicToppers } from "@/components/forms/ToppersBoard";
import { Logo } from "@/components/brand/Logo";
import { DeskModal } from "@/components/portal/Desk";
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
  email: string;
  mobile: string;
  dob: string;
  /** Records uploaded by the research office that were matched at this sign-in. */
  linked: number;
  /** The account incentives are credited to, with the number masked. */
  bank: Bank | null;
  /** True when an incentive has been approved and no account is saved yet: it can be entered once. */
  bankOpen: boolean;
  /** Where the faculty member stands among the research toppers. */
  standing: Standing | null;
  profile: ResearchValues | null;
  records: ResearchRecord[];
};

/**
 * Step 1, like a sign-in: the email, the mobile number and the date of birth open the faculty
 * member's file. Records the office uploaded are matched by the email at this step.
 */
function Identify({ onOpen }: { onOpen: (faculty: Faculty) => void }) {
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { ok, data } = await post({ action: "lookup", email, mobile, dob });
    setBusy(false);
    if (ok) {
      onOpen({
        email: email.trim().toLowerCase(),
        mobile: mobile.replace(/\D/g, "").slice(-10),
        dob,
        linked: Number(data.linked) || 0,
        bank: (data.bank as Bank | null) ?? null,
        bankOpen: data.bankOpen === true,
        standing: (data.standing as Standing | null) ?? null,
        profile: (data.profile as ResearchValues | null) ?? null,
        records: (data.records as ResearchRecord[]) ?? [],
      });
      return;
    }
    setErrors((data.errors as Record<string, string>) ?? {});
    setMessage(String(data.message ?? "Try again."));
  }

  return (
    <form noValidate onSubmit={open} className="grid items-end gap-4 sm:grid-cols-2">
      <FormField
        label="Email"
        htmlFor="faculty-email"
        required
        error={errors.email}
        className="sm:col-span-2"
      >
        <Input
          id="faculty-email"
          type="email"
          autoComplete="email"
          maxLength={200}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>
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
      <Button type="submit" disabled={busy} className="sm:col-span-2">
        {busy ? "Opening…" : "Continue"}
      </Button>
      {message ? (
        <p role="alert" className="text-sm text-secondary sm:col-span-2">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export type Standing = {
  overall: number;
  department: number;
  departmentName: string;
  count: number;
  of: number;
};

type Bank = {
  holderName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branch: string;
};

const bankFields: [keyof Bank, string, string][] = [
  ["holderName", "Account holder's name", "name"],
  ["accountNo", "Account number", "off"],
  ["ifsc", "IFSC", "off"],
  ["bankName", "Bank", "off"],
  ["branch", "Branch", "off"],
];

/**
 * The bank account publication incentives are credited to. It is entered once, when the faculty
 * member becomes eligible; the research office corrects it if needed.
 */
function BankCard({
  faculty,
  onSaved,
}: {
  faculty: Faculty;
  onSaved: (bank: Bank) => void;
}) {
  const [values, setValues] = useState<Bank>({
    holderName: faculty.profile?.facultyName?.toString() ?? "",
    accountNo: "",
    ifsc: "",
    bankName: "",
    branch: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { ok, data } = await post({
      action: "save-bank",
      email: faculty.email,
      mobile: faculty.mobile,
      dob: faculty.dob,
      bank: values,
    });
    setBusy(false);
    if (ok) {
      onSaved(data.bank as Bank);
      setErrors({});
      return;
    }
    setErrors((data.errors as Record<string, string>) ?? {});
    setMessage(String(data.message ?? "Not saved."));
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
          Bank account for incentive credit
        </h3>
      </div>
      {faculty.bank ? (
        <>
          <p className="mt-2 text-sm">
            <strong className="text-primary">{faculty.bank.holderName}</strong> ·{" "}
            {faculty.bank.bankName}
            {faculty.bank.branch ? `, ${faculty.bank.branch}` : ""} · IFSC{" "}
            {faculty.bank.ifsc} · Account {faculty.bank.accountNo}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved. To correct these details, contact the research office.
          </p>
        </>
      ) : !faculty.bankOpen ? (
        <p className="mt-2 text-sm text-muted-foreground">
          You can enter your bank account once you have a Checked &amp; Approved
          publication or patent that earns an incentive.
        </p>
      ) : (
        <form noValidate onSubmit={save} className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            You are eligible for an incentive. Enter the account it is to be credited to.
            Check the details carefully: they can be entered only once.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bankFields.map(([key, label, auto]) => (
              <FormField
                key={key}
                label={label}
                htmlFor={`bank-${key}`}
                required={key !== "branch"}
                error={errors[key]}
              >
                <Input
                  id={`bank-${key}`}
                  autoComplete={auto}
                  inputMode={key === "accountNo" ? "numeric" : undefined}
                  maxLength={key === "ifsc" ? 11 : key === "accountNo" ? 20 : 120}
                  value={values[key]}
                  onChange={(event) =>
                    setValues({ ...values, [key]: event.target.value })
                  }
                />
              </FormField>
            ))}
          </div>
          {message ? (
            <p role="alert" className="text-sm text-secondary">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="gold" disabled={busy}>
              {busy ? "Saving…" : "Save bank account"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** A new record. The personal details are asked only when none are saved yet. */
function AddRecord({
  faculty,
  kind,
  record,
  onSaved,
  onCancel,
}: {
  faculty: Faculty;
  kind: ResearchKind;
  /** A record being changed (until it is approved); a new one when not given. */
  record?: ResearchRecord;
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
    ...(record?.values ?? {}),
    ...(faculty.profile ?? {}),
    mobile: faculty.mobile,
    dob: faculty.dob,
    email: faculty.email,
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
      action: record ? "update" : "submit",
      id: record?.id,
      kind,
      email: faculty.email,
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
        {record ? "Edit" : "Add"} {kindLabel[kind].toLowerCase()}
      </h3>
      {record?.rejectedAt && record.reviewNote ? (
        <p className="rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2 text-sm text-secondary">
          Rejected: {record.reviewNote}. Correct it and submit; it goes back for review.
        </p>
      ) : null}
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
        hiddenKeys={["mobile", "dob", "email", ...savedKeys]}
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

/** The slim bar on top of the faculty dashboard, in place of the website's menus. */
function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-3 px-3 py-2 sm:px-5">
        <Link href="/" className="shrink-0" aria-label="St. Joseph University, home">
          <Logo className="h-9 w-auto sm:h-10" />
        </Link>
        <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <p className="font-heading text-base text-primary sm:text-lg">Faculty research</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

/**
 * The faculty dashboard: email, mobile number and date of birth first; then the faculty
 * member's figures and records on one compact screen. New and changed records open in a
 * popup over it.
 */
export function PublicResearchDesk({ toppers }: { toppers: PublicToppers }) {
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [adding, setAdding] = useState<ResearchKind | null>(null);
  const [editing, setEditing] = useState<ResearchRecord | null>(null);
  const [notice, setNotice] = useState("");

  if (!faculty) {
    return (
      <>
        <TopBar />
        <main className="mx-auto w-full max-w-xl px-3 py-8 sm:px-5 sm:py-12">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-purple-deep to-accent"
            />
            <div className="flex items-center gap-3">
              <motion.span
                initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
                className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
              >
                <BookOpenCheck className="size-5" aria-hidden="true" />
              </motion.span>
              <div>
                <h1 className="font-heading text-xl text-primary">Sign in</h1>
                <p className="text-sm text-muted-foreground">
                  Email, mobile number and date of birth.
                </p>
              </div>
            </div>
            <div className="mt-4" />
            <Identify
              onOpen={(opened) => {
                setFaculty(opened);
                setNotice(
                  opened.linked
                    ? `${opened.linked} record(s) entered by the research office were found under your email and added to your file.`
                    : "",
                );
                setAdding(opened.profile ? null : "publication");
              }}
            />
          </motion.section>
        </main>
      </>
    );
  }

  const startAdding = (kind: ResearchKind) => {
    setEditing(null);
    setAdding(kind);
    setNotice("");
  };
  const formOpen = Boolean(editing || adding);

  return (
    <>
      <TopBar>
        <Button type="button" size="sm" onClick={() => startAdding("publication")}>
          <Plus className="size-4" /> Publication
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => startAdding("proposal")}
        >
          <Plus className="size-4" /> Project proposal
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setFaculty(null);
            setAdding(null);
            setEditing(null);
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </TopBar>
      <main className="mx-auto w-full max-w-[110rem] space-y-3 px-3 py-3 sm:px-5">
        <ToppersStrip
          toppers={toppers}
          department={
            faculty.profile && typeof faculty.profile.department === "string"
              ? faculty.profile.department
              : ""
          }
        />
        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            {notice}
          </p>
        ) : null}
        {faculty.profile ? (
          <FacultyDashboard
            profile={faculty.profile}
            records={faculty.records}
            standing={faculty.standing}
            onEdit={(record) => {
              setAdding(null);
              setNotice("");
              setEditing(record);
            }}
          />
        ) : (
          <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            Add your first publication or project proposal to start your dashboard.
          </p>
        )}
        {/* The toppers are shown only once signed in, in the strip at the top. */}
        {faculty.profile ? (
          <BankCard
            faculty={faculty}
            onSaved={(bank) => {
              setFaculty({ ...faculty, bank, bankOpen: false });
              setNotice("Bank account saved.");
            }}
          />
        ) : null}
      </main>
      {formOpen ? (
        <DeskModal
          title={
            editing ? "Edit record" : faculty.profile ? "Add record" : "First record"
          }
          onClose={() => {
            setEditing(null);
            setAdding(null);
          }}
          size="lg"
        >
          {editing ? (
            <AddRecord
              key={editing.id}
              faculty={faculty}
              kind={editing.kind}
              record={editing}
              onCancel={() => setEditing(null)}
              onSaved={(saved) => {
                setFaculty(saved);
                setEditing(null);
                setNotice("Changes saved.");
              }}
            />
          ) : adding ? (
            <>
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
                      "min-h-9 rounded-lg border px-3 text-sm font-semibold transition",
                      adding === id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-card text-primary hover:border-primary/40",
                    )}
                  >
                    {kindLabel[id]}
                  </button>
                ))}
              </div>
              <AddRecord
                key={adding}
                faculty={faculty}
                kind={adding}
                onCancel={() => setAdding(null)}
                onSaved={(saved) => {
                  setFaculty(saved);
                  setAdding(null);
                  setNotice("Saved. You can add another record.");
                }}
              />
            </>
          ) : null}
        </DeskModal>
      ) : null}
    </>
  );
}
