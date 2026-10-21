"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { FormDialog, PageTitle } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { schoolIcons } from "@/data/schools";
import {
  currentAreaLoad,
  researchAreaMigrationHint,
  saveResearchAreas,
  schoolId,
  subscribeResearchAreas,
} from "@/lib/research-areas";
import type { School } from "@/types";

const schoolSchema = z.object({
  name: z.string().trim().min(2, "Enter the school name.").max(120),
  summary: z.string().trim().max(240, "Use 240 characters or fewer."),
  icon: z.enum([
    "cpu",
    "flask",
    "briefcase",
    "building",
    "sprout",
    "scale",
    "heart-pulse",
  ]),
});

const areaSchema = z.object({
  schoolId: z.string().min(1, "Choose a school."),
  area: z.string().trim().min(2, "Enter the research area.").max(120),
});

type SchoolValues = z.infer<typeof schoolSchema>;
type AreaValues = z.infer<typeof areaSchema>;

export function ResearchAreaManager() {
  const stored = useSyncExternalStore(
    subscribeResearchAreas,
    currentAreaLoad,
    currentAreaLoad,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"school" | "area" | null>(null);
  const schoolForm = useForm<SchoolValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: { name: "", summary: "", icon: "cpu" },
  });
  const areaForm = useForm<AreaValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: { schoolId: "", area: "" },
  });

  if (!stored) {
    return <p className="text-sm text-muted-foreground">Loading research areas…</p>;
  }
  const schools = stored.schools;

  async function publish(next: School[], message: string) {
    setBusy(true);
    const saved = await saveResearchAreas(next);
    setBusy(false);
    setNotice(
      saved.ok
        ? message
        : "message" in saved && saved.message
          ? saved.message
          : "That change could not be saved.",
    );
    if (saved.ok) setDialog(null);
    return saved.ok;
  }

  async function addSchool(values: SchoolValues) {
    const school: School = {
      id: schoolId(
        values.name,
        schools.map((item) => item.id),
      ),
      name: values.name,
      summary: values.summary,
      icon: values.icon,
      areas: [],
    };
    if (await publish([...schools, school], `${school.name} is on the home page.`)) {
      schoolForm.reset({ name: "", summary: "", icon: "cpu" });
    }
  }

  async function addArea(values: AreaValues) {
    const next = schools.map((school) =>
      school.id === values.schoolId && !school.areas.includes(values.area)
        ? { ...school, areas: [...school.areas, values.area] }
        : school,
    );
    if (await publish(next, `${values.area} is on the home page.`)) {
      areaForm.reset({ schoolId: values.schoolId, area: "" });
    }
  }

  return (
    <div>
      <PageTitle
        kicker="Website"
        title="Research areas"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setDialog("school")}>
              Add school
            </Button>
            <Button
              type="button"
              variant="gold"
              disabled={schools.length === 0}
              onClick={() => setDialog("area")}
            >
              Add research area
            </Button>
          </>
        }
      />
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice} {stored?.source === "browser" ? researchAreaMigrationHint : ""}
        </p>
      ) : null}

      {dialog === "school" ? (
        <FormDialog
          title="Add a school"
          onClose={() => setDialog(null)}
          onSubmit={schoolForm.handleSubmit((values) => void addSchool(values))}
          busy={busy}
          submitLabel="Add school"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="School"
              htmlFor="school-name"
              required
              error={schoolForm.formState.errors.name?.message}
            >
              <Input id="school-name" {...schoolForm.register("name")} />
            </FormField>
            <FormField
              label="Icon"
              htmlFor="school-icon"
              error={schoolForm.formState.errors.icon?.message}
            >
              <NativeSelect id="school-icon" {...schoolForm.register("icon")}>
                {schoolIcons.map((icon) => (
                  <option key={icon.value} value={icon.value}>
                    {icon.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Summary"
              htmlFor="school-summary"
              error={schoolForm.formState.errors.summary?.message}
              className="sm:col-span-2"
            >
              <Input id="school-summary" {...schoolForm.register("summary")} />
            </FormField>
          </div>
        </FormDialog>
      ) : null}

      {dialog === "area" ? (
        <FormDialog
          title="Add a research area"
          onClose={() => setDialog(null)}
          onSubmit={areaForm.handleSubmit((values) => void addArea(values))}
          busy={busy}
          submitLabel="Add research area"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="School"
              htmlFor="area-school"
              required
              error={areaForm.formState.errors.schoolId?.message}
            >
              <NativeSelect id="area-school" {...areaForm.register("schoolId")}>
                <option value="">Select a school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Research area"
              htmlFor="area-name"
              required
              error={areaForm.formState.errors.area?.message}
            >
              <Input id="area-name" {...areaForm.register("area")} />
            </FormField>
          </div>
        </FormDialog>
      ) : null}

      <div className="mt-6 space-y-4">
        {schools.map((school) => (
          <section
            key={school.id}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-primary">{school.name}</h2>
                {school.summary ? (
                  <p className="mt-1 text-sm text-muted-foreground">{school.summary}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    areaForm.reset({ schoolId: school.id, area: "" });
                    setDialog("area");
                  }}
                >
                  Add area
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    window.confirm(`Remove ${school.name}?`) &&
                    void publish(
                      schools.filter((item) => item.id !== school.id),
                      `${school.name} has been removed.`,
                    )
                  }
                >
                  Remove school
                </Button>
              </div>
            </div>
            {school.areas.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No research areas yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {school.areas.map((area) => (
                  <li key={area}>
                    <button
                      type="button"
                      className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground"
                      disabled={busy}
                      onClick={() =>
                        void publish(
                          schools.map((item) =>
                            item.id === school.id
                              ? {
                                  ...item,
                                  areas: item.areas.filter((name) => name !== area),
                                }
                              : item,
                          ),
                          `${area} has been removed.`,
                        )
                      }
                    >
                      {area}
                      <span className="sr-only"> Remove</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
