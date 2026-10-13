"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { courseSemesters, courseWorkFee, standardSubjects } from "@/data/doctoral";
import { researchRegister, type ResearchBatch } from "@/data/research-register";
import { paymentModes } from "@/lib/constants";
import { clientToday, formatIsoDate, isOnOrBefore, isValidIsoDate } from "@/lib/dates";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { batchOf, scholarBySignIn } from "@/lib/register";
import { downloadStoredFile } from "@/lib/scholar-records";
import {
  currentDoctoral,
  hasArrear,
  paperOf,
  registerCoursePapers,
  resultFor,
  saveCourseWindow,
  saveSubject,
  subscribeDoctoral,
  type CourseWindow,
  type DoctoralState,
} from "@/lib/doctoral";
import { usePortalSession } from "@/lib/use-preview-session";
import { formatInr } from "@/lib/utils";

const windowSchema = z.object({
  enabled: z.boolean(),
  semester: z.enum(["1", "2", "3", "4"]),
  lastDate: z.string().refine(isValidIsoDate, "Enter the last date."),
});

const subjectCatalogSchema = z.object({
  batchId: z.string().min(1, "Select a batch."),
  semester: z.enum(["1", "2", "3", "4"]),
  code: z.string().trim().min(2, "Enter the subject code."),
  name: z.string().min(1, "Select the subject."),
  credits: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter the credits."),
});

const subjectRowSchema = z
  .object({
    code: z.string().trim().min(2, "Enter the subject code.").max(20),
    choice: z.string().min(1, "Select the subject."),
    customName: z.string().trim().max(140),
  })
  .refine((row) => row.choice !== "other" || row.customName.length >= 2, {
    path: ["customName"],
    message: "Enter the subject name.",
  });

function registrationSchema(slots: number) {
  return z.object({
    subjects: z
      .array(subjectRowSchema)
      .min(1, "Add a subject.")
      .max(slots, "Two papers are the limit for this semester."),
    paymentMode: z.enum(paymentModes),
    paymentReference: z.string().trim().min(3, "Enter the payment reference.").max(80),
    paymentDate: z
      .string()
      .refine(
        (value) => isValidIsoDate(value) && isOnOrBefore(value, clientToday()),
        "Enter the payment date.",
      ),
  });
}

type WindowValues = z.infer<typeof windowSchema>;
type CatalogValues = z.infer<typeof subjectCatalogSchema>;
type RegistrationValues = z.infer<ReturnType<typeof registrationSchema>>;

function batchLabel(batchId: string) {
  return (
    batchOf(batchId)?.name ??
    researchRegister.batches.find((batch) => batch.id === batchId)?.name ??
    batchId
  );
}

function windowSummary(window: CourseWindow | undefined) {
  if (!window?.enabled || !isValidIsoDate(window.lastDate))
    return "Registration is closed.";
  const date = formatIsoDate(window.lastDate);
  if (window.lastDate < clientToday()) return `Registration closed on ${date}.`;
  return `Semester ${window.semester} is open until ${date}.`;
}

function subjectName(choice: string, customName: string) {
  if (choice === "other") return customName.trim();
  if (choice.startsWith("saved:"))
    return choice.slice("saved:".length).split(":::")[1] ?? "";
  return choice.trim();
}

function BatchControl({
  batch,
  window,
  onNotice,
}: {
  batch: ResearchBatch;
  window: CourseWindow | undefined;
  onNotice: (message: string) => void;
}) {
  const form = useForm<WindowValues>({
    resolver: zodResolver(windowSchema) as Resolver<WindowValues>,
    defaultValues: {
      enabled: window?.enabled ?? false,
      semester: String(window?.semester || 1) as WindowValues["semester"],
      lastDate: window?.lastDate ?? "",
    },
  });
  const scholars = researchRegister.scholars.filter(
    (scholar) => scholar.batchId === batch.id,
  );

  async function onSubmit(values: WindowValues) {
    const saved = await saveCourseWindow({
      batchId: batch.id,
      enabled: values.enabled,
      semester: Number(values.semester),
      lastDate: values.lastDate,
    });
    onNotice(
      saved.ok
        ? `${batch.name} registration is ${values.enabled ? "open" : "closed"}.`
        : saved.message,
    );
  }

  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-4"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="lg:col-span-4">
        <p className="font-semibold text-primary">{batch.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {scholars.length} scholars. {windowSummary(window)} Scholars with an arrear can
          register through semester 4.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("enabled")} />
        Open registration
      </label>
      <FormField
        label="Semester"
        htmlFor={`semester-${batch.id}`}
        required
        error={form.formState.errors.semester?.message}
      >
        <NativeSelect id={`semester-${batch.id}`} {...form.register("semester")}>
          {courseSemesters.map((semester) => (
            <option key={semester} value={semester}>
              Semester {semester}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label="Last date"
        htmlFor={`last-${batch.id}`}
        required
        error={form.formState.errors.lastDate?.message}
      >
        <Input id={`last-${batch.id}`} type="date" {...form.register("lastDate")} />
      </FormField>
      <div className="flex items-end">
        <Button type="submit" variant="gold">
          Save {batch.name}
        </Button>
      </div>
    </form>
  );
}

function RegistrationForm({
  identifier,
  name,
  batchId,
  semester,
  slots,
  catalog,
  onDone,
}: {
  identifier: string;
  name: string;
  batchId: string;
  semester: 1 | 2 | 3 | 4;
  slots: number;
  catalog: { code: string; name: string }[];
  onDone: (message: string) => void;
}) {
  const schema = registrationSchema(slots);
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(schema) as Resolver<RegistrationValues>,
    defaultValues: {
      subjects: [{ code: "", choice: "", customName: "" }],
      paymentMode: "UPI",
      paymentReference: "",
      paymentDate: "",
    },
  });
  const subjects = useFieldArray({ control: form.control, name: "subjects" });
  const rows = useWatch({ control: form.control, name: "subjects" });
  const [receipt, setReceipt] = useState<StoredFile | null>(null);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const known = (standardSubjects[semester] ?? []).filter(
    (subject) => !catalog.some((item) => item.name === subject),
  );
  const total = (rows?.length ?? 0) * courseWorkFee;

  async function onSubmit(values: RegistrationValues) {
    if (!receipt?.file) {
      setReceiptMessage("Upload the payment receipt.");
      return;
    }
    const problem = fileError(receipt.file, "document", true);
    setReceiptMessage(problem);
    if (problem) return;
    const receiptData = await fileToDataUrl(receipt.file).catch(() => "");
    if (!receiptData) {
      setReceiptMessage("The receipt could not be read.");
      return;
    }
    setBusy(true);
    const saved = await registerCoursePapers({
      scholarIdentifier: identifier,
      scholarName: name,
      batchId,
      semester,
      subjects: values.subjects.map((row) => ({
        code: row.code.trim(),
        name: subjectName(row.choice, row.customName),
      })),
      paymentMode: values.paymentMode,
      paymentReference: values.paymentReference,
      paymentDate: values.paymentDate,
      receiptName: receipt.file.name,
      receiptData,
    });
    setBusy(false);
    if (!saved.ok) {
      onDone(saved.message);
      return;
    }
    form.reset();
    setReceipt(null);
    onDone("Registration and payment receipt submitted.");
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-primary">Semester {semester}</h2>
        <p className="text-sm text-muted-foreground">
          ₹{formatInr(courseWorkFee)} per subject. Total ₹{formatInr(total)}.
        </p>
      </div>
      {subjects.fields.map((field, index) => {
        const choice = rows?.[index]?.choice ?? "";
        return (
          <div
            key={field.id}
            className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
          >
            <FormField
              label="Subject"
              htmlFor={`subject-${index}`}
              required
              error={form.formState.errors.subjects?.[index]?.choice?.message}
            >
              <NativeSelect
                id={`subject-${index}`}
                {...form.register(`subjects.${index}.choice`, {
                  onChange: (event) => {
                    const value = event.target.value;
                    if (!value.startsWith("saved:")) return;
                    const code = value.slice("saved:".length).split(":::")[0] ?? "";
                    form.setValue(`subjects.${index}.code`, code);
                  },
                })}
              >
                <option value="">Select</option>
                {catalog.map((subject) => (
                  <option
                    key={`${subject.code}-${subject.name}`}
                    value={`saved:${subject.code}:::${subject.name}`}
                  >
                    {subject.code} · {subject.name}
                  </option>
                ))}
                {known.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
                <option value="other">Other</option>
              </NativeSelect>
            </FormField>
            <FormField
              label="Subject code"
              htmlFor={`code-${index}`}
              required
              error={form.formState.errors.subjects?.[index]?.code?.message}
            >
              <Input id={`code-${index}`} {...form.register(`subjects.${index}.code`)} />
            </FormField>
            {choice === "other" ? (
              <FormField
                label="Subject name"
                htmlFor={`custom-${index}`}
                required
                className="sm:col-span-2"
                error={form.formState.errors.subjects?.[index]?.customName?.message}
              >
                <Input
                  id={`custom-${index}`}
                  {...form.register(`subjects.${index}.customName`)}
                />
              </FormField>
            ) : null}
            {subjects.fields.length > 1 ? (
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => subjects.remove(index)}
                >
                  Remove subject
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
      {slots > subjects.fields.length ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => subjects.append({ code: "", choice: "", customName: "" })}
        >
          Add subject
        </Button>
      ) : null}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-primary sm:col-span-2">Payment</h3>
        <FormField
          label="Mode"
          htmlFor="payment-mode"
          required
          error={form.formState.errors.paymentMode?.message}
        >
          <NativeSelect id="payment-mode" {...form.register("paymentMode")}>
            {paymentModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Reference"
          htmlFor="payment-reference"
          required
          error={form.formState.errors.paymentReference?.message}
        >
          <Input id="payment-reference" {...form.register("paymentReference")} />
        </FormField>
        <FormField
          label="Payment date"
          htmlFor="payment-date"
          required
          error={form.formState.errors.paymentDate?.message}
        >
          <Input id="payment-date" type="date" {...form.register("paymentDate")} />
        </FormField>
        <FormField
          label="Receipt"
          htmlFor="payment-receipt"
          required
          error={receiptMessage ?? undefined}
        >
          <FileUpload
            id="payment-receipt"
            acceptRule="document"
            value={receipt}
            onChange={setReceipt}
          />
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="gold" disabled={busy}>
          Submit registration
        </Button>
      </div>
    </form>
  );
}

function ScholarCourseWork({
  doctoral,
  identifier,
  scholarName,
}: {
  doctoral: DoctoralState;
  identifier: string;
  scholarName: string;
}) {
  const scholar = scholarBySignIn(identifier);
  const batch = scholar ? batchOf(scholar.batchId) : null;
  const window = doctoral.windows.find((item) => item.batchId === batch?.id);
  const [notice, setNotice] = useState<string | null>(null);
  const mine = doctoral.registrations.filter(
    (item) => item.scholarIdentifier.toLowerCase() === identifier.toLowerCase(),
  );
  const open = window?.enabled ? window.semester : 0;
  const arrear = hasArrear(doctoral, identifier);
  const taken = mine.filter((item) => item.semester === open).length;
  const slots = Math.max(0, 2 - taken);
  const closed = !window?.enabled || !window.lastDate || window.lastDate < clientToday();
  const blockedSemester = open > 2 && !arrear;
  const catalog = doctoral.subjects
    .filter((subject) => subject.batchId === batch?.id && subject.semester === open)
    .map((subject) => ({ code: subject.code, name: subject.name }));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-4xl text-primary">Course work</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Register the subjects for the semester the office has opened. The fee is ₹
          {formatInr(courseWorkFee)} for each subject, paid with the registration receipt.
          Scholars with an arrear can register through semester 4.
        </p>
      </header>
      {doctoral.detail ? (
        <p className="text-sm text-secondary">{doctoral.detail}</p>
      ) : null}
      {!scholar || !batch ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">
          Course work registration opens for scholars on a research batch.
        </p>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">
          {batch.name}. {windowSummary(window)}
        </p>
      )}
      {batch && window && !closed && blockedSemester ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">
          Semester {open} is open for scholars who have an arrear.
        </p>
      ) : null}
      {batch && window && !closed && !blockedSemester && slots === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">
          Two papers are already registered for this semester.
        </p>
      ) : null}
      {batch && window && !closed && !blockedSemester && slots > 0 ? (
        <RegistrationForm
          identifier={identifier}
          name={scholarName}
          batchId={batch.id}
          semester={open as 1 | 2 | 3 | 4}
          slots={slots}
          catalog={catalog}
          onDone={setNotice}
        />
      ) : null}
      {mine.length ? (
        <div>
          <h2 className="font-semibold text-primary">Your papers</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {mine.map((item) => {
              const paper = paperOf(doctoral, item);
              const result = resultFor(doctoral, item.id);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <span>
                    Semester {item.semester}: {paper.code} {paper.name}
                    {item.amount ? ` · ₹${formatInr(item.amount)}` : ""}
                    {item.paymentReference ? ` · ${item.paymentReference}` : ""}
                  </span>
                  <span>{result ? result.outcome : "Result pending"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

export function CourseWorkScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [syllabus, setSyllabus] = useState<StoredFile | null>(null);
  const [syllabusMessage, setSyllabusMessage] = useState<string | null>(null);
  const subjectForm = useForm<CatalogValues>({
    resolver: zodResolver(subjectCatalogSchema) as Resolver<CatalogValues>,
    defaultValues: { batchId: "", semester: "1", code: "", name: "", credits: "" },
  });
  const semester = useWatch({ control: subjectForm.control, name: "semester" });
  const subjectNames = standardSubjects[Number(semester) as 1 | 2 | 3 | 4] ?? [];

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading course work…</p>;
  }

  if (mode === "scholar") {
    return (
      <ScholarCourseWork
        doctoral={doctoral}
        identifier={session?.identifier ?? ""}
        scholarName={session?.name ?? ""}
      />
    );
  }

  const batchOptions = [
    ...researchRegister.batches.map((batch) => ({ id: batch.id, name: batch.name })),
    ...doctoral.batches
      .filter((batch) => !researchRegister.batches.some((item) => item.id === batch.id))
      .map((batch) => ({ id: batch.id, name: batch.name })),
  ];
  const registrations = doctoral.registrations.filter((row) => {
    const paper = paperOf(doctoral, row);
    return (
      (batchFilter === "" || row.batchId === batchFilter) &&
      (semesterFilter === "" || String(row.semester) === semesterFilter) &&
      textMatches(query, [
        row.scholarName,
        paper.code,
        paper.name,
        row.paymentReference,
        batchLabel(row.batchId),
      ])
    );
  });

  async function addSubject(values: CatalogValues) {
    const problem = fileError(syllabus?.file ?? null, "document", true);
    setSyllabusMessage(problem);
    if (problem || !syllabus?.file) return;
    const data = await fileToDataUrl(syllabus.file).catch(() => "");
    if (!data) {
      setSyllabusMessage("That syllabus could not be read.");
      return;
    }
    const saved = await saveSubject({
      batchId: values.batchId,
      semester: Number(values.semester),
      code: values.code,
      name: values.name,
      credits: values.credits,
      syllabusName: syllabus.file.name,
      syllabusData: data,
    });
    setNotice(saved.ok ? "Subject and syllabus saved." : saved.message);
    if (saved.ok) {
      subjectForm.reset();
      setSyllabus(null);
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-heading text-4xl text-primary">Course work</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Open registration for a research batch and fix the last date. Scholars with an
          arrear can register through semester 4. Each subject is ₹
          {formatInr(courseWorkFee)}.
        </p>
      </header>
      {doctoral.detail ? (
        <p className="text-sm text-secondary">{doctoral.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <div className="space-y-3">
        {researchRegister.batches.map((batch) => (
          <BatchControl
            key={batch.id}
            batch={batch}
            window={doctoral.windows.find((item) => item.batchId === batch.id)}
            onNotice={setNotice}
          />
        ))}
      </div>

      <div>
        <h2 className="font-semibold text-primary">Registrations</h2>
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filters={[
            {
              id: "batch",
              label: "Batch",
              value: batchFilter,
              options: researchRegister.batches.map((batch) => ({
                value: batch.id,
                label: batch.name,
              })),
              onChange: setBatchFilter,
            },
            {
              id: "semester",
              label: "Semester",
              value: semesterFilter,
              options: courseSemesters.map((item) => ({
                value: String(item),
                label: `Semester ${item}`,
              })),
              onChange: setSemesterFilter,
            },
          ]}
          shown={registrations.length}
          total={doctoral.registrations.length}
          filename="course-registrations.csv"
          headers={[
            "batch",
            "scholar",
            "semester",
            "code",
            "subject",
            "amount",
            "payment mode",
            "reference",
            "payment date",
            "receipt",
          ]}
          rows={registrations.map((row) => {
            const paper = paperOf(doctoral, row);
            return [
              batchLabel(row.batchId),
              row.scholarName,
              String(row.semester),
              paper.code,
              paper.name,
              String(row.amount),
              row.paymentMode,
              row.paymentReference,
              row.paymentDate,
              row.receiptName ?? "",
            ];
          })}
        />
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-4 py-3 font-semibold">Scholar</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((row) => {
                const paper = paperOf(doctoral, row);
                const result = resultFor(doctoral, row.id);
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{row.scholarName}</p>
                      <p className="text-muted-foreground">Semester {row.semester}</p>
                    </td>
                    <td className="px-4 py-3">{batchLabel(row.batchId)}</td>
                    <td className="px-4 py-3">
                      {paper.code} {paper.name}
                      {result ? (
                        <Badge
                          variant={result.outcome === "Fail" ? "maroon" : "gold"}
                          className="ml-2"
                        >
                          {result.outcome}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">₹{formatInr(row.amount || 0)}</td>
                    <td className="px-4 py-3">
                      {row.paymentMode || "—"}
                      {row.paymentReference ? ` · ${row.paymentReference}` : ""}
                      {row.paymentDate ? ` · ${formatIsoDate(row.paymentDate)}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {row.receiptName && row.receiptData ? (
                        <button
                          type="button"
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                          onClick={() =>
                            downloadStoredFile(
                              row.receiptName ?? "receipt",
                              row.receiptData ?? "",
                            )
                          }
                        >
                          {row.receiptName}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {registrations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No registrations yet.
            </p>
          ) : null}
        </div>
      </div>

      <form
        className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
        onSubmit={subjectForm.handleSubmit(addSubject)}
        noValidate
      >
        <h2 className="font-semibold text-primary sm:col-span-2">Subject list</h2>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Subjects added here appear in the scholar&apos;s list. A scholar can also type a
          subject that is not on the list.
        </p>
        <FormField
          label="Batch"
          htmlFor="subject-batch"
          required
          error={subjectForm.formState.errors.batchId?.message}
        >
          <NativeSelect id="subject-batch" {...subjectForm.register("batchId")}>
            <option value="">Select</option>
            {batchOptions.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Semester"
          htmlFor="subject-semester"
          required
          error={subjectForm.formState.errors.semester?.message}
        >
          <NativeSelect
            id="subject-semester"
            {...subjectForm.register("semester", {
              onChange: () => subjectForm.setValue("name", ""),
            })}
          >
            {courseSemesters.map((item) => (
              <option key={item} value={item}>
                Semester {item}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Subject code"
          htmlFor="subject-code"
          required
          error={subjectForm.formState.errors.code?.message}
        >
          <Input id="subject-code" {...subjectForm.register("code")} />
        </FormField>
        <FormField
          label="Subject name"
          htmlFor="subject-name"
          required
          error={subjectForm.formState.errors.name?.message}
        >
          <NativeSelect id="subject-name" {...subjectForm.register("name")}>
            <option value="">Select</option>
            {subjectNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Credits"
          htmlFor="subject-credits"
          required
          error={subjectForm.formState.errors.credits?.message}
        >
          <Input id="subject-credits" {...subjectForm.register("credits")} />
        </FormField>
        <FormField
          label="Syllabus"
          htmlFor="subject-syllabus"
          required
          error={syllabusMessage ?? undefined}
        >
          <FileUpload
            id="subject-syllabus"
            acceptRule="document"
            value={syllabus}
            onChange={setSyllabus}
          />
        </FormField>
        <div className="sm:col-span-2">
          <Button type="submit" variant="gold">
            Add subject
          </Button>
        </div>
      </form>
    </section>
  );
}
