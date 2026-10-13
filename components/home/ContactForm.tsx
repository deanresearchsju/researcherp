"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactSchema } from "@/lib/validation";
import type { z } from "zod";

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  function onSubmit() {
    setSent(true);
    form.reset();
  }

  if (sent) {
    return (
      <p
        className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card"
        role="status"
      >
        Write to the helpdesk address shown beside the form.
      </p>
    );
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <h2 className="font-heading text-2xl text-primary">Write to the helpdesk</h2>
      <FormField
        label="Name"
        htmlFor="contact-name"
        required
        error={form.formState.errors.name?.message}
      >
        <Input id="contact-name" {...form.register("name")} />
      </FormField>
      <FormField
        label="Email"
        htmlFor="contact-email"
        required
        error={form.formState.errors.email?.message}
      >
        <Input id="contact-email" type="email" {...form.register("email")} />
      </FormField>
      <FormField
        label="Message"
        htmlFor="contact-message"
        required
        error={form.formState.errors.message?.message}
      >
        <Textarea id="contact-message" {...form.register("message")} />
      </FormField>
      <Button type="submit" variant="gold">
        Send message
      </Button>
    </form>
  );
}
