"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { sampleApplications } from "@/data/sample-applications";
import { readSubmissions, type ScholarSubmission } from "@/lib/applications";
import { lookupPhdApplication } from "@/lib/records";
import { referenceDate } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import { statusSchema } from "@/lib/validation";
import type { z } from "zod";

type StatusValues = z.infer<typeof statusSchema>;

export function StatusLookup() {
  const [match, setMatch] = useState<ScholarSubmission | null>(null);
  const [missed, setMissed] = useState(false);
  const form = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { applicationNo: "", dateOfBirth: "" },
  });

  async function onSubmit(values: StatusValues) {
    const remote = await lookupPhdApplication(values.applicationNo, values.dateOfBirth);
    const found =
      remote ??
      [...readSubmissions(), ...sampleApplications].find(
        (item) =>
          item.applicationNo.toUpperCase() === values.applicationNo.toUpperCase() &&
          item.dateOfBirth === values.dateOfBirth,
      );
    setMatch(found ?? null);
    setMissed(!found);
  }

  return (
    <form
      className="mx-auto max-w-xl space-y-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <FormField
        label="Application No."
        htmlFor="applicationNo"
        required
        error={form.formState.errors.applicationNo?.message}
      >
        <Input id="applicationNo" {...form.register("applicationNo")} />
      </FormField>
      <FormField
        label="Date of Birth"
        htmlFor="status-dob"
        required
        error={form.formState.errors.dateOfBirth?.message}
      >
        <Input
          id="status-dob"
          type="date"
          max={referenceDate}
          {...form.register("dateOfBirth")}
        />
      </FormField>
      <Button type="submit" variant="gold">
        Check status
      </Button>
      {match ? (
        <div
          className="rounded-xl border border-border bg-card p-4 text-sm shadow-card"
          role="status"
        >
          <p className="font-semibold text-primary">{match.applicationNo}</p>
          <p className="mt-1">{match.name}</p>
          <p className="mt-1 text-muted-foreground">
            {match.status}. An acknowledgement mail has been sent to your email.
          </p>
          <p className="mt-1 text-muted-foreground">
            Date of birth {formatIsoDate(match.dateOfBirth)}
          </p>
        </div>
      ) : null}
      {missed ? (
        <p role="alert" className="text-sm text-secondary">
          No application matches that number and date of birth.
        </p>
      ) : null}
    </form>
  );
}
