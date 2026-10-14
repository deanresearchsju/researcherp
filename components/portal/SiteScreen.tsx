"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  phdWindowCopy,
  siteHeroCopy,
  supervisorWindowCopy,
} from "@/data/home";
import { admissionSessions } from "@/lib/constants";
import {
  currentOffice,
  defaultSiteSettings,
  formatPhdSession,
  formatPhdWindowLine,
  parsePhdSession,
  saveSiteSettings,
  subscribeOffice,
  type PhdSessionMonth,
  type SiteSettings,
} from "@/lib/office";

const siteFormSchema = z.object({
  heroEyebrow: z.string().trim().min(1, "Enter the eyebrow.").max(80),
  heroTitle: z.string().trim().min(1, "Enter the heading.").max(160),
  heroSummary: z.string().trim().min(1, "Enter the summary.").max(800),
  admissionLabel: z.string().trim().min(1, "Enter the status label.").max(80),
  sessionMonth: z
    .string()
    .refine(
      (value): value is PhdSessionMonth =>
        (admissionSessions as readonly string[]).includes(value),
      "Select January or July.",
    ),
  sessionYear: z.string().trim().regex(/^(19|20)\d{2}$/, "Enter a four-digit year."),
  deadlineLabel: z.string().trim().max(80),
  deadline: z.string().trim().max(80),
  phdOpen: z.boolean(),
  supervisorOpen: z.boolean(),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

function toForm(settings: SiteSettings): SiteFormValues {
  const parsed = parsePhdSession(settings.admissionSession);
  return {
    heroEyebrow: settings.heroEyebrow,
    heroTitle: settings.heroTitle,
    heroSummary: settings.heroSummary,
    admissionLabel: settings.admissionLabel,
    sessionMonth: parsed.month,
    sessionYear: parsed.year,
    deadlineLabel: settings.deadlineLabel,
    deadline: settings.deadline,
    phdOpen: settings.phdOpen,
    supervisorOpen: settings.supervisorOpen,
  };
}

function toSettings(values: SiteFormValues): SiteSettings {
  return {
    heroEyebrow: values.heroEyebrow,
    heroTitle: values.heroTitle,
    heroSummary: values.heroSummary,
    admissionLabel: values.admissionLabel,
    admissionSession: formatPhdSession(values.sessionMonth, values.sessionYear),
    deadlineLabel: values.deadlineLabel,
    deadline: values.deadline,
    phdOpen: values.phdOpen,
    supervisorOpen: values.supervisorOpen,
  };
}

export function SiteScreen() {
  const ready = useClientReady();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    values: toForm(office?.settings ?? defaultSiteSettings),
  });
  const phdOpen = useWatch({ control: form.control, name: "phdOpen" });
  const supervisorOpen = useWatch({ control: form.control, name: "supervisorOpen" });
  const admissionLabel = useWatch({ control: form.control, name: "admissionLabel" });
  const sessionMonth = useWatch({ control: form.control, name: "sessionMonth" });
  const sessionYear = useWatch({ control: form.control, name: "sessionYear" });
  const deadlineLabel = useWatch({ control: form.control, name: "deadlineLabel" });
  const deadline = useWatch({ control: form.control, name: "deadline" });

  async function persist(settings: SiteSettings, message: string) {
    setBusy(true);
    try {
      await saveSiteSettings(settings);
      form.reset(toForm(settings));
      setNotice(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveWindow(values: SiteFormValues) {
    await persist(toSettings(values), phdWindowCopy.saved);
  }

  async function setPhdOpen(open: boolean) {
    const parsed = siteFormSchema.safeParse(form.getValues());
    const base = parsed.success
      ? toSettings(parsed.data)
      : (office?.settings ?? defaultSiteSettings);
    await persist(
      { ...base, phdOpen: open },
      open ? phdWindowCopy.opened : phdWindowCopy.closed,
    );
  }

  async function setSupervisorOpen(open: boolean) {
    const parsed = siteFormSchema.safeParse(form.getValues());
    const base = parsed.success
      ? toSettings(parsed.data)
      : (office?.settings ?? defaultSiteSettings);
    await persist(
      { ...base, supervisorOpen: open },
      open ? supervisorWindowCopy.opened : supervisorWindowCopy.closed,
    );
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const preview = formatPhdWindowLine({
    ...(office?.settings ?? defaultSiteSettings),
    admissionLabel: admissionLabel || defaultSiteSettings.admissionLabel,
    admissionSession: formatPhdSession(
      sessionMonth === "July" ? "July" : "January",
      sessionYear || "",
    ),
    deadlineLabel: deadlineLabel ?? "",
    deadline: deadline ?? "",
    phdOpen: Boolean(phdOpen),
  });

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Research office
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Application window</h1>
      {office?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{office.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <form
        className="mt-6 space-y-6"
        onSubmit={form.handleSubmit(saveWindow)}
        noValidate
      >
        <section
          id="phd-window"
          className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
                {phdWindowCopy.eyebrow}
              </p>
              <h2 className="mt-2 font-heading text-2xl text-primary">
                {phdWindowCopy.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {phdWindowCopy.description}
              </p>
            </div>
            <Badge variant={phdOpen ? "gold" : "maroon"}>
              {phdOpen ? phdWindowCopy.openStatus : phdWindowCopy.closedStatus}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="gold"
              disabled={busy || phdOpen}
              onClick={() => void setPhdOpen(true)}
            >
              {phdWindowCopy.open}
            </Button>
            <Button
              type="button"
              variant="maroon"
              disabled={busy || !phdOpen}
              onClick={() => void setPhdOpen(false)}
            >
              {phdWindowCopy.close}
            </Button>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            <span className="font-semibold text-primary">{phdWindowCopy.preview}: </span>
            {preview}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FormField
              label={phdWindowCopy.session}
              htmlFor="sessionMonth"
              required
              error={form.formState.errors.sessionMonth?.message}
            >
              <NativeSelect id="sessionMonth" {...form.register("sessionMonth")}>
                {admissionSessions.map((session) => (
                  <option key={session} value={session}>
                    {session}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label={phdWindowCopy.year}
              htmlFor="sessionYear"
              required
              error={form.formState.errors.sessionYear?.message}
            >
              <Input id="sessionYear" inputMode="numeric" {...form.register("sessionYear")} />
            </FormField>
            <FormField
              label={phdWindowCopy.label}
              htmlFor="admissionLabel"
              required
              error={form.formState.errors.admissionLabel?.message}
            >
              <Input id="admissionLabel" {...form.register("admissionLabel")} />
            </FormField>
            <FormField
              label={phdWindowCopy.deadlineLabel}
              htmlFor="deadlineLabel"
              error={form.formState.errors.deadlineLabel?.message}
            >
              <Input id="deadlineLabel" {...form.register("deadlineLabel")} />
            </FormField>
            <FormField
              label={phdWindowCopy.deadline}
              htmlFor="deadline"
              hint={phdWindowCopy.deadlineHint}
              error={form.formState.errors.deadline?.message}
              className="sm:col-span-2"
            >
              <Input id="deadline" {...form.register("deadline")} />
            </FormField>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-2xl text-primary">
                {supervisorWindowCopy.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {supervisorWindowCopy.description}
              </p>
            </div>
            <Badge variant={supervisorOpen ? "gold" : "maroon"}>
              {supervisorOpen
                ? supervisorWindowCopy.openStatus
                : supervisorWindowCopy.closedStatus}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="gold"
              disabled={busy || supervisorOpen}
              onClick={() => void setSupervisorOpen(true)}
            >
              {supervisorWindowCopy.open}
            </Button>
            <Button
              type="button"
              variant="maroon"
              disabled={busy || !supervisorOpen}
              onClick={() => void setSupervisorOpen(false)}
            >
              {supervisorWindowCopy.close}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-6">
          <h2 className="font-heading text-2xl text-primary">{siteHeroCopy.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {siteHeroCopy.description}
          </p>
          <div className="mt-6 grid gap-4">
            <FormField
              label={siteHeroCopy.eyebrow}
              htmlFor="heroEyebrow"
              error={form.formState.errors.heroEyebrow?.message}
            >
              <Input id="heroEyebrow" {...form.register("heroEyebrow")} />
            </FormField>
            <FormField
              label={siteHeroCopy.heading}
              htmlFor="heroTitle"
              error={form.formState.errors.heroTitle?.message}
            >
              <Input id="heroTitle" {...form.register("heroTitle")} />
            </FormField>
            <FormField
              label={siteHeroCopy.summary}
              htmlFor="heroSummary"
              error={form.formState.errors.heroSummary?.message}
            >
              <Textarea id="heroSummary" {...form.register("heroSummary")} />
            </FormField>
          </div>
        </section>

        <Button type="submit" variant="gold" disabled={busy}>
          {phdWindowCopy.save}
        </Button>
      </form>
    </div>
  );
}
