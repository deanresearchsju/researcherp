"use client";

import { useState, useSyncExternalStore } from "react";

import {
  ApplicationViewer,
  type ReviewAction,
} from "@/components/portal/ApplicationViewer";
import { DeskModal, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { applicationReviewCopy } from "@/data/application-review";
import { field } from "@/lib/csv";
import { formatIsoDate } from "@/lib/dates";
import {
  currentAdmission,
  isArchivedApplication,
  subscribeAdmission,
} from "@/lib/admission";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import { useCanMenuAction } from "@/lib/use-menu-action";
import {
  applicationStatuses,
  approveApplicationStage,
  canAdvanceApplication,
  canChangeApplicationStatus,
  deleteApplication,
  nextApplicationStage,
  rejectApplicationStage,
  reviewSupervisorApplication,
  supervisorReviewStatuses,
  updateApplicationStatus,
  type ApplicationKind,
  type StoredApplication,
} from "@/lib/records";
import { saveApprovedQuota } from "@/lib/register";
import { phdReceiptFromApplication } from "@/lib/scholar-progress";
import { supervisorReceiptFromApplication } from "@/lib/supervisor-application";
import { downloadSupervisorApplications } from "@/lib/supervisor-application-pdf";
import type { Json } from "@/types/database";

function payloadValue(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

const applicationColumns = [
  "kind",
  "application_no",
  "applicant_name",
  "email",
  "date_of_birth",
  "study_mode",
  "status",
  "submitted",
] as const;

function kindFromCell(value: string): ApplicationKind | null {
  const normal = value.trim().toLowerCase();
  if (normal === "phd" || normal === "ph.d." || normal === "ph.d") return "phd";
  if (normal === "supervisor" || normal === "supervisor recognition") return "supervisor";
  return null;
}

function dateLabel(value: string) {
  return formatIsoDate(value.slice(0, 10));
}

function payloadText(payload: Json) {
  return JSON.stringify(payload, null, 2) ?? "";
}

function ApplicationTable({
  title,
  rows,
  busy,
  selectable,
  selectedIds,
  onToggle,
  onToggleAll,
  onDownload,
  downloadBusy,
  onMoveNext,
  onApprove,
  onReject,
  onStatus,
  onRemove,
  onView,
}: {
  title: string;
  rows: StoredApplication[];
  busy: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  onDownload?: () => void;
  downloadBusy?: boolean;
  onMoveNext?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onStatus: (row: StoredApplication, status: string) => void;
  onRemove: (row: StoredApplication) => void;
  onView: (row: StoredApplication) => void;
}) {
  const canDownload = useCanMenuAction("export");
  const picked = selectedIds ?? [];
  const selectedRows = rows.filter((row) => picked.includes(row.id));
  const allOn = rows.length > 0 && rows.every((row) => picked.includes(row.id));
  const canNext = selectedRows.some((row) => nextApplicationStage(row.kind, row.status));
  const canApprove = selectedRows.some((row) =>
    approveApplicationStage(row.kind, row.status),
  );
  const canReject = selectedRows.some((row) =>
    rejectApplicationStage(row.kind, row.status),
  );
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-heading text-2xl text-primary">{title}</h2>
        {selectable ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onToggleAll}>
              {allOn
                ? applicationReviewCopy.clearSelection
                : applicationReviewCopy.selectAll}
            </Button>
            {canDownload && onDownload ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                disabled={downloadBusy}
                onClick={onDownload}
              >
                {downloadBusy
                  ? applicationReviewCopy.downloadingPdf
                  : picked.length > 1
                    ? applicationReviewCopy.downloadZip
                    : applicationReviewCopy.download}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !canNext}
              onClick={onMoveNext}
            >
              {applicationReviewCopy.moveNext}
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              disabled={busy || !canApprove}
              onClick={onApprove}
            >
              {applicationReviewCopy.bulkApprove}
            </Button>
            <Button
              type="button"
              variant="maroon"
              size="sm"
              disabled={busy || !canReject}
              onClick={onReject}
            >
              {applicationReviewCopy.bulkReject}
            </Button>
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No applications stored yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                {selectable ? (
                  <th className="px-3 py-3 font-semibold">
                    <span className="sr-only">Select</span>
                  </th>
                ) : null}
                <th className="px-3 py-3 font-semibold">Application No.</th>
                <th className="px-3 py-3 font-semibold">Applicant</th>
                <th className="px-3 py-3 font-semibold">Submitted</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  {selectable ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={picked.includes(row.id)}
                        aria-label={`Select ${row.applicationNo}`}
                        onChange={() => onToggle?.(row.id)}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary">{row.applicationNo}</p>
                    {row.studyMode ? (
                      <p className="mt-1 text-muted-foreground">{row.studyMode}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <p>
                      <PersonNameLink
                        role={row.kind === "phd" ? "scholar" : "supervisor"}
                        name={row.applicantName}
                        identifier={row.email.trim() || row.applicationNo}
                      />
                    </p>
                    <p className="mt-1 text-muted-foreground">{row.email}</p>
                    <p className="mt-1 text-muted-foreground">
                      Date of birth {dateLabel(row.dateOfBirth)}
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold text-primary">
                        All stored details
                      </summary>
                      <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs leading-5 whitespace-pre-wrap">
                        {payloadText(row.payload)}
                      </pre>
                    </details>
                  </td>
                  <td className="px-3 py-3">{dateLabel(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <NativeSelect
                      aria-label={`Status for ${row.applicationNo}`}
                      value={row.status}
                      onChange={(event) => onStatus(row, event.target.value)}
                    >
                      {(row.kind === "supervisor"
                        ? supervisorReviewStatuses
                        : applicationStatuses
                      )
                        .filter((status) =>
                          canAdvanceApplication(row.kind, row.status, status),
                        )
                        .map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      {(row.kind === "supervisor"
                        ? supervisorReviewStatuses
                        : applicationStatuses
                      ).some((status) => status === row.status) ? null : (
                        <option value={row.status}>{row.status}</option>
                      )}
                    </NativeSelect>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onView(row)}
                      >
                        {applicationReviewCopy.view}
                      </Button>
                      <Button
                        type="button"
                        variant="maroon"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRemove(row)}
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
      )}
    </section>
  );
}

export function ApplicationManager({
  records,
  detail,
}: {
  records: StoredApplication[];
  detail: string | null;
}) {
  const [rows, setRows] = useState(records);
  const [notice, setNotice] = useState<string | null>(detail);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<StoredApplication | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([]);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [bulkJob, setBulkJob] = useState<{
    kind: ApplicationKind;
    action: "next" | "approve" | "reject";
  } | null>(null);
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [bulkQuota, setBulkQuota] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const canUpload = detail === null;
  const liveRows = rows.filter(
    (row) => row.kind !== "phd" || !isArchivedApplication(row, admission?.archived ?? []),
  );

  function chosenRows(kind: ApplicationKind) {
    const ids = kind === "phd" ? selectedIds : selectedSupervisorIds;
    return liveRows.filter((row) => row.kind === kind && ids.includes(row.id));
  }

  function supervisorDialogNeeded(
    action: "next" | "approve" | "reject",
    chosen: StoredApplication[],
  ) {
    if (action === "approve" || action === "reject") return true;
    return chosen.some((row) => {
      const next = nextApplicationStage(row.kind, row.status);
      return next === "Accepted" || next === "Approved";
    });
  }

  async function runBulk(
    kind: ApplicationKind,
    action: "next" | "approve" | "reject",
    remarks: string,
    quotaText: string,
  ) {
    const chosen = chosenRows(kind);
    if (chosen.length === 0) {
      setNotice(applicationReviewCopy.needSelection);
      return;
    }
    setBusy(true);
    setNotice(null);
    let updated = 0;
    let failed = 0;
    let nextRows = rows;
    for (const row of chosen) {
      const status =
        action === "next"
          ? nextApplicationStage(row.kind, row.status)
          : action === "approve"
            ? approveApplicationStage(row.kind, row.status)
            : rejectApplicationStage(row.kind, row.status);
      if (!status) continue;
      let saved = false;
      if (
        row.kind === "supervisor" &&
        (status === "Accepted" || status === "Approved" || status === "Rejected")
      ) {
        const quota = status === "Approved" ? Number(quotaText) : undefined;
        saved = await reviewSupervisorApplication(
          row.id,
          row.payload,
          status,
          remarks.trim(),
          Number.isInteger(quota) ? quota : undefined,
        );
        if (
          saved &&
          status === "Approved" &&
          Number.isInteger(quota) &&
          quota !== undefined
        ) {
          await saveApprovedQuota({
            name: row.applicantName,
            quota,
            department:
              payloadValue(row.payload, "proposedDepartment") ||
              payloadValue(row.payload, "department"),
            designation: payloadValue(row.payload, "designation"),
          });
        }
      } else {
        saved = await updateApplicationStatus(row.kind, row.id, status);
      }
      if (saved) {
        updated += 1;
        nextRows = nextRows.map((item) =>
          item.id === row.id ? { ...item, status } : item,
        );
      } else {
        failed += 1;
      }
    }
    setRows(nextRows);
    setBusy(false);
    setBulkJob(null);
    if (updated === 0) setNotice(applicationReviewCopy.bulkNone);
    else if (failed > 0) setNotice(applicationReviewCopy.bulkPartial);
    else setNotice(applicationReviewCopy.bulkUpdated);
  }

  function requestBulk(kind: ApplicationKind, action: "next" | "approve" | "reject") {
    const chosen = chosenRows(kind);
    if (chosen.length === 0) {
      setNotice(applicationReviewCopy.needSelection);
      return;
    }
    const possible = chosen.some((row) => {
      if (action === "next") return Boolean(nextApplicationStage(row.kind, row.status));
      if (action === "approve")
        return Boolean(approveApplicationStage(row.kind, row.status));
      return Boolean(rejectApplicationStage(row.kind, row.status));
    });
    if (!possible) {
      setNotice(applicationReviewCopy.bulkNone);
      return;
    }
    if (kind === "supervisor" && supervisorDialogNeeded(action, chosen)) {
      setBulkRemarks("");
      setBulkQuota("");
      setBulkJob({ kind, action });
      return;
    }
    void runBulk(kind, action, "", "");
  }

  async function onStatus(row: StoredApplication, status: string) {
    if (!canAdvanceApplication(row.kind, row.status, status)) {
      setNotice("That status change is not allowed.");
      return;
    }
    const previous = row.status;
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, status } : item)),
    );
    const saved = await updateApplicationStatus(row.kind, row.id, status);
    if (!saved) {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, status: previous } : item,
        ),
      );
      setNotice("The status could not be saved.");
    }
  }

  async function onRemove(row: StoredApplication) {
    if (!window.confirm(`Remove application ${row.applicationNo}?`)) return;
    setBusy(true);
    const removed = await deleteApplication(row.kind, row.id);
    setBusy(false);
    if (!removed) {
      setNotice("That application could not be removed.");
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
  }

  async function uploadCsv(records: Record<string, string>[]) {
    setBusy(true);
    setNotice(null);
    let updated = 0;
    const problems: string[] = [];
    for (const [index, record] of records.entries()) {
      const kind = kindFromCell(field(record, ["kind"]));
      const applicationNo = field(record, [
        "application_no",
        "application no",
        "application number",
      ]);
      const status = field(record, ["status"]);
      const match = rows.find(
        (row) =>
          row.kind === kind &&
          row.applicationNo.toLowerCase() === applicationNo.toLowerCase(),
      );
      if (!kind || !match) {
        problems.push(`Row ${index + 2} does not match a stored application.`);
        continue;
      }
      if (!applicationStatuses.includes(status as (typeof applicationStatuses)[number])) {
        problems.push(`Row ${index + 2} has a status the office does not use.`);
        continue;
      }
      if (match.status === status) continue;
      if (!canChangeApplicationStatus(match.status, status)) {
        problems.push(`Row ${index + 2} skips a required status.`);
        continue;
      }
      const saved = await updateApplicationStatus(match.kind, match.id, status);
      if (!saved) {
        problems.push(`Row ${index + 2} could not be updated.`);
        continue;
      }
      updated += 1;
      setRows((current) =>
        current.map((item) => (item.id === match.id ? { ...item, status } : item)),
      );
    }
    setBusy(false);
    const summary = `Updated ${updated} application statuses from the CSV.`;
    setNotice(problems.length ? `${summary} ${problems.slice(0, 3).join(" ")}` : summary);
  }

  const visible = liveRows.filter(
    (row) =>
      filterMatches(kindFilter, row.kind) &&
      filterMatches(statusFilter, row.status) &&
      textMatches(query, [
        row.applicationNo,
        row.applicantName,
        row.email,
        row.status,
        row.studyMode ?? "",
      ]),
  );
  const phd = visible.filter((row) => row.kind === "phd");
  const supervisors = visible.filter((row) => row.kind === "supervisor");

  return (
    <div>
      <PageTitle kicker="Administration" title="Applications" />
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "kind",
            label: "Application",
            value: kindFilter,
            options: [
              { value: "phd", label: "Ph.D." },
              { value: "supervisor", label: "Supervisor recognition" },
            ],
            onChange: setKindFilter,
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            options: [
              ...applicationStatuses,
              ...supervisorReviewStatuses.filter(
                (status) =>
                  !applicationStatuses.includes(
                    status as (typeof applicationStatuses)[number],
                  ),
              ),
            ].map((status) => ({
              value: status,
              label: status,
            })),
            onChange: setStatusFilter,
          },
        ]}
        shown={visible.length}
        total={liveRows.length}
        filename="applications-filtered.csv"
        headers={applicationColumns}
        rows={visible.map((row) => [
          row.kind,
          row.applicationNo,
          row.applicantName,
          row.email,
          row.dateOfBirth.slice(0, 10),
          row.studyMode ?? "",
          row.status,
          row.createdAt.slice(0, 10),
        ])}
      />
      <SpreadsheetBar
        filename="applications.csv"
        headers={applicationColumns}
        rows={visible.map((row) => [
          row.kind,
          row.applicationNo,
          row.applicantName,
          row.email,
          row.dateOfBirth.slice(0, 10),
          row.studyMode ?? "",
          row.status,
          row.createdAt.slice(0, 10),
        ])}
        canUpload={canUpload}
        busy={busy}
        onUpload={(incoming) => void uploadCsv(incoming)}
        onError={setNotice}
      />
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <ApplicationTable
        title="Ph.D. applications"
        rows={phd}
        busy={busy}
        selectable
        selectedIds={selectedIds}
        onToggle={(id) => {
          setSelectedIds((current) =>
            current.includes(id)
              ? current.filter((item) => item !== id)
              : [...current, id],
          );
        }}
        onToggleAll={() => {
          const ids = phd.map((row) => row.id);
          const allOn = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
          setSelectedIds(allOn ? [] : ids);
        }}
        downloadBusy={downloadBusy}
        onDownload={() => {
          const chosen = phd.filter((row) => selectedIds.includes(row.id));
          if (chosen.length === 0) {
            setNotice(applicationReviewCopy.needSelection);
            return;
          }
          setDownloadBusy(true);
          setNotice(null);
          void downloadPhdApplications(chosen.map(phdReceiptFromApplication))
            .catch(() => setNotice(applicationReviewCopy.downloadFailed))
            .finally(() => setDownloadBusy(false));
        }}
        onMoveNext={() => requestBulk("phd", "next")}
        onApprove={() => requestBulk("phd", "approve")}
        onReject={() => requestBulk("phd", "reject")}
        onStatus={onStatus}
        onRemove={(row) => void onRemove(row)}
        onView={setViewing}
      />
      <ApplicationTable
        title="Supervisor recognition"
        rows={supervisors}
        busy={busy}
        selectable
        selectedIds={selectedSupervisorIds}
        onToggle={(id) => {
          setSelectedSupervisorIds((current) =>
            current.includes(id)
              ? current.filter((item) => item !== id)
              : [...current, id],
          );
        }}
        onToggleAll={() => {
          const ids = supervisors.map((row) => row.id);
          const allOn =
            ids.length > 0 && ids.every((id) => selectedSupervisorIds.includes(id));
          setSelectedSupervisorIds(allOn ? [] : ids);
        }}
        downloadBusy={downloadBusy}
        onDownload={() => {
          const chosen = supervisors.filter((row) =>
            selectedSupervisorIds.includes(row.id),
          );
          if (chosen.length === 0) {
            setNotice(applicationReviewCopy.needSelection);
            return;
          }
          setDownloadBusy(true);
          setNotice(null);
          void downloadSupervisorApplications(
            chosen.map(supervisorReceiptFromApplication),
          )
            .catch(() => setNotice(applicationReviewCopy.downloadFailed))
            .finally(() => setDownloadBusy(false));
        }}
        onMoveNext={() => requestBulk("supervisor", "next")}
        onApprove={() => requestBulk("supervisor", "approve")}
        onReject={() => requestBulk("supervisor", "reject")}
        onStatus={onStatus}
        onRemove={(row) => void onRemove(row)}
        onView={setViewing}
      />
      {viewing ? (
        <ApplicationViewer
          application={viewing}
          onClose={() => setViewing(null)}
          review={
            viewing.kind === "supervisor"
              ? {
                  busy,
                  onAction: (action: ReviewAction, remarks: string, quota: string) => {
                    void (async () => {
                      setBusy(true);
                      const approvedQuota =
                        action === "Approved" ? Number(quota) : undefined;
                      const saved = await reviewSupervisorApplication(
                        viewing.id,
                        viewing.payload,
                        action,
                        remarks,
                        approvedQuota,
                      );
                      if (
                        saved &&
                        action === "Approved" &&
                        Number.isInteger(approvedQuota)
                      ) {
                        await saveApprovedQuota({
                          name: viewing.applicantName,
                          quota: approvedQuota ?? 0,
                          department:
                            payloadValue(viewing.payload, "proposedDepartment") ||
                            payloadValue(viewing.payload, "department"),
                          designation: payloadValue(viewing.payload, "designation"),
                        });
                      }
                      setBusy(false);
                      if (!saved) {
                        setNotice("That decision could not be saved.");
                        return;
                      }
                      setRows((current) =>
                        current.map((item) =>
                          item.id === viewing.id ? { ...item, status: action } : item,
                        ),
                      );
                      setViewing(null);
                      setNotice(
                        action === "Approved"
                          ? applicationReviewCopy.approved
                          : action === "Rejected"
                            ? applicationReviewCopy.rejected
                            : applicationReviewCopy.sentForApproval,
                      );
                    })();
                  },
                }
              : undefined
          }
        />
      ) : null}
      {bulkJob ? (
        <DeskModal
          title={
            bulkJob.action === "reject"
              ? applicationReviewCopy.bulkReject
              : bulkJob.action === "approve"
                ? applicationReviewCopy.bulkApprove
                : applicationReviewCopy.moveNext
          }
          onClose={() => setBulkJob(null)}
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (bulkRemarks.trim().length < 2) return;
              void runBulk(bulkJob.kind, bulkJob.action, bulkRemarks, bulkQuota);
            }}
          >
            {bulkJob.action === "approve" ||
            (bulkJob.action === "next" &&
              chosenRows(bulkJob.kind).some(
                (row) => nextApplicationStage(row.kind, row.status) === "Approved",
              )) ? (
              <FormField
                label={applicationReviewCopy.bulkQuota}
                htmlFor="bulk-quota"
                required
              >
                <input
                  id="bulk-quota"
                  className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
                  inputMode="numeric"
                  value={bulkQuota}
                  onChange={(event) => setBulkQuota(event.target.value)}
                />
              </FormField>
            ) : null}
            <FormField
              label={applicationReviewCopy.bulkRemarks}
              htmlFor="bulk-remarks"
              required
            >
              <textarea
                id="bulk-remarks"
                className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                value={bulkRemarks}
                onChange={(event) => setBulkRemarks(event.target.value)}
              />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" disabled={busy}>
                {applicationReviewCopy.bulkApply}
              </Button>
              <Button type="button" variant="outline" onClick={() => setBulkJob(null)}>
                {applicationReviewCopy.close}
              </Button>
            </div>
          </form>
        </DeskModal>
      ) : null}
    </div>
  );
}
