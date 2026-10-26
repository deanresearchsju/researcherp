"use client";

import { useState, useSyncExternalStore } from "react";

import {
  ApplicationViewer,
  type ReviewAction,
} from "@/components/portal/ApplicationViewer";
import { DeskModal, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { SupervisorApprovalSheet } from "@/components/portal/SupervisorPrint";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { applicationReviewCopy } from "@/data/application-review";
import { field } from "@/lib/csv";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral, nextLetterSerial, subscribeDoctoral } from "@/lib/doctoral";
import {
  currentAdmission,
  decideApplicationFees,
  isArchivedApplication,
  subscribeAdmission,
  type PaymentMark,
} from "@/lib/admission";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import { useCanMenuAction } from "@/lib/use-menu-action";
import {
  applicationStatuses,
  canChangeApplicationStatus,
  deleteApplication,
  reviewSupervisorApplication,
  supervisorReviewStatuses,
  updateApplicationStatus,
  type ApplicationKind,
  type StoredApplication,
} from "@/lib/records";
import { mailSummary, sendMailEvent, type MailResult } from "@/lib/mail-client";
import { saveApprovedQuota } from "@/lib/register";
import { uniqueIssuedPassword } from "@/lib/register-access";
import { createPortalUser, currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import {
  awaitingRecognition,
  eligibilityCriteria,
  eligibilityOf,
  highestRecognitionSerial,
  proposedQuota,
  recognitionBodies,
} from "@/lib/supervisor-approval";
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

type TableDecision = {
  approveLabel: string;
  rejectLabel: string;
  stateOf: (row: StoredApplication) => {
    label: string;
    tone: "gold" | "maroon" | "outline";
    canApprove: boolean;
    canReject: boolean;
  };
  onApprove: (rows: StoredApplication[]) => void;
  onReject: (rows: StoredApplication[]) => void;
};

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
  decision,
  decisionHeading,
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
  decision: TableDecision;
  decisionHeading: string;
  onRemove: (row: StoredApplication) => void;
  onView: (row: StoredApplication) => void;
}) {
  const canDownload = useCanMenuAction("export");
  const picked = selectedIds ?? [];
  const selectedRows = rows.filter((row) => picked.includes(row.id));
  const allOn = rows.length > 0 && rows.every((row) => picked.includes(row.id));
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
              variant="gold"
              size="sm"
              disabled={
                busy || !selectedRows.some((row) => decision.stateOf(row).canApprove)
              }
              onClick={() => decision.onApprove(selectedRows)}
            >
              {decision.approveLabel}
            </Button>
            <Button
              type="button"
              variant="maroon"
              size="sm"
              disabled={
                busy || !selectedRows.some((row) => decision.stateOf(row).canReject)
              }
              onClick={() => decision.onReject(selectedRows)}
            >
              {decision.rejectLabel}
            </Button>{" "}
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
                <th className="px-3 py-3 font-semibold">{decisionHeading}</th>
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
                  </td>
                  <td className="px-3 py-3">{dateLabel(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    {(() => {
                      const state = decision.stateOf(row);
                      return (
                        <div className="space-y-2">
                          <Badge variant={state.tone}>{state.label}</Badge>
                          <div className="flex flex-wrap gap-2">
                            {state.canApprove ? (
                              <Button
                                type="button"
                                variant="gold"
                                size="sm"
                                disabled={busy}
                                onClick={() => decision.onApprove([row])}
                              >
                                {decision.approveLabel}
                              </Button>
                            ) : null}
                            {state.canReject ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => decision.onReject([row])}
                              >
                                {decision.rejectLabel}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}{" "}
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
  const [approveJob, setApproveJob] = useState<StoredApplication[] | null>(null);
  const [approveQuotas, setApproveQuotas] = useState<Record<string, string>>({});
  const [rejectJob, setRejectJob] = useState<StoredApplication[] | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [tab, setTab] = useState<ApplicationKind>("phd");
  const [eligibilityTicks, setEligibilityTicks] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [approval, setApproval] = useState({
    body: recognitionBodies[0] as string,
    reference: "",
    approvedOn: "",
    preparedBy: "",
    verifiedBy: "",
  });
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [issuedLogins, setIssuedLogins] = useState<
    { name: string; identifier: string; password: string }[]
  >([]);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const [approvalSheet, setApprovalSheet] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [feeFilter, setFeeFilter] = useState("");
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const canUpload = detail === null;

  // The application fee is decided here; approved applications appear in Selection.
  function feeOf(row: StoredApplication): PaymentMark {
    const found = admission?.cases.find(
      (item) => item.applicationId === row.id || item.applicationNo === row.applicationNo,
    );
    return found?.payment ?? "Pending";
  }

  async function decideFees(
    chosen: StoredApplication[],
    payment: "Approved" | "Returned",
  ) {
    const pending = chosen.filter((row) => feeOf(row) !== payment);
    if (chosen.length === 0) {
      setNotice(applicationReviewCopy.needSelection);
      return;
    }
    if (pending.length === 0) {
      setNotice(`Those applications are already ${payment.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setNotice(null);
    const saved = await decideApplicationFees(pending, payment);
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    if (saved.changed === 0) {
      setNotice("No change: those applications have already moved on in Selection.");
      return;
    }
    if (payment === "Approved") {
      setRows((current) =>
        current.map((item) =>
          pending.some((row) => row.id === item.id) &&
          item.status === "Acknowledgement sent"
            ? { ...item, status: "Under review" }
            : item,
        ),
      );
    }
    setSelectedIds([]);
    setNotice(
      payment === "Approved"
        ? `Payment approved for ${saved.changed}. ${saved.changed === 1 ? "The application is" : "The applications are"} now in Selection.`
        : `Payment returned for ${saved.changed}.`,
    );
  }
  const liveRows = rows.filter(
    (row) => row.kind !== "phd" || !isArchivedApplication(row, admission?.archived ?? []),
  );

  function supervisorState(row: StoredApplication) {
    if (row.status === "Approved") {
      return {
        label: "Approved",
        tone: "gold" as const,
        canApprove: false,
        canReject: false,
      };
    }
    if (row.status === "Rejected") {
      return {
        label: "Rejected",
        tone: "maroon" as const,
        canApprove: false,
        canReject: false,
      };
    }
    if (row.status === "Accepted") {
      return {
        label: "Eligible · awaiting approval",
        tone: "outline" as const,
        canApprove: false,
        canReject: true,
      };
    }
    return {
      label: "Awaiting verification",
      tone: "outline" as const,
      canApprove: true,
      canReject: true,
    };
  }

  function openVerify(chosen: StoredApplication[]) {
    const open = chosen.filter((row) => supervisorState(row).canApprove);
    if (chosen.length === 0) {
      setNotice(applicationReviewCopy.needSelection);
      return;
    }
    if (open.length === 0) {
      setNotice(applicationReviewCopy.bulkNone);
      return;
    }
    setApproveQuotas(
      Object.fromEntries(
        open.map((row) => [
          row.id,
          String(proposedQuota(payloadValue(row.payload, "designation"))),
        ]),
      ),
    );
    setEligibilityTicks({});
    setApproveJob(open);
  }

  function openReject(chosen: StoredApplication[]) {
    const open = chosen.filter((row) => supervisorState(row).canReject);
    if (chosen.length === 0) {
      setNotice(applicationReviewCopy.needSelection);
      return;
    }
    if (open.length === 0) {
      setNotice(applicationReviewCopy.bulkNone);
      return;
    }
    setRejectRemarks("");
    setRejectJob(open);
  }

  /** Verify the eligibility conditions; the application then waits for the RAB / Vice Chancellor. */
  async function verifySupervisors() {
    if (!approveJob) return;
    for (const row of approveJob) {
      const ticks = eligibilityTicks[row.id] ?? {};
      if (!eligibilityCriteria.every((item) => ticks[item.id])) {
        setNotice(
          `Tick every eligibility condition for ${row.applicantName}, or reject the application.`,
        );
        return;
      }
    }
    setBusy(true);
    setNotice(null);
    const today = clientToday();
    const done = new Map<string, Json>();
    for (const row of approveJob) {
      const eligibility = {
        checks: eligibilityTicks[row.id] ?? {},
        quota: proposedQuota(payloadValue(row.payload, "designation")),
        verifiedOn: today,
        remarks: "Eligibility verified.",
      };
      const saved = await reviewSupervisorApplication(
        row.id,
        row.payload,
        "Accepted",
        eligibility.remarks,
        undefined,
        { eligibility },
      );
      if (!saved) continue;
      done.set(row.id, { eligibility } as Json);
    }
    setRows((current) =>
      current.map((item) =>
        done.has(item.id)
          ? {
              ...item,
              status: "Accepted",
              payload: {
                ...(item.payload &&
                typeof item.payload === "object" &&
                !Array.isArray(item.payload)
                  ? item.payload
                  : {}),
                ...(done.get(item.id) as Record<string, Json>),
              },
            }
          : item,
      ),
    );
    setBusy(false);
    setApproveJob(null);
    setSelectedSupervisorIds([]);
    setNotice(
      done.size === approveJob.length
        ? `Eligibility verified for ${done.size} applicant${done.size === 1 ? "" : "s"}. Print the approval sheet for the RAB / Vice Chancellor.`
        : applicationReviewCopy.bulkPartial,
    );
  }

  /** Records the RAB / Vice Chancellor approval and approves every verified applicant. */
  async function recordRecognition() {
    const waiting = awaitingRecognition(liveRows);
    if (waiting.length === 0) return;
    if (!approval.reference.trim() || !approval.approvedOn) {
      setNotice("Enter the approval reference and the date of approval.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const year = approval.approvedOn.slice(0, 4);
    let serial = Math.max(
      doctoral ? nextLetterSerial(doctoral, "recognition", year) : 1,
      highestRecognitionSerial(rows, year) + 1,
    );
    const done = new Map<string, Record<string, unknown>>();
    for (const row of waiting) {
      const eligibility = eligibilityOf(row.payload);
      const quota =
        eligibility?.quota ?? proposedQuota(payloadValue(row.payload, "designation"));
      const recognition = {
        body: approval.body,
        reference: approval.reference.trim(),
        approvedOn: approval.approvedOn,
        refNo: `SJU/DR/SR/${year}/${String(serial).padStart(3, "0")}`,
        issuedOn: approval.approvedOn,
        preparedBy: approval.preparedBy.trim(),
        verifiedBy: approval.verifiedBy.trim(),
      };
      const saved = await reviewSupervisorApplication(
        row.id,
        row.payload,
        "Approved",
        `Approved by the ${approval.body}.`,
        quota,
        { recognition },
      );
      if (!saved) continue;
      await saveApprovedQuota({
        name: row.applicantName,
        quota,
        department:
          payloadValue(row.payload, "subject") || payloadValue(row.payload, "department"),
        designation: payloadValue(row.payload, "designation"),
      });
      serial += 1;
      done.set(row.id, { recognition, approvedQuota: quota });
    }
    setRows((current) =>
      current.map((item) =>
        done.has(item.id)
          ? {
              ...item,
              status: "Approved",
              payload: {
                ...(item.payload &&
                typeof item.payload === "object" &&
                !Array.isArray(item.payload)
                  ? item.payload
                  : {}),
                ...(done.get(item.id) as Record<string, Json>),
              },
            }
          : item,
      ),
    );
    // Open each approved supervisor's ERP sign-in and mail the details.
    const approvedRows = waiting.filter((row) => done.has(row.id));
    const logins: { name: string; identifier: string; password: string }[] = [];
    for (const row of approvedRows) {
      const identifier = row.email.trim();
      if (!identifier) continue;
      const exists = users?.users.some(
        (user) =>
          user.role === "supervisor" &&
          user.identifier.toLowerCase() === identifier.toLowerCase(),
      );
      if (exists) continue;
      const password = uniqueIssuedPassword();
      const created = await createPortalUser(
        {
          role: "supervisor",
          name: row.applicantName,
          identifier,
          password,
          menus: null,
        },
        users?.source ?? "browser",
      );
      if (created.ok) logins.push({ name: row.applicantName, identifier, password });
    }
    const letterMail = await sendMailEvent({
      event: "recognition",
      applicationNos: approvedRows.map((row) => row.applicationNo),
    });
    const loginMail: MailResult = { ok: true, sent: 0, failed: 0, configured: true };
    for (const item of logins) {
      const result = await sendMailEvent({
        event: "credentials",
        role: "supervisor",
        identifier: item.identifier,
        password: item.password,
      });
      loginMail.sent += result.sent;
      loginMail.failed += result.failed;
      loginMail.configured = result.configured;
    }
    setIssuedLogins((current) => [...logins, ...current]);
    setBusy(false);
    setApprovalDialog(false);
    setNotice(
      done.size === waiting.length
        ? `Approval recorded for ${done.size} supervisor${done.size === 1 ? "" : "s"}. They can download the recognition letter from Supervisor application status.${mailSummary(letterMail, "Recognition notice")}${logins.length > 0 ? ` ${logins.length} sign-in(s) opened.${mailSummary(loginMail, "Sign-in details")}` : ""}`
        : applicationReviewCopy.bulkPartial,
    );
  }

  async function rejectSupervisors() {
    if (!rejectJob || rejectRemarks.trim().length < 2) return;
    setBusy(true);
    setNotice(null);
    const done = new Set<string>();
    for (const row of rejectJob) {
      const saved = await reviewSupervisorApplication(
        row.id,
        row.payload,
        "Rejected",
        rejectRemarks.trim(),
      );
      if (saved) done.add(row.id);
    }
    setRows((current) =>
      current.map((item) => (done.has(item.id) ? { ...item, status: "Rejected" } : item)),
    );
    setBusy(false);
    const total = rejectJob.length;
    setRejectJob(null);
    setSelectedSupervisorIds([]);
    setNotice(
      done.size === total
        ? `${done.size} supervisor application${done.size === 1 ? "" : "s"} rejected.`
        : applicationReviewCopy.bulkPartial,
    );
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
      row.kind === tab &&
      filterMatches(statusFilter, row.status) &&
      (!feeFilter || filterMatches(feeFilter, feeOf(row))) &&
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
  const phdCount = liveRows.filter((row) => row.kind === "phd").length;
  const supervisorCount = liveRows.filter((row) => row.kind === "supervisor").length;
  const tabRows = liveRows.filter((row) => row.kind === tab);

  function switchTab(next: ApplicationKind) {
    if (next === tab) return;
    setTab(next);
    setQuery("");
    setStatusFilter("");
    setFeeFilter("");
    setNotice(null);
  }
  const waitingRecognition = awaitingRecognition(liveRows);

  if (approvalSheet) {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setApprovalSheet(false)}>
            Back to applications
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print approval sheet
          </Button>
        </div>
        <SupervisorApprovalSheet
          rows={waitingRecognition}
          body={approval.body}
          preparedBy={approval.preparedBy}
          verifiedBy={approval.verifiedBy}
          deanName={admission?.letter.deanName ?? ""}
          deanTitle={admission?.letter.deanTitle || undefined}
        />
      </div>
    );
  }

  const recognitionPanel =
    waitingRecognition.length > 0 ? (
      <section className="mt-6 rounded-xl border border-accent/50 bg-accent/10 p-4">
        <h2 className="font-heading text-xl text-primary">
          Recognition approval · RAB / Vice Chancellor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {waitingRecognition.length} applicant
          {waitingRecognition.length === 1 ? " has" : "s have"} met the eligibility
          conditions. Print the sheet for approval; once approved, record it here and the
          supervisors can download their recognition letter from the application status
          page.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField label="Prepared by" htmlFor="rec-prepared">
            <input
              id="rec-prepared"
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
              value={approval.preparedBy}
              onChange={(event) =>
                setApproval((current) => ({ ...current, preparedBy: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Verified by" htmlFor="rec-verified">
            <input
              id="rec-verified"
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
              value={approval.verifiedBy}
              onChange={(event) =>
                setApproval((current) => ({ ...current, verifiedBy: event.target.value }))
              }
            />
          </FormField>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="gold" onClick={() => setApprovalSheet(true)}>
            Print approval sheet
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setApproval((current) => ({
                ...current,
                approvedOn: current.approvedOn || clientToday(),
              }));
              setApprovalDialog(true);
            }}
          >
            Record approval
          </Button>
        </div>
      </section>
    ) : null;

  return (
    <div>
      <PageTitle kicker="Administration" title="Applications" />
      <div
        className="mt-5 flex flex-wrap gap-3"
        role="group"
        aria-label="Application type"
      >
        {(
          [
            ["phd", "Ph.D. applications", phdCount],
            ["supervisor", "Supervisor applications", supervisorCount],
          ] as const
        ).map(([kind, label, count]) => (
          <Button
            key={kind}
            type="button"
            variant={tab === kind ? "default" : "outline"}
            aria-pressed={tab === kind}
            data-readonly-allow
            onClick={() => switchTab(kind)}
          >
            {label}
            <span
              className={
                tab === kind
                  ? "ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs"
                  : "ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs"
              }
            >
              {count}
            </span>
          </Button>
        ))}
      </div>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            options: (tab === "phd" ? applicationStatuses : supervisorReviewStatuses).map(
              (status) => ({ value: status, label: status }),
            ),
            onChange: setStatusFilter,
          },
          ...(tab === "phd"
            ? [
                {
                  id: "fee",
                  label: "Application fee",
                  value: feeFilter,
                  options: [
                    { value: "Pending", label: "Payment pending" },
                    { value: "Approved", label: "Payment approved" },
                    { value: "Returned", label: "Payment returned" },
                  ],
                  onChange: setFeeFilter,
                },
              ]
            : []),
        ]}
        shown={visible.length}
        total={tabRows.length}
        filename={`applications-${tab}-filtered.csv`}
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
      {tab === "phd" ? (
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
          decisionHeading="Application fee"
          decision={{
            approveLabel: "Approve payment",
            rejectLabel: "Return payment",
            stateOf: (row) => {
              const fee = feeOf(row);
              return {
                label:
                  fee === "Approved"
                    ? "Payment approved"
                    : fee === "Returned"
                      ? "Payment returned"
                      : "Payment pending",
                tone:
                  fee === "Approved" ? "gold" : fee === "Returned" ? "maroon" : "outline",
                canApprove: fee !== "Approved",
                canReject: fee === "Pending",
              };
            },
            onApprove: (chosen) => void decideFees(chosen, "Approved"),
            onReject: (chosen) => void decideFees(chosen, "Returned"),
          }}
          onRemove={(row) => void onRemove(row)}
          onView={setViewing}
        />
      ) : (
        <>
          {issuedLogins.length > 0 ? (
            <div className="mt-6 rounded-xl border border-accent/50 bg-accent/10 p-3 text-sm">
              <p className="font-semibold text-primary">
                First sign-in for newly approved supervisors. The details are emailed;
                share a password yourself only if the email did not go. It is not shown
                again after you leave this page.
              </p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {issuedLogins.map((item) => (
                  <li key={item.identifier} className="font-mono text-xs">
                    {item.name} · {item.identifier} · {item.password}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {recognitionPanel}
          <ApplicationTable
            title="Supervisor applications"
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
            decisionHeading="Verification"
            decision={{
              approveLabel: "Verify eligibility",
              rejectLabel: "Reject application",
              stateOf: supervisorState,
              onApprove: openVerify,
              onReject: openReject,
            }}
            onRemove={(row) => void onRemove(row)}
            onView={setViewing}
          />
        </>
      )}
      {viewing ? (
        <ApplicationViewer
          application={viewing}
          onClose={() => setViewing(null)}
          review={
            viewing.kind === "supervisor"
              ? {
                  busy,
                  onAction: (action: ReviewAction, remarks: string) => {
                    void (async () => {
                      setBusy(true);
                      const approvedQuota =
                        action === "Approved"
                          ? proposedQuota(payloadValue(viewing.payload, "designation"))
                          : undefined;
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
      {approveJob ? (
        <DeskModal title="Verify eligibility" onClose={() => setApproveJob(null)}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifySupervisors();
            }}
          >
            {approveJob.map((row) => (
              <fieldset
                key={row.id}
                className="rounded-xl border border-border p-3 text-sm"
              >
                <legend className="px-1 font-semibold text-primary">
                  {row.applicantName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {row.applicationNo} ·{" "}
                    {payloadValue(row.payload, "designation") || "—"}
                  </span>
                </legend>
                <p className="text-xs text-muted-foreground">
                  Ph.D. awarded {payloadValue(row.payload, "phdAwardYear") || "—"} ·
                  Appointed{" "}
                  {payloadValue(row.payload, "appointmentDate")
                    ? formatIsoDate(payloadValue(row.payload, "appointmentDate"))
                    : "—"}{" "}
                  · {payloadValue(row.payload, "faculty") || "School not stated"}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {eligibilityCriteria.map((item) => (
                    <li key={item.id}>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-primary"
                          checked={eligibilityTicks[row.id]?.[item.id] === true}
                          onChange={(event) =>
                            setEligibilityTicks((current) => ({
                              ...current,
                              [row.id]: {
                                ...current[row.id],
                                [item.id]: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-center gap-2">
                  <span className="text-sm">
                    Guide quota (fixed by designation:{" "}
                    {payloadValue(row.payload, "designation") || "not stated"})
                  </span>
                  <input
                    aria-label={`Guide quota for ${row.applicantName}`}
                    className="h-10 w-20 rounded-lg border border-input bg-muted px-2 text-sm"
                    value={approveQuotas[row.id] ?? ""}
                    readOnly
                  />
                </label>
              </fieldset>
            ))}
            <p className="text-xs text-muted-foreground">
              Once every condition is met the application waits for the RAB / Vice
              Chancellor approval. The quota is the number of scholars the supervisor may
              guide and is fixed by the designation: Professor 8, Associate Professor 6,
              Assistant Professor 4.
            </p>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" disabled={busy}>
                {busy ? "Saving…" : "Eligibility verified"}
              </Button>
            </div>
          </form>
        </DeskModal>
      ) : null}
      {approvalDialog ? (
        <DeskModal
          title="Record RAB / Vice Chancellor approval"
          onClose={() => setApprovalDialog(false)}
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void recordRecognition();
            }}
          >
            <p className="text-sm text-muted-foreground">
              {awaitingRecognition(liveRows)
                .map((row) => row.applicantName)
                .join(", ")}
            </p>
            <FormField label="Approved by" htmlFor="rec-body" required>
              <select
                id="rec-body"
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
                value={approval.body}
                onChange={(event) =>
                  setApproval((current) => ({ ...current, body: event.target.value }))
                }
              >
                {recognitionBodies.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Approval reference / minutes no."
              htmlFor="rec-ref"
              required
            >
              <input
                id="rec-ref"
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
                value={approval.reference}
                onChange={(event) =>
                  setApproval((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Date of approval" htmlFor="rec-date" required>
              <input
                id="rec-date"
                type="date"
                max={clientToday()}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
                value={approval.approvedOn}
                onChange={(event) =>
                  setApproval((current) => ({
                    ...current,
                    approvedOn: event.target.value,
                  }))
                }
              />
            </FormField>
            <p className="text-xs text-muted-foreground">
              The listed supervisors are approved, added to the vacancy list, and can
              download the recognition letter from Supervisor application status.
            </p>
            <div className="flex gap-2">
              <Button type="submit" variant="gold" disabled={busy}>
                {busy ? "Saving…" : "Record approval"}
              </Button>
            </div>
          </form>
        </DeskModal>
      ) : null}
      {rejectJob ? (
        <DeskModal title="Reject application" onClose={() => setRejectJob(null)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void rejectSupervisors();
            }}
          >
            <p className="text-sm text-muted-foreground">
              {rejectJob.map((row) => row.applicantName).join(", ")}
            </p>
            <FormField
              label={applicationReviewCopy.bulkRemarks}
              htmlFor="reject-remarks"
              required
            >
              <textarea
                id="reject-remarks"
                className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                value={rejectRemarks}
                onChange={(event) => setRejectRemarks(event.target.value)}
              />
            </FormField>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="maroon"
                disabled={busy || rejectRemarks.trim().length < 2}
              >
                Reject
              </Button>
            </div>
          </form>
        </DeskModal>
      ) : null}
    </div>
  );
}
