"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { FormDialog, PageTitle } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { schoolIcons } from "@/data/schools";
import { keyAreasOf, sameDepartment } from "@/lib/department-areas";
import { researchRegister } from "@/data/research-register";
import {
  addDepartment,
  currentAreaLoad,
  editSchool,
  managedAreas,
  removeDepartment,
  renameDepartment,
  researchAreaMigrationHint,
  saveResearchAreas,
  schoolId,
  setDepartmentAreas,
  subscribeResearchAreas,
  type TreeResult,
} from "@/lib/research-areas";
import type { School } from "@/types";

type Dialog =
  | { kind: "school"; id: string | null }
  | { kind: "department"; schoolId: string; name: string | null }
  | { kind: "area"; schoolId: string; department: string; original: string | null };

/**
 * The research areas of the website, kept here: a research area (school) holds departments,
 * and a department holds its key areas. Add, change or remove at every level; the home page
 * shows exactly what is kept here.
 */
export function ResearchAreaManager() {
  const stored = useSyncExternalStore(
    subscribeResearchAreas,
    currentAreaLoad,
    currentAreaLoad,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [icon, setIcon] = useState<School["icon"]>("cpu");
  const [problem, setProblem] = useState("");

  if (!stored) {
    return <p className="text-sm text-muted-foreground">Loading research areas…</p>;
  }
  const schools = stored.schools;

  async function save(next: School[], message: string) {
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

  async function apply(result: TreeResult, message: string) {
    if (!result.ok) {
      setProblem(result.message);
      return false;
    }
    setProblem("");
    return save(result.schools, message);
  }

  function open(next: Dialog) {
    setProblem("");
    setNotice(null);
    if (next.kind === "school") {
      const school = schools.find((item) => item.id === next.id);
      setText(school?.name ?? "");
      setSummary(school?.summary ?? "");
      setIcon(school?.icon ?? "cpu");
    } else if (next.kind === "department") {
      setText(next.name ?? "");
    } else {
      setText(next.original ?? "");
    }
    setDialog(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    if (dialog.kind === "school") {
      if (dialog.id) {
        await apply(
          editSchool(schools, dialog.id, { name: text, summary, icon }),
          "The research area is updated.",
        );
        return;
      }
      const name = text.trim();
      if (name.length < 2) return setProblem("Enter the name.");
      if (schools.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
        return setProblem(`${name} is already listed.`);
      }
      const school: School = {
        id: schoolId(
          name,
          schools.map((item) => item.id),
        ),
        name,
        summary: summary.trim(),
        icon,
        areas: [],
      };
      await save([...schools, school], `${name} is on the home page.`);
    } else if (dialog.kind === "department") {
      await apply(
        dialog.name
          ? renameDepartment(schools, dialog.schoolId, dialog.name, text)
          : addDepartment(schools, dialog.schoolId, text),
        dialog.name ? "The department is renamed." : "The department is added.",
      );
    } else {
      const school = schools.find((item) => item.id === dialog.schoolId);
      const clean = text.trim();
      if (!school) return;
      if (clean.length < 2) return setProblem("Enter the area.");
      const current = managedAreas(school, dialog.department);
      if (
        current.some(
          (item) =>
            item.toLowerCase() === clean.toLowerCase() && item !== dialog.original,
        )
      ) {
        return setProblem(`${clean} is already listed.`);
      }
      const next = dialog.original
        ? current.map((item) => (item === dialog.original ? clean : item))
        : [...current, clean];
      await save(
        setDepartmentAreas(schools, dialog.schoolId, dialog.department, next),
        dialog.original ? "The area is updated." : "The area is added.",
      );
    }
  }

  /** The areas the supervisors of a department name in their profiles, to start a list from. */
  function supervisorAreas(department: string) {
    const found: string[] = [];
    for (const supervisor of researchRegister.supervisors) {
      if (!supervisor.active || !sameDepartment(supervisor.department, department))
        continue;
      for (const area of keyAreasOf(supervisor.researchArea)) {
        if (!found.some((item) => item.toLowerCase() === area.toLowerCase()))
          found.push(area);
      }
    }
    return found;
  }

  const title =
    dialog?.kind === "school"
      ? dialog.id
        ? "Edit the research area"
        : "Add a research area"
      : dialog?.kind === "department"
        ? dialog.name
          ? "Edit the department"
          : "Add a department"
        : dialog?.kind === "area"
          ? dialog.original
            ? "Edit the area"
            : "Add an area"
          : "";

  return (
    <div>
      <PageTitle
        kicker="Website"
        title="Research areas"
        actions={
          <Button
            type="button"
            variant="gold"
            onClick={() => open({ kind: "school", id: null })}
          >
            <Plus className="mr-1 size-4" aria-hidden="true" />
            Add research area
          </Button>
        }
      />
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        A research area holds departments, and a department holds its key areas. The home
        page and the Ph.D. application form show what is kept here.
      </p>
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice} {stored?.source === "browser" ? researchAreaMigrationHint : ""}
        </p>
      ) : null}

      {dialog ? (
        <FormDialog
          title={title}
          onClose={() => setDialog(null)}
          onSubmit={submit}
          busy={busy}
        >
          <div className="space-y-4">
            <label className="grid gap-1 text-sm font-medium">
              {dialog.kind === "school"
                ? "Name"
                : dialog.kind === "department"
                  ? "Department"
                  : "Area"}
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={120}
              />
            </label>
            {dialog.kind === "school" ? (
              <>
                <label className="grid gap-1 text-sm font-medium">
                  Summary (optional)
                  <Input
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    maxLength={240}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Icon
                  <NativeSelect
                    value={icon}
                    onChange={(event) => setIcon(event.target.value as School["icon"])}
                  >
                    {schoolIcons.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              </>
            ) : null}
            {dialog.kind === "department" && dialog.name ? (
              <p className="text-xs text-muted-foreground">
                Supervisors, vacancies and applications that already carry the old name
                keep it; change them where they are kept so the names match.
              </p>
            ) : null}
            {problem ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {problem}
              </p>
            ) : null}
          </div>
        </FormDialog>
      ) : null}

      <div className="mt-6 space-y-4">
        {schools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No research area yet.</p>
        ) : null}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => open({ kind: "school", id: school.id })}
                >
                  <Pencil className="mr-1 size-3.5" aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    open({ kind: "department", schoolId: school.id, name: null })
                  }
                >
                  <Plus className="mr-1 size-3.5" aria-hidden="true" />
                  Add department
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    window.confirm(
                      `Remove ${school.name} with its departments and areas?`,
                    ) &&
                    void save(
                      schools.filter((item) => item.id !== school.id),
                      `${school.name} is removed.`,
                    )
                  }
                >
                  <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
            {school.areas.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No department yet. The areas of the school itself can be kept under a
                department named like the school.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {school.areas.map((department) => {
                  const areas = managedAreas(school, department);
                  const fromSupervisors = supervisorAreas(department).filter(
                    (item) =>
                      !areas.some((own) => own.toLowerCase() === item.toLowerCase()),
                  );
                  return (
                    <li
                      key={department}
                      className="rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-primary">
                          {department}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              open({
                                kind: "area",
                                schoolId: school.id,
                                department,
                                original: null,
                              })
                            }
                          >
                            Add area
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              open({
                                kind: "department",
                                schoolId: school.id,
                                name: department,
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              window.confirm(`Remove ${department} and its areas?`) &&
                              void save(
                                removeDepartment(schools, school.id, department),
                                `${department} is removed.`,
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      {areas.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No area entered here. The home page then shows the areas the
                          supervisors of this department give in their profiles.
                        </p>
                      ) : (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {areas.map((area) => (
                            <li
                              key={area}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs"
                            >
                              {area}
                              <button
                                type="button"
                                aria-label={`Edit ${area}`}
                                className="text-muted-foreground hover:text-primary"
                                onClick={() =>
                                  open({
                                    kind: "area",
                                    schoolId: school.id,
                                    department,
                                    original: area,
                                  })
                                }
                              >
                                <Pencil className="size-3" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${area}`}
                                className="text-muted-foreground hover:text-destructive"
                                disabled={busy}
                                onClick={() =>
                                  void save(
                                    setDepartmentAreas(
                                      schools,
                                      school.id,
                                      department,
                                      areas.filter((item) => item !== area),
                                    ),
                                    `${area} is removed.`,
                                  )
                                }
                              >
                                <X className="size-3" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {fromSupervisors.length > 0 ? (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void save(
                                setDepartmentAreas(schools, school.id, department, [
                                  ...areas,
                                  ...fromSupervisors,
                                ]),
                                `${fromSupervisors.length} area(s) of the supervisors are added to ${department}.`,
                              )
                            }
                          >
                            Add the {fromSupervisors.length} area(s) from the
                            supervisors&apos; profiles
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
