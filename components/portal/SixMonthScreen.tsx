"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskPage,
  DeskSection,
  DeskTable,
  DeskTabs,
  FormDialog,
  GateBanner,
  ProcessFlow,
  ScholarIdentityHeader,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { SixMonthOfficeEntry } from "@/components/portal/SixMonthOfficeEntry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  conferenceLevels,
  patentStatuses,
  processFlows,
  programmeNatures,
} from "@/data/portal-desk";
import { sixMonthOnlineFrom } from "@/data/doctoral";
import { university } from "@/lib/constants";
import { fileError, type StoredFile } from "@/lib/files";
import {
  currentDoctoral,
  decideAccess,
  enrollmentFor,
  periodState,
  reportPeriodsFor,
  saveAccess,
  subscribeDoctoral,
} from "@/lib/doctoral";
import {
  annotateScholarRecord,
  currentScholarRecords,
  loadRecordFile,
  saveScholarRecord,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { ProfileCell } from "@/components/portal/ProfileCell";
import { storeFile } from "@/lib/file-store";
import { ApprovalBadge } from "@/components/portal/ApprovalTrail";
import { recordSummary } from "@/lib/approval-flow";
import { allocationFor, currentOffice, subscribeOffice } from "@/lib/office";
import { scholarBySignIn, supervisorForGuide } from "@/lib/register";
import { recordViewStamp } from "@/lib/approved-documents";

const schema = z.object({
  progress: z.string().trim().min(10, "Describe the work done in this period."),
  coursesCompleted: z.string().trim(),
  nextTargets: z
    .string()
    .trim()
    .min(10, "Enter the aim and objectives of the work to be done."),
});

type PaperRow = {
  title: string;
  journal: string;
  volume: string;
  issue: string;
  indexedIn: string;
};
type ConferenceRow = {
  nature: string;
  name: string;
  level: string;
  institute: string;
  fromTo: string;
};
type PatentRow = {
  number: string;
  status: string;
  inventor: string;
  title: string;
  filedOn: string;
};
type ActivityRow = { type: string; details: string; date: string; remarks: string };

const remarksSchema = z.string().trim().min(2, "Enter the remarks.");

type Values = z.infer<typeof schema>;

export function SixMonthScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("six_month_report", onChange),
    () => currentScholarRecords("six_month_report"),
    () => null,
  );
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState<StoredFile | null>(null);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const profile = useScholarProfiles();
  const [officeTab, setOfficeTab] = useState<"reports" | "paper">("reports");
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { progress: "", coursesCompleted: "", nextTargets: "" },
  });
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [conferences, setConferences] = useState<ConferenceRow[]>([]);
  const [patents, setPatents] = useState<PatentRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [paperDraft, setPaperDraft] = useState<PaperRow>({
    title: "",
    journal: "",
    volume: "",
    issue: "",
    indexedIn: "",
  });
  const [addingPaper, setAddingPaper] = useState(false);

  if (!ready || !doctoral || !load)
    return <p className="text-sm text-muted-foreground">Loading reports…</p>;

  const enrollment = session ? enrollmentFor(doctoral, session.identifier) : null;
  const batch = doctoral.batches.find((item) => item.id === enrollment?.batchId) ?? null;
  const periods = session ? reportPeriodsFor(doctoral, session.identifier) : [];
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
    const due = periods.find((item) => item.label === label)?.due ?? "";
    // Reports due before online submission began were received on paper.
    if (due && due < sixMonthOnlineFrom) return false;
    const report = reportFor(label, ownReports);
    if (report?.status === "Returned") return true;
    if (report) return false;
    const access = ownAccess.find(
      (item) => item.period === label && item.status === "Granted",
    );
    if (access) return true;
    return current?.label === label;
  }

  function findGuide() {
    if (!session) return null;
    const allotment = allocationFor(office?.allocations ?? [], session.identifier);
    if (allotment) return allotment;
    const scholar = scholarBySignIn(session.identifier);
    const guide = scholar ? supervisorForGuide(scholar.guideName) : null;
    return guide || scholar?.guideName
      ? {
          supervisorIdentifier: guide?.supervisorId.trim() || scholar?.guideName || "",
          supervisorName: guide?.name || scholar?.guideName || "",
        }
      : null;
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
    const problem = fileError(file?.file ?? null, "pdfDocument", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the report.");
      return;
    }
    const guideFor = findGuide();
    const data = await storeFile(file.file, "records").catch(() => "");
    const existing = reportFor(period, ownReports);
    const saved = await saveScholarRecord(
      {
        kind: "six_month_report",
        scholarIdentifier: session.identifier,
        scholarName: session.name,
        payload: {
          period,
          progress: values.progress,
          coursesCompleted: values.coursesCompleted,
          nextTargets: values.nextTargets,
          papers: JSON.stringify(papers),
          conferences: JSON.stringify(conferences),
          patents: JSON.stringify(patents),
          activities: JSON.stringify(activities),
        },
        fileName: file.file.name,
        fileData: data || null,
        supervisorIdentifier: guideFor?.supervisorIdentifier ?? "",
        supervisorName: guideFor?.supervisorName ?? "",
      },
      existing?.status === "Returned" ? existing.id : undefined,
    );
    setNotice(
      saved.ok
        ? guideFor
          ? "Report submitted to your supervisor."
          : "Report submitted to the Dean."
        : saved.message,
    );
    if (saved.ok) {
      setReporting(false);
      form.reset();
      setFile(null);
      setPapers([]);
      setConferences([]);
      setPatents([]);
      setActivities([]);
      setAddingPaper(false);
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
            filterMatches(statusFilter, record.status) &&
            profile.matches(record.scholarIdentifier) &&
            textMatches(query, [
              record.scholarName,
              record.payload.period ?? "",
              record.payload.progress ?? "",
              record.status,
            ]),
        )
      : ownReports;

  return (
    <DeskPage title="Six-month report">
      <ProcessFlow>{processFlows.sixMonth}</ProcessFlow>
      {mode === "scholar" ? (
        <ScholarIdentityHeader identifier={session?.identifier ?? ""} />
      ) : null}
      {mode === "scholar" ? (
        periods.length === 0 ? (
          <GateBanner>
            The research office has to place you in a batch before reports open.
          </GateBanner>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm text-muted-foreground">
                {[batch?.name, enrollment?.studyMode].filter(Boolean).join(" · ") ||
                  "Six-month reports"}
                {current
                  ? ` · Current period ${current.label}`
                  : " · No period is due yet"}
              </p>
              <Button
                type="button"
                variant="gold"
                onClick={() => {
                  setNotice(null);
                  setReporting(true);
                }}
              >
                Submit report
              </Button>
            </div>
            <DeskSection title="Already submitted report">
              <DeskTable
                headers={["Requested on", "Status", "Remark", ""]}
                empty={ownReports.length === 0}
              >
                {ownReports.map((record) => (
                  <tr key={record.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      {record.payload.period} · {record.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <ApprovalBadge summary={recordSummary(record, false)} showDetail />
                    </td>
                    <td className="px-4 py-3">{record.payload.remarks || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <ViewFilesButton
                        fileName={record.fileName}
                        load={() => loadRecordFile(record)}
                        stamp={recordViewStamp(record)}
                        onMissing={setNotice}
                      />
                    </td>
                  </tr>
                ))}
              </DeskTable>
            </DeskSection>
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
            {reporting ? (
              <FormDialog
                title="Six-month report"
                onClose={() => setReporting(false)}
                onSubmit={form.handleSubmit(upload)}
                submitLabel="Upload report"
                size="lg"
              >
                {notice ? (
                  <p role="alert" className="text-sm text-secondary">
                    {notice}
                  </p>
                ) : null}
                <DeskSection
                  title="Paper published details"
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingPaper((open) => !open)}
                    >
                      Add new
                    </Button>
                  }
                >
                  {addingPaper ? (
                    <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
                      <Input
                        placeholder="Title of paper"
                        value={paperDraft.title}
                        onChange={(event) =>
                          setPaperDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                      <Input
                        placeholder="Title of journal"
                        value={paperDraft.journal}
                        onChange={(event) =>
                          setPaperDraft((current) => ({
                            ...current,
                            journal: event.target.value,
                          }))
                        }
                      />
                      <Input
                        placeholder="Volume"
                        value={paperDraft.volume}
                        onChange={(event) =>
                          setPaperDraft((current) => ({
                            ...current,
                            volume: event.target.value,
                          }))
                        }
                      />
                      <Input
                        placeholder="Issue"
                        value={paperDraft.issue}
                        onChange={(event) =>
                          setPaperDraft((current) => ({
                            ...current,
                            issue: event.target.value,
                          }))
                        }
                      />
                      <Input
                        placeholder="Indexed in"
                        value={paperDraft.indexedIn}
                        onChange={(event) =>
                          setPaperDraft((current) => ({
                            ...current,
                            indexedIn: event.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="gold"
                        onClick={() => {
                          if (paperDraft.title.trim().length < 2) return;
                          setPapers((current) => [...current, paperDraft]);
                          setPaperDraft({
                            title: "",
                            journal: "",
                            volume: "",
                            issue: "",
                            indexedIn: "",
                          });
                          setAddingPaper(false);
                        }}
                      >
                        Save paper
                      </Button>
                    </div>
                  ) : null}
                  <DeskTable
                    headers={[
                      "Title of paper",
                      "Title of journal",
                      "Volume",
                      "Issue",
                      "Indexed in",
                    ]}
                    empty={papers.length === 0}
                  >
                    {papers.map((row, index) => (
                      <tr
                        key={`${row.title}-${index}`}
                        className="border-t border-border"
                      >
                        <td className="px-4 py-3">{row.title}</td>
                        <td className="px-4 py-3">{row.journal || "—"}</td>
                        <td className="px-4 py-3">{row.volume || "—"}</td>
                        <td className="px-4 py-3">{row.issue || "—"}</td>
                        <td className="px-4 py-3">{row.indexedIn || "—"}</td>
                      </tr>
                    ))}
                  </DeskTable>
                </DeskSection>
                <DeskSection
                  title="Conference / workshop details"
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setConferences((current) => [
                          ...current,
                          {
                            nature: programmeNatures[0],
                            name: "",
                            level: conferenceLevels[0],
                            institute: "",
                            fromTo: "",
                          },
                        ])
                      }
                    >
                      Add new
                    </Button>
                  }
                >
                  <DeskTable
                    headers={[
                      "Program nature",
                      "Name of the program",
                      "Level",
                      "Organizing institute",
                      "From & to",
                    ]}
                    empty={conferences.length === 0}
                  >
                    {conferences.map((row, index) => (
                      <tr key={`conf-${index}`} className="border-t border-border">
                        <td className="px-4 py-3">{row.nature}</td>
                        <td className="px-4 py-3">
                          <Input
                            value={row.name}
                            onChange={(event) =>
                              setConferences((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">{row.level}</td>
                        <td className="px-4 py-3">{row.institute || "—"}</td>
                        <td className="px-4 py-3">{row.fromTo || "—"}</td>
                      </tr>
                    ))}
                  </DeskTable>
                </DeskSection>
                <DeskSection
                  title="Patent details"
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPatents((current) => [
                          ...current,
                          {
                            number: "",
                            status: patentStatuses[0],
                            inventor: "",
                            title: "",
                            filedOn: "",
                          },
                        ])
                      }
                    >
                      Add new
                    </Button>
                  }
                >
                  <DeskTable
                    headers={[
                      "Patent application number",
                      "Status of patent",
                      "Inventor’s name",
                      "Title of the patent",
                      "Patent filed date",
                    ]}
                    empty={patents.length === 0}
                  >
                    {patents.map((row, index) => (
                      <tr key={`pat-${index}`} className="border-t border-border">
                        <td className="px-4 py-3">
                          <Input
                            value={row.number}
                            onChange={(event) =>
                              setPatents((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, number: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">{row.inventor || "—"}</td>
                        <td className="px-4 py-3">{row.title || "—"}</td>
                        <td className="px-4 py-3">{row.filedOn || "—"}</td>
                      </tr>
                    ))}
                  </DeskTable>
                </DeskSection>
                <DeskSection
                  title="Other activities details"
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setActivities((current) => [
                          ...current,
                          { type: "", details: "", date: "", remarks: "" },
                        ])
                      }
                    >
                      Add new
                    </Button>
                  }
                >
                  <DeskTable
                    headers={["Type", "Details", "Date", "Remarks"]}
                    empty={activities.length === 0}
                  >
                    {activities.map((row, index) => (
                      <tr key={`act-${index}`} className="border-t border-border">
                        <td className="px-4 py-3">
                          <Input
                            value={row.type}
                            onChange={(event) =>
                              setActivities((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, type: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">{row.details || "—"}</td>
                        <td className="px-4 py-3">{row.date || "—"}</td>
                        <td className="px-4 py-3">{row.remarks || "—"}</td>
                      </tr>
                    ))}
                  </DeskTable>
                </DeskSection>
                <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
                  <FormField label="Period" htmlFor="report-period" required>
                    <NativeSelect
                      id="report-period"
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
                    </NativeSelect>
                  </FormField>
                  <FormField
                    label="No. of courses completed"
                    htmlFor="report-courses"
                    error={form.formState.errors.coursesCompleted?.message}
                  >
                    <Input id="report-courses" {...form.register("coursesCompleted")} />
                  </FormField>
                  <FormField
                    label="Work done"
                    htmlFor="report-progress"
                    required
                    error={form.formState.errors.progress?.message}
                  >
                    <Textarea id="report-progress" {...form.register("progress")} />
                  </FormField>
                  <FormField
                    label="Aim and objectives of the work to be done"
                    htmlFor="report-targets"
                    required
                    error={form.formState.errors.nextTargets?.message}
                  >
                    <Textarea id="report-targets" {...form.register("nextTargets")} />
                  </FormField>
                  <FormField label="Report" htmlFor="report-file" required>
                    <FileUpload
                      id="report-file"
                      acceptRule="pdfDocument"
                      value={file}
                      onChange={setFile}
                    />
                  </FormField>
                </div>
              </FormDialog>
            ) : null}
          </div>
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
        <DeskTabs
          tabs={[
            { id: "reports", label: "Online reports" },
            { id: "paper", label: "Received before July 2026" },
          ]}
          value={officeTab}
          onChange={(id) => setOfficeTab(id as "reports" | "paper")}
        />
      ) : null}
      {mode === "admin" && officeTab === "paper" ? (
        <SixMonthOfficeEntry doctoral={doctoral} records={load.records} />
      ) : null}
      {mode === "admin" && officeTab === "reports" ? (
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
            ...profile.filters,
          ]}
          shown={rows.length}
          total={load.records.length}
          filename="six-month-reports.csv"
          headers={["scholar", "period", "status", "approved_on", "remarks", ...profile.headers]}
          rows={rows.map((record) => [
            record.scholarName,
            record.payload.period ?? "",
            record.status,
            record.payload.approvedOn ?? "",
            record.payload.remarks ?? "",
            ...profile.cells(record.scholarIdentifier),
          ])}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      <ul className={mode === "admin" && officeTab === "paper" ? "hidden" : "space-y-3"}>
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
              <div className="flex flex-wrap items-center gap-2">
                <ViewFilesButton
                  fileName={record.fileName}
                  load={() => loadRecordFile(record)}
                  stamp={recordViewStamp(record)}
                  onMissing={setNotice}
                />
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
            </div>
            <p className="text-sm text-muted-foreground">{record.payload.progress}</p>
            {mode === "admin" &&
            record.status === "Submitted" &&
            record.supervisorIdentifier.trim() ? (
              <p className="text-sm text-muted-foreground">
                Waiting for the supervisor&apos;s approval.
              </p>
            ) : null}
            {mode === "admin" &&
            (record.status === "Supervisor approved" ||
              (record.status === "Submitted" && !record.supervisorIdentifier.trim())) ? (
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
    </DeskPage>
  );
}
