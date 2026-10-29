"use client";

import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { PaymentInstructions } from "@/components/forms/PaymentInstructions";
import {
  DeskModal,
  DeskPage,
  DeskSection,
  DeskTable,
  DeskTabs,
  FormDialog,
  GateBanner,
  ManageCard,
  OpenSwitch,
  PageTitle,
  ProcessFlow,
  ScholarIdentityHeader,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { ProfileCell, profileColumnHeading } from "@/components/portal/ProfileCell";
import { NptelApprovals, ScholarNptel } from "@/components/portal/NptelPanel";
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
  subjectSchoolLabel,
} from "@/data/doctoral";
import { schools } from "@/data/schools";
import { researchRegister, type ResearchBatch } from "@/data/research-register";
import { scholarSchoolName } from "@/lib/admission";
import { useFees } from "@/lib/fee-settings";
import { paymentModes } from "@/lib/constants";
import { clientToday, formatIsoDate, isOnOrBefore, isValidIsoDate } from "@/lib/dates";
import { fileError, type StoredFile } from "@/lib/files";
import { batchOf, scholarBySignIn } from "@/lib/register";
import {
  batchSemesterFloor,
  courseCatalogFor,
  currentDoctoral,
  forwardToCoe,
  nptelOf,
  nptelUsed,
  paperOf,
  paperStandings,
  registerCoursePapers,
  resultFor,
  saveCourseWindow,
  approveSubject,
  removeSubject,
  saveSubject,
  subscribeDoctoral,
  type CourseSubject,
  type CourseWindow,
  type DoctoralState,
} from "@/lib/doctoral";
import { currentExam, subscribeExam } from "@/lib/exam-office";
import { usePortalSession } from "@/lib/use-preview-session";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { formatInr } from "@/lib/utils";
import { allBatches } from "@/lib/batches";
import { storeFile } from "@/lib/file-store";
import { inputRules, masked } from "@/lib/input-rules";

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

const paymentSchema = z.object({
  paymentMode: z.enum(paymentModes),
  paymentReference: z.string().trim().min(3, "Enter the payment reference.").max(80),
  paymentDate: z
    .string()
    .refine(
      (value) => isValidIsoDate(value) && isOnOrBefore(value, clientToday()),
      "Enter the payment date.",
    ),
});

type WindowValues = z.infer<typeof windowSchema>;
type CatalogValues = z.infer<typeof subjectCatalogSchema>;
type PaymentValues = z.infer<typeof paymentSchema>;

function batchLabel(batchId: string) {
  return (
    batchOf(batchId)?.name ??
    allBatches().find((batch) => batch.id === batchId)?.name ??
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

function BatchWindowDialog({
  batch,
  window,
  floor,
  onNotice,
  onClose,
}: {
  batch: ResearchBatch;
  window: CourseWindow | undefined;
  floor: number;
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const form = useForm<WindowValues>({
    resolver: zodResolver(windowSchema) as Resolver<WindowValues>,
    defaultValues: {
      enabled: window?.enabled ?? false,
      semester: String(
        Math.min(Math.max(window?.semester || 1, floor, 1), 4),
      ) as WindowValues["semester"],
      lastDate: window?.lastDate ?? "",
    },
  });
  const enabled = useWatch({ control: form.control, name: "enabled" });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: WindowValues) {
    const saved = await saveCourseWindow({
      batchId: batch.id,
      enabled: values.enabled,
      semester: Number(values.semester),
      lastDate: values.lastDate,
    });
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onNotice(`${batch.name} registration is ${values.enabled ? "open" : "closed"}.`);
    onClose();
  }

  return (
    <FormDialog
      title={`Course registration · ${batch.name}`}
      onClose={onClose}
      onSubmit={form.handleSubmit(onSubmit)}
      busy={form.formState.isSubmitting}
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <OpenSwitch
        label="Registration"
        checked={Boolean(enabled)}
        onChange={(value) => form.setValue("enabled", value, { shouldDirty: true })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Semester"
          htmlFor={`semester-${batch.id}`}
          required
          error={form.formState.errors.semester?.message}
        >
          <NativeSelect id={`semester-${batch.id}`} {...form.register("semester")}>
            {courseSemesters.map((semester) => (
              <option key={semester} value={semester} disabled={Number(semester) < floor}>
                Semester {semester}
                {Number(semester) < floor ? " (closed)" : ""}
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
      </div>
    </FormDialog>
  );
}

function RegistrationForm({
  identifier,
  name,
  batchId,
  semester,
  slots,
  catalog,
  arrears,
  onDone,
  onClose,
}: {
  identifier: string;
  name: string;
  batchId: string;
  semester: 1 | 2 | 3 | 4;
  slots: number;
  catalog: { code: string; name: string }[];
  arrears: { code: string; name: string; semester: number; outcome: string }[];
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentValues>,
    defaultValues: { paymentMode: "UPI", paymentReference: "", paymentDate: "" },
  });
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<StoredFile | null>(null);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The campuses where the examination is written are set up by the research office.
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const centres = exam?.settings.centres ?? [];
  const [centreId, setCentreId] = useState("");
  const arrearCodes = new Set(arrears.map((paper) => paper.code));
  const freshPicked = picked.filter((code) => !arrearCodes.has(code));
  const markSheetFee = useFees().markSheet;
  const papersFee = picked.length * courseWorkFee;
  const total = picked.length > 0 ? papersFee + markSheetFee : 0;
  const matches = (paper: { code: string; name: string }) =>
    textMatches(query, [paper.code, paper.name]);
  const shownCatalog = catalog.filter(matches);
  const shownArrears = arrears.filter(matches);

  function toggle(code: string, arrear: boolean) {
    setError(null);
    setPicked((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      if (!arrear && freshPicked.length >= slots) {
        setError(`You can register ${slots} new paper(s) this semester.`);
        return current;
      }
      return [...current, code];
    });
  }

  async function onSubmit(values: PaymentValues) {
    if (picked.length === 0) {
      setError("Select at least one subject.");
      return;
    }
    if (centres.length > 0 && !centreId) {
      setError("Choose the campus where you will write the examination.");
      return;
    }
    if (!receipt?.file) {
      setReceiptMessage("Upload the payment receipt.");
      return;
    }
    const problem = fileError(receipt.file, "pdfDocument", true);
    setReceiptMessage(problem);
    if (problem) return;
    const receiptData = await storeFile(receipt.file, "receipts").catch(() => "");
    if (!receiptData) {
      setReceiptMessage("The receipt could not be read.");
      return;
    }
    setBusy(true);
    const all = [...catalog, ...arrears];
    const saved = await registerCoursePapers({
      scholarIdentifier: identifier,
      scholarName: name,
      batchId,
      semester,
      subjects: picked.map((code) => ({
        code,
        name: all.find((paper) => paper.code === code)?.name ?? "",
      })),
      paymentMode: values.paymentMode,
      paymentReference: values.paymentReference,
      paymentDate: values.paymentDate,
      receiptName: receipt.file.name,
      receiptData,
      examCentreId: centreId,
    });
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onDone(
      `Registration for ${picked.length} paper(s) submitted. The research office verifies the fee and forwards it to the Controller of Examinations.`,
    );
    onClose();
  }

  const paperRow = (
    paper: { code: string; name: string },
    arrear: boolean,
    note?: string,
  ) => {
    const on = picked.includes(paper.code);
    return (
      <li key={`${arrear ? "a" : "n"}-${paper.code}`}>
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
            on ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
          }`}
        >
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={on}
            onChange={() => toggle(paper.code, arrear)}
          />
          <span className="w-24 shrink-0 font-mono text-xs font-semibold text-primary">
            {paper.code}
          </span>
          <span className="min-w-0 flex-1">{paper.name}</span>
          {note ? <Badge variant="maroon">{note}</Badge> : null}
          <span className="shrink-0 text-xs text-muted-foreground">
            ₹{formatInr(courseWorkFee)}
          </span>
        </label>
      </li>
    );
  };

  return (
    <FormDialog
      title={`Course-work registration · Semester ${semester}`}
      onClose={onClose}
      onSubmit={form.handleSubmit(onSubmit)}
      busy={busy}
      submitLabel="Submit registration"
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <div className="space-y-3">
        <Input
          placeholder="Search by subject code or name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search subjects"
        />
        {slots > 0 && semester <= 2 ? (
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {semester === 1
                ? "Papers 1 and 2 · common to all scholars"
                : "Papers 3 and 4 · major and allied"}{" "}
              · choose up to {slots}
            </p>
            {shownCatalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subject matches.</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {shownCatalog.map((paper) => paperRow(paper, false))}
              </ul>
            )}
          </div>
        ) : null}
        {arrears.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-[0.14em] text-secondary uppercase">
              Arrear papers · register again
            </p>
            <ul className="space-y-1.5">
              {shownArrears.map((paper) =>
                paperRow(paper, true, paper.outcome === "AAA" ? "Absent" : "RA"),
              )}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm font-semibold text-primary">
        {picked.length} paper(s) × ₹{formatInr(courseWorkFee)} = ₹{formatInr(papersFee)}
        {picked.length > 0
          ? `, plus mark sheet fee ₹${formatInr(markSheetFee)} = ₹${formatInr(total)}`
          : ""}
      </p>
      {centres.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <FormField
            label="Campus where you will write the examination"
            htmlFor="exam-centre"
            required
          >
            <NativeSelect
              id="exam-centre"
              value={centreId}
              onChange={(event) => setCentreId(event.target.value)}
            >
              <option value="">Choose a campus</option>
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <p className="mt-2 text-xs text-muted-foreground">
            Your hall ticket is issued for this campus once Accounts approves the fee.
          </p>
        </div>
      ) : null}
      <PaymentInstructions amount={total} purpose="Course-work fee" />
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-primary sm:col-span-2">Payment details</h3>
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
            acceptRule="pdfDocument"
            value={receipt}
            onChange={setReceipt}
          />
        </FormField>
      </div>
    </FormDialog>
  );
}

const courseTabs = [
  { id: "papers", label: "My papers & results" },
  { id: "new", label: "New course-work enrolment" },
  { id: "history", label: "Enrolment submitted history" },
  { id: "nptel", label: "NPTEL courses" },
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
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const asked = useSearchParams().get("tab");
  const [tab, setTab] = useState<(typeof courseTabs)[number]["id"]>(
    asked === "nptel" ? "nptel" : "papers",
  );
  const [viewKey, setViewKey] = useState<string | null>(null);
  const groups = enrollmentGroups(doctoral, identifier);
  const viewing = groups.find((item) => item.key === viewKey) ?? null;
  const mine = groups.flatMap((item) => item.papers);
  const open = window?.enabled ? window.semester : 0;
  const standings = paperStandings(doctoral, identifier);
  const arrears = standings
    .filter((paper) => paper.status === "Arrear")
    .map((paper) => ({
      code: paper.code,
      name: paper.name,
      semester: paper.semester,
      outcome: paper.outcome ?? "RA",
    }));
  const arrear = arrears.length > 0;
  const taken = mine.filter(
    (item) => item.semester === open && !item.arrear && item.paymentStatus !== "Returned",
  ).length;
  // Each NPTEL course (not turned down) takes one of the semester's two papers.
  const nptelHere = open > 0 ? nptelUsed(doctoral, identifier, open) : 0;
  const nptelCleared = nptelOf(doctoral, identifier).filter(
    (item) => item.approval === "Approved",
  ).length;
  const slots = open > 2 ? 0 : Math.max(0, 2 - taken - nptelHere);
  const closed = !window?.enabled || !window.lastDate || window.lastDate < clientToday();
  const blockedSemester = open > 2 && !arrear;
  const school = scholarSchoolName(identifier);
  const catalog = courseCatalogFor(doctoral, {
    identifier,
    semester: open,
    batchId: batch?.id ?? "",
  })
    .map((subject) => ({ code: subject.code, name: subject.name }))
    .filter(
      (subject) =>
        !standings.some(
          (paper) =>
            paper.code.trim().toLowerCase() === subject.code.trim().toLowerCase(),
        ),
    );
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
      {tab === "papers" ? (
        <DeskSection title="My course-work papers">
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-primary">
                {standings.filter((paper) => paper.status === "Passed").length +
                  nptelCleared}{" "}
                of 4 papers cleared
                {nptelCleared > 0 ? ` (${nptelCleared} by NPTEL)` : ""}
              </p>
              <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{
                    width: `${Math.min((standings.filter((paper) => paper.status === "Passed").length + nptelCleared) / 4, 1) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <DeskTable
            headers={["Subject code", "Subject", "Semester", "Attempts", "COE", "Status"]}
            empty={standings.length === 0}
          >
            {standings.map((paper) => {
              const latest = mine
                .filter(
                  (item) =>
                    item.code.trim().toLowerCase() === paper.code.trim().toLowerCase(),
                )
                .sort((a, b) =>
                  (b.paymentDate || "").localeCompare(a.paymentDate || ""),
                )[0];
              return (
                <tr key={paper.code} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    {paper.code}
                  </td>
                  <td className="px-4 py-3">{paper.name}</td>
                  <td className="px-4 py-3">{paper.semester}</td>
                  <td className="px-4 py-3">{paper.attempts}</td>
                  <td className="px-4 py-3">
                    {latest?.coeStatus ? (
                      <Badge variant="purple">Forwarded</Badge>
                    ) : latest?.paymentStatus === "Approved" ? (
                      <Badge variant="outline">Fee verified</Badge>
                    ) : (
                      <Badge variant="outline">
                        Fee {latest?.paymentStatus ?? "pending"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {paper.status === "Passed" ? (
                      <Badge variant="gold">Pass</Badge>
                    ) : paper.status === "Arrear" ? (
                      <Badge variant="maroon">
                        Arrear · {paper.outcome === "AAA" ? "Absent" : paper.outcome}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Awaiting result</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </DeskTable>
        </DeskSection>
      ) : null}
      {tab === "nptel" ? (
        <ScholarNptel
          doctoral={doctoral}
          identifier={identifier}
          scholarName={scholarName}
        />
      ) : null}
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
            {batch && window && !closed && !blockedSemester && slots === 0 && !arrear ? (
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
            catalog.length === 0 &&
            !arrear ? (
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
            ((slots > 0 && catalog.length > 0) || arrear) ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Semester {open} registration is open.
                </p>
                <Button type="button" variant="gold" onClick={() => setRegistering(true)}>
                  Register papers
                </Button>
              </div>
            ) : null}
            {registering && batch ? (
              <RegistrationForm
                identifier={identifier}
                name={scholarName}
                batchId={batch.id}
                semester={open as 1 | 2 | 3 | 4}
                slots={slots}
                catalog={catalog}
                arrears={arrears}
                onDone={setNotice}
                onClose={() => setRegistering(false)}
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

export function CourseWorkScreen({
  mode,
  view = "work",
}: {
  mode: "admin" | "scholar";
  /** Office: "windows" is the registration windows menu; "work" is registrations, arrears and subjects. */
  view?: "windows" | "work";
}) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [syllabus, setSyllabus] = useState<StoredFile | null>(null);
  const [syllabusMessage, setSyllabusMessage] = useState<string | null>(null);
  const [chosenTab, setTab] = useState<
    "registrations" | "arrears" | "subjects" | "nptel"
  >("registrations");
  const tab = view === "windows" ? "windows" : chosenTab;
  const [coeFilter, setCoeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [windowBatch, setWindowBatch] = useState<string | null>(null);
  const [addingSubject, setAddingSubject] = useState(false);
  const canApproveSubjects = session?.role === "admin" || session?.role === "dean";
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
  const profile = useScholarProfiles();

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
    ...allBatches().map((batch) => ({ id: batch.id, name: batch.name })),
    ...doctoral.batches
      .filter((batch) => !allBatches().some((item) => item.id === batch.id))
      .map((batch) => ({ id: batch.id, name: batch.name })),
  ];
  const registrations = doctoral.registrations.filter((row) => {
    const paper = paperOf(doctoral, row);
    return (
      profile.matches(row.scholarIdentifier) &&
      filterMatches(batchFilter, row.batchId) &&
      filterMatches(semesterFilter, String(row.semester)) &&
      filterMatches(coeFilter, row.coeStatus || "Not forwarded") &&
      filterMatches(paymentFilter, row.paymentStatus) &&
      textMatches(query, [
        row.scholarName,
        paper.code,
        paper.name,
        row.paymentReference,
        batchLabel(row.batchId),
      ])
    );
  });

  const readyForCoe = registrations.filter(
    (row) => row.paymentStatus === "Approved" && !row.coeStatus,
  );
  const scholarIds = [
    ...new Set(doctoral.registrations.map((row) => row.scholarIdentifier)),
  ];
  const arrearRows = scholarIds.flatMap((identifier) => {
    const name =
      doctoral.registrations.find((row) => row.scholarIdentifier === identifier)
        ?.scholarName ?? identifier;
    const scholar = scholarBySignIn(identifier);
    return paperStandings(doctoral, identifier)
      .filter((paper) => paper.status === "Arrear")
      .map((paper) => ({
        identifier,
        scholarName: name,
        batch: scholar ? batchLabel(scholar.batchId) : "",
        registration: scholar?.registrationNumber || scholar?.fileNumber || identifier,
        code: paper.code,
        paperName: paper.name,
        semester: paper.semester,
        outcome: paper.outcome,
        attempts: paper.attempts,
      }));
  });
  const shownArrears = arrearRows.filter(
    (row) =>
      profile.matches(row.identifier) &&
      textMatches(query, [
        row.scholarName,
        row.code,
        row.paperName,
        row.batch,
        row.registration,
      ]),
  );

  async function forwardShown() {
    if (readyForCoe.length === 0) return;
    if (
      !window.confirm(
        `Forward ${readyForCoe.length} fee-verified registration(s) to the Controller of Examinations?`,
      )
    ) {
      return;
    }
    setForwarding(true);
    const saved = await forwardToCoe(readyForCoe.map((row) => row.id));
    setForwarding(false);
    setNotice(
      saved.ok
        ? `${readyForCoe.length} registration(s) forwarded to the COE. Download the list with Export.`
        : saved.message,
    );
  }

  async function addSubject(values: CatalogValues) {
    let syllabusName: string | null = null;
    let syllabusData: string | null = null;
    if (!syllabus?.file) {
      setSyllabusMessage("Upload the syllabus (PDF).");
      return;
    }
    const problem = fileError(syllabus.file, "pdfDocument", true);
    setSyllabusMessage(problem);
    if (problem) return;
    const data = await storeFile(syllabus.file, "documents").catch(() => "");
    if (!data) {
      setSyllabusMessage("That syllabus could not be read.");
      return;
    }
    syllabusName = syllabus.file.name;
    syllabusData = data;
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
    setNotice(
      saved.ok
        ? "Subject saved. It is offered to scholars after the Dean or the administrator approves it."
        : saved.message,
    );
    if (saved.ok) {
      setAddingSubject(false);
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
    <section className="space-y-6">
      <PageTitle
        kicker="Examination"
        title={view === "windows" ? "Registration windows" : "Course work registrations"}
        actions={
          view === "work" && tab === "subjects" ? (
            <Button
              type="button"
              variant="gold"
              onClick={() => {
                setNotice(null);
                setAddingSubject(true);
              }}
            >
              Add subject
            </Button>
          ) : null
        }
      />
      {doctoral.detail ? (
        <p className="text-sm text-secondary">{doctoral.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      {view === "work" ? (
        <DeskTabs
          tabs={[
            { id: "registrations", label: "Registrations & COE" },
            { id: "arrears", label: `Arrears (${arrearRows.length})` },
            { id: "subjects", label: "Subjects" },
            { id: "nptel", label: "NPTEL courses" },
          ]}
          value={tab}
          onChange={(id) => setTab(id as typeof chosenTab)}
        />
      ) : null}

      {tab === "windows" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allBatches().map((batch) => {
            const window = doctoral.windows.find((item) => item.batchId === batch.id);
            const floor = batchSemesterFloor(doctoral, batch.id);
            const open =
              Boolean(window?.enabled) &&
              Boolean(window?.lastDate) &&
              (window?.lastDate ?? "") >= clientToday();
            return (
              <ManageCard
                key={batch.id}
                eyebrow="Batch"
                title={batch.name}
                status={
                  open
                    ? { label: "Open", tone: "open" }
                    : { label: "Closed", tone: "closed" }
                }
                facts={[
                  {
                    label: "Scholars",
                    value: String(
                      researchRegister.scholars.filter(
                        (scholar) => scholar.batchId === batch.id,
                      ).length,
                    ),
                  },
                  { label: "Batch semester", value: floor ? `Semester ${floor}` : "—" },
                  {
                    label: "Window semester",
                    value: window?.semester ? `Semester ${window.semester}` : "—",
                  },
                  {
                    label: "Last date",
                    value:
                      window?.lastDate && isValidIsoDate(window.lastDate)
                        ? formatIsoDate(window.lastDate)
                        : "—",
                  },
                ]}
                onAction={() => setWindowBatch(batch.id)}
              />
            );
          })}
        </div>
      ) : null}
      {windowBatch
        ? (() => {
            const batch = allBatches().find((item) => item.id === windowBatch);
            if (!batch) return null;
            return (
              <BatchWindowDialog
                batch={batch}
                window={doctoral.windows.find((item) => item.batchId === batch.id)}
                floor={batchSemesterFloor(doctoral, batch.id)}
                onNotice={setNotice}
                onClose={() => setWindowBatch(null)}
              />
            );
          })()
        : null}

      {tab === "registrations" ? (
        <div>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "batch",
                label: "Batch",
                value: batchFilter,
                options: allBatches().map((batch) => ({
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
              {
                id: "payment",
                label: "Fee",
                value: paymentFilter,
                options: ["Pending", "Approved", "Returned"].map((value) => ({
                  value,
                  label: value === "Approved" ? "Verified" : value,
                })),
                onChange: setPaymentFilter,
              },
              {
                id: "coe",
                label: "COE",
                value: coeFilter,
                options: ["Forwarded", "Not forwarded"].map((value) => ({
                  value,
                  label: value,
                })),
                onChange: setCoeFilter,
              },
              ...profile.filters,
            ]}
            shown={registrations.length}
            total={doctoral.registrations.length}
            filename="course-registrations-coe.csv"
            title="Course-work registrations · Controller of Examinations"
            headers={[
              "Registration No.",
              "Scholar",
              "Batch",
              "Semester",
              "Subject code",
              "Subject",
              "Attempt",
              "Fee (₹)",
              "Fee status",
              "COE",
              "Forwarded on",
              "Result",
              ...profile.headers,
            ]}
            rows={registrations.map((row) => {
              const paper = paperOf(doctoral, row);
              const scholar = scholarBySignIn(row.scholarIdentifier);
              const result = resultFor(doctoral, row.id);
              return [
                scholar?.registrationNumber ||
                  scholar?.fileNumber ||
                  row.scholarIdentifier,
                row.scholarName,
                batchLabel(row.batchId),
                String(row.semester),
                paper.code,
                paper.name,
                row.arrear ? "Arrear" : "Regular",
                String(row.amount),
                row.paymentStatus === "Approved" ? "Verified" : row.paymentStatus,
                row.coeStatus || "Not forwarded",
                row.coeForwardedOn ? formatIsoDate(row.coeForwardedOn) : "",
                result ? (result.outcome === "AAA" ? "Absent" : result.outcome) : "",
                ...profile.cells(row.scholarIdentifier),
              ];
            })}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {readyForCoe.length} fee-verified registration(s) in this list are waiting
              to be forwarded to the Controller of Examinations.
            </p>
            <Button
              type="button"
              variant="gold"
              disabled={forwarding || readyForCoe.length === 0}
              onClick={() => void forwardShown()}
            >
              Forward to COE ({readyForCoe.length})
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Scholar</th>
                  <th className="px-4 py-3 font-semibold">{profileColumnHeading}</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Fee</th>
                  <th className="px-4 py-3 font-semibold">COE</th>
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
                      <td className="px-4 py-3">
                        <ProfileCell profile={profile.profileOf(row.scholarIdentifier)} />
                      </td>
                      <td className="px-4 py-3">{batchLabel(row.batchId)}</td>
                      <td className="px-4 py-3">
                        {paper.code} {paper.name}
                        {row.arrear ? (
                          <Badge variant="purple" className="ml-2">
                            Arrear
                          </Badge>
                        ) : null}
                        {result ? (
                          <Badge
                            variant={result.outcome === "Pass" ? "gold" : "maroon"}
                            className="ml-2"
                          >
                            {result.outcome === "AAA" ? "Absent" : result.outcome}
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
                        {row.coeStatus ? (
                          <Badge variant="gold">
                            Forwarded
                            {row.coeForwardedOn
                              ? ` · ${formatIsoDate(row.coeForwardedOn)}`
                              : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not forwarded</Badge>
                        )}
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
      ) : null}

      {tab === "nptel" ? <NptelApprovals doctoral={doctoral} /> : null}

      {tab === "arrears" ? (
        <div className="space-y-3">
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={profile.filters}
            shown={shownArrears.length}
            total={arrearRows.length}
            filename="course-work-arrears.csv"
            title="Course-work arrear list"
            headers={[
              "Registration No.",
              "Scholar",
              "Batch",
              "Subject code",
              "Subject",
              "Semester",
              "Last result",
              "Attempts",
              ...profile.headers,
            ]}
            rows={shownArrears.map((row) => [
              row.registration,
              row.scholarName,
              row.batch,
              row.code,
              row.paperName,
              String(row.semester),
              row.outcome === "AAA" ? "Absent" : (row.outcome ?? ""),
              String(row.attempts),
              ...profile.cells(row.identifier),
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  {[
                    "Scholar",
                    profileColumnHeading,
                    "Batch",
                    "Paper",
                    "Semester",
                    "Last result",
                    "Attempts",
                  ].map((header) => (
                    <th key={header} className="px-4 py-3 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownArrears.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                      No scholar has an arrear paper.
                    </td>
                  </tr>
                ) : (
                  shownArrears.map((row) => (
                    <tr
                      key={`${row.identifier}-${row.code}`}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-primary">{row.scholarName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.registration}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <ProfileCell profile={profile.profileOf(row.identifier)} />
                      </td>
                      <td className="px-4 py-3">{row.batch || "—"}</td>
                      <td className="px-4 py-3">
                        {row.code} · {row.paperName}
                      </td>
                      <td className="px-4 py-3">{row.semester}</td>
                      <td className="px-4 py-3">
                        <Badge variant="maroon">
                          {row.outcome === "AAA" ? "Absent" : (row.outcome ?? "—")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{row.attempts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "subjects" ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-card">
          {doctoral.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subjects listed yet.</p>
          ) : (
            subjectsBySchool(doctoral.subjects).map((group) => (
              <div key={group.school} className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">{group.school}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Code</th>
                        <th className="py-2 pr-3 font-medium">Subject</th>
                        <th className="py-2 pr-3 font-medium">Semester</th>
                        <th className="py-2 pr-3 font-medium">Batch</th>
                        <th className="py-2 pr-3 font-medium">Syllabus</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.subjects.map((subject) => (
                        <tr key={subject.id} className="border-t border-border align-top">
                          <td className="py-2 pr-3">{subject.code}</td>
                          <td className="py-2 pr-3">{subject.name}</td>
                          <td className="py-2 pr-3">{subject.semester}</td>
                          <td className="py-2 pr-3">
                            {subject.batchId
                              ? batchLabel(subject.batchId)
                              : "All batches"}
                          </td>
                          <td className="py-2 pr-3">
                            <ViewFilesButton
                              fileName={subject.syllabusName}
                              data={subject.syllabusData}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            {subject.status === "Approved" ? (
                              <Badge variant="gold">
                                Approved
                                {subject.approvedBy ? ` · ${subject.approvedBy}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Waiting for approval</Badge>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              {subject.status !== "Approved" && canApproveSubjects ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="gold"
                                  onClick={() =>
                                    void approveSubject(subject.id).then((saved) =>
                                      setNotice(
                                        saved.ok
                                          ? `${subject.code} approved.`
                                          : saved.message,
                                      ),
                                    )
                                  }
                                >
                                  Approve
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!window.confirm(`Remove ${subject.code}?`)) return;
                                  void removeSubject(subject.id).then((saved) =>
                                    setNotice(
                                      saved.ok
                                        ? `${subject.code} removed.`
                                        : saved.message,
                                    ),
                                  );
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {addingSubject ? (
        <FormDialog
          title="Add a subject"
          onClose={() => setAddingSubject(false)}
          onSubmit={subjectForm.handleSubmit(addSubject)}
          busy={subjectForm.formState.isSubmitting}
          submitLabel="Add subject"
          size="lg"
        >
          {notice && !notice.startsWith("Subject saved") ? (
            <p role="alert" className="text-sm text-secondary">
              {notice}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
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
                    subjectForm.setValue(
                      "school",
                      value === "1" ? commonSchoolValue : "",
                    );
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
              label="Subject title"
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
              <Input
                id="subject-credits"
                {...masked(subjectForm.register("credits"), inputRules.decimal)}
              />
            </FormField>
            <FormField
              label="Subject in-charge"
              htmlFor="subject-incharge"
              error={subjectForm.formState.errors.inChargeName?.message}
            >
              <Input
                id="subject-incharge"
                {...masked(subjectForm.register("inChargeName"), inputRules.personName)}
              />
            </FormField>
            <FormField
              label="Designation"
              htmlFor="subject-designation"
              error={subjectForm.formState.errors.inChargeDesignation?.message}
            >
              <Input
                id="subject-designation"
                {...masked(
                  subjectForm.register("inChargeDesignation"),
                  inputRules.letters,
                )}
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
              label="Syllabus (PDF)"
              htmlFor="subject-syllabus"
              required
              error={syllabusMessage ?? undefined}
            >
              <FileUpload
                id="subject-syllabus"
                acceptRule="pdfDocument"
                value={syllabus}
                onChange={setSyllabus}
              />
            </FormField>
          </div>
        </FormDialog>
      ) : null}
    </section>
  );
}
