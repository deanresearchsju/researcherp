"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";

import { FileUpload } from "@/components/forms/FileUpload";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ScholarRecordMenu } from "@/data/scholar-records";
import { formatIsoDate } from "@/lib/dates";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import {
  currentScholarRecords,
  downloadStoredFile,
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
  personalDetailsFromRegister,
  scholarBySignIn,
  supervisorForGuide,
} from "@/lib/register";
import { currentPortalUsers } from "@/lib/users";
import { usePortalSession } from "@/lib/use-preview-session";

function statusVariant(status: ScholarRecord["status"]) {
  if (status === "Approved") return "gold" as const;
  if (status === "Returned") return "maroon" as const;
  return "purple" as const;
}

function RecordForm({
  menu,
  scholarIdentifier,
  scholarName,
  supervisorIdentifier,
  supervisorName,
  existing,
}: {
  menu: ScholarRecordMenu;
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
  existing?: ScholarRecord;
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
      : { ...defaults, ...registerDefaults },
  });
  const doi = useWatch({ control: form.control, name: "doi" });
  const [file, setFile] = useState<StoredFile | null>(null);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: Record<string, string>) {
    const problem = fileError(file?.file ?? null, menu.fileRule, menu.fileRequired);
    setFileMessage(problem);
    if (problem) return;
    setBusy(true);
    setNotice(null);
    const fileData = file?.file ? await fileToDataUrl(file.file).catch(() => "") : "";
    const saved = await saveScholarRecord(
      {
        kind: menu.kind,
        scholarIdentifier,
        scholarName: values.fullName?.trim() || values.nameOnCard?.trim() || scholarName,
        payload: values,
        fileName: file?.file.name ?? existing?.fileName ?? null,
        fileData: fileData || existing?.fileData || null,
        supervisorIdentifier,
        supervisorName,
      },
      existing?.id,
    );
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setNotice(
      menu.needsSupervisor
        ? "Submitted. Your supervisor reviews it first, then the research office."
        : existing
          ? "Updated. The research office will review it again."
          : "Submitted. The research office will review it.",
    );
    if (!menu.single) form.reset(defaults);
    setFile(null);
  }

  return (
    <form
      className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <h2 className="font-semibold text-primary sm:col-span-2">
        {existing ? `Update ${menu.label}` : `Add ${menu.label}`}
      </h2>
      {notice ? (
        <p role="status" className="text-sm text-secondary sm:col-span-2">
          {notice}
        </p>
      ) : null}
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
                type={
                  field.kind === "date"
                    ? "date"
                    : field.kind === "email"
                      ? "email"
                      : "text"
                }
                inputMode={
                  field.kind === "tel" || field.kind === "amount" ? "decimal" : undefined
                }
                {...form.register(field.name)}
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
          required={menu.fileRequired}
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
            <p className="text-xs text-muted-foreground">
              Current file: {existing.fileName}
            </p>
          ) : null}
        </FormField>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" variant="gold" disabled={busy}>
          {existing ? "Save" : "Submit"}
        </Button>
      </div>
    </form>
  );
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
  const [scholarFilter, setScholarFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords(menu.kind, onChange),
    () => currentScholarRecords(menu.kind),
    () => null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
            (scholarFilter === "" || record.scholarIdentifier === scholarFilter) &&
            (statusFilter === "" || record.status === statusFilter) &&
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
  const scholarOptions = Array.from(
    new Map(
      owned.map((record) => [record.scholarIdentifier, record.scholarName]),
    ).entries(),
  );

  async function downloadFile(record: ScholarRecord) {
    setBusyId(record.id);
    const data = await loadRecordFile(record);
    setBusyId(null);
    if (!data || !record.fileName) {
      setNotice("That file is not stored with the record.");
      return;
    }
    downloadStoredFile(record.fileName, data);
  }

  async function decide(record: ScholarRecord, status: "Approved" | "Returned") {
    setBusyId(record.id);
    const saved = await setScholarRecordStatus(record, status);
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

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        {mode === "admin" ? "Admin" : "Scholar"}
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">{menu.label}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {menu.summary}
      </p>
      {load.detail ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {load.detail} {scholarRecordMigrationHint}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      {mode === "scholar" && !signedIn ? (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href="/login/scholar"
            className="font-semibold text-primary hover:underline"
          >
            Sign in as a scholar
          </Link>{" "}
          to upload this record.
        </p>
      ) : null}

      {mode === "scholar" &&
      signedIn &&
      session &&
      menu.needsSupervisor &&
      office &&
      !guide ? (
        <p className="mt-6 text-sm text-muted-foreground">
          A supervisor has to be allotted before you can submit this.
        </p>
      ) : null}

      {mode === "scholar" && signedIn && session && (!menu.needsSupervisor || guide) ? (
        <RecordForm
          key={existing?.id ?? "new"}
          menu={menu}
          scholarIdentifier={session.identifier}
          scholarName={session.name.trim() || session.identifier}
          supervisorIdentifier={guide?.supervisorIdentifier ?? ""}
          supervisorName={guide?.supervisorName ?? ""}
          existing={existing}
        />
      ) : null}

      {menu.kind === "payment" ? (
        <p className="mt-6 text-sm text-foreground">
          {mode === "scholar" ? "Your payments" : "Overall"}: {mine.length} · ₹
          {paymentTotal.toLocaleString("en-IN")}
        </p>
      ) : null}
      {mode === "admin" ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filters={[
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
          headers={[
            "scholar_name",
            "scholar_identifier",
            "status",
            "submitted",
            ...menu.fields.map((field) => field.name),
            "file_name",
          ]}
          rows={mine.map((record) => [
            record.scholarName,
            record.scholarIdentifier,
            record.status,
            record.createdAt.slice(0, 10),
            ...menu.fields.map((field) => record.payload[field.name] ?? ""),
            record.fileName ?? "",
          ])}
        />
      ) : null}

      {mine.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No records yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                {mode === "admin" ? (
                  <th className="px-3 py-3 font-semibold">Scholar</th>
                ) : null}
                <th className="px-3 py-3 font-semibold">Details</th>
                <th className="px-3 py-3 font-semibold">Submitted</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {mine.map((record) => (
                <tr key={record.id} className="border-t border-border align-top">
                  {mode === "admin" ? (
                    <td className="px-3 py-3">
                      <p className="font-semibold text-primary">{record.scholarName}</p>
                      <p className="text-muted-foreground">{record.scholarIdentifier}</p>
                    </td>
                  ) : null}
                  <td className="px-3 py-3">
                    {menu.fields.map((field) => (
                      <p key={field.name}>
                        <span className="text-muted-foreground">{field.label}: </span>
                        {record.payload[field.name] || "—"}
                      </p>
                    ))}
                    {record.fileName ? (
                      <p className="text-muted-foreground">File: {record.fileName}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {formatIsoDate(record.createdAt.slice(0, 10))}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {mode === "admin" && record.fileName ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === record.id}
                          onClick={() => void downloadFile(record)}
                        >
                          Download file
                        </Button>
                      ) : null}
                      {mode === "admin" ? (
                        <>
                          <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            disabled={
                              busyId === record.id ||
                              (menu.needsSupervisor &&
                                record.status !== "Supervisor approved")
                            }
                            onClick={() => void decide(record, "Approved")}
                          >
                            {menu.needsSupervisor && record.status === "Submitted"
                              ? "With supervisor"
                              : "Approve"}
                          </Button>
                          <Button
                            type="button"
                            variant="maroon"
                            size="sm"
                            disabled={busyId === record.id}
                            onClick={() => void decide(record, "Returned")}
                          >
                            Return
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
