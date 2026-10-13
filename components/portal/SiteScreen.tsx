"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  currentOffice,
  defaultSiteSettings,
  officeMigrationHint,
  saveSiteSettings,
  subscribeOffice,
  type SiteSettings,
} from "@/lib/office";

export function SiteScreen() {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<SiteSettings>({
    values: office?.settings ?? defaultSiteSettings,
  });

  async function onSubmit(values: SiteSettings) {
    await saveSiteSettings(values);
    setNotice("Home page and application window saved.");
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Research office
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Home and admissions</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Change the home-page introduction and admission dates, and open or close the Ph.D. and supervisor applications.
      </p>
      {office?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">
          {office.detail} {officeMigrationHint}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <form
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField label="Eyebrow" htmlFor="heroEyebrow">
          <Input id="heroEyebrow" {...form.register("heroEyebrow")} />
        </FormField>
        <FormField label="Heading" htmlFor="heroTitle">
          <Input id="heroTitle" {...form.register("heroTitle")} />
        </FormField>
        <FormField label="Summary" htmlFor="heroSummary">
          <Textarea id="heroSummary" {...form.register("heroSummary")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Admission label" htmlFor="admissionLabel">
            <Input id="admissionLabel" {...form.register("admissionLabel")} />
          </FormField>
          <FormField label="Session" htmlFor="admissionSession">
            <Input id="admissionSession" {...form.register("admissionSession")} />
          </FormField>
          <FormField label="Deadline label" htmlFor="deadlineLabel">
            <Input id="deadlineLabel" {...form.register("deadlineLabel")} />
          </FormField>
          <FormField label="Deadline" htmlFor="deadline">
            <Input id="deadline" {...form.register("deadline")} />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("phdOpen")} />
          Ph.D. applications are open
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("supervisorOpen")} />
          Supervisor recognition applications are open
        </label>
        <div>
          <Button type="submit" variant="gold">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
