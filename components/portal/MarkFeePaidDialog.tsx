"use client";

import { useState } from "react";

import { FormDialog } from "@/components/portal/Desk";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { clientToday } from "@/lib/dates";
import { recordAudit } from "@/lib/audit";
import {
  annualFeePurpose,
  concessionPurpose,
  feePaymentModes,
  nextInstallment,
  ordinal,
  type FeeYear,
} from "@/lib/fees";
import { saveScholarRecord } from "@/lib/scholar-records";
import { usePreviewSession } from "@/lib/use-preview-session";
import { formatInr } from "@/lib/utils";

export type FeeMarkRow = {
  key: string;
  identifier: string;
  name: string;
  year: FeeYear;
};

export const openingReference = "Paid before ERP (office entry)";
const officeModes = ["Recorded by office", ...feePaymentModes] as const;

/** Saves each scholar-year as a verified office payment. Returns how many were saved. */
export async function markFeesPaid(
  entries: readonly { row: FeeMarkRow; amount: number }[],
  details: { paidOn: string; mode: string; reference: string; recordedBy: string },
) {
  let saved = 0;
  const failures: string[] = [];
  for (const { row, amount } of entries) {
    const next = nextInstallment(row.year);
    if (!next.number || amount <= 0) {
      failures.push(
        `${row.name} · Year ${row.year.index}: ${next.blocked ?? "nothing due"}`,
      );
      continue;
    }
    if (next.mustPayAll && amount !== next.due) {
      failures.push(
        `${row.name} · Year ${row.year.index}: the last instalment must clear the balance`,
      );
      continue;
    }
    const result = await saveScholarRecord({
      kind: "payment",
      scholarIdentifier: row.identifier,
      scholarName: row.name,
      status: "Approved",
      payload: {
        purpose: annualFeePurpose,
        feeYear: String(row.year.index),
        installment: String(next.number),
        amount: String(amount),
        paidOn: details.paidOn,
        mode: details.mode,
        transactionNumber: details.reference,
        recordedBy: details.recordedBy,
      },
      fileName: null,
      fileData: null,
    });
    if (result.ok) saved += 1;
    else failures.push(`${row.name} · Year ${row.year.index}: ${result.message}`);
  }
  return { saved, failures };
}

/** Saves a fee concession for each chosen year, with the reason. The due for the year drops by it. */
export async function grantConcessions(
  entries: readonly { row: FeeMarkRow; amount: number }[],
  details: { reason: string; orderRef: string; recordedBy: string; on: string },
) {
  let saved = 0;
  const failures: string[] = [];
  for (const { row, amount } of entries) {
    if (amount <= 0 || amount > row.year.balance) {
      failures.push(
        `${row.name} · Year ${row.year.index}: enter up to ₹${formatInr(row.year.balance)}`,
      );
      continue;
    }
    const result = await saveScholarRecord({
      kind: "payment",
      scholarIdentifier: row.identifier,
      scholarName: row.name,
      status: "Approved",
      payload: {
        purpose: concessionPurpose,
        concession: "yes",
        feeYear: String(row.year.index),
        amount: String(amount),
        reason: details.reason,
        transactionNumber: details.orderRef,
        paidOn: details.on,
        mode: "Concession",
        recordedBy: details.recordedBy,
      },
      fileName: null,
      fileData: null,
    });
    if (result.ok) {
      saved += 1;
      await recordAudit({
        action: "fee:concession",
        subject: row.identifier,
        detail: `${details.recordedBy} granted a fee concession of ₹${formatInr(amount)} to ${row.name} for Year ${row.year.index}: ${details.reason}${details.orderRef ? ` (order ${details.orderRef})` : ""}`,
      }).catch(() => undefined);
    } else failures.push(`${row.name} · Year ${row.year.index}: ${result.message}`);
  }
  return { saved, failures };
}

/**
 * Office entry for one scholar: tick the years already paid (amounts default to the full
 * balance). Used to bring existing batches onto the ERP; later payments come from scholars.
 */
export function MarkFeePaidDialog({
  scholarName,
  rows,
  info,
  onClose,
  onDone,
}: {
  scholarName: string;
  rows: readonly FeeMarkRow[];
  /** Shown after a part payment, when the dialog reopens for the remaining amount. */
  info?: string | null;
  onClose: () => void;
  /** `again` is true when a part payment left a balance, so the dialog reopens. */
  onDone: (message: string, again: boolean) => void;
}) {
  const session = usePreviewSession();
  const open = rows.filter((row) => row.year.balance > 0);
  const [chosen, setChosen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(open.map((row) => [row.key, open.length === 1])),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [paidOn, setPaidOn] = useState("");
  const [mode, setMode] = useState<string>(officeModes[0]);
  const [reference, setReference] = useState(openingReference);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A concession is decided by the administrator or the Dean.
  const mayConcede = session?.role === "admin" || session?.role === "dean";
  const [entry, setEntry] = useState<"payment" | "concession">("payment");
  const [reason, setReason] = useState("");
  const [orderRef, setOrderRef] = useState("");

  /** The last instalment clears the balance, so it is not typed: it is the whole balance. */
  const amountFor = (row: FeeMarkRow) => {
    const next = nextInstallment(row.year);
    return next.mustPayAll ? next.due : Number(amounts[row.key]) || 0;
  };

  async function concede() {
    const entries = open
      .filter((row) => chosen[row.key])
      .map((row) => ({ row, amount: Number(amounts[row.key]) || 0 }));
    if (entries.length === 0) return setError("Tick at least one year.");
    const missing = entries.find(({ amount }) => amount <= 0);
    if (missing)
      return setError(`Enter the concession for Year ${missing.row.year.index}.`);
    const tooMuch = entries.find(({ row, amount }) => amount > row.year.balance);
    if (tooMuch)
      return setError(
        `Year ${tooMuch.row.year.index}: the concession can be up to ₹${formatInr(tooMuch.row.year.balance)}.`,
      );
    if (reason.trim().length < 3) return setError("Give the reason for the concession.");
    setBusy(true);
    const recordedBy = session
      ? session.name.trim() || session.identifier
      : "Research office";
    const result = await grantConcessions(entries, {
      reason: reason.trim().slice(0, 300),
      orderRef: orderRef.trim().slice(0, 80),
      recordedBy,
      on: clientToday(),
    });
    setBusy(false);
    if (result.saved === 0) return setError(result.failures.join(" ") || "Not saved.");
    onDone(
      `${scholarName} · concession of ${entries
        .map(({ row, amount }) => `₹${formatInr(amount)} for Year ${row.year.index}`)
        .join(
          ", ",
        )} saved.${result.failures.length ? ` Not saved: ${result.failures.join("; ")}.` : ""}`,
      false,
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (entry === "concession") return concede();
    const entries = open
      .filter((row) => chosen[row.key])
      .map((row) => ({ row, amount: amountFor(row) }));
    if (entries.length === 0) {
      setError("Tick at least one year.");
      return;
    }
    if (!paidOn) {
      setError("Select the date of payment.");
      return;
    }
    const missing = entries.find(({ amount }) => amount <= 0);
    if (missing) {
      setError(`Enter the amount paid for Year ${missing.row.year.index}.`);
      return;
    }
    const tooMuch = entries.find(
      ({ row, amount }) => amount > nextInstallment(row.year).due,
    );
    if (tooMuch) {
      setError(
        `Year ${tooMuch.row.year.index}: enter up to ₹${formatInr(nextInstallment(tooMuch.row.year).due)}.`,
      );
      return;
    }
    if (paidOn > clientToday()) {
      setError("The payment date cannot be in the future.");
      return;
    }
    setBusy(true);
    const result = await markFeesPaid(entries, {
      paidOn,
      mode,
      reference: reference.trim() || openingReference,
      recordedBy: session ? session.name.trim() || session.identifier : "Research office",
    });
    setBusy(false);
    if (result.failures.length > 0 && result.saved === 0) {
      setError(result.failures.join(" "));
      return;
    }
    const partial = entries.filter(({ row, amount }) => amount < row.year.balance);
    const summary = entries
      .map(
        ({ row, amount }) =>
          `Year ${row.year.index}: ₹${formatInr(amount)} saved${
            amount < row.year.balance
              ? `, ₹${formatInr(row.year.balance - amount)} remaining`
              : " (paid in full)"
          }`,
      )
      .join(" · ");
    onDone(
      `${scholarName} · ${summary}.${
        result.failures.length ? ` Not saved: ${result.failures.join("; ")}.` : ""
      }`,
      partial.length > 0 && result.saved > 0,
    );
  }

  return (
    <FormDialog
      title={`Fee already paid · ${scholarName}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel={entry === "concession" ? "Save concession" : "Record payment"}
    >
      {mayConcede ? (
        <div role="radiogroup" aria-label="Entry" className="flex gap-2">
          {(
            [
              ["payment", "Fee paid"],
              ["concession", "Fee concession"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={entry === id}
              onClick={() => {
                setEntry(id);
                setError(null);
              }}
              className={
                entry === id
                  ? "rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-primary hover:border-primary/40"
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {info ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-primary"
        >
          {info} Enter the next instalment below, or close if the rest is not paid yet.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every year is already paid.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-2">
                  {entry === "concession" ? "Concession" : "Paid"}
                </th>
                <th className="px-3 py-2">Fee year</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">
                  {entry === "concession" ? "Concession (₹)" : "Amount paid (₹)"}
                </th>
              </tr>
            </thead>
            <tbody>
              {open.map((row) => {
                const next = nextInstallment(row.year);
                return (
                  <tr key={row.key} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Mark Year ${row.year.index} paid`}
                        checked={Boolean(chosen[row.key])}
                        disabled={entry === "payment" && !next.number}
                        onChange={(event) =>
                          setChosen((current) => ({
                            ...current,
                            [row.key]: event.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      {row.year.label}
                      <p className="text-xs text-muted-foreground">
                        {next.number
                          ? `${ordinal(next.number)} instalment${next.mustPayAll ? " · must clear the balance" : ""}`
                          : next.blocked}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      ₹{formatInr(row.year.balance)}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label={`Amount for Year ${row.year.index}`}
                        inputMode="numeric"
                        className="h-9"
                        placeholder={`Up to ${formatInr(entry === "concession" ? row.year.balance : next.due)}`}
                        value={
                          entry === "payment" && next.mustPayAll
                            ? String(next.due)
                            : (amounts[row.key] ?? "")
                        }
                        disabled={
                          !chosen[row.key] || (entry === "payment" && !next.number)
                        }
                        readOnly={entry === "payment" && next.mustPayAll}
                        onChange={(event) =>
                          setAmounts((current) => ({
                            ...current,
                            [row.key]: event.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {entry === "concession" ? (
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormField
            label="Reason for the concession"
            htmlFor="concession-reason"
            required
          >
            <Input
              id="concession-reason"
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <FormField label="Order / reference no." htmlFor="concession-order">
            <Input
              id="concession-order"
              maxLength={80}
              value={orderRef}
              onChange={(event) => setOrderRef(event.target.value)}
            />
          </FormField>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Date of payment" htmlFor="mark-date" required>
            <Input
              id="mark-date"
              type="date"
              value={paidOn}
              max={clientToday()}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </FormField>
          <FormField label="Mode" htmlFor="mark-mode">
            <NativeSelect
              id="mark-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {officeModes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Reference / receipt no." htmlFor="mark-ref">
            <Input
              id="mark-ref"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </FormField>
        </div>
      )}
    </FormDialog>
  );
}
