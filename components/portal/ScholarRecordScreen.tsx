"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";

import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskModal,
  DeskPage,
  DeskSection,
  DeskTable,
  FormDialog,
  GateBanner,
  ProcessFlow,
  ScholarIdentityHeader,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { processFlows } from "@/data/portal-desk";
import { portalModules } from "@/data/portal";
import type { ScholarRecordKind, ScholarRecordMenu } from "@/data/scholar-records";
import {
  approvalChain,
  currentApprovalRules,
  mayAct,
  nextStage,
  stageApplies,
  stageNames,
  subscribeApprovalRules,
} from "@/lib/approval-rules";
import { formatIsoDate } from "@/lib/dates";
import { fileError, type StoredFile } from "@/lib/files";
import {
  currentScholarRecords,
  loadRecordFile,
  recordSchema,
  saveScholarRecord,
  scholarRecordMigrationHint,
  setScholarRecordStatus,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import {
  allocationFor,
  currentOffice,
  saveAllocation,
  subscribeOffice,
} from "@/lib/office";
import {
  currentQuotas,
  currentStandings,
  personalDetailsFromRegister,
  scholarBySignIn,
  supervisorForGuide,
} from "@/lib/register";
import { guideOptions } from "@/lib/supervision";
import { currentPortalUsers } from "@/lib/users";
import { usePortalSession } from "@/lib/use-preview-session";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { ProfileCell, profileColumnHeading } from "@/components/portal/ProfileCell";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { researchTitleOf, titleRuleText } from "@/lib/research-title";
import { storeFile } from "@/lib/file-store";
import { ApprovalBadge, ApprovalTrail } from "@/components/portal/ApprovalTrail";
import { recordStages, recordSummary } from "@/lib/approval-flow";
import { recordViewStamp } from "@/lib/approved-documents";
import { inputRules, masked, type InputRule } from "@/lib/input-rules";

/** What each field of a record may hold: names take letters, numbers take digits, and so on. */
const recordRules: Record<string, InputRule> = {
  fullName: inputRules.personName,
  nameOnCard: inputRules.personName,
  fatherName: inputRules.personName,
  motherName: inputRules.personName,
  correspondingAuthor: inputRules.personName,
  authors: inputRules.names,
  nationality: inputRules.letters,
  district: inputRules.letters,
  state: inputRules.letters,
  community: inputRules.letters,
  pincode: inputRules.pin,
  mobile: inputRules.mobile,
  parentContact: inputRules.mobile,
  abcId: inputRules.reference,
  transactionNumber: inputRules.reference,
  amount: inputRules.decimal,
  year: inputRules.year,
  pageFrom: inputRules.pages,
  pageTo: inputRules.pages,
  volume: inputRules.reference,
  issue: inputRules.reference,
  issn: inputRules.issn,
  eissn: inputRules.issn,
  impactFactor: inputRules.decimal,
  webUrl: inputRules.url,
  doi: inputRules.doi,
};

function recordRule(field: { name: string; kind: string }): InputRule | null {
  if (recordRules[field.name]) return recordRules[field.name];
  if (field.kind === "tel") return inputRules.mobile;
  if (field.kind === "amount") return inputRules.decimal;
  if (field.kind === "email") return inputRules.email;
  return null;
}

function flowFor(kind: ScholarRecordKind) {
  if (kind === "publication") return processFlows.publication;
  if (kind === "phd_cancellation") return processFlows.cancellation;
  if (kind === "supervisor_change") return processFlows.supervisorChange;
  if (kind === "leave") return processFlows.leave;
  if (kind === "extension") return processFlows.extension;
  if (kind === "title_change") return processFlows.titleChange;
  if (kind === "study_mode_change") return processFlows.studyMode;
  if (kind === "six_month_report") return processFlows.sixMonth;
  return null;
}

const personalGroups = [
  {
    title: "General details",
    names: ["fullName", "programme", "studyMode", "mobile", "email"],
  },
  {
    title: "Personal details",
    names: ["dateOfBirth", "gender", "nationality", "bloodGroup"],
  },
  {
    title: "Parent details",
    names: ["fatherName", "motherName", "parentContact", "parentEmail"],
  },
  {
    title: "Address for communication",
    names: ["address", "pincode", "district", "state"],
  },
] as const;

function statusVariant(status: ScholarRecord["status"]) {
  if (status === "Approved") return "gold" as const;
  if (status === "Returned") return "maroon" as const;
  return "purple" as const;
}

export function RecordForm({
  officeEntry = false,
  menu,
  scholarIdentifier,
  scholarName,
  supervisorIdentifier,
  supervisorName,
  existing,
  prefill,
  onClose,
  onDone,
}: {
  /** Saved by the research office already approved, which locks it. */
  officeEntry?: boolean;
  prefill?: Record<string, string>;
  menu: ScholarRecordMenu;
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
  existing?: ScholarRecord;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const schema = useMemo(() => recordSchema(menu), [menu]);
  const defaults = Object.fromEntries(menu.fields.map((field) => [field.name, ""]));
  const registerDefaults =
    menu.kind === "personal_details" && !existing
      ? personalDetailsFromRegister(scholarIdentifier, scholarName)
      : {};
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as Resolver<Record<string, string>>,
    defaultValues: existing
      ? { ...defaults, ...existing.payload }
      : { ...defaults, ...registerDefaults, ...prefill },
  });
  const doi = useWatch({ control: form.control, name: "doi" });
  // The office may record entries (such as fees paid before the ERP) without a receipt, and a
  // correction keeps the file already on the record.
  const fileRequired = menu.fileRequired && !officeEntry && !existing?.fileName;
  const [file, setFile] = useState<StoredFile | null>(null);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: Record<string, string>) {
    const problem = fileError(file?.file ?? null, menu.fileRule, fileRequired);
    setFileMessage(problem);
    if (problem) return;
    setBusy(true);
    setNotice(null);
    const fileData = file?.file
      ? await storeFile(file.file, "records").catch(() => "")
      : "";
    const saved = await saveScholarRecord(
      {
        kind: menu.kind,
        scholarIdentifier,
        scholarName: values.fullName?.trim() || values.nameOnCard?.trim() || scholarName,
        // The steps this request goes through are fixed now (Approval rules).
        payload:
          menu.needsSupervisor && !officeEntry
            ? {
                ...values,
                chain: (approvalChain(`record:${menu.kind}`).filter(
                  (stage) =>
                    stage !== "supervisor" || Boolean(supervisorIdentifier.trim()),
                ).length > 0
                  ? approvalChain(`record:${menu.kind}`).filter(
                      (stage) =>
                        stage !== "supervisor" || Boolean(supervisorIdentifier.trim()),
                    )
                  : ["dean"]
                ).join(","),
              }
            : values,
        fileName: file?.file.name ?? existing?.fileName ?? null,
        fileData: fileData || existing?.fileData || null,
        supervisorIdentifier,
        supervisorName,
        ...(officeEntry ? { status: "Approved" as const } : {}),
      },
      existing?.id,
    );
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    if (!menu.single) form.reset(defaults);
    setFile(null);
    onDone(
      officeEntry
        ? menu.kind === "payment"
          ? "Payment recorded and verified. Only the administrator can change it now."
          : "Saved and locked. Only the administrator can change it now."
        : menu.needsSupervisor
          ? "Submitted. Your supervisor reviews it first, then the research office."
          : existing
            ? "Updated. The research office will review it again."
            : "Submitted. The research office will review it.",
    );
  }

  return (
    <FormDialog
      title={existing ? `Update ${menu.label}` : `Add ${menu.label}`}
      onClose={onClose}
      onSubmit={form.handleSubmit(onSubmit)}
      busy={busy}
      submitLabel={existing ? "Save" : "Submit"}
      size="lg"
    >
      {notice ? (
        <p role="alert" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {menu.fields.map((field) => (
          <FormField
            key={field.name}
            label={field.label}
            htmlFor={field.name}
            required={field.required}
            error={form.formState.errors[field.name]?.message}
            className={field.kind === "textarea" ? "sm:col-span-2" : undefined}
          >
            {field.kind === "textarea" ? (
              <Textarea id={field.name} {...form.register(field.name)} />
            ) : field.kind === "select" ? (
              <NativeSelect id={field.name} {...form.register(field.name)}>
                <option value="">Select</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <>
                <Input
                  id={field.name}
                  {...(field.kind === "date" ? { type: "date" } : {})}
                  {...(recordRule(field)
                    ? masked(form.register(field.name), recordRule(field) as InputRule)
                    : form.register(field.name))}
                />
                {field.kind === "doi" && /^10\.\d{4,9}\/\S+$/.test(doi ?? "") ? (
                  <p className="text-xs text-primary">DOI format verified.</p>
                ) : null}
              </>
            )}
          </FormField>
        ))}
        {menu.fileLabel ? (
          <FormField
            label={menu.fileLabel}
            htmlFor={`${menu.kind}-file`}
            required={fileRequired}
            error={fileMessage ?? undefined}
            className="sm:col-span-2"
          >
            <FileUpload
              id={`${menu.kind}-file`}
              acceptRule={menu.fileRule}
              value={file}
              error={fileMessage ?? undefined}
              onChange={setFile}
            />
            {!file && existing?.fileName ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Current file: {existing.fileName}
                </p>
                <ViewFilesButton
                  fileName={existing.fileName}
                  load={() => loadRecordFile(existing)}
                  stamp={recordViewStamp(existing)}
                />
              </div>
            ) : null}
          </FormField>
        ) : null}
      </div>
    </FormDialog>
  );
}

function recordModule(kind: ScholarRecordKind) {
  if (
    kind === "phd_cancellation" ||
    kind === "supervisor_change" ||
    kind === "study_mode_change" ||
    kind === "leave" ||
    kind === "extension" ||
    kind === "title_change"
  ) {
    return portalModules.requests;
  }
  if (kind === "publication" || kind === "six_month_report") {
    return portalModules.doctoralProgress;
  }
  return portalModules.scholarRecords;
}

/** A request has the supervisor's step when its menu has one and a supervisor's name is on it. */
function hasSupervisorStep(
  menu: ScholarRecordMenu,
  record: { supervisorIdentifier?: string | null },
) {
  return menu.needsSupervisor && Boolean(record.supervisorIdentifier?.trim());
}

export function ScholarRecordScreen({
  menu,
  mode,
}: {
  menu: ScholarRecordMenu;
  mode: "scholar" | "admin";
}) {
  const session = usePortalSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const rules = useSyncExternalStore(
    subscribeApprovalRules,
    currentApprovalRules,
    () => null,
  );
  const [scholarFilter, setScholarFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [indexFilter, setIndexFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [query, setQuery] = useState("");
  const profile = useScholarProfiles();
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords(menu.kind, onChange),
    () => currentScholarRecords(menu.kind),
    () => null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);

  if (!load) {
    return (
      <p className="text-sm text-muted-foreground">Loading {menu.label.toLowerCase()}…</p>
    );
  }

  const signedIn = session?.role === "scholar";
  const registerScholar =
    session && signedIn ? scholarBySignIn(session.identifier) : null;
  const registerGuide = registerScholar
    ? supervisorForGuide(registerScholar.guideName)
    : null;
  const allotment =
    session && signedIn
      ? allocationFor(office?.allocations ?? [], session.identifier)
      : null;
  // The supervisor's step is part of the Approval rules: a request made while it is switched off
  // goes straight to the Dean, without the supervisor's name on it.
  const viaSupervisor =
    menu.needsSupervisor &&
    stageApplies(rules?.rules ?? {}, `record:${menu.kind}`, "supervisor");
  const guide =
    allotment ??
    (registerGuide || registerScholar?.guideName
      ? {
          supervisorIdentifier:
            registerGuide?.supervisorId.trim() || registerScholar?.guideName || "",
          supervisorName: registerGuide?.name || registerScholar?.guideName || "",
        }
      : null);
  const owned =
    mode === "scholar"
      ? load.records.filter((record) => record.scholarIdentifier === session?.identifier)
      : load.records;
  const mine =
    mode === "admin"
      ? owned.filter(
          (record) =>
            filterMatches(scholarFilter, record.scholarIdentifier) &&
            filterMatches(statusFilter, record.status) &&
            filterMatches(typeFilter, record.payload.kind ?? "") &&
            filterMatches(indexFilter, record.payload.indexing ?? "") &&
            filterMatches(yearFilter, record.payload.year ?? "") &&
            profile.matches(record.scholarIdentifier) &&
            textMatches(query, [
              record.scholarName,
              record.scholarIdentifier,
              record.status,
              ...menu.fields.map((field) => record.payload[field.name] ?? ""),
            ]),
        )
      : owned;
  const existing = menu.single ? owned[0] : undefined;
  const paymentTotal = mine.reduce(
    (sum, record) => sum + (Number(record.payload.amount) || 0),
    0,
  );
  const isPublication = menu.kind === "publication";
  const choice = (name: string) =>
    [...new Set(owned.map((record) => record.payload[name] ?? "").filter(Boolean))]
      .sort()
      .map((value) => ({ value, label: value }));
  const paperRow = (record: ScholarRecord) => {
    const p = record.payload;
    const person = profile.profileOf(record.scholarIdentifier);
    const pages = [p.pageFrom, p.pageTo].filter(Boolean).join("–");
    return {
      p,
      person,
      pages,
      when: [p.month, p.year].filter(Boolean).join(" "),
    };
  };
  const scholarOptions = Array.from(
    new Map(
      owned.map((record) => [record.scholarIdentifier, record.scholarName]),
    ).entries(),
  );

  /** The step a request waits at, and whether it is the last one. */
  function waitingStep(record: ScholarRecord) {
    const stages = recordStages(record, hasSupervisorStep(menu, record));
    const done = stages.filter((stage) =>
      Boolean(record.payload[stage === "supervisor" ? "supervisorOn" : `${stage}On`]),
    );
    return { stage: nextStage(stages, done), last: stages[stages.length - 1] };
  }
  function canApproveNow(record: ScholarRecord) {
    const { stage } = waitingStep(record);
    if (!stage) return false;
    if (stage === "supervisor") return session?.role === "admin";
    return mayAct(session?.role, stage);
  }
  function approveLabel(record: ScholarRecord) {
    const { stage, last } = waitingStep(record);
    if (stage === "supervisor") return "With supervisor";
    if (stage && !mayAct(session?.role, stage)) {
      return `With the ${stageNames[stage]}`;
    }
    return stage === last ? "Approve" : "Recommend";
  }

  async function decide(record: ScholarRecord, status: "Approved" | "Returned") {
    const note = (remarks[record.id] ?? "").trim();
    if (status === "Returned" && note.length < 2) {
      setNotice("Enter the remarks before returning this record.");
      return;
    }
    if (status === "Approved" && record.kind === "supervisor_change") {
      // A scholar is not moved to a supervisor who has no vacancy.
      const wanted = (record.payload.requestedSupervisor ?? "").trim().toLowerCase();
      const option = guideOptions(
        currentOffice()?.allocations ?? [],
        currentPortalUsers()?.users ?? [],
        currentQuotas(),
        currentStandings(),
      ).find(
        (item) =>
          item.name.toLowerCase() === wanted || item.identifier.toLowerCase() === wanted,
      );
      if (option && option.vacancy !== null && option.vacancy < 1) {
        setNotice(
          `${option.name} has no vacancy, so this change of supervisor cannot be approved.`,
        );
        return;
      }
    }
    setBusyId(record.id);
    const saved = await setScholarRecordStatus(record, status, note);
    if (saved && status === "Approved" && record.kind === "supervisor_change") {
      const requested = record.payload.requestedSupervisor ?? "";
      const registerGuide = supervisorForGuide(requested);
      const match = currentPortalUsers()?.users.find(
        (user) =>
          user.role === "supervisor" &&
          (user.name.toLowerCase() === requested.toLowerCase() ||
            user.identifier.toLowerCase() === requested.toLowerCase()),
      );
      const supervisorName = registerGuide?.name ?? match?.name ?? "";
      if (supervisorName) {
        const allotted = await saveAllocation({
          scholarIdentifier: record.scholarIdentifier,
          scholarName: record.scholarName,
          supervisorIdentifier:
            registerGuide?.supervisorId.trim() || match?.identifier || requested,
          supervisorName,
        });
        if (!allotted.ok) {
          setBusyId(null);
          setNotice(allotted.message);
          return;
        }
      }
    }
    setBusyId(null);
    setNotice(
      saved
        ? `${record.scholarName} marked ${status}.`
        : "That decision could not be saved.",
    );
  }

  const opened = mine.find((record) => record.id === openId) ?? null;
  const flow = flowFor(menu.kind);
  const canForm =
    mode === "scholar" &&
    signedIn &&
    session &&
    (!viaSupervisor || Boolean(guide)) &&
    existing?.status !== "Approved";

  return (
    <DeskPage kicker={recordModule(menu.kind)} title={menu.label}>
      {flow ? <ProcessFlow>{flow}</ProcessFlow> : null}
      {load.detail ? (
        <p role="status" className="max-w-2xl text-sm leading-6 text-secondary">
          {load.detail} {scholarRecordMigrationHint}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      {mode === "scholar" ? (
        <ScholarIdentityHeader identifier={session?.identifier ?? ""} />
      ) : null}

      {mode === "scholar" && !signedIn ? (
        <GateBanner>
          <Link
            href="/login/scholar"
            className="font-semibold text-primary hover:underline"
          >
            Sign in as a scholar
          </Link>{" "}
          to upload this record.
        </GateBanner>
      ) : null}

      {mode === "scholar" && signedIn && session && viaSupervisor && office && !guide ? (
        <GateBanner>
          A supervisor has to be allotted before you can submit this.
        </GateBanner>
      ) : null}

      {mode === "scholar" && menu.kind === "personal_details" && existing ? (
        <>
          {personalGroups.map((group) => (
            <DeskSection key={group.title} title={group.title}>
              <dl>
                {group.names.map((name) => {
                  const field = menu.fields.find((item) => item.name === name);
                  if (!field) return null;
                  return (
                    <div
                      key={name}
                      className="grid grid-cols-[12rem_1fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
                    >
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="font-semibold text-primary">
                        {existing.payload[name] || "—"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </DeskSection>
          ))}
        </>
      ) : null}

      {mode === "scholar" && menu.kind !== "personal_details" ? (
        <DeskSection
          title={
            menu.kind === "payment" ? "Fees payment details" : "Already submitted request"
          }
        >
          {menu.kind === "payment" ? (
            <DeskTable
              headers={[
                "Date",
                "Amount",
                "Mode",
                "Transaction number",
                "Purpose",
                "Status",
                "",
              ]}
              empty={mine.length === 0}
            >
              {mine.map((record) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {record.payload.paidOn
                      ? formatIsoDate(record.payload.paidOn)
                      : formatIsoDate(record.createdAt.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">₹{record.payload.amount || "—"}</td>
                  <td className="px-4 py-3">{record.payload.mode || "—"}</td>
                  <td className="px-4 py-3">{record.payload.transactionNumber || "—"}</td>
                  <td className="px-4 py-3">{record.payload.purpose || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={record.status} />
                    {record.status === "Returned" ? (
                      <p className="mt-1 max-w-[14rem] text-xs text-secondary">
                        Returned
                        {record.payload.remarks ? `: ${record.payload.remarks}` : ""}. Add
                        the payment again with the correct receipt and submit it for
                        approval.
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ViewFilesButton
                        fileName={record.fileName}
                        load={() => loadRecordFile(record)}
                        stamp={recordViewStamp(record)}
                        onMissing={setNotice}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenId(record.id)}
                      >
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DeskTable>
          ) : (
            <DeskTable
              headers={["Submitted on", "Reason", "Status", ""]}
              empty={mine.length === 0}
            >
              {mine.map((record) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {formatIsoDate(record.createdAt.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    {record.payload.reason ||
                      record.payload.title ||
                      record.payload.examName ||
                      record.payload.abcId ||
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ApprovalBadge
                      summary={recordSummary(record, hasSupervisorStep(menu, record))}
                      showDetail
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ViewFilesButton
                        fileName={record.fileName}
                        load={() => loadRecordFile(record)}
                        stamp={recordViewStamp(record)}
                        onMissing={setNotice}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenId(record.id)}
                      >
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DeskTable>
          )}
        </DeskSection>
      ) : null}

      {menu.kind === "payment" ? (
        <p className="text-sm text-foreground">
          {mode === "scholar" ? "Your payments" : "Overall"}: {mine.length} · ₹
          {paymentTotal.toLocaleString("en-IN")}
        </p>
      ) : null}

      {menu.kind === "title_change" && mode === "scholar" && session && doctoral
        ? (() => {
            const title = researchTitleOf(
              doctoral,
              session.identifier,
              load?.records ?? [],
            );
            return (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <p className="text-[0.65rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                    Research title · {title.stage}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {title.title || "Not fixed yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{title.note}</p>
                </div>
                <GateBanner tone={title.changeBlock ? "danger" : "info"}>
                  {title.changeBlock ?? titleRuleText}
                </GateBanner>
              </div>
            );
          })()
        : null}

      {canForm &&
      session &&
      !(
        menu.kind === "title_change" &&
        mode === "scholar" &&
        doctoral &&
        researchTitleOf(doctoral, session.identifier, load?.records ?? []).changeBlock
      ) ? (
        <DeskSection
          title={menu.single ? `Update ${menu.label}` : "New request"}
          tone={menu.single ? "primary" : "new"}
        >
          <div className="p-4">
            {existing?.status === "Approved" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm">
                  This record is approved and locked
                  {existing.fileName ? ` · ${existing.fileName}` : ""}.
                </p>
                <ViewFilesButton
                  fileName={existing.fileName}
                  load={() => loadRecordFile(existing)}
                  stamp={recordViewStamp(existing)}
                  onMissing={setNotice}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {existing
                    ? `${existing.status}${existing.fileName ? ` · ${existing.fileName}` : ""}`
                    : menu.single
                      ? "Not submitted yet."
                      : "Submit a new request."}
                </p>
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    setNotice(null);
                    setFormOpen(true);
                  }}
                >
                  {existing
                    ? `Update ${menu.label}`
                    : menu.single
                      ? `Add ${menu.label}`
                      : "New request"}
                </Button>
              </div>
            )}
            {formOpen && existing?.status !== "Approved" ? (
              <RecordForm
                key={existing?.id ?? "new"}
                menu={menu}
                scholarIdentifier={session.identifier}
                scholarName={session.name.trim() || session.identifier}
                supervisorIdentifier={
                  viaSupervisor ? (guide?.supervisorIdentifier ?? "") : ""
                }
                supervisorName={viaSupervisor ? (guide?.supervisorName ?? "") : ""}
                existing={existing}
                prefill={
                  menu.kind === "title_change" && doctoral
                    ? {
                        currentTitle: researchTitleOf(
                          doctoral,
                          session.identifier,
                          load?.records ?? [],
                        ).title,
                      }
                    : undefined
                }
                onClose={() => setFormOpen(false)}
                onDone={(message) => {
                  setFormOpen(false);
                  setNotice(message);
                }}
              />
            ) : null}
          </div>
        </DeskSection>
      ) : null}

      {mode === "admin" ? (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              ...(isPublication
                ? [
                    {
                      id: "type",
                      label: "Publication type",
                      value: typeFilter,
                      options: choice("kind"),
                      onChange: setTypeFilter,
                    },
                    {
                      id: "indexing",
                      label: "Indexed in",
                      value: indexFilter,
                      options: choice("indexing"),
                      onChange: setIndexFilter,
                    },
                    {
                      id: "year",
                      label: "Year",
                      value: yearFilter,
                      options: choice("year").reverse(),
                      onChange: setYearFilter,
                    },
                  ]
                : []),
              ...profile.filters,
              {
                id: "scholar",
                label: "Scholar",
                value: scholarFilter,
                options: scholarOptions.map(([identifier, name]) => ({
                  value: identifier,
                  label: `${name} · ${identifier}`,
                })),
                onChange: setScholarFilter,
              },
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                options: ["Submitted", "Supervisor approved", "Approved", "Returned"].map(
                  (status) => ({ value: status, label: status }),
                ),
                onChange: setStatusFilter,
              },
            ]}
            shown={mine.length}
            total={owned.length}
            filename={`${menu.slug}.csv`}
            csv={isPublication}
            title={isPublication ? "Publications of scholars" : undefined}
            headers={
              isPublication
                ? [
                    "Scholar",
                    "Registration No.",
                    "Sign-in",
                    ...profile.headers,
                    "Publication type",
                    "Title of paper",
                    "Authors",
                    "Corresponding author",
                    "Position of the scholar",
                    "Journal / book / conference",
                    "Volume",
                    "Issue",
                    "Pages",
                    "ISSN",
                    "eISSN",
                    "Indexed in",
                    "Quality panel",
                    "Impact factor",
                    "DOI",
                    "Web URL",
                    "Month",
                    "Year",
                    "Status",
                    "Submitted on",
                    "Approved on",
                    "Remarks",
                  ]
                : [
                    "scholar_name",
                    "scholar_identifier",
                    "status",
                    "submitted",
                    ...profile.headers,
                    ...menu.fields.map((field) => field.name),
                    "file_name",
                  ]
            }
            rows={mine.map((record) => {
              if (!isPublication) {
                return [
                  record.scholarName,
                  record.scholarIdentifier,
                  record.status,
                  record.createdAt.slice(0, 10),
                  ...profile.cells(record.scholarIdentifier),
                  ...menu.fields.map((field) => record.payload[field.name] ?? ""),
                  record.fileName ?? "",
                ];
              }
              const { p, person, pages } = paperRow(record);
              return [
                record.scholarName,
                person.registration,
                record.scholarIdentifier,
                ...profile.cells(record.scholarIdentifier),
                p.kind ?? "",
                p.title ?? "",
                p.authors ?? "",
                p.correspondingAuthor ?? "",
                p.position ?? "",
                p.journal ?? "",
                p.volume ?? "",
                p.issue ?? "",
                pages,
                p.issn ?? "",
                p.eissn ?? "",
                p.indexing ?? "",
                p.qualityPanel ?? "",
                p.impactFactor ?? "",
                p.doi ?? "",
                p.webUrl ?? "",
                p.month ?? "",
                p.year ?? "",
                record.status,
                record.createdAt.slice(0, 10),
                p.approvedOn ?? "",
                p.remarks ?? "",
              ];
            })}
            pdfHeaders={
              isPublication
                ? [
                    "Scholar",
                    "Department · Campus",
                    "Guide · Mode",
                    "Type",
                    "Title · Authors",
                    "Journal / book / conference",
                    "Indexed in",
                    "DOI",
                    "Month · Year",
                    "Status",
                  ]
                : undefined
            }
            pdfRows={
              isPublication
                ? mine.map((record) => {
                    const { p, person, pages, when } = paperRow(record);
                    return [
                      [record.scholarName, person.registration]
                        .filter(Boolean)
                        .join("\n"),
                      [person.department, person.campus].filter(Boolean).join("\n"),
                      [person.guide, person.mode].filter(Boolean).join("\n"),
                      p.kind ?? "",
                      [p.title, p.authors ? `Authors: ${p.authors}` : ""]
                        .filter(Boolean)
                        .join("\n"),
                      [
                        p.journal,
                        [
                          p.volume ? `Vol. ${p.volume}` : "",
                          p.issue ? `Issue ${p.issue}` : "",
                          pages ? `pp. ${pages}` : "",
                        ]
                          .filter(Boolean)
                          .join(", "),
                      ]
                        .filter(Boolean)
                        .join("\n"),
                      [
                        p.indexing,
                        p.qualityPanel,
                        p.issn ? `ISSN ${p.issn}` : "",
                        p.impactFactor ? `IF ${p.impactFactor}` : "",
                      ]
                        .filter(Boolean)
                        .join("\n"),
                      p.doi ?? "",
                      when,
                      record.status,
                    ];
                  })
                : undefined
            }
          />
          <DeskSection title={menu.label}>
            <DeskTable
              headers={["Scholar", profileColumnHeading, "Details", "Submitted", "Status", ""]}
              empty={mine.length === 0}
            >
              {mine.map((record) => (
                <tr key={record.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{record.scholarName}</p>
                    <p className="text-muted-foreground">{record.scholarIdentifier}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ProfileCell profile={profile.profileOf(record.scholarIdentifier)} />
                  </td>
                  <td className="px-4 py-3">
                    {menu.fields.slice(0, 4).map((field) => (
                      <p key={field.name}>
                        <span className="text-muted-foreground">{field.label}: </span>
                        {record.payload[field.name] || "—"}
                      </p>
                    ))}
                    {record.fileName ? (
                      <p className="text-muted-foreground">File: {record.fileName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {formatIsoDate(record.createdAt.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ViewFilesButton
                        fileName={record.fileName}
                        load={() => loadRecordFile(record)}
                        stamp={recordViewStamp(record)}
                        onMissing={setNotice}
                      />
                      <Textarea
                        aria-label={`Remarks for ${record.scholarName}`}
                        className="min-h-16"
                        value={remarks[record.id] ?? ""}
                        onChange={(event) =>
                          setRemarks((current) => ({
                            ...current,
                            [record.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        disabled={busyId === record.id || !canApproveNow(record)}
                        onClick={() => void decide(record, "Approved")}
                      >
                        {approveLabel(record)}
                      </Button>
                      <Button
                        type="button"
                        variant="maroon"
                        size="sm"
                        disabled={busyId === record.id}
                        onClick={() => void decide(record, "Returned")}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DeskTable>
          </DeskSection>
        </>
      ) : null}

      {opened ? (
        <DeskModal title={menu.label} onClose={() => setOpenId(null)}>
          <ScholarIdentityHeader identifier={opened.scholarIdentifier} />
          <DeskSection title="Request details">
            <dl>
              {menu.fields.map((field) => (
                <div
                  key={field.name}
                  className="grid grid-cols-[12rem_1fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
                >
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="font-semibold text-primary">
                    {opened.payload[field.name] || "—"}
                  </dd>
                </div>
              ))}
              <div className="grid grid-cols-[12rem_1fr] gap-3 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="space-y-2">
                  <ApprovalBadge
                    summary={recordSummary(opened, hasSupervisorStep(menu, opened))}
                    showDetail
                  />
                  <ApprovalTrail
                    summary={recordSummary(opened, hasSupervisorStep(menu, opened))}
                  />
                </dd>
              </div>
              {opened.fileName ? (
                <div className="grid grid-cols-[12rem_1fr] gap-3 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">File</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-primary">{opened.fileName}</span>
                    <ViewFilesButton
                      fileName={opened.fileName}
                      load={() => loadRecordFile(opened)}
                      stamp={recordViewStamp(opened)}
                      onMissing={setNotice}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>
          </DeskSection>
        </DeskModal>
      ) : null}
    </DeskPage>
  );
}
