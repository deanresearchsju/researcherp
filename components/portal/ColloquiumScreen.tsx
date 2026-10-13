"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { colloquiumSittings } from "@/data/doctoral";
import { university } from "@/lib/constants";
import { currentDoctoral, issueColloquium, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { usePortalSession } from "@/lib/use-preview-session";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the colloquium name."),
  sitting: z.enum(["May", "November"]),
  year: z
    .string()
    .trim()
    .regex(/^20\d{2}$/, "Enter a year such as 2026."),
});

type Values = z.infer<typeof schema>;

export function ColloquiumScreen({ mode }: { mode: "admin" | "scholar" | "supervisor" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sittingFilter, setSittingFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { name: "", sitting: "May", year: "" },
  });

  if (!ready || !doctoral)
    return <p className="text-sm text-muted-foreground">Loading colloquia…</p>;

  const invitations = doctoral.colloquia.filter((item) => {
    if (mode === "admin" || !session) {
      if (mode !== "admin") return false;
      return (
        (sittingFilter === "" || item.sitting === sittingFilter) &&
        (yearFilter === "" || item.year === yearFilter) &&
        textMatches(query, [item.name, item.sitting, item.year])
      );
    }
    if (mode === "scholar") {
      return item.scholars.some((person) => person.identifier === session.identifier);
    }
    return item.supervisors.some((person) => person.identifier === session.identifier);
  });

  async function issue(values: Values) {
    const scholars = (office?.allocations ?? []).map((item) => ({
      identifier: item.scholarIdentifier,
      name: item.scholarName,
    }));
    const supervisors = Array.from(
      new Map(
        (office?.allocations ?? []).map((item) => [
          item.supervisorIdentifier,
          { identifier: item.supervisorIdentifier, name: item.supervisorName },
        ]),
      ).values(),
    );
    const saved = await issueColloquium({ ...values, scholars, supervisors });
    setNotice(
      saved.ok
        ? `Invitation recorded for ${scholars.length} ${scholars.length === 1 ? "scholar" : "scholars"} and ${supervisors.length} ${supervisors.length === 1 ? "supervisor" : "supervisors"}. It appears in their portal. Write to ${university.email} if a paper invitation is also required.`
        : saved.message,
    );
    if (saved.ok) form.reset();
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Colloquium</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Each sitting is named for May or November. Active scholars and their supervisors
          see the invitation here.
        </p>
      </header>
      {mode === "admin" ? (
        <form
          className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3"
          onSubmit={form.handleSubmit(issue)}
          noValidate
        >
          <FormField
            label="Name"
            htmlFor="colloquium-name"
            required
            error={form.formState.errors.name?.message}
            className="sm:col-span-3"
          >
            <Input id="colloquium-name" {...form.register("name")} />
          </FormField>
          <FormField label="Sitting" htmlFor="colloquium-sitting" required>
            <NativeSelect id="colloquium-sitting" {...form.register("sitting")}>
              {colloquiumSittings.map((sitting) => (
                <option key={sitting} value={sitting}>
                  {sitting}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Year"
            htmlFor="colloquium-year"
            required
            error={form.formState.errors.year?.message}
          >
            <Input id="colloquium-year" {...form.register("year")} />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" variant="gold">
              Record invitation
            </Button>
          </div>
        </form>
      ) : null}
      {mode === "admin" ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filters={[
            {
              id: "sitting",
              label: "Sitting",
              value: sittingFilter,
              options: colloquiumSittings.map((sitting) => ({ value: sitting, label: sitting })),
              onChange: setSittingFilter,
            },
            {
              id: "year",
              label: "Year",
              value: yearFilter,
              options: [...new Set(doctoral.colloquia.map((item) => item.year))]
                .filter(Boolean)
                .sort()
                .map((year) => ({ value: year, label: year })),
              onChange: setYearFilter,
            },
          ]}
          shown={invitations.length}
          total={doctoral.colloquia.length}
          filename="colloquia.csv"
          headers={["name", "sitting", "year", "scholars", "supervisors"]}
          rows={invitations.map((item) => [
            item.name,
            item.sitting,
            item.year,
            String(item.scholars.length),
            String(item.supervisors.length),
          ])}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      <ul className="space-y-3">
        {invitations.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-primary">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {item.sitting} {item.year}
              {mode === "admin"
                ? ` · ${item.scholars.length} scholars · ${item.supervisors.length} supervisors`
                : " · You are invited"}
            </p>
          </li>
        ))}
      </ul>
      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No invitation is recorded for this account.
        </p>
      ) : null}
    </section>
  );
}
