"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FormDialog, ManageCard, OpenSwitch, PageTitle } from "@/components/portal/Desk";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { phdWindowCopy, supervisorWindowCopy } from "@/data/home";
import { admissionSessions } from "@/lib/constants";
import {
  currentOffice,
  defaultSiteSettings,
  formatPhdSession,
  formatPhdWindowLine,
  parsePhdSession,
  saveSiteSettings,
  subscribeOffice,
  type SiteSettings,
} from "@/lib/office";
import { inputRules, masked } from "@/lib/input-rules";

const siteFormSchema = z.object({
  admissionLabel: z.string().trim().min(1, "Enter the status label.").max(80),
  sessionMonth: z.enum(admissionSessions),
  sessionYear: z
    .string()
    .trim()
    .regex(/^(19|20)\d{2}$/, "Enter a four-digit year."),
  deadlineLabel: z.string().trim().max(80),
  deadline: z.string().trim().max(80),
  phdOpen: z.boolean(),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

function toForm(settings: SiteSettings): SiteFormValues {
  const parsed = parsePhdSession(settings.admissionSession);
  return {
    admissionLabel: settings.admissionLabel,
    sessionMonth: parsed.month,
    sessionYear: parsed.year,
    deadlineLabel: settings.deadlineLabel,
    deadline: settings.deadline,
    phdOpen: settings.phdOpen,
  };
}

export function PhdWindowDialog({
  settings,
  onClose,
  onSaved,
}: {
  settings: SiteSettings;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: toForm(settings),
  });
  const values = useWatch({ control: form.control });
  const preview = formatPhdWindowLine({
    ...settings,
    admissionLabel: values.admissionLabel || defaultSiteSettings.admissionLabel,
    admissionSession: formatPhdSession(
      values.sessionMonth === "July" ? "July" : "January",
      values.sessionYear || "",
    ),
    deadlineLabel: values.deadlineLabel ?? "",
    deadline: values.deadline ?? "",
    phdOpen: Boolean(values.phdOpen),
  });

  async function save(next: SiteFormValues) {
    setBusy(true);
    try {
      await saveSiteSettings({
        ...settings,
        admissionLabel: next.admissionLabel,
        admissionSession: formatPhdSession(next.sessionMonth, next.sessionYear),
        deadlineLabel: next.deadlineLabel,
        deadline: next.deadline,
        phdOpen: next.phdOpen,
      });
      onSaved(
        next.phdOpen === settings.phdOpen
          ? phdWindowCopy.saved
          : next.phdOpen
            ? phdWindowCopy.opened
            : phdWindowCopy.closed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={phdWindowCopy.title}
      onClose={onClose}
      onSubmit={form.handleSubmit(save)}
      busy={busy}
    >
      <OpenSwitch
        label="Online applications"
        checked={Boolean(values.phdOpen)}
        onChange={(open) => form.setValue("phdOpen", open, { shouldDirty: true })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
          <Input
            id="sessionYear"
            {...masked(form.register("sessionYear"), inputRules.year)}
          />
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
          error={form.formState.errors.deadline?.message}
          className="sm:col-span-2"
        >
          <Input id="deadline" type="date" {...form.register("deadline")} />
        </FormField>
      </div>
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-primary">
        <span className="font-semibold">{phdWindowCopy.preview}: </span>
        {preview}
      </p>
    </FormDialog>
  );
}

function SupervisorWindowDialog({
  settings,
  onClose,
  onSaved,
}: {
  settings: SiteSettings;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(settings.supervisorOpen);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveSiteSettings({ ...settings, supervisorOpen: open });
      onSaved(open ? supervisorWindowCopy.opened : supervisorWindowCopy.closed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={supervisorWindowCopy.title}
      onClose={onClose}
      onSubmit={(event) => void save(event)}
      busy={busy}
      size="sm"
    >
      <OpenSwitch label="Recognition applications" checked={open} onChange={setOpen} />
    </FormDialog>
  );
}

export function SiteScreen() {
  const ready = useClientReady();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<"phd" | "supervisor" | null>(null);

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const settings = office?.settings ?? defaultSiteSettings;
  const session = parsePhdSession(settings.admissionSession);

  function saved(message: string) {
    setEditing(null);
    setNotice(message);
  }

  return (
    <div className="space-y-6">
      <PageTitle kicker="Research office" title="Application window" />
      {office?.detail ? <p className="text-sm text-secondary">{office.detail}</p> : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ManageCard
          eyebrow={phdWindowCopy.eyebrow}
          title={phdWindowCopy.title}
          status={
            settings.phdOpen
              ? { label: "Open", tone: "open" }
              : { label: "Closed", tone: "closed" }
          }
          facts={[
            { label: "Session", value: `${session.month} ${session.year}` },
            { label: "Status label", value: settings.admissionLabel },
            { label: settings.deadlineLabel || "Last date", value: settings.deadline },
          ]}
          onAction={() => setEditing("phd")}
        />
        <ManageCard
          eyebrow="Recognition"
          title={supervisorWindowCopy.title}
          status={
            settings.supervisorOpen
              ? { label: "Open", tone: "open" }
              : { label: "Closed", tone: "closed" }
          }
          facts={[
            {
              label: "Applications",
              value: settings.supervisorOpen ? "Accepting" : "Not accepting",
            },
          ]}
          onAction={() => setEditing("supervisor")}
        />
      </div>

      {editing === "phd" ? (
        <PhdWindowDialog
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      ) : null}
      {editing === "supervisor" ? (
        <SupervisorWindowDialog
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
