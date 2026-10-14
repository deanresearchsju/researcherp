"use client";

import { useState } from "react";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { field } from "@/lib/csv";
import { formatIsoDate } from "@/lib/dates";
import {
  applicationStatuses,
  canChangeApplicationStatus,
  deleteApplication,
  updateApplicationStatus,
  type ApplicationKind,
  type StoredApplication,
} from "@/lib/records";
import type { Json } from "@/types/database";

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
  onStatus,
  onRemove,
}: {
  title: string;
  rows: StoredApplication[];
  busy: boolean;
  onStatus: (row: StoredApplication, status: string) => void;
  onRemove: (row: StoredApplication) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-2xl text-primary">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No applications stored yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
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
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary">{row.applicationNo}</p>
                    {row.studyMode ? (
                      <p className="mt-1 text-muted-foreground">{row.studyMode}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <p>{row.applicantName}</p>
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
                      {applicationStatuses
                        .filter((status) => canChangeApplicationStatus(row.status, status))
                        .map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      {applicationStatuses.includes(
                        row.status as (typeof applicationStatuses)[number],
                      ) ? null : (
                        <option value={row.status}>{row.status}</option>
                      )}
                    </NativeSelect>
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      type="button"
                      variant="maroon"
                      size="sm"
                      disabled={busy}
                      onClick={() => onRemove(row)}
                    >
                      Remove
                    </Button>
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
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const canUpload = detail === null;

  async function onStatus(row: StoredApplication, status: string) {
    if (!canChangeApplicationStatus(row.status, status)) {
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

  const visible = rows.filter(
    (row) =>
      (kindFilter === "" || row.kind === kindFilter) &&
      (statusFilter === "" || row.status === statusFilter) &&
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
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Applications</h1>
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
            options: applicationStatuses.map((status) => ({ value: status, label: status })),
            onChange: setStatusFilter,
          },
        ]}
        shown={visible.length}
        total={rows.length}
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
        onStatus={onStatus}
        onRemove={(row) => void onRemove(row)}
      />
      <ApplicationTable
        title="Supervisor recognition"
        rows={supervisors}
        busy={busy}
        onStatus={onStatus}
        onRemove={(row) => void onRemove(row)}
      />
    </div>
  );
}
