"use client";

import { useState } from "react";

import { FormDialog } from "@/components/portal/Desk";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { clientToday } from "@/lib/dates";
import {
  annualFeePurpose,
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = open
      .filter((row) => chosen[row.key])
      .map((row) => ({ row, amount: Number(amounts[row.key]) || 0 }));
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
      title={`Mark fee paid · ${scholarName}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Mark paid"
    >
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
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Fee year</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Amount paid (₹)</th>
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
                        disabled={!next.number}
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
                        placeholder={`Up to ${formatInr(next.due)}`}
                        value={amounts[row.key] ?? ""}
                        disabled={!chosen[row.key] || !next.number}
                        readOnly={next.mustPayAll}
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
    </FormDialog>
  );
}
