"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { ApprovedCopyButton } from "@/components/portal/ApprovedCopyButton";
import {
  OfficeConfirmationLetters,
  ScholarConfirmationLetter,
} from "@/components/portal/ConfirmationLetterPanel";
import {
  DeskModal,
  DeskPage,
  DeskTabs,
  FormDialog,
  GateBanner,
  ScholarIdentityHeader,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dcCopy, dcOfficeEntryBatchIds } from "@/data/doctoral";
import { researchRegister } from "@/data/research-register";
import { approvedDocuments } from "@/lib/approved-documents";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  committeeBlocked,
  currentDoctoral,
  decideCommittee,
  latestCommittee,
  recommendCommittee,
  recordCommitteeHeld,
  saveCommittee,
  setCommitteeTitle,
  subscribeDoctoral,
  synopsisSubmitted,
  type CommitteeKind,
  type CommitteeReport,
  type DoctoralState,
} from "@/lib/doctoral";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import {
  currentOffice,
  sameId,
  scholarsStillGuidedBy,
  subscribeOffice,
} from "@/lib/office";
import { batchOf, isPassedOut, scholarBySignIn, scholarSignInId } from "@/lib/register";
import { loadRecordFile } from "@/lib/scholar-records";
import { researchTitleOf, titleRuleText } from "@/lib/research-title";
import { usePortalSession } from "@/lib/use-preview-session";

/** The first committee fixes the research title and the second finalises it. */
function carriesTitle(kind: CommitteeKind) {
  return kind === "first" || kind === "second";
}

/** True when the scholar's batch met before the ERP and the office records the committee. */
export function isOfficeEntryScholar(identifier: string) {
  const scholar = scholarBySignIn(identifier);
  return Boolean(scholar && dcOfficeEntryBatchIds.includes(scholar.batchId));
}

function stageOf(report: CommitteeReport) {
  if (report.status === "Approved") return report.officeEntry ? "Completed" : "Approved";
  if (report.status === "Rejected") return "Returned";
  return report.supervisorStatus === "Recommended" ? "With the Dean" : "With the guide";
}

function stageTone(stage: string) {
  return stage === "Approved" || stage === "Completed"
    ? "gold"
    : stage === "Returned"
      ? "maroon"
      : "purple";
}

function approvedStampFor(doctoral: DoctoralState, report: CommitteeReport) {
  return approvedDocuments([report.scholarIdentifier], doctoral, [], loadRecordFile).find(
    (item) => item.id === report.id,
  );
}

/* ------------------------------- Scholar ------------------------------- */

function ScholarCommittee({
  kind,
  doctoral,
}: {
  kind: CommitteeKind;
  doctoral: DoctoralState;
}) {
  const session = usePortalSession();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [meetingOn, setMeetingOn] = useState("");
  const [researchTitle, setResearchTitle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const identifier = session?.identifier ?? "";
  const title = researchTitleOf(doctoral, identifier);
  const mine = latestCommittee(doctoral, kind, identifier);
  const officeEntry = isOfficeEntryScholar(identifier);
  const gate = committeeBlocked(doctoral, kind, identifier);
  const approved = mine?.status === "Approved" ? approvedStampFor(doctoral, mine) : null;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!meetingOn) {
      setError("Enter the date of the meeting.");
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setError(problem ?? "Attach the committee report (PDF).");
      return;
    }
    if (carriesTitle(kind) && researchTitle.trim().length < 10) {
      setError(
        kind === "first"
          ? "Enter the research title fixed in the meeting."
          : "Enter the final research title approved in the meeting.",
      );
      return;
    }
    const data = await fileToDataUrl(file.file).catch(() => "");
    const saved = await saveCommittee({
      kind,
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      fileName: file.file.name,
      fileData: data || null,
      meetingOn,
      researchTitle: carriesTitle(kind) ? researchTitle.trim() : "",
    });
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setUploading(false);
    setFile(null);
    setNotice("Report submitted. Your guide reviews it first, then the Dean.");
  }

  return (
    <div className="space-y-4">
      <ScholarIdentityHeader identifier={identifier} />
      {kind === "second" ? (
        <ScholarConfirmationLetter doctoral={doctoral} identifier={identifier} />
      ) : null}
      {carriesTitle(kind) ? <GateBanner>{titleRuleText}</GateBanner> : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mine && mine.status !== "Rejected" ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-primary">{dcCopy[kind].title}</p>
              <p className="text-sm text-muted-foreground">
                Meeting {mine.meetingOn ? formatIsoDate(mine.meetingOn) : "—"}
                {mine.fileName ? ` · ${mine.fileName}` : ""}
              </p>
            </div>
            <Badge variant={stageTone(stageOf(mine))}>{stageOf(mine)}</Badge>
          </div>
          {carriesTitle(kind) && mine.researchTitle ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                {kind === "first" ? "Research title fixed" : "Final research title"}
              </p>
              <p className="mt-0.5 font-semibold text-primary">{mine.researchTitle}</p>
            </div>
          ) : null}
          <ol className="grid gap-2 text-sm sm:grid-cols-3">
            {(mine.officeEntry
              ? [["Recorded by the research office", mine.decidedOn]]
              : [
                  ["Submitted", mine.createdAt.slice(0, 10)],
                  ["Guide recommended", mine.supervisorOn],
                  ["Dean approved", mine.status === "Approved" ? mine.decidedOn : ""],
                ]
            ).map(([label, on]) => (
              <li
                key={label}
                className={`rounded-lg border px-3 py-2 ${on ? "border-accent/50 bg-accent/10" : "border-border text-muted-foreground"}`}
              >
                <p className="font-semibold">{label}</p>
                <p className="text-xs">{on ? formatIsoDate(on) : "Pending"}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-end gap-2">
            <ViewFilesButton
              fileName={mine.fileName}
              data={mine.fileData}
              onMissing={setNotice}
            />
            {approved ? (
              <ApprovedCopyButton
                fileName={approved.fileName}
                data={approved.fileData}
                stamp={approved.stamp}
                onError={setNotice}
              />
            ) : null}
          </div>
        </div>
      ) : officeEntry ? (
        <GateBanner>
          For your batch the research office records this committee once it has met.
        </GateBanner>
      ) : gate ? (
        <GateBanner tone="danger">{gate}</GateBanner>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">
            {mine?.status === "Rejected"
              ? `Returned: ${mine.remarks}. Upload the corrected report.`
              : "Upload the committee report after the meeting."}
          </p>
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              setError(null);
              setResearchTitle(
                kind === "second" ? title.title : (mine?.researchTitle ?? title.title),
              );
              setUploading(true);
            }}
          >
            Upload report
          </Button>
        </div>
      )}
      {uploading ? (
        <FormDialog
          title={`${dcCopy[kind].title} · report`}
          onClose={() => setUploading(false)}
          onSubmit={(event) => void upload(event)}
          submitLabel="Submit to guide"
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <FormField label="Date of meeting" htmlFor="dc-meeting" required>
            <Input
              id="dc-meeting"
              type="date"
              max={clientToday()}
              value={meetingOn}
              onChange={(event) => setMeetingOn(event.target.value)}
            />
          </FormField>
          {carriesTitle(kind) ? (
            <FormField
              label={
                kind === "first"
                  ? "Research title fixed in the meeting"
                  : "Final research title approved in the meeting"
              }
              htmlFor="dc-title"
              required
            >
              <Textarea
                id="dc-title"
                rows={3}
                value={researchTitle}
                onChange={(event) => setResearchTitle(event.target.value)}
              />
            </FormField>
          ) : null}
          <FormField label="Committee report (PDF)" htmlFor={`${kind}-report`} required>
            <FileUpload
              id={`${kind}-report`}
              acceptRule="document"
              value={file}
              onChange={setFile}
            />
          </FormField>
        </FormDialog>
      ) : null}
    </div>
  );
}

/* ------------------------------ Supervisor ------------------------------ */

export function SupervisorCommitteeScreen() {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [acting, setActing] = useState<{
    report: CommitteeReport;
    status: "Recommended" | "Returned";
  } | null>(null);
  const [remarks, setRemarks] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ready || !doctoral || !office || !session) {
    return <p className="text-sm text-muted-foreground">Loading committee reports…</p>;
  }
  const mine = [
    ...office.allocations
      .filter((item) => sameId(item.supervisorIdentifier, session.identifier))
      .map((item) => item.scholarIdentifier),
    ...scholarsStillGuidedBy(session.name, session.identifier, office.allocations).map(
      (scholar) => scholarSignInId(scholar),
    ),
  ];
  const reports = doctoral.committees
    .filter((item) => mine.some((key) => sameId(key, item.scholarIdentifier)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acting) return;
    const saved = await recommendCommittee(acting.report.id, {
      status: acting.status,
      remarks,
    });
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setNotice(
      acting.status === "Recommended"
        ? `${acting.report.scholarName}'s report is sent to the Dean.`
        : `${acting.report.scholarName}'s report is returned.`,
    );
    setActing(null);
  }

  return (
    <DeskPage kicker="Supervision" title="Doctoral committees">
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {reports.length === 0 ? (
        <GateBanner>No committee report from your scholars yet.</GateBanner>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-4 py-3">Scholar</th>
                <th className="px-4 py-3">Committee</th>
                <th className="px-4 py-3">Meeting</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const stage = stageOf(report);
                const approved =
                  report.status === "Approved"
                    ? approvedStampFor(doctoral, report)
                    : null;
                return (
                  <tr key={report.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-semibold text-primary">
                      {report.scholarName}
                    </td>
                    <td className="px-4 py-3">{dcCopy[report.kind].title}</td>
                    <td className="px-4 py-3">
                      {report.meetingOn ? formatIsoDate(report.meetingOn) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={stageTone(stage)}>{stage}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ViewFilesButton
                          fileName={report.fileName}
                          data={report.fileData}
                          onMissing={setNotice}
                        />
                        {approved ? (
                          <ApprovedCopyButton
                            fileName={approved.fileName}
                            data={approved.fileData}
                            stamp={approved.stamp}
                            onError={setNotice}
                          />
                        ) : null}
                        {stage === "With the guide" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="gold"
                              onClick={() => {
                                setError(null);
                                setRemarks("");
                                setActing({ report, status: "Recommended" });
                              }}
                            >
                              Recommend
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setError(null);
                                setRemarks("");
                                setActing({ report, status: "Returned" });
                              }}
                            >
                              Return
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {acting ? (
        <FormDialog
          title={`${acting.status === "Recommended" ? "Recommend" : "Return"} · ${acting.report.scholarName}`}
          onClose={() => setActing(null)}
          onSubmit={(event) => void submit(event)}
          submitLabel={
            acting.status === "Recommended" ? "Send to the Dean" : "Return to scholar"
          }
          size="sm"
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <FormField
            label={acting.status === "Recommended" ? "Remarks (optional)" : "Remarks"}
            htmlFor="dc-guide-remarks"
            required={acting.status === "Returned"}
          >
            <Textarea
              id="dc-guide-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </FormField>
        </FormDialog>
      ) : null}
    </DeskPage>
  );
}

/* -------------------------------- Office -------------------------------- */

function OfficeCommittee({
  kind,
  doctoral,
}: {
  kind: CommitteeKind;
  doctoral: DoctoralState;
}) {
  const session = usePortalSession();
  const [tab, setTab] = useState<"reports" | "office" | "letters">("reports");
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [marking, setMarking] = useState<{ identifier: string; name: string }[] | null>(
    null,
  );
  const [meetingOn, setMeetingOn] = useState("");
  const [markRemarks, setMarkRemarks] = useState("");
  const [markTitles, setMarkTitles] = useState<Record<string, string>>({});
  const [titling, setTitling] = useState<CommitteeReport | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [reviewing, setReviewing] = useState<CommitteeReport | null>(null);
  const [decision, setDecision] = useState({
    agenda: "",
    attendance: "",
    minutes: "",
    remarks: "",
  });
  const [error, setError] = useState<string | null>(null);
  const canDecide = session?.role === "dean" || session?.role === "admin";

  const reports = doctoral.committees.filter(
    (item) => item.kind === kind && !item.officeEntry,
  );
  const shownReports = reports.filter(
    (item) =>
      filterMatches(stageFilter, stageOf(item)) &&
      textMatches(query, [item.scholarName, item.fileName, item.remarks]),
  );

  const legacy = researchRegister.scholars
    .filter((scholar) => dcOfficeEntryBatchIds.includes(scholar.batchId))
    .map((scholar) => {
      const identifier = scholarSignInId(scholar);
      const report = latestCommittee(doctoral, kind, identifier);
      return {
        identifier,
        name: scholar.name,
        batchName: batchOf(scholar.batchId)?.name ?? "",
        report: report?.status === "Approved" ? report : null,
      };
    })
    .filter((row) => !isPassedOut(row.identifier, row.name));
  const shownLegacy = legacy.filter(
    (row) =>
      filterMatches(batchFilter, row.batchName) &&
      filterMatches(stageFilter, row.report ? "Completed" : "Not recorded") &&
      textMatches(query, [row.name, row.identifier, row.batchName]),
  );

  async function mark(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!marking) return;
    if (
      carriesTitle(kind) &&
      marking.some((row) => (markTitles[row.identifier] ?? "").trim().length < 10)
    ) {
      setError("Enter the research title of every scholar.");
      return;
    }
    const saved = await recordCommitteeHeld({
      kind,
      meetingOn,
      remarks: markRemarks,
      scholars: marking,
      titles: carriesTitle(kind) ? markTitles : undefined,
    });
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setNotice(
      `${"saved" in saved ? saved.saved : marking.length} scholar(s) marked completed.`,
    );
    setMarking(null);
    setSelected([]);
  }

  async function decide(status: "Approved" | "Rejected") {
    if (!reviewing) return;
    if (status === "Rejected" && decision.remarks.trim().length < 2) {
      setError("Enter the remarks before returning.");
      return;
    }
    const saved = await decideCommittee(reviewing.id, {
      status,
      remarks: decision.remarks.trim(),
      agenda: decision.agenda.trim(),
      attendance: decision.attendance.trim(),
      minutes: decision.minutes.trim(),
      decidedOn: clientToday(),
    });
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setNotice(
      `${reviewing.scholarName}: ${status === "Approved" ? "approved" : "returned"}.`,
    );
    setReviewing(null);
  }

  const choices = (values: string[]) =>
    [...new Set(values)]
      .filter(Boolean)
      .sort()
      .map((value) => ({ value, label: value }));

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskTabs
        tabs={[
          { id: "reports", label: `Uploaded reports (${reports.length})` },
          { id: "office", label: "Batches 1–3 · mark completed" },
          ...(kind === "second"
            ? [{ id: "letters", label: "Confirmation letters" }]
            : []),
        ]}
        value={tab}
        onChange={(id) => {
          setTab(id as typeof tab);
          setStageFilter("");
          setSelected([]);
        }}
      />
      {tab === "letters" ? (
        <OfficeConfirmationLetters />
      ) : tab === "reports" ? (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "stage",
                label: "Status",
                value: stageFilter,
                options: ["With the guide", "With the Dean", "Approved", "Returned"].map(
                  (value) => ({
                    value,
                    label: value,
                  }),
                ),
                onChange: setStageFilter,
              },
            ]}
            shown={shownReports.length}
            total={reports.length}
            filename={`${kind}-committee-reports.csv`}
            headers={[
              "Scholar",
              "Meeting",
              "File",
              "Status",
              "Guide",
              "Decided on",
              "Decided by",
            ]}
            rows={shownReports.map((item) => [
              item.scholarName,
              item.meetingOn,
              item.fileName,
              stageOf(item),
              item.supervisorName,
              item.decidedOn,
              item.decidedBy,
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-4 py-3">Scholar</th>
                  <th className="px-4 py-3">Meeting</th>
                  <th className="px-4 py-3">Guide</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownReports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No uploaded report.
                    </td>
                  </tr>
                ) : (
                  shownReports.map((report) => {
                    const stage = stageOf(report);
                    const approved =
                      report.status === "Approved"
                        ? approvedStampFor(doctoral, report)
                        : null;
                    return (
                      <tr key={report.id} className="border-t border-border align-top">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-primary">
                            {report.scholarName}
                          </p>
                          {carriesTitle(kind) && report.researchTitle ? (
                            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                              {report.researchTitle}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {report.meetingOn ? formatIsoDate(report.meetingOn) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {report.supervisorStatus
                            ? `${report.supervisorStatus} · ${report.supervisorName}`
                            : "Waiting"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={stageTone(stage)}>{stage}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <ViewFilesButton
                              fileName={report.fileName}
                              data={report.fileData}
                              onMissing={setNotice}
                            />
                            {approved ? (
                              <ApprovedCopyButton
                                fileName={approved.fileName}
                                data={approved.fileData}
                                stamp={approved.stamp}
                                onError={setNotice}
                              />
                            ) : null}
                            {stage === "With the Dean" && canDecide ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setError(null);
                                  setDecision({
                                    agenda: "",
                                    attendance: "",
                                    minutes: "",
                                    remarks: "",
                                  });
                                  setReviewing(report);
                                }}
                              >
                                Review
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {legacy.filter((row) => row.report).length} of {legacy.length} completed
            </p>
            <Button
              type="button"
              variant="gold"
              disabled={selected.length === 0}
              onClick={() => {
                setError(null);
                setMeetingOn("");
                setMarkRemarks("");
                setMarkTitles({});
                setMarking(legacy.filter((row) => selected.includes(row.identifier)));
              }}
            >
              Mark completed{selected.length ? ` (${selected.length})` : ""}
            </Button>
          </div>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "batch",
                label: "Batch",
                value: batchFilter,
                options: choices(legacy.map((row) => row.batchName)),
                onChange: setBatchFilter,
              },
              {
                id: "stage",
                label: "Status",
                value: stageFilter,
                options: ["Completed", "Not recorded"].map((value) => ({
                  value,
                  label: value,
                })),
                onChange: setStageFilter,
              },
            ]}
            shown={shownLegacy.length}
            total={legacy.length}
            filename={`${kind}-committee-batches-1-3.csv`}
            headers={["Scholar", "Batch", "Status", "Meeting date", "Recorded by"]}
            rows={shownLegacy.map((row) => [
              row.name,
              row.batchName,
              row.report ? "Completed" : "Not recorded",
              row.report?.meetingOn ?? "",
              row.report?.decidedBy ?? "",
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all not recorded"
                      checked={
                        shownLegacy.some((row) => !row.report) &&
                        shownLegacy
                          .filter((row) => !row.report)
                          .every((row) => selected.includes(row.identifier))
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? shownLegacy
                                .filter((row) => !row.report)
                                .map((row) => row.identifier)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-3">Scholar</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownLegacy.map((row) => (
                  <tr key={row.identifier} className="border-t border-border">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.name}`}
                        disabled={Boolean(row.report)}
                        checked={selected.includes(row.identifier)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, row.identifier]
                              : current.filter((item) => item !== row.identifier),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{row.name}</td>
                    <td className="px-4 py-3">{row.batchName}</td>
                    <td className="px-4 py-3">
                      {row.report ? (
                        <>
                          <Badge variant="gold">Completed</Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Met {formatIsoDate(row.report.meetingOn)} ·{" "}
                            {row.report.decidedBy}
                          </p>
                          {carriesTitle(kind) ? (
                            <p className="mt-1 max-w-md text-xs">
                              {row.report.researchTitle || "Research title not recorded"}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <Badge variant="outline">Not recorded</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.report ? (
                        carriesTitle(kind) &&
                        !synopsisSubmitted(doctoral, row.identifier) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setError(null);
                              setTitleDraft(row.report?.researchTitle ?? "");
                              setTitling(row.report);
                            }}
                          >
                            {row.report.researchTitle ? "Edit title" : "Add title"}
                          </Button>
                        ) : null
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setMeetingOn("");
                            setMarkRemarks("");
                            setMarkTitles({});
                            setMarking([row]);
                          }}
                        >
                          Mark completed
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {marking ? (
        <FormDialog
          title={`${dcCopy[kind].title} · mark completed (${marking.length})`}
          onClose={() => setMarking(null)}
          onSubmit={(event) => void mark(event)}
          submitLabel="Mark completed"
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {marking
              .slice(0, 6)
              .map((row) => row.name)
              .join(", ")}
            {marking.length > 6 ? ` and ${marking.length - 6} more` : ""}
          </p>
          <FormField label="Date of meeting" htmlFor="dc-held-on" required>
            <Input
              id="dc-held-on"
              type="date"
              max={clientToday()}
              value={meetingOn}
              onChange={(event) => setMeetingOn(event.target.value)}
            />
          </FormField>
          {carriesTitle(kind) ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">
                {kind === "first" ? "Research title fixed" : "Final research title"}
              </p>
              {marking.map((row) => (
                <label key={row.identifier} className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {row.name}
                  </span>
                  <Textarea
                    rows={2}
                    value={markTitles[row.identifier] ?? ""}
                    onChange={(event) =>
                      setMarkTitles((current) => ({
                        ...current,
                        [row.identifier]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}
          <FormField label="Remarks" htmlFor="dc-held-remarks">
            <Textarea
              id="dc-held-remarks"
              value={markRemarks}
              onChange={(event) => setMarkRemarks(event.target.value)}
            />
          </FormField>
        </FormDialog>
      ) : null}

      {titling ? (
        <FormDialog
          title={`Research title · ${titling.scholarName}`}
          onClose={() => setTitling(null)}
          submitLabel="Save title"
          onSubmit={(event) => {
            event.preventDefault();
            void setCommitteeTitle(titling.id, titleDraft).then((saved) => {
              if (!saved.ok) {
                setError(saved.message);
                return;
              }
              setNotice(`Research title saved for ${titling.scholarName}.`);
              setTitling(null);
            });
          }}
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <FormField label="Research title" htmlFor="dc-title-edit" required>
            <Textarea
              id="dc-title-edit"
              rows={3}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
          </FormField>
        </FormDialog>
      ) : null}

      {reviewing ? (
        <DeskModal
          title={`${dcCopy[kind].title} · ${reviewing.scholarName}`}
          onClose={() => setReviewing(null)}
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <p className="text-sm">
            Meeting {reviewing.meetingOn ? formatIsoDate(reviewing.meetingOn) : "—"} ·
            recommended by {reviewing.supervisorName} on{" "}
            {formatIsoDate(reviewing.supervisorOn)}
            {reviewing.supervisorRemarks ? ` · “${reviewing.supervisorRemarks}”` : ""}
          </p>
          {carriesTitle(kind) && reviewing.researchTitle ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                {kind === "first" ? "Research title proposed" : "Final research title"}
              </p>
              <p className="mt-0.5 font-semibold text-primary">
                {reviewing.researchTitle}
              </p>
            </div>
          ) : null}
          <ViewFilesButton
            fileName={reviewing.fileName}
            data={reviewing.fileData}
            onMissing={setNotice}
          />
          {(["agenda", "attendance", "minutes", "remarks"] as const).map((field) => (
            <FormField
              key={field}
              label={field[0].toUpperCase() + field.slice(1)}
              htmlFor={`dc-${field}`}
              required={field === "minutes"}
            >
              <Textarea
                id={`dc-${field}`}
                value={decision[field]}
                onChange={(event) =>
                  setDecision((current) => ({ ...current, [field]: event.target.value }))
                }
              />
            </FormField>
          ))}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="maroon"
              size="sm"
              onClick={() => void decide("Rejected")}
            >
              Return
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={() => void decide("Approved")}
            >
              Approve
            </Button>
          </div>
        </DeskModal>
      ) : null}
    </div>
  );
}

export function CommitteeScreen({
  kind,
  mode,
}: {
  kind: CommitteeKind;
  mode: "admin" | "scholar";
}) {
  const ready = useClientReady();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading the committee report…</p>;
  }
  return (
    <DeskPage kicker="Doctoral progress" title={dcCopy[kind].title}>
      {mode === "scholar" ? (
        <ScholarCommittee kind={kind} doctoral={doctoral} />
      ) : (
        <OfficeCommittee kind={kind} doctoral={doctoral} />
      )}
    </DeskPage>
  );
}
