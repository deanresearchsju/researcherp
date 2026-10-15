"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskModal,
  DeskPage,
  DeskSection,
  DeskTable,
  DeskTabs,
  GateBanner,
  ProcessFlow,
  ScholarIdentityHeader,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { processFlows } from "@/data/portal-desk";
import {
  commonSchoolLabel,
  commonSchoolValue,
  courseSemesters,
  courseWorkFee,
  isCommonSchool,
  standardSubjects,
  subjectSchoolLabel,
} from "@/data/doctoral";
import { schools } from "@/data/schools";
import { researchRegister, type ResearchBatch } from "@/data/research-register";
import { scholarSchoolName } from "@/lib/admission";
import { paymentModes } from "@/lib/constants";
import { clientToday, formatIsoDate, isOnOrBefore, isValidIsoDate } from "@/lib/dates";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { batchOf, scholarBySignIn } from "@/lib/register";
import {
  courseCatalogFor,
  currentDoctoral,
  hasArrear,
  paperOf,
  registerCoursePapers,
  resultFor,
  saveCourseWindow,
  saveSubject,
  subscribeDoctoral,
  type CourseSubject,
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

const subjectCatalogSchema = z
  .object({
    batchId: z.string(),
    semester: z.enum(["1", "2", "3", "4"]),
    school: z.string().min(1, "Select the school."),
    code: z.string().trim().min(2, "Enter the subject code."),
    name: z.string().trim().min(2, "Enter the subject name."),
    credits: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^\d+(\.\d+)?$/.test(value),
        "Enter the credits.",
      ),
    inChargeName: z.string().trim(),
    inChargeDesignation: z.string().trim(),
    inChargeEmail: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || z.string().email().safeParse(value).success,
        "Enter an email address.",
      ),
  })
  .refine((row) => row.semester === "1" || !isCommonSchool(row.school), {
    path: ["school"],
    message: "Select the school.",
  });

const subjectRowSchema = z.object({
  code: z.string().trim().min(2, "Select the subject.").max(20),
  choice: z.string().min(1, "Select the subject."),
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

function subjectName(choice: string) {
  if (choice.startsWith("saved:"))
    return choice.slice("saved:".length).split(":::")[1] ?? "";
  return choice.trim();
}

function subjectsBySchool(subjects: readonly CourseSubject[]) {
  const groups = new Map<string, CourseSubject[]>();
  for (const subject of subjects) {
    const label = subjectSchoolLabel(subject.school);
    const rows = groups.get(label) ?? [];
    rows.push(subject);
    groups.set(label, rows);
  }
  const order = [commonSchoolLabel, ...schools.map((item) => item.name)];
  return [
    ...order
      .filter((label) => groups.has(label))
      .map((label) => ({
        school: label,
        subjects: groups.get(label) ?? [],
      })),
    ...[...groups.entries()]
      .filter(([label]) => !order.includes(label))
      .map(([school, rows]) => ({ school, subjects: rows })),
  ];
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
      subjects: [{ code: "", choice: "" }],
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
        name: subjectName(row.choice),
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
      <p className="text-sm text-muted-foreground">
        {semester === 1
          ? "Semester 1 has two papers common to all schools. Select from the list."
          : "Select the papers listed for your school."}
      </p>
      {subjects.fields.map((field, index) => {
        return (
          <div
            key={field.id}
            className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
          >
            <FormField
              label="Subject"
              htmlFor={`subject-${index}`}
              required
              className="sm:col-span-2"
              error={
                form.formState.errors.subjects?.[index]?.choice?.message ??
                form.formState.errors.subjects?.[index]?.code?.message
              }
            >
              <NativeSelect
                id={`subject-${index}`}
                {...form.register(`subjects.${index}.choice`, {
                  onChange: (event) => {
                    const value = event.target.value;
                    if (!value.startsWith("saved:")) {
                      form.setValue(`subjects.${index}.code`, "");
                      return;
                    }
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
              </NativeSelect>
            </FormField>
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
          onClick={() => subjects.append({ code: "", choice: "" })}
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

const courseTabs = [
  { id: "new", label: "New course-work enrolment" },
  { id: "history", label: "Enrolment submitted history" },
  { id: "incharge", label: "Subject in-charge details" },
] as const;

function enrollmentGroups(doctoral: DoctoralState, identifier: string) {
  const mine = doctoral.registrations.filter(
    (item) => item.scholarIdentifier.toLowerCase() === identifier.toLowerCase(),
  );
  const map = new Map<string, typeof mine>();
  for (const row of mine) {
    const key = `${row.semester}|${row.paymentDate || "pending"}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].flatMap(([key, papers]) => {
    const first = papers[0];
    if (!first) return [];
    const [semester] = key.split("|");
    const paymentStatus = first.paymentStatus;
    const status =
      paymentStatus === "Approved"
        ? ("Approved" as const)
        : paymentStatus === "Returned"
          ? ("Returned" as const)
          : ("Pending" as const);
    const batch = batchOf(first.batchId);
    return [
      {
        key,
        semester: Number(semester) || first.semester,
        monthYear: batch?.name ?? `Semester ${semester}`,
        submittedOn: first.paymentDate,
        status,
        papers,
      },
    ];
  });
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
  const [tab, setTab] = useState<(typeof courseTabs)[number]["id"]>("history");
  const [viewKey, setViewKey] = useState<string | null>(null);
  const groups = enrollmentGroups(doctoral, identifier);
  const viewing = groups.find((item) => item.key === viewKey) ?? null;
  const mine = groups.flatMap((item) => item.papers);
  const open = window?.enabled ? window.semester : 0;
  const arrear = hasArrear(doctoral, identifier);
  const taken = mine.filter((item) => item.semester === open).length;
  const slots = Math.max(0, 2 - taken);
  const closed = !window?.enabled || !window.lastDate || window.lastDate < clientToday();
  const blockedSemester = open > 2 && !arrear;
  const school = scholarSchoolName(identifier);
  const catalog = courseCatalogFor(doctoral, {
    identifier,
    semester: open,
    batchId: batch?.id ?? "",
  }).map((subject) => ({ code: subject.code, name: subject.name }));
  const approved = mine;
  const completed = mine.filter(
    (item) => resultFor(doctoral, item.id)?.outcome === "Pass",
  );
  const current = mine.filter((item) => item.semester === (open || viewing?.semester));

  return (
    <DeskPage title="Course work">
      <ProcessFlow>{processFlows.courseWork}</ProcessFlow>
      {doctoral.detail ? (
        <p className="text-sm text-secondary">{doctoral.detail}</p>
      ) : null}
      <ScholarIdentityHeader identifier={identifier} />
      <DeskTabs
        tabs={courseTabs}
        value={tab}
        onChange={(id) => setTab(id as (typeof courseTabs)[number]["id"])}
      />
      {tab === "new" ? (
        <DeskSection title="New course-work enrolment">
          <div className="space-y-4 p-4">
            {!scholar || !batch ? (
              <GateBanner>
                Course-work registration opens for scholars on a research batch.
              </GateBanner>
            ) : (
              <p className="text-sm text-muted-foreground">
                {batch.name}. {windowSummary(window)}
              </p>
            )}
            {batch && window && !closed && blockedSemester ? (
              <GateBanner>
                Semester {open} is open for scholars who have an arrear.
              </GateBanner>
            ) : null}
            {batch && window && !closed && !blockedSemester && slots === 0 ? (
              <GateBanner>
                Two papers are already registered for this semester.
              </GateBanner>
            ) : null}
            {closed ? (
              <GateBanner>Registration is closed for the current window.</GateBanner>
            ) : null}
            {batch &&
            window &&
            !closed &&
            !blockedSemester &&
            slots > 0 &&
            catalog.length === 0 ? (
              <GateBanner>
                {open === 1
                  ? "Semester 1 common papers are not listed yet."
                  : school
                    ? `Subjects for ${school} are not listed yet.`
                    : "Your school is not on the admission file yet."}
              </GateBanner>
            ) : null}
            {batch &&
            window &&
            !closed &&
            !blockedSemester &&
            slots > 0 &&
            catalog.length > 0 ? (
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
          </div>
        </DeskSection>
      ) : null}
      {tab === "history" ? (
        <DeskSection title="Enrolment submitted history">
          <DeskTable
            headers={["Enrolment month & year", "Submitted on", "Payment", ""]}
            empty={groups.length === 0}
          >
            {groups.map((group) => (
              <tr key={group.key} className="border-t border-border">
                <td className="px-4 py-3">{group.monthYear}</td>
                <td className="px-4 py-3">
                  {group.submittedOn ? formatIsoDate(group.submittedOn) : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={group.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <ViewFilesButton
                      fileName={group.papers[0]?.receiptName}
                      data={group.papers[0]?.receiptData}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setViewKey(group.key)}
                    >
                      View
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}
      {tab === "incharge" ? (
        <DeskSection title="Current subject in-charge">
          <div className="p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              {batch?.name ?? "Enrolment month"} · {windowSummary(window)}
            </p>
          </div>
          <DeskTable
            headers={["Course code", "Course name", "Credit", "Subject in-charge"]}
            empty={mine.length === 0}
          >
            {mine.map((item) => {
              const paper = paperOf(doctoral, item);
              return (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">{paper.code || "—"}</td>
                  <td className="px-4 py-3">{paper.name || "—"}</td>
                  <td className="px-4 py-3">{paper.credits || "—"}</td>
                  <td className="px-4 py-3">
                    {paper.inChargeName ? (
                      <div>
                        <p className="font-semibold text-primary">{paper.inChargeName}</p>
                        {paper.inChargeDesignation ? (
                          <p className="text-muted-foreground">
                            {paper.inChargeDesignation}
                          </p>
                        ) : null}
                        {paper.inChargeEmail ? (
                          <p className="text-muted-foreground">{paper.inChargeEmail}</p>
                        ) : null}
                        <div className="mt-2">
                          <ViewFilesButton
                            fileName={paper.syllabusName}
                            data={paper.syllabusData}
                          />
                        </div>
                      </div>
                    ) : (
                      <ViewFilesButton
                        fileName={paper.syllabusName}
                        data={paper.syllabusData}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </DeskTable>
        </DeskSection>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {viewing ? (
        <DeskModal title="Course work details" onClose={() => setViewKey(null)}>
          <ScholarIdentityHeader identifier={identifier} />
          <DeskSection title="Course(s) approved by doctoral committee">
            <DeskTable
              headers={["Course code", "Course name", "Credits", "Exempted"]}
              empty={approved.length === 0}
            >
              {approved.map((item) => {
                const paper = paperOf(doctoral, item);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">{paper.code || "—"}</td>
                    <td className="px-4 py-3">{paper.name || "—"}</td>
                    <td className="px-4 py-3">{paper.credits || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">No</Badge>
                    </td>
                  </tr>
                );
              })}
            </DeskTable>
          </DeskSection>
          <DeskSection title="Course(s) already taken / completed">
            <DeskTable
              headers={[
                "Course code",
                "Course name",
                "Credit",
                "Course completion status",
                "Grade",
                "Month & year of passing",
              ]}
              empty={completed.length === 0}
            >
              {completed.map((item) => {
                const paper = paperOf(doctoral, item);
                const result = resultFor(doctoral, item.id);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">{paper.code || "—"}</td>
                    <td className="px-4 py-3">{paper.name || "—"}</td>
                    <td className="px-4 py-3">{paper.credits || "—"}</td>
                    <td className="px-4 py-3">Completed</td>
                    <td className="px-4 py-3">{result?.outcome ?? "—"}</td>
                    <td className="px-4 py-3">
                      {result?.publishedOn ? formatIsoDate(result.publishedOn) : "—"}
                    </td>
                  </tr>
                );
              })}
            </DeskTable>
          </DeskSection>
          {viewing.papers[0]?.receiptName ? (
            <DeskSection title="Payment receipt">
              <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span>{viewing.papers[0].receiptName}</span>
                <ViewFilesButton
                  fileName={viewing.papers[0].receiptName}
                  data={viewing.papers[0].receiptData}
                />
              </div>
            </DeskSection>
          ) : null}
          <DeskSection title="Course(s) taken up for the current semester">
            <DeskTable
              headers={["Course code", "Course name", "Course type", "Credits"]}
              empty={current.length === 0}
            >
              {current.map((item) => {
                const paper = paperOf(doctoral, item);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">{paper.code || "—"}</td>
                    <td className="px-4 py-3">{paper.name || "—"}</td>
                    <td className="px-4 py-3">Regular</td>
                    <td className="px-4 py-3">{paper.credits || "—"}</td>
                  </tr>
                );
              })}
            </DeskTable>
          </DeskSection>
        </DeskModal>
      ) : null}
    </DeskPage>
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
    defaultValues: {
      batchId: "",
      semester: "1",
      school: commonSchoolValue,
      code: "",
      name: "",
      credits: "",
      inChargeName: "",
      inChargeDesignation: "",
      inChargeEmail: "",
    },
  });
  const semester = useWatch({ control: subjectForm.control, name: "semester" });
  const commonNames = standardSubjects[1];

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
    let syllabusName: string | null = null;
    let syllabusData: string | null = null;
    if (syllabus?.file) {
      const problem = fileError(syllabus.file, "document", true);
      setSyllabusMessage(problem);
      if (problem) return;
      const data = await fileToDataUrl(syllabus.file).catch(() => "");
      if (!data) {
        setSyllabusMessage("That syllabus could not be read.");
        return;
      }
      syllabusName = syllabus.file.name;
      syllabusData = data;
    } else {
      setSyllabusMessage(null);
    }
    const saved = await saveSubject({
      batchId: values.batchId,
      semester: Number(values.semester),
      school: values.school,
      code: values.code,
      name: values.name,
      credits: values.credits,
      inChargeName: values.inChargeName,
      inChargeDesignation: values.inChargeDesignation,
      inChargeEmail: values.inChargeEmail,
      syllabusName,
      syllabusData,
    });
    setNotice(saved.ok ? "Subject saved." : saved.message);
    if (saved.ok) {
      subjectForm.reset({
        batchId: "",
        semester: values.semester,
        school: values.semester === "1" ? commonSchoolValue : "",
        code: "",
        name: "",
        credits: "",
        inChargeName: "",
        inChargeDesignation: "",
        inChargeEmail: "",
      });
      setSyllabus(null);
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-heading text-4xl text-primary">Course work</h1>
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
            "payment status",
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
              row.paymentStatus,
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
                <th className="px-4 py-3 font-semibold">Status</th>
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
                          variant={result.outcome === "Pass" ? "gold" : "maroon"}
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
                      <StatusPill status={row.paymentStatus ?? "Pending"} />
                    </td>
                    <td className="px-4 py-3">
                      {row.receiptName ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.receiptName}</span>
                          <ViewFilesButton
                            fileName={row.receiptName}
                            data={row.receiptData}
                          />
                        </div>
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

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-primary">Subjects by school</h2>
        {doctoral.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects listed yet.</p>
        ) : (
          subjectsBySchool(doctoral.subjects).map((group) => (
            <div key={group.school} className="space-y-2">
              <h3 className="text-sm font-semibold text-primary">{group.school}</h3>
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Semester</th>
                    <th className="py-2 font-medium">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {group.subjects.map((subject) => (
                    <tr key={subject.id} className="border-t border-border">
                      <td className="py-2 pr-3">{subject.code}</td>
                      <td className="py-2 pr-3">{subject.name}</td>
                      <td className="py-2 pr-3">{subject.semester}</td>
                      <td className="py-2">
                        {subject.batchId ? batchLabel(subject.batchId) : "All batches"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      <form
        className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
        onSubmit={subjectForm.handleSubmit(addSubject)}
        noValidate
      >
        <h2 className="font-semibold text-primary sm:col-span-2">Add a subject</h2>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          {semester === "1"
            ? `Semester 1 papers are common to all schools: ${commonNames.join(" and ")}.`
            : "Semester 2 papers vary by school. Scholars see only the list for their school."}
        </p>
        <FormField
          label="School"
          htmlFor="subject-school"
          required
          error={subjectForm.formState.errors.school?.message}
        >
          <NativeSelect id="subject-school" {...subjectForm.register("school")}>
            {semester === "1" ? (
              <option value={commonSchoolValue}>{commonSchoolLabel}</option>
            ) : (
              <>
                <option value="">Select</option>
                {schools.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </>
            )}
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
              onChange: (event) => {
                const value = event.target.value;
                subjectForm.setValue("school", value === "1" ? commonSchoolValue : "");
              },
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
          <Input id="subject-name" {...subjectForm.register("name")} />
        </FormField>
        <FormField
          label="Batch"
          htmlFor="subject-batch"
          error={subjectForm.formState.errors.batchId?.message}
        >
          <NativeSelect id="subject-batch" {...subjectForm.register("batchId")}>
            <option value="">All batches</option>
            {batchOptions.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Credits"
          htmlFor="subject-credits"
          error={subjectForm.formState.errors.credits?.message}
        >
          <Input id="subject-credits" {...subjectForm.register("credits")} />
        </FormField>
        <FormField
          label="Subject in-charge"
          htmlFor="subject-incharge"
          error={subjectForm.formState.errors.inChargeName?.message}
        >
          <Input id="subject-incharge" {...subjectForm.register("inChargeName")} />
        </FormField>
        <FormField
          label="Designation"
          htmlFor="subject-designation"
          error={subjectForm.formState.errors.inChargeDesignation?.message}
        >
          <Input
            id="subject-designation"
            {...subjectForm.register("inChargeDesignation")}
          />
        </FormField>
        <FormField
          label="In-charge email"
          htmlFor="subject-email"
          error={subjectForm.formState.errors.inChargeEmail?.message}
        >
          <Input id="subject-email" {...subjectForm.register("inChargeEmail")} />
        </FormField>
        <FormField
          label="Syllabus"
          htmlFor="subject-syllabus"
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
