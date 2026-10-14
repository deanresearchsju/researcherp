"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { university } from "@/lib/constants";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import {
  currentDoctoral,
  decideAccess,
  enrollmentFor,
  periodState,
  reportPeriods,
  saveAccess,
  subscribeDoctoral,
} from "@/lib/doctoral";
import {
  annotateScholarRecord,
  currentScholarRecords,
  saveScholarRecord,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";

const schema = z.object({
  progress: z.string().trim().min(10, "Describe the work done in this period."),
});
const remarksSchema = z.string().trim().min(2, "Enter the remarks.");

type Values = z.infer<typeof schema>;

export function SixMonthScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("six_month_report", onChange),
    () => currentScholarRecords("six_month_report"),
    () => null,
  );
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState<StoredFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { progress: "" },
  });

  if (!ready || !doctoral || !load)
    return <p className="text-sm text-muted-foreground">Loading reports…</p>;

  const enrollment = session ? enrollmentFor(doctoral, session.identifier) : null;
  const batch = doctoral.batches.find((item) => item.id === enrollment?.batchId) ?? null;
  const periods = batch ? reportPeriods(batch.session, Number(batch.year) || 2026) : [];
  const duePeriods = periods.filter((item) => periodState(item.due) === "due");
  const current = duePeriods.at(-1) ?? null;
  const ownReports = load.records.filter(
    (record) => record.scholarIdentifier === session?.identifier,
  );
  const ownAccess = doctoral.access.filter(
    (item) => item.scholarIdentifier === session?.identifier,
  );

  function reportFor(label: string, records: ScholarRecord[]) {
    return records.find((record) => record.payload.period === label) ?? null;
  }

  function canUpload(label: string) {
    const report = reportFor(label, ownReports);
    if (report?.status === "Returned") return true;
    if (report) return false;
    const access = ownAccess.find(
      (item) => item.period === label && item.status === "Granted",
    );
    if (access) return true;
    return current?.label === label;
  }

  async function upload(values: Values) {
    if (!session || !period) {
      setNotice("Select a period.");
      return;
    }
    if (!canUpload(period)) {
      setNotice("That period is not open. Request access if the report was missed.");
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the report.");
      return;
    }
    const data = await fileToDataUrl(file.file).catch(() => "");
    const existing = reportFor(period, ownReports);
    const saved = await saveScholarRecord(
      {
        kind: "six_month_report",
        scholarIdentifier: session.identifier,
        scholarName: session.name,
        payload: { period, progress: values.progress },
        fileName: file.file.name,
        fileData: data || null,
      },
      existing?.status === "Returned" ? existing.id : undefined,
    );
    setNotice(saved.ok ? "Report submitted for the research office." : saved.message);
    if (saved.ok) {
      form.reset();
      setFile(null);
    }
  }

  async function request(label: string) {
    if (!session) return;
    const saved = await saveAccess({
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      period: label,
    });
    setNotice(
      saved.ok
        ? `The request for ${label} is recorded for the Dean of Research in this portal. The office address is ${university.email}.`
        : saved.message,
    );
  }

  async function decide(record: ScholarRecord, status: "Approved" | "Returned") {
    const note = remarks[record.id] ?? "";
    if (status === "Returned") {
      const parsed = remarksSchema.safeParse(note);
      if (!parsed.success) {
        setNotice(parsed.error.issues[0]?.message ?? "Enter the remarks.");
        return;
      }
    }
    const saved = await annotateScholarRecord(record, {
      status,
      extra: {
        remarks: note,
        approvedOn: status === "Approved" ? new Date().toISOString().slice(0, 10) : "",
      },
    });
    setNotice(saved ? status : "That decision could not be saved.");
  }

  const rows =
    mode === "admin"
      ? load.records.filter(
          (record) =>
            (statusFilter === "" || record.status === statusFilter) &&
            textMatches(query, [
              record.scholarName,
              record.payload.period ?? "",
              record.payload.progress ?? "",
              record.status,
            ]),
        )
      : ownReports;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Six-month report</h1>
      </header>
      {mode === "scholar" ? (
        !enrollment || !batch ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            The research office has to place you in a course-work batch before reports
            open.
          </p>
        ) : (
          <form
            className="space-y-4 rounded-xl border border-border bg-card p-4"
            onSubmit={form.handleSubmit(upload)}
            noValidate
          >
            <p className="text-sm text-muted-foreground">
              {batch.name} · {enrollment.studyMode}
              {current ? ` · Current period ${current.label}` : " · No period is due yet"}
            </p>
            <ul className="space-y-2 text-sm">
              {periods.map((item) => {
                const report = reportFor(item.label, ownReports);
                const access = ownAccess.find((entry) => entry.period === item.label);
                const state = periodState(item.due);
                const missed =
                  state === "due" &&
                  item.label !== current?.label &&
                  !report &&
                  access?.status !== "Granted";
                return (
                  <li
                    key={item.label}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      {item.label}
                      {report
                        ? ` · ${report.status}`
                        : state === "upcoming"
                          ? " · upcoming"
                          : ""}
                      {report?.payload.approvedOn
                        ? ` · approved ${report.payload.approvedOn}`
                        : ""}
                      {report?.payload.remarks ? ` · ${report.payload.remarks}` : ""}
                    </span>
                    {missed && access?.status !== "Requested" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void request(item.label)}
                      >
                        Request access
                      </Button>
                    ) : access ? (
                      <span>{access.status}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <FormField label="Period" htmlFor="report-period" required>
              <select
                id="report-period"
                className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="">Select</option>
                {periods
                  .filter((item) => canUpload(item.label))
                  .map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField
              label="Work done"
              htmlFor="report-progress"
              required
              error={form.formState.errors.progress?.message}
            >
              <Textarea id="report-progress" {...form.register("progress")} />
            </FormField>
            <FormField label="Report" htmlFor="report-file" required>
              <FileUpload
                id="report-file"
                acceptRule="document"
                value={file}
                onChange={setFile}
              />
            </FormField>
            <Button type="submit" variant="gold">
              Upload report
            </Button>
          </form>
        )
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-primary">Access requests</h2>
          {doctoral.access.length === 0 ? (
            <p className="text-sm text-muted-foreground">No access request is waiting.</p>
          ) : (
            doctoral.access.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <span>
                  {item.scholarName} · {item.period} · {item.status}
                </span>
                {item.status === "Requested" ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      onClick={() =>
                        void decideAccess(item.id, { status: "Granted", remarks: "" })
                      }
                    >
                      Grant
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="maroon"
                      onClick={() =>
                        void decideAccess(item.id, {
                          status: "Rejected",
                          remarks: "Access refused",
                        })
                      }
                    >
                      Refuse
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
      {mode === "admin" ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filters={[
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              options: ["Submitted", "Approved", "Returned"].map((item) => ({
                value: item,
                label: item,
              })),
              onChange: setStatusFilter,
            },
          ]}
          shown={rows.length}
          total={load.records.length}
          filename="six-month-reports.csv"
          headers={["scholar", "period", "status", "approved_on", "remarks"]}
          rows={rows.map((record) => [
            record.scholarName,
            record.payload.period ?? "",
            record.status,
            record.payload.approvedOn ?? "",
            record.payload.remarks ?? "",
          ])}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      <ul className="space-y-3">
        {rows.map((record) => (
          <li
            key={record.id}
            className="space-y-2 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-primary">
                {record.scholarName} · {record.payload.period}
                {record.payload.approvedOn
                  ? ` · approved ${record.payload.approvedOn}`
                  : ""}
              </p>
              <Badge
                variant={
                  record.status === "Approved"
                    ? "gold"
                    : record.status === "Returned"
                      ? "maroon"
                      : "purple"
                }
              >
                {record.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{record.payload.progress}</p>
            {mode === "admin" &&
            (record.status === "Submitted" || record.status === "Supervisor approved") ? (
              <div className="space-y-2">
                <Textarea
                  aria-label="Remarks"
                  value={remarks[record.id] ?? ""}
                  onChange={(event) =>
                    setRemarks((current) => ({
                      ...current,
                      [record.id]: event.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={() => void decide(record, "Approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="maroon"
                    onClick={() => void decide(record, "Returned")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
