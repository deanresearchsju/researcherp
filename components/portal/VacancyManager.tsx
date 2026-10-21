"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { FormDialog, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { schools } from "@/data/schools";
import { vacancySeed } from "@/data/vacancies";
import { field } from "@/lib/csv";
import { createSupabase } from "@/lib/supabase/client";
import {
  loadVacancies,
  mapVacancy,
  officeVacancies,
  vacancyMigrationHint,
  vacancySchoolName,
  type Vacancy,
  type VacancyLoad,
} from "@/lib/vacancies";

const vacancyColumns = [
  "serial_no",
  "supervisor_name",
  "designation",
  "school",
  "department",
  "research_area",
  "vacancy_count",
] as const;

const vacancyFormSchema = z.object({
  serialNo: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter the serial number.")
    .refine((value) => Number(value) >= 1, "Enter a serial number of 1 or more."),
  supervisorName: z.string().trim().min(2, "Enter the supervisor name."),
  designation: z.string().trim().min(2, "Enter the designation."),
  school: z.string().trim().min(2, "Enter the school name."),
  department: z.string().trim().min(2, "Enter the subject."),
  researchArea: z.string().trim().min(2, "Enter the area of research."),
  vacancyCount: z.string().trim().regex(/^\d+$/, "Enter the number of vacancies."),
});

type VacancyFormValues = z.infer<typeof vacancyFormSchema>;

const emptyForm: VacancyFormValues = {
  serialNo: "",
  supervisorName: "",
  designation: "",
  school: "",
  department: "",
  researchArea: "",
  vacancyCount: "",
};

function toColumns(values: VacancyFormValues) {
  return {
    serial_no: Number(values.serialNo),
    supervisor_name: values.supervisorName.trim(),
    designation: values.designation.trim(),
    school: values.school.trim(),
    department: values.department.trim(),
    research_area: values.researchArea.trim(),
    vacancy_count: Number(values.vacancyCount),
  };
}

function withoutSchool(columns: ReturnType<typeof toColumns>) {
  return {
    serial_no: columns.serial_no,
    supervisor_name: columns.supervisor_name,
    designation: columns.designation,
    department: columns.department,
    research_area: columns.research_area,
    vacancy_count: columns.vacancy_count,
  };
}

function VacancyFields({
  form,
  schoolOptions,
}: {
  form: UseFormReturn<VacancyFormValues>;
  schoolOptions: string[];
}) {
  return (
    <>
      <FormField
        label="S. No."
        htmlFor="serialNo"
        required
        error={form.formState.errors.serialNo?.message}
      >
        <Input id="serialNo" inputMode="numeric" {...form.register("serialNo")} />
      </FormField>
      <FormField
        label="No. of vacancy"
        htmlFor="vacancyCount"
        required
        error={form.formState.errors.vacancyCount?.message}
      >
        <Input id="vacancyCount" inputMode="numeric" {...form.register("vacancyCount")} />
      </FormField>
      <FormField
        label="Name of the supervisor"
        htmlFor="supervisorName"
        required
        error={form.formState.errors.supervisorName?.message}
      >
        <Input id="supervisorName" {...form.register("supervisorName")} />
      </FormField>
      <FormField
        label="Designation"
        htmlFor="designation"
        required
        error={form.formState.errors.designation?.message}
      >
        <Input id="designation" {...form.register("designation")} />
      </FormField>
      <FormField
        label="School"
        htmlFor="school"
        required
        error={form.formState.errors.school?.message}
      >
        <Input id="school" list="vacancy-schools" {...form.register("school")} />
        <datalist id="vacancy-schools">
          {schoolOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </FormField>
      <FormField
        label="Subject"
        htmlFor="department"
        required
        error={form.formState.errors.department?.message}
      >
        <Input id="department" {...form.register("department")} />
      </FormField>
      <FormField
        label="Area of research"
        htmlFor="researchArea"
        required
        error={form.formState.errors.researchArea?.message}
      >
        <Input id="researchArea" {...form.register("researchArea")} />
      </FormField>
    </>
  );
}

export function VacancyManager({ initial }: { initial: VacancyLoad }) {
  const [rows, setRows] = useState<Vacancy[]>(
    initial.source === "empty" ? officeVacancies() : initial.rows,
  );
  const [source, setSource] = useState(initial.source);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(initial.detail);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");

  const form = useForm<VacancyFormValues>({
    resolver: zodResolver(vacancyFormSchema),
    defaultValues: emptyForm,
  });

  const writable = source === "database" || source === "empty";

  function beginEdit(row: Vacancy) {
    setNotice(null);
    setEditingId(row.id);
    form.reset({
      serialNo: String(row.serialNo),
      supervisorName: row.supervisorName,
      designation: row.designation,
      school: vacancySchoolName(row),
      department: row.department,
      researchArea: row.researchArea,
      vacancyCount: String(row.vacancyCount),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
    form.reset(emptyForm);
  }

  async function refresh() {
    const loaded = await loadVacancies();
    setSource(loaded.source);
    setRows(loaded.source === "empty" ? officeVacancies() : loaded.rows);
    setNotice(loaded.detail);
  }

  async function publishOfficeList() {
    const supabase = createSupabase();
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const seedRows = vacancySeed.map((row) => ({
      serial_no: row.serialNo,
      supervisor_name: row.supervisorName,
      designation: row.designation,
      school: vacancySchoolName(row),
      department: row.department,
      research_area: row.researchArea,
      vacancy_count: row.vacancyCount,
    }));
    const first = await supabase.from("supervisor_vacancies").insert(seedRows);
    const { error } = first.error
      ? await supabase
          .from("supervisor_vacancies")
          .insert(seedRows.map((row) => withoutSchool(row)))
      : first;
    setBusy(false);
    if (error) {
      setNotice(
        "The office list could not be saved. Run the SQL migration, then try again.",
      );
      return;
    }
    await refresh();
  }

  async function onSubmit(values: VacancyFormValues) {
    const supabase = createSupabase();
    if (!supabase || source === "office-copy") return;
    setBusy(true);
    setNotice(null);
    const columns = toColumns(values);

    if (source === "empty") {
      const first = await supabase.from("supervisor_vacancies").insert(columns);
      const { error } = first.error
        ? await supabase.from("supervisor_vacancies").insert(withoutSchool(columns))
        : first;
      setBusy(false);
      if (error) {
        setNotice("That supervisor could not be added.");
        return;
      }
      cancelEdit();
      await refresh();
      return;
    }

    const selectColumns =
      "id, serial_no, supervisor_name, designation, department, research_area, vacancy_count, school";

    if (editingId && !editingId.startsWith("office-")) {
      const first = await supabase
        .from("supervisor_vacancies")
        .update(columns)
        .eq("id", editingId)
        .select(selectColumns)
        .single();
      const { data, error } = first.error
        ? await supabase
            .from("supervisor_vacancies")
            .update(withoutSchool(columns))
            .eq("id", editingId)
            .select(
              "id, serial_no, supervisor_name, designation, department, research_area, vacancy_count",
            )
            .single()
        : first;
      setBusy(false);
      if (error || !data) {
        setNotice(
          "That row could not be updated. The serial number may already be used.",
        );
        return;
      }
      const next = mapVacancy(data);
      setRows((current) =>
        current
          .map((row) => (row.id === editingId ? next : row))
          .sort((a, b) => a.serialNo - b.serialNo),
      );
      cancelEdit();
      return;
    }

    const first = await supabase
      .from("supervisor_vacancies")
      .insert(columns)
      .select(selectColumns)
      .single();
    const { data, error } = first.error
      ? await supabase
          .from("supervisor_vacancies")
          .insert(withoutSchool(columns))
          .select(
            "id, serial_no, supervisor_name, designation, department, research_area, vacancy_count",
          )
          .single()
      : first;
    setBusy(false);
    if (error || !data) {
      setNotice(
        "That supervisor could not be added. The serial number may already be used.",
      );
      return;
    }
    setRows((current) =>
      [...current, mapVacancy(data)].sort((a, b) => a.serialNo - b.serialNo),
    );
    cancelEdit();
  }

  async function remove(row: Vacancy) {
    if (row.id.startsWith("office-")) return;
    const supabase = createSupabase();
    if (!supabase) return;
    if (!window.confirm(`Remove ${row.supervisorName} from the vacancy list?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("supervisor_vacancies")
      .delete()
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      setNotice("That row could not be removed.");
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
    if (editingId === row.id) cancelEdit();
  }

  async function uploadCsv(records: Record<string, string>[]) {
    if (source !== "database" && source !== "empty") {
      setNotice("Save the vacancy table in Supabase before uploading a CSV.");
      return;
    }
    const supabase = createSupabase();
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const known = new Map(
      rows
        .filter((row) => !row.id.startsWith("office-"))
        .map((row) => [row.serialNo, row.id]),
    );
    let added = 0;
    let updated = 0;
    const problems: string[] = [];

    for (const [index, record] of records.entries()) {
      const subject = field(record, ["department", "subject"]);
      const parsed = vacancyFormSchema.safeParse({
        serialNo: field(record, ["serial_no", "s. no.", "s no"]),
        supervisorName: field(record, [
          "supervisor_name",
          "supervisor",
          "name of the supervisor",
        ]),
        designation: field(record, ["designation"]),
        school:
          field(record, ["school", "school name"]) ||
          vacancySchoolName({ department: subject }),
        department: subject,
        researchArea: field(record, ["research_area", "area of research"]),
        vacancyCount: field(record, ["vacancy_count", "vacancy", "no. of vacancy"]),
      });
      if (!parsed.success) {
        problems.push(
          `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "Check this row."}`,
        );
        continue;
      }
      const columns = toColumns(parsed.data);
      const existingId = known.get(columns.serial_no);
      if (existingId) {
        const first = await supabase
          .from("supervisor_vacancies")
          .update(columns)
          .eq("id", existingId);
        const { error } = first.error
          ? await supabase
              .from("supervisor_vacancies")
              .update(withoutSchool(columns))
              .eq("id", existingId)
          : first;
        if (error) problems.push(`Row ${index + 2} could not be updated.`);
        else updated += 1;
        continue;
      }
      const first = await supabase
        .from("supervisor_vacancies")
        .insert(columns)
        .select("id")
        .single();
      const { data, error } = first.error
        ? await supabase
            .from("supervisor_vacancies")
            .insert(withoutSchool(columns))
            .select("id")
            .single()
        : first;
      if (error || !data) {
        problems.push(
          `Row ${index + 2} could not be added. The serial number may already be used.`,
        );
        continue;
      }
      known.set(columns.serial_no, data.id);
      added += 1;
    }

    setBusy(false);
    await refresh();
    const summary = `Added ${added} and updated ${updated} from the CSV.`;
    setNotice(problems.length ? `${summary} ${problems.slice(0, 3).join(" ")}` : summary);
  }

  const visible = rows.filter(
    (row) =>
      filterMatches(department, row.department) &&
      filterMatches(designation, row.designation) &&
      textMatches(query, [
        row.supervisorName,
        row.designation,
        vacancySchoolName(row),
        row.department,
        row.researchArea,
        String(row.serialNo),
      ]),
  );
  const choices = (values: string[]) =>
    [...new Set(values)].sort().map((value) => ({ value, label: value }));
  const schoolOptions = [
    ...new Set([
      ...schools.map((school) => school.name),
      ...rows.map((row) => vacancySchoolName(row)).filter(Boolean),
    ]),
  ];
  const editingRow = rows.find((row) => row.id === editingId) ?? null;
  const editing = Boolean(editingRow);

  return (
    <div>
      <PageTitle
        kicker="Admissions"
        title="Supervisor vacancies"
        actions={
          writable && source === "database" ? (
            <Button
              type="button"
              variant="gold"
              onClick={() => {
                cancelEdit();
                setNotice(null);
                setAdding(true);
              }}
            >
              Add supervisor
            </Button>
          ) : null
        }
      />
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "department",
            label: "Subject",
            value: department,
            options: choices(rows.map((row) => row.department)),
            onChange: setDepartment,
          },
          {
            id: "designation",
            label: "Designation",
            value: designation,
            options: choices(rows.map((row) => row.designation)),
            onChange: setDesignation,
          },
        ]}
        shown={visible.length}
        total={rows.length}
        filename="supervisor-vacancies-filtered.csv"
        headers={vacancyColumns}
        rows={visible.map((row) => [
          String(row.serialNo),
          row.supervisorName,
          row.designation,
          vacancySchoolName(row),
          row.department,
          row.researchArea,
          String(row.vacancyCount),
        ])}
      />
      <SpreadsheetBar
        filename="supervisor-vacancies.csv"
        headers={vacancyColumns}
        rows={visible.map((row) => [
          String(row.serialNo),
          row.supervisorName,
          row.designation,
          vacancySchoolName(row),
          row.department,
          row.researchArea,
          String(row.vacancyCount),
        ])}
        canUpload={writable}
        busy={busy}
        onUpload={(records) => void uploadCsv(records)}
        onError={setNotice}
      />
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice} {source === "office-copy" ? vacancyMigrationHint : ""}
        </p>
      ) : null}

      {source === "empty" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm leading-6 text-muted-foreground">
            The database has no vacancy rows yet. Save the office list, then edit it here.
          </p>
          <Button
            type="button"
            variant="gold"
            className="mt-4"
            disabled={busy}
            onClick={() => void publishOfficeList()}
          >
            Save the office list
          </Button>
        </div>
      ) : null}

      {writable && source === "database" && (editing || adding) ? (
        <FormDialog
          title={editingRow ? `Edit ${editingRow.supervisorName}` : "Add supervisor"}
          onClose={cancelEdit}
          onSubmit={form.handleSubmit(onSubmit)}
          busy={busy}
          submitLabel={editing ? "Save changes" : "Add supervisor"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <VacancyFields form={form} schoolOptions={schoolOptions} />
          </div>
          {notice ? (
            <p role="alert" className="text-sm font-semibold text-secondary">
              {notice}
            </p>
          ) : null}
        </FormDialog>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3 font-semibold">S. No.</th>
              <th className="px-3 py-3 font-semibold">Supervisor</th>
              <th className="px-3 py-3 font-semibold">School</th>
              <th className="px-3 py-3 font-semibold">Subject</th>
              <th className="px-3 py-3 font-semibold">Area of research</th>
              <th className="px-3 py-3 font-semibold">Vacancy</th>
              {source === "database" ? (
                <th className="px-3 py-3 font-semibold">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-3 align-top">{row.serialNo}</td>
                <td className="px-3 py-3 align-top">
                  <span className="font-semibold text-primary">{row.supervisorName}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {row.designation}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">{vacancySchoolName(row)}</td>
                <td className="px-3 py-3 align-top">{row.department}</td>
                <td className="px-3 py-3 align-top">{row.researchArea}</td>
                <td className="px-3 py-3 align-top">{row.vacancyCount}</td>
                {source === "database" ? (
                  <td className="px-3 py-3 align-top">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => beginEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="maroon"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(row)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
