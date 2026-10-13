"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { ApplicationsClosed } from "@/components/forms/ApplicationsClosed";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { schools } from "@/data/schools";
import { university } from "@/lib/constants";
import { currentOffice, subscribeOffice } from "@/lib/office";

const departments = schools.map((school) => school.name);

const startSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."),
  email: z.string().trim().email("Enter a valid email address."),
  department: z.string().refine((value) => departments.includes(value), {
    message: "Select a department.",
  }),
});

export type ApplicationStartValues = z.infer<typeof startSchema>;

export function ApplicationStart({
  onApply,
}: {
  onApply: (values: ApplicationStartValues) => Promise<void>;
}) {
  const form = useForm<ApplicationStartValues>({
    resolver: zodResolver(startSchema),
    defaultValues: { mobile: "", email: "", department: "" },
  });
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  if (office && !office.settings.phdOpen) {
    return (
      <ApplicationsClosed
        title="Ph.D. applications are closed"
        detail="The research office has closed this admission window. The dates on the home page show when it opens again."
      />
    );
  }

  return (
    <form
      className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 shadow-card sm:p-8"
      onSubmit={form.handleSubmit(onApply)}
      noValidate
    >
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        {university.researchOffice}
      </p>
      <h1 className="mt-2 font-heading text-3xl text-primary">Apply for Ph.D.</h1>
      <div className="mt-6 space-y-4">
        <FormField
          label="Mobile number"
          htmlFor="start-mobile"
          required
          error={form.formState.errors.mobile?.message}
        >
          <Input
            id="start-mobile"
            inputMode="numeric"
            autoComplete="tel"
            {...form.register("mobile")}
          />
        </FormField>
        <FormField
          label="Email"
          htmlFor="start-email"
          required
          error={form.formState.errors.email?.message}
        >
          <Input
            id="start-email"
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </FormField>
        <FormField
          label="Department"
          htmlFor="start-department"
          required
          error={form.formState.errors.department?.message}
        >
          <NativeSelect id="start-department" {...form.register("department")}>
            <option value="">Select a department</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <Button
        type="submit"
        variant="gold"
        className="mt-6"
        disabled={form.formState.isSubmitting}
      >
        Apply
      </Button>
    </form>
  );
}
