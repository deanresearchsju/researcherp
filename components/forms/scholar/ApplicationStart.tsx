"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { ApplicationsClosed } from "@/components/forms/ApplicationsClosed";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { scholarFormCopy } from "@/data/forms";
import { phdWindowCopy } from "@/data/home";
import { university } from "@/lib/constants";
import { inputRules, masked } from "@/lib/input-rules";
import {
  currentSiteSettings,
  defaultSiteSettings,
  formatPhdSession,
  parsePhdSession,
  subscribeSiteSettings,
} from "@/lib/office";
import { hasAnyOpenVacancy, loadVacancies, type Vacancy } from "@/lib/vacancies";

const startSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."),
  email: z.string().trim().email("Enter a valid email address."),
});

type StartFields = z.infer<typeof startSchema>;

export type ApplicationStartValues = StartFields & {
  vacancies: Vacancy[];
};

export function ApplicationStart({
  onApply,
}: {
  onApply: (values: ApplicationStartValues) => Promise<void>;
}) {
  const form = useForm<StartFields>({
    resolver: zodResolver(startSchema),
    defaultValues: { mobile: "", email: "" },
  });
  const [busy, setBusy] = useState(false);
  const [vacancyError, setVacancyError] = useState<string | null>(null);
  const loaded = useSyncExternalStore(
    subscribeSiteSettings,
    currentSiteSettings,
    () => null,
  );
  const settings = loaded ?? defaultSiteSettings;
  const session = parsePhdSession(settings.admissionSession);
  const sessionLabel = formatPhdSession(session.month, session.year);

  async function submit(values: StartFields) {
    setBusy(true);
    setVacancyError(null);
    try {
      const loaded = await loadVacancies();
      if (!hasAnyOpenVacancy(loaded.rows)) {
        setVacancyError(scholarFormCopy.noVacancy);
        return;
      }
      await onApply({ ...values, vacancies: loaded.rows });
    } finally {
      setBusy(false);
    }
  }
  if (loaded && !loaded.phdOpen) {
    return (
      <ApplicationsClosed
        title="Admissions are currently closed"
        detail={
          loaded.deadline.trim()
            ? `${phdWindowCopy.closedDetail} ${loaded.deadlineLabel} ${loaded.deadline}.`
            : phdWindowCopy.closedDetail
        }
      />
    );
  }

  return (
    <form
      className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 shadow-card sm:p-8"
      onSubmit={form.handleSubmit(submit)}
      noValidate
    >
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        {university.researchOffice}
      </p>
      <h1 className="mt-2 font-heading text-3xl text-primary">
        {scholarFormCopy.pageTitle}
      </h1>
      <div className="mt-6 space-y-4">
        <FormField label={scholarFormCopy.session} htmlFor="start-session" required>
          <Input id="start-session" readOnly value={sessionLabel} />
        </FormField>
        <FormField
          label="Mobile number"
          htmlFor="start-mobile"
          required
          error={form.formState.errors.mobile?.message}
        >
          <Input
            id="start-mobile"
            {...masked(form.register("mobile"), inputRules.mobile)}
          />
        </FormField>
        <FormField
          label="Email"
          htmlFor="start-email"
          required
          error={form.formState.errors.email?.message}
        >
          <Input id="start-email" {...masked(form.register("email"), inputRules.email)} />
        </FormField>
      </div>
      {vacancyError ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-secondary">
          {vacancyError}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="gold"
        className="mt-6"
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Opening…" : "Apply"}
      </Button>
      <Link
        href="/apply/status"
        className={buttonVariants({ variant: "outline", className: "mt-4 w-full" })}
      >
        {scholarFormCopy.track}
      </Link>
    </form>
  );
}
