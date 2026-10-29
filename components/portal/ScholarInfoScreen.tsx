"use client";

import { IndianRupee, Lock, PencilLine, UserPlus, Users } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { DeskModal, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { MarkFeePaidDialog, type FeeMarkRow } from "@/components/portal/MarkFeePaidDialog";
import { OfficeEntryDialog } from "@/components/portal/RacScreen";
import { RecordForm } from "@/components/portal/ScholarRecordScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { menuByKind } from "@/data/scholar-records";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { feeLedger } from "@/lib/fee-ledger";
import { sameId } from "@/lib/office";
import { batchNames } from "@/lib/scholar-report";
import {
  currentScholarRecords,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { ProfileCell, profileColumnHeading } from "@/components/portal/ProfileCell";
import { useScholarReports } from "@/lib/use-report-sources";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { usePreviewSession } from "@/lib/use-preview-session";
import { formatInr } from "@/lib/utils";
import { RegisterImport } from "@/components/portal/RegisterImport";

const menu = menuByKind("personal_details");

/**
 * Staff enter each scholar's information once; the entry locks and only the administrator can
 * correct it. The fee already paid and the RAC are entered from the same row, so one menu holds
 * everything the office has to enter for a scholar; both go to the same stores as the Fee and
 * RAC menus, so they show everywhere the fee and the RAC are used.
 */
export function ScholarInfoScreen() {
  const session = usePreviewSession();
  const isAdmin = session?.role === "admin";
  const data = useScholarReports();
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("personal_details", onChange),
    () => currentScholarRecords("personal_details"),
    () => null,
  );
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    identifier: string;
    name: string;
    record?: ScholarRecord;
  } | null>(null);
  const [viewing, setViewing] = useState<ScholarRecord | null>(null);
  const profile = useScholarProfiles();
  const [feeFor, setFeeFor] = useState<{ identifier: string; name: string } | null>(null);
  const [feeRound, setFeeRound] = useState(0);
  const [feeInfo, setFeeInfo] = useState<string | null>(null);
  const [racFor, setRacFor] = useState<string | null>(null);
  const [feeFilter, setFeeFilter] = useState("");
  const [racFilter, setRacFilter] = useState("");

  if (!data.ready || !load) {
    return <p className="text-sm text-muted-foreground">Loading scholars…</p>;
  }

  const rows = data.reports.map((report) => {
    const record =
      load.records
        .filter((item) => sameId(item.scholarIdentifier, report.identifier))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    const state = !record
      ? "Not entered"
      : record.status === "Approved"
        ? "Locked"
        : "Sent by scholar";
    return { report, record, state };
  });
  const shown = rows.filter(
    (row) =>
      filterMatches(batch, row.report.batchName) &&
      filterMatches(status, row.state) &&
      filterMatches(feeFilter, row.report.feeBalance > 0 ? "Balance due" : "Paid up") &&
      filterMatches(racFilter, row.report.rac) &&
      profile.matches(row.report.identifier) &&
      textMatches(query, [row.report.name, row.report.registration, row.report.subject]),
  );
  const fields = menu.fields;
  const today = clientToday();
  /** The fee years that have started for a scholar, as the Fee menu lists them. */
  const feeRows = (identifier: string, name: string): FeeMarkRow[] =>
    feeLedger(identifier, name, data.sources.payments, today)
      .plan.filter((year) => year.status !== "Upcoming")
      .map((year) => ({
        key: `${identifier}#${year.index}`,
        identifier,
        name,
        year,
      }));
  const racChoice = data.reports
    .filter((report) => report.guideName)
    .map((report) => ({
      identifier: report.identifier,
      name: report.name,
      supervisorIdentifier: report.guideIdentifier,
      supervisorName: report.guideName,
    }));

  return (
    <section className="space-y-5">
      <PageTitle kicker="Registers" title="Scholar information" />
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Scholars", rows.length],
          ["Entered and locked", rows.filter((row) => row.state === "Locked").length],
          ["Still to enter", rows.filter((row) => row.state !== "Locked").length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>
      <RegisterImport kind="scholars" onDone={setNotice} />
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "batch",
            label: "Batch",
            value: batch,
            options: batchNames()
              .filter((name) => rows.some((row) => row.report.batchName === name))
              .map((name) => ({ value: name, label: name })),
            onChange: setBatch,
          },
          {
            id: "status",
            label: "Status",
            value: status,
            options: ["Not entered", "Sent by scholar", "Locked"].map((value) => ({
              value,
              label: value,
            })),
            onChange: setStatus,
          },
          {
            id: "fee",
            label: "Fee",
            value: feeFilter,
            options: ["Balance due", "Paid up"].map((value) => ({ value, label: value })),
            onChange: setFeeFilter,
          },
          {
            id: "rac",
            label: "RAC",
            value: racFilter,
            options: ["Constituted", "Waiting for the Dean", "Not constituted"].map(
              (value) => ({ value, label: value }),
            ),
            onChange: setRacFilter,
          },
          ...profile.filters,
        ]}
        shown={shown.length}
        total={rows.length}
        filename="scholar-information.csv"
        title="Scholar information"
        headers={[
          "Scholar",
          "Registration No.",
          "Batch",
          "Status",
          "Fee paid (₹)",
          "Fee balance (₹)",
          "RAC",
          ...profile.headers,
          ...fields.map((f) => f.label),
        ]}
        rows={shown.map((row) => [
          row.report.name,
          row.report.registration,
          row.report.batchName,
          row.state,
          formatInr(row.report.feePaid),
          formatInr(row.report.feeBalance),
          row.report.rac,
          ...profile.cells(row.report.identifier),
          ...fields.map((field) => row.record?.payload[field.name] ?? ""),
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
                "Mobile · Email",
                "Fee · RAC",
                "Status",
                "",
              ].map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                  No scholar matches.
                </td>
              </tr>
            ) : (
              shown.map(({ report, record, state }) => (
                <tr key={report.identifier} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{report.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {report.registration}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <ProfileCell profile={profile.profileOf(report.identifier)} />
                  </td>
                  <td className="px-4 py-3">{report.batchName || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {record?.payload.mobile || "—"}
                    <br />
                    {record?.payload.email || report.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p>
                      <span className="text-muted-foreground">Fee: </span>
                      {report.feeBalance > 0 ? (
                        <span className="font-semibold text-secondary">
                          ₹{formatInr(report.feeBalance)} due
                        </span>
                      ) : (
                        <span className="font-semibold text-primary">Paid up</span>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      Paid ₹{formatInr(report.feePaid)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">RAC: </span>
                      {report.rac}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {state === "Locked" ? (
                      <Badge variant="gold">
                        <Lock className="mr-1 size-3" aria-hidden="true" />
                        Locked
                        {record?.payload.approvedOn
                          ? ` · ${formatIsoDate(record.payload.approvedOn)}`
                          : ""}
                      </Badge>
                    ) : state === "Sent by scholar" ? (
                      <Badge variant="purple">Sent by scholar</Badge>
                    ) : (
                      <Badge variant="outline">Not entered</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {record ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-readonly-allow
                          onClick={() => setViewing(record)}
                        >
                          View
                        </Button>
                      ) : null}
                      {state !== "Locked" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="gold"
                          onClick={() => {
                            setNotice(null);
                            setEditing({
                              identifier: report.identifier,
                              name: report.name,
                              record: record ?? undefined,
                            });
                          }}
                        >
                          <UserPlus className="size-4" aria-hidden="true" />
                          {record ? "Verify & lock" : "Enter details"}
                        </Button>
                      ) : isAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNotice(null);
                            setEditing({
                              identifier: report.identifier,
                              name: report.name,
                              record: record ?? undefined,
                            });
                          }}
                        >
                          <PencilLine className="size-4" aria-hidden="true" />
                          Correct
                        </Button>
                      ) : null}
                      {report.feeBalance > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNotice(null);
                            setFeeInfo(null);
                            setFeeRound((value) => value + 1);
                            setFeeFor({ identifier: report.identifier, name: report.name });
                          }}
                        >
                          <IndianRupee className="size-4" aria-hidden="true" />
                          Fee paid
                        </Button>
                      ) : null}
                      {report.rac === "Not constituted" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNotice(null);
                            if (!report.guideName) {
                              setNotice(
                                `${report.name}: allot a guide first, then enter the RAC.`,
                              );
                              return;
                            }
                            setRacFor(report.identifier);
                          }}
                        >
                          <Users className="size-4" aria-hidden="true" />
                          Enter RAC
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {feeFor ? (
        <MarkFeePaidDialog
          key={feeRound}
          scholarName={feeFor.name}
          rows={feeRows(feeFor.identifier, feeFor.name)}
          info={feeInfo}
          onClose={() => {
            setFeeFor(null);
            setFeeInfo(null);
          }}
          onDone={(message, again) => {
            setNotice(message);
            if (again) {
              setFeeInfo(message);
              setFeeRound((value) => value + 1);
            } else {
              setFeeFor(null);
              setFeeInfo(null);
            }
          }}
        />
      ) : null}
      {racFor ? (
        <OfficeEntryDialog
          key={racFor}
          scholars={racChoice}
          initialScholar={racFor}
          defaultRecorded
          canRecord={isAdmin || session?.role === "staff"}
          onClose={() => setRacFor(null)}
          onDone={(message) => {
            setNotice(message);
            setRacFor(null);
          }}
        />
      ) : null}
      {editing ? (
        <RecordForm
          key={editing.identifier}
          officeEntry
          menu={menu}
          scholarIdentifier={editing.identifier}
          scholarName={editing.name}
          supervisorIdentifier=""
          supervisorName=""
          existing={editing.record}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(`${editing.name}: ${message}`);
          }}
        />
      ) : null}
      {viewing ? (
        <DeskModal
          title={`Scholar information · ${viewing.scholarName}`}
          onClose={() => setViewing(null)}
        >
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="font-medium break-words text-primary">
                  {viewing.payload[field.name] || "—"}
                </dd>
              </div>
            ))}
          </dl>
          {viewing.status === "Approved" ? (
            <p className="text-xs text-muted-foreground">
              Locked
              {viewing.payload.approvedBy ? ` by ${viewing.payload.approvedBy}` : ""}
              {viewing.payload.approvedOn
                ? ` on ${formatIsoDate(viewing.payload.approvedOn)}`
                : ""}
              .
            </p>
          ) : null}
        </DeskModal>
      ) : null}
    </section>
  );
}
