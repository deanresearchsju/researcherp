"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import {
  DeskTabs,
  FormDialog,
  PageTitle,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import {
  MarkFeePaidDialog,
  markFeesPaid,
  openingReference,
} from "@/components/portal/MarkFeePaidDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { feeRoster } from "@/lib/fee-ledger";
import { annualResearchFee, ordinal, type FeeYear } from "@/lib/fees";
import {
  clearFeeReminder,
  currentPassedOut,
  currentReminders,
  saveFeeReminders,
  subscribeRegister,
  type FeeReminder,
} from "@/lib/register";
import {
  currentScholarRecords,
  loadRecordFile,
  setScholarRecordStatus,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePreviewSession } from "@/lib/use-preview-session";
import { formatInr } from "@/lib/utils";

type LedgerRow = {
  key: string;
  identifier: string;
  name: string;
  batchName: string;
  studyMode: string;
  year: FeeYear;
};

const statusTone: Record<FeeYear["status"], "gold" | "maroon" | "purple" | "outline"> = {
  Paid: "gold",
  "Partly paid": "purple",
  Unpaid: "maroon",
  Upcoming: "outline",
};

function reminderText(row: LedgerRow, dueOn: string, note: string) {
  const base = `Your Year ${row.year.index} annual research fee balance of ₹${formatInr(row.year.balance)} is pending${
    dueOn ? ` and is due by ${formatIsoDate(dueOn)}` : ""
  }. Please pay through the Fee menu and upload the receipt.`;
  return note.trim() ? `${base} ${note.trim()}` : base;
}

function ReminderDialog({
  rows,
  onClose,
  onSent,
}: {
  rows: readonly LedgerRow[];
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const session = usePreviewSession();
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const due = rows.filter((row) => row.year.balance > 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (due.length === 0) {
      setError("None of the selected scholars has a balance.");
      return;
    }
    setBusy(true);
    const sentBy = session ? session.name.trim() || session.identifier : "";
    const entries: FeeReminder[] = due.map((row) => ({
      key: row.identifier,
      name: row.name,
      feeYear: row.year.index,
      message: reminderText(row, dueOn, note),
      dueOn,
      sentOn: clientToday(),
      sentBy,
    }));
    const saved = await saveFeeReminders(entries);
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onSent(
      `Reminder placed on the home page of ${entries.length} scholar${entries.length === 1 ? "" : "s"}. It disappears once the fee is paid.`,
    );
  }

  const sample = due[0];
  return (
    <FormDialog
      title={`Fee reminder · ${due.length} scholar${due.length === 1 ? "" : "s"}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Send reminder"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <FormField label="Due date" htmlFor="remind-due">
        <Input
          id="remind-due"
          type="date"
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
        />
      </FormField>
      <FormField label="Additional note" htmlFor="remind-note">
        <Textarea
          id="remind-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
      {sample ? (
        <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-sm text-secondary">
          <p className="text-xs font-bold tracking-wide uppercase">
            Preview · {sample.name}
          </p>
          <p className="mt-1 leading-6">{reminderText(sample, dueOn, note)}</p>
        </div>
      ) : null}
    </FormDialog>
  );
}

export function FeeCollectionScreen() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const passedOut = useSyncExternalStore(
    subscribeRegister,
    currentPassedOut,
    currentPassedOut,
  );
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const reminders = useSyncExternalStore(
    subscribeRegister,
    currentReminders,
    currentReminders,
  );
  const [tab, setTab] = useState<"ledger" | "verify" | "reminders">("ledger");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reminding, setReminding] = useState<LedgerRow[] | null>(null);
  const [marking, setMarking] = useState<{ identifier: string; name: string } | null>(
    null,
  );
  const [bulkMarking, setBulkMarking] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [markInfo, setMarkInfo] = useState<string | null>(null);
  const [markRound, setMarkRound] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = clientToday();
  const rows = useMemo<LedgerRow[]>(() => {
    if (!load) return [];
    return feeRoster(load.records, today).flatMap((ledger) =>
      ledger.plan
        .filter((year) => year.status !== "Upcoming")
        .map((year) => ({
          key: `${ledger.identifier}#${year.index}`,
          identifier: ledger.identifier,
          name: ledger.name,
          batchName: ledger.batchName,
          studyMode: ledger.studyMode,
          year,
        })),
    );
    // feeRoster reads enrolments and passed-out scholars from their stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, today, doctoral, passedOut]);

  if (!ready || !load)
    return <p className="text-sm text-muted-foreground">Loading fees…</p>;

  const shown = rows.filter(
    (row) =>
      filterMatches(statusFilter, row.year.status) &&
      filterMatches(modeFilter, row.studyMode) &&
      filterMatches(batchFilter, row.batchName) &&
      filterMatches(yearFilter, `Year ${row.year.index}`) &&
      textMatches(query, [row.name, row.identifier, row.batchName]),
  );
  const totals = shown.reduce(
    (sum, row) => ({
      expected: sum.expected + row.year.amount,
      collected: sum.collected + row.year.paid,
      pending: sum.pending + row.year.pending,
      outstanding: sum.outstanding + row.year.balance,
    }),
    { expected: 0, collected: 0, pending: 0, outstanding: 0 },
  );
  const waiting = load.records
    .filter(
      (record) =>
        record.kind === "payment" &&
        record.status !== "Approved" &&
        record.status !== "Returned",
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const canAct =
    session?.role === "admin" || session?.role === "dean" || session?.role === "staff";
  const choices = (values: string[]) =>
    [...new Set(values)]
      .filter(Boolean)
      .sort()
      .map((value) => ({ value, label: value }));

  async function decide(record: ScholarRecord, status: "Approved" | "Returned") {
    let remarks = "";
    if (status === "Returned") {
      remarks = window.prompt("Reason for returning this payment") ?? "";
      if (remarks.trim().length < 2) return;
    }
    setBusyId(record.id);
    const saved = await setScholarRecordStatus(record, status, remarks);
    setBusyId(null);
    setNotice(
      saved
        ? `${record.scholarName} · ₹${formatInr(Number(record.payload.amount) || 0)} ${status === "Approved" ? "verified" : "returned"}.`
        : "That payment could not be updated.",
    );
  }

  return (
    <section className="space-y-6">
      <PageTitle
        kicker="Fee"
        title="Fee collection"
        actions={
          canAct && tab === "ledger" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={selected.length === 0}
                onClick={() => {
                  setNotice(null);
                  setBulkMarking(true);
                }}
              >
                Mark selected as paid{selected.length ? ` (${selected.length})` : ""}
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={selected.length === 0}
                onClick={() => {
                  setNotice(null);
                  setReminding(rows.filter((row) => selected.includes(row.key)));
                }}
              >
                Send reminder{selected.length ? ` (${selected.length})` : ""}
              </Button>
            </>
          ) : null
        }
      />
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Expected", totals.expected, "text-primary"],
          ["Collected", totals.collected, "text-primary"],
          ["Under verification", totals.pending, "text-primary"],
          ["Outstanding", totals.outstanding, "text-secondary"],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
              ₹{formatInr(Number(value))}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Annual research fee: Full time ₹{formatInr(annualResearchFee.fullTime)} · Part
        time ₹{formatInr(annualResearchFee.partTime)} · up to three instalments a year.
      </p>
      <DeskTabs
        tabs={[
          { id: "ledger", label: "Fee ledger" },
          { id: "verify", label: `Verify payments (${waiting.length})` },
          { id: "reminders", label: `Reminders (${reminders.length})` },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === "ledger" ? (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                options: ["Paid", "Partly paid", "Unpaid"].map((value) => ({
                  value,
                  label: value,
                })),
                onChange: setStatusFilter,
              },
              {
                id: "mode",
                label: "Study mode",
                value: modeFilter,
                options: choices(rows.map((row) => row.studyMode)),
                onChange: setModeFilter,
              },
              {
                id: "batch",
                label: "Batch",
                value: batchFilter,
                options: choices(rows.map((row) => row.batchName)),
                onChange: setBatchFilter,
              },
              {
                id: "year",
                label: "Fee year",
                value: yearFilter,
                options: choices(rows.map((row) => `Year ${row.year.index}`)),
                onChange: setYearFilter,
              },
            ]}
            shown={shown.length}
            total={rows.length}
            filename="fee-collection.csv"
            title="Annual research fee · paid / unpaid report"
            headers={[
              "Scholar",
              "Sign-in",
              "Batch",
              "Study mode",
              "Fee year",
              "Annual fee",
              "Paid",
              "Under verification",
              "Balance",
              "Instalments",
              "Status",
            ]}
            rows={shown.map((row) => [
              row.name,
              row.identifier,
              row.batchName,
              row.studyMode,
              row.year.label,
              formatInr(row.year.amount),
              formatInr(row.year.paid),
              formatInr(row.year.pending),
              formatInr(row.year.balance),
              String(row.year.installments.length),
              row.year.status,
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all with a balance"
                      checked={
                        shown.some((row) => row.year.balance > 0) &&
                        shown
                          .filter((row) => row.year.balance > 0)
                          .every((row) => selected.includes(row.key))
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? shown
                                .filter((row) => row.year.balance > 0)
                                .map((row) => row.key)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th className="px-3 py-3">Scholar</th>
                  <th className="px-3 py-3">Mode</th>
                  <th className="px-3 py-3">Fee year</th>
                  <th className="px-3 py-3 text-right">Annual fee</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-3 py-3 text-right">Balance</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No scholars match the filters.
                    </td>
                  </tr>
                ) : (
                  shown.map((row) => {
                    const reminded = reminders.some(
                      (item) =>
                        item.key.toLowerCase() === row.identifier.toLowerCase() &&
                        item.feeYear === row.year.index,
                    );
                    return (
                      <tr key={row.key} className="border-t border-border align-top">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.name}`}
                            disabled={row.year.balance === 0}
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
                        <td className="px-3 py-3">
                          <p className="font-semibold text-primary">{row.name}</p>
                          <p className="text-muted-foreground">
                            {row.batchName || row.identifier}
                          </p>
                        </td>
                        <td className="px-3 py-3">{row.studyMode}</td>
                        <td className="px-3 py-3">
                          {row.year.label}
                          <p className="text-xs text-muted-foreground">
                            {row.year.installments.length} instalment
                            {row.year.installments.length === 1 ? "" : "s"}
                            {row.year.pending
                              ? ` · ₹${formatInr(row.year.pending)} to verify`
                              : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          ₹{formatInr(row.year.amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          ₹{formatInr(row.year.paid)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          ₹{formatInr(row.year.balance)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={statusTone[row.year.status]}>
                            {row.year.status}
                          </Badge>
                          {reminded ? (
                            <p className="mt-1 text-xs text-secondary">
                              Reminder on home page
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {canAct && row.year.balance > 0 ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setNotice(null);
                                  setMarking({
                                    identifier: row.identifier,
                                    name: row.name,
                                  });
                                }}
                              >
                                Mark paid
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setNotice(null);
                                  setReminding([row]);
                                }}
                              >
                                Remind
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "verify" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-3">Scholar</th>
                <th className="px-3 py-3">Fee year · instalment</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3">Paid on · mode · reference</th>
                <th className="px-3 py-3">Receipt</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {waiting.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No payment is waiting for verification.
                  </td>
                </tr>
              ) : (
                waiting.map((record) => (
                  <tr key={record.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-primary">{record.scholarName}</p>
                      <p className="text-muted-foreground">{record.scholarIdentifier}</p>
                    </td>
                    <td className="px-3 py-3">
                      {record.payload.feeYear
                        ? `Year ${record.payload.feeYear}`
                        : record.payload.purpose || "—"}
                      {record.payload.installment
                        ? ` · ${ordinal(Number(record.payload.installment))}`
                        : ""}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      ₹{formatInr(Number(record.payload.amount) || 0)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {[
                        record.payload.paidOn ? formatIsoDate(record.payload.paidOn) : "",
                        record.payload.mode,
                        record.payload.transactionNumber,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-3">
                      <ViewFilesButton
                        fileName={record.fileName}
                        load={() => loadRecordFile(record)}
                        onMissing={setNotice}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {canAct ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="gold"
                            disabled={busyId === record.id}
                            onClick={() => void decide(record, "Approved")}
                          >
                            Verify
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="maroon"
                            disabled={busyId === record.id}
                            onClick={() => void decide(record, "Returned")}
                          >
                            Return
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "reminders" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-3">Scholar</th>
                <th className="px-3 py-3">Fee year</th>
                <th className="px-3 py-3">Message</th>
                <th className="px-3 py-3">Sent</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reminders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No reminders are active.
                  </td>
                </tr>
              ) : (
                reminders.map((item) => {
                  const ledgerRow = rows.find(
                    (row) =>
                      row.identifier.toLowerCase() === item.key.toLowerCase() &&
                      row.year.index === item.feeYear,
                  );
                  return (
                    <tr
                      key={`${item.key}-${item.feeYear}`}
                      className="border-t border-border align-top"
                    >
                      <td className="px-3 py-3 font-semibold text-primary">
                        {item.name}
                      </td>
                      <td className="px-3 py-3">
                        Year {item.feeYear}
                        {ledgerRow ? (
                          <p className="text-xs text-muted-foreground">
                            {ledgerRow.year.balance > 0
                              ? `Balance ₹${formatInr(ledgerRow.year.balance)}`
                              : "Paid · hidden from the scholar"}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-md px-3 py-3 text-muted-foreground">
                        {item.message}
                      </td>
                      <td className="px-3 py-3">
                        {formatIsoDate(item.sentOn)}
                        {item.sentBy ? ` · ${item.sentBy}` : ""}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canAct ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void clearFeeReminder(item.key, item.feeYear).then(
                                (saved) =>
                                  setNotice(
                                    saved.ok ? "Reminder withdrawn." : saved.message,
                                  ),
                              )
                            }
                          >
                            Withdraw
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {marking ? (
        <MarkFeePaidDialog
          scholarName={marking.name}
          rows={rows.filter(
            (row) => row.identifier.toLowerCase() === marking.identifier.toLowerCase(),
          )}
          key={markRound}
          info={markInfo}
          onClose={() => {
            setMarking(null);
            setMarkInfo(null);
          }}
          onDone={(message, again) => {
            setNotice(message);
            if (again) {
              setMarkInfo(message);
              setMarkRound((value) => value + 1);
            } else {
              setMarking(null);
              setMarkInfo(null);
            }
          }}
        />
      ) : null}
      {bulkMarking ? (
        <FormDialog
          title={`Mark ${selected.length} fee year${selected.length === 1 ? "" : "s"} as paid`}
          onClose={() => setBulkMarking(false)}
          submitLabel="Mark paid in full"
          size="sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!bulkDate) {
              setNotice("Select the date of payment for the selected scholars.");
              return;
            }
            const chosen = rows.filter(
              (row) => selected.includes(row.key) && row.year.balance > 0,
            );
            void markFeesPaid(
              chosen.map((row) => ({
                row,
                amount: Math.min(
                  row.year.balance,
                  row.year.amount - row.year.paid - row.year.pending,
                ),
              })),
              {
                paidOn: bulkDate,
                mode: "Recorded by office",
                reference: openingReference,
                recordedBy: session ? session.name.trim() || session.identifier : "",
              },
            ).then((result) => {
              setBulkMarking(false);
              setSelected([]);
              setNotice(
                `${result.saved} fee year${result.saved === 1 ? "" : "s"} marked paid in full.${
                  result.failures.length
                    ? ` Not saved: ${result.failures.join("; ")}.`
                    : ""
                }`,
              );
            });
          }}
        >
          <p className="text-sm leading-6">
            The full balance of each selected scholar and year is recorded as paid and
            verified, with the reference “{openingReference}”. Use{" "}
            <strong>Mark paid</strong> on a row to enter a part payment or a different
            date.
          </p>
          {notice && !bulkDate ? (
            <p role="alert" className="text-sm text-secondary">
              {notice}
            </p>
          ) : null}
          <FormField label="Date of payment" htmlFor="bulk-date" required>
            <Input
              id="bulk-date"
              type="date"
              max={clientToday()}
              value={bulkDate}
              onChange={(event) => setBulkDate(event.target.value)}
            />
          </FormField>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-3 text-sm">
            {rows
              .filter((row) => selected.includes(row.key))
              .map((row) => (
                <li key={row.key} className="flex justify-between gap-3">
                  <span>
                    {row.name} · Year {row.year.index}
                  </span>
                  <span className="font-semibold tabular-nums">
                    ₹{formatInr(row.year.balance)}
                  </span>
                </li>
              ))}
          </ul>
        </FormDialog>
      ) : null}
      {reminding ? (
        <ReminderDialog
          rows={reminding}
          onClose={() => setReminding(null)}
          onSent={(message) => {
            setReminding(null);
            setSelected([]);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
