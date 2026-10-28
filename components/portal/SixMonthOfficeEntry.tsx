"use client";

import { useState } from "react";

import { FormDialog } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { sixMonthOnlineFrom } from "@/data/doctoral";
import { researchRegister } from "@/data/research-register";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { periodState, reportPeriodsFor, type DoctoralState } from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import {
  batchOf,
  isPassedOut,
  scholarSignInId,
  registerScholarsInOrder,
} from "@/lib/register";
import { saveScholarRecord, type ScholarRecord } from "@/lib/scholar-records";

type Row = {
  key: string;
  identifier: string;
  name: string;
  batchName: string;
  period: string;
  due: string;
  report: ScholarRecord | null;
};

/**
 * Six-month reports that were received on paper before online submission began. The office
 * ticks scholars and periods and records them as received.
 */
export function SixMonthOfficeEntry({
  doctoral,
  records,
}: {
  doctoral: DoctoralState;
  records: readonly ScholarRecord[];
}) {
  const [query, setQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [marking, setMarking] = useState(false);
  const [receivedOn, setReceivedOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scholars = [
    ...registerScholarsInOrder().map((scholar) => ({
      identifier: scholarSignInId(scholar),
      name: scholar.name,
      batchName: batchOf(scholar.batchId)?.name ?? "",
    })),
    ...doctoral.enrollments
      .filter(
        (item) =>
          !researchRegister.scholars.some((scholar) =>
            sameId(scholarSignInId(scholar), item.scholarIdentifier),
          ),
      )
      .map((item) => ({
        identifier: item.scholarIdentifier,
        name: item.scholarName,
        batchName:
          doctoral.batches.find((batch) => batch.id === item.batchId)?.name ?? "",
      })),
  ].filter((row) => !isPassedOut(row.identifier, row.name));

  const rows: Row[] = scholars.flatMap((scholar) =>
    reportPeriodsFor(doctoral, scholar.identifier)
      .filter(
        (period) => period.due < sixMonthOnlineFrom && periodState(period.due) === "due",
      )
      .map((period) => ({
        key: `${scholar.identifier}|${period.label}`,
        identifier: scholar.identifier,
        name: scholar.name,
        batchName: scholar.batchName,
        period: period.label,
        due: period.due,
        report:
          records.find(
            (record) =>
              sameId(record.scholarIdentifier, scholar.identifier) &&
              record.payload.period === period.label &&
              record.status !== "Returned",
          ) ?? null,
      })),
  );
  const statusOf = (row: Row) => (row.report ? "Recorded" : "Not recorded");
  const shown = rows.filter(
    (row) =>
      filterMatches(batchFilter, row.batchName) &&
      filterMatches(periodFilter, row.period) &&
      filterMatches(statusFilter, statusOf(row)) &&
      textMatches(query, [row.name, row.identifier, row.batchName, row.period]),
  );
  const open = shown.filter((row) => !row.report);
  const choices = (values: string[]) =>
    [...new Set(values)]
      .filter(Boolean)
      .sort()
      .map((value) => ({ value, label: value }));

  async function mark(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receivedOn) {
      setError("Select the date the reports were received.");
      return;
    }
    setBusy(true);
    let saved = 0;
    for (const row of rows.filter(
      (item) => selected.includes(item.key) && !item.report,
    )) {
      const result = await saveScholarRecord({
        kind: "six_month_report",
        scholarIdentifier: row.identifier,
        scholarName: row.name,
        status: "Approved",
        payload: {
          period: row.period,
          receivedOn,
          progress: "Received on paper by the research office.",
          officeEntry: "yes",
        },
        fileName: null,
        fileData: null,
      });
      if (result.ok) saved += 1;
    }
    setBusy(false);
    setMarking(false);
    setSelected([]);
    setNotice(`${saved} report${saved === 1 ? "" : "s"} recorded as received.`);
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Reports due before {formatIsoDate(sixMonthOnlineFrom)} ·{" "}
          {rows.filter((row) => row.report).length} of {rows.length} recorded
        </p>
        <Button
          type="button"
          variant="gold"
          disabled={selected.length === 0}
          onClick={() => {
            setError(null);
            setReceivedOn("");
            setMarking(true);
          }}
        >
          Mark received{selected.length ? ` (${selected.length})` : ""}
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
            options: choices(rows.map((row) => row.batchName)),
            onChange: setBatchFilter,
          },
          {
            id: "period",
            label: "Period",
            value: periodFilter,
            options: choices(rows.map((row) => row.period)),
            onChange: setPeriodFilter,
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            options: ["Recorded", "Not recorded"].map((value) => ({
              value,
              label: value,
            })),
            onChange: setStatusFilter,
          },
        ]}
        shown={shown.length}
        total={rows.length}
        filename="six-month-reports-before-online.csv"
        title="Six-month reports received before online submission"
        headers={["Scholar", "Batch", "Period", "Status", "Received on"]}
        rows={shown.map((row) => [
          row.name,
          row.batchName,
          row.period,
          statusOf(row),
          row.report?.payload.receivedOn ?? row.report?.payload.approvedOn ?? "",
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
                    open.length > 0 && open.every((row) => selected.includes(row.key))
                  }
                  onChange={(event) =>
                    setSelected(event.target.checked ? open.map((row) => row.key) : [])
                  }
                />
              </th>
              <th className="px-4 py-3">Scholar</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No report period matches.
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name} ${row.period}`}
                      disabled={Boolean(row.report)}
                      checked={selected.includes(row.key)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, row.key]
                            : current.filter((item) => item !== row.key),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{row.name}</td>
                  <td className="px-4 py-3">{row.batchName || "—"}</td>
                  <td className="px-4 py-3">{row.period}</td>
                  <td className="px-4 py-3">
                    {row.report ? (
                      <>
                        <Badge variant="gold">Recorded</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.report.payload.officeEntry
                            ? `Received ${formatIsoDate(row.report.payload.receivedOn ?? "")}`
                            : `Online · ${row.report.status}`}
                        </p>
                      </>
                    ) : (
                      <Badge variant="outline">Not recorded</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {marking ? (
        <FormDialog
          title={`Mark ${selected.length} report${selected.length === 1 ? "" : "s"} received`}
          onClose={() => setMarking(false)}
          onSubmit={(event) => void mark(event)}
          busy={busy}
          submitLabel="Mark received"
          size="sm"
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <FormField label="Date received" htmlFor="six-received" required>
            <Input
              id="six-received"
              type="date"
              max={clientToday()}
              value={receivedOn}
              onChange={(event) => setReceivedOn(event.target.value)}
            />
          </FormField>
        </FormDialog>
      ) : null}
    </div>
  );
}
