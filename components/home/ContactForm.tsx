"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { helpdeskCopy } from "@/data/helpdesk";
import { rememberHelpdeskMessage } from "@/lib/helpdesk";
import { contactSchema } from "@/lib/validation";
import type { z } from "zod";

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", subject: "", message: "" },
  });

  async function onSubmit(values: ContactValues) {
    setNotice(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: unknown = await response.json();
      if (!data || typeof data !== "object") {
        setNotice(helpdeskCopy.sendError);
        return;
      }
      const payload = data as { ok?: unknown; source?: unknown };
      if (payload.ok !== true) {
        setNotice(helpdeskCopy.sendError);
        return;
      }
      if (payload.source !== "database") {
        rememberHelpdeskMessage(values);
      }
      setSent(true);
      form.reset();
    } catch {
      rememberHelpdeskMessage(values);
      setSent(true);
      form.reset();
    }
  }

  if (sent) {
    return (
      <p
        className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card"
        role="status"
      >
        {helpdeskCopy.sent}
      </p>
    );
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card sm:p-8"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <h2 className="font-heading text-2xl text-primary">{helpdeskCopy.formTitle}</h2>
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Name"
          htmlFor="contact-name"
          required
          error={form.formState.errors.name?.message}
        >
          <Input id="contact-name" autoComplete="name" {...form.register("name")} />
        </FormField>
        <FormField
          label={helpdeskCopy.phone}
          htmlFor="contact-phone"
          required
          error={form.formState.errors.phone?.message}
        >
          <Input
            id="contact-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            {...form.register("phone")}
          />
        </FormField>
        <FormField
          label="Email"
          htmlFor="contact-email"
          required
          error={form.formState.errors.email?.message}
        >
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </FormField>
        <FormField
          label={helpdeskCopy.subject}
          htmlFor="contact-subject"
          required
          error={form.formState.errors.subject?.message}
        >
          <Input id="contact-subject" {...form.register("subject")} />
        </FormField>
      </div>
      <FormField
        label={helpdeskCopy.message}
        htmlFor="contact-message"
        required
        error={form.formState.errors.message?.message}
      >
        <Textarea id="contact-message" rows={5} {...form.register("message")} />
      </FormField>
      <Button type="submit" variant="gold" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? helpdeskCopy.sending : helpdeskCopy.send}
      </Button>
    </form>
  );
}
