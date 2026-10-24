"use client";

import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { PaymentInstructions } from "@/components/forms/PaymentInstructions";
import {
  FormDialog,
  PageTitle,
  ScholarIdentityHeader,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ScholarFeeStatus } from "@/components/portal/ScholarFeeStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { feeLedger } from "@/lib/fee-ledger";
import {
  annualFeePurpose,
  feePaymentModes,
  maxInstallments,
  nextInstallment,
  ordinal,
  type FeeYear,
} from "@/lib/fees";
import { fileError, type StoredFile } from "@/lib/files";
import { currentReminders, subscribeRegister } from "@/lib/register";
import {
  currentScholarRecords,
  loadRecordFile,
  saveScholarRecord,
  subscribeScholarRecords,
} from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";
import { cn, formatInr } from "@/lib/utils";
import { storeFile } from "@/lib/file-store";

const yearTone: Record<FeeYear["status"], "gold" | "maroon" | "purple" | "outline"> = {
  Paid: "gold",
  "Partly paid": "purple",
  Unpaid: "maroon",
  Upcoming: "outline",
};

function Tile({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "good" | "due";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-card",
        tone === "good" && "border-accent/50",
        tone === "due" && "border-secondary/40",
        tone === "default" && "border-border",
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "due" ? "text-secondary" : "text-primary",
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function PayDialog({
  year,
  identifier,
  name,
  onClose,
  onDone,
}: {
  year: FeeYear;
  identifier: string;
  name: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const next = nextInstallment(year);
  const [amount, setAmount] = useState(String(next.due));
  const [paidOn, setPaidOn] = useState(clientToday());
  const [mode, setMode] = useState<string>(feePaymentModes[0]);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<StoredFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!next.number) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter the amount paid.");
      return;
    }
    if (value > next.due) {
      setError(`The balance for this year is ₹${formatInr(next.due)}.`);
      return;
    }
    if (next.mustPayAll && value !== next.due) {
      setError(
        `The ${ordinal(maxInstallments)} instalment has to clear the full balance of ₹${formatInr(next.due)}.`,
      );
      return;
    }
    if (!paidOn || paidOn > clientToday()) {
      setError("Enter the date of payment.");
      return;
    }
    if (reference.trim().length < 4) {
      setError("Enter the transaction reference.");
      return;
    }
    const problem = fileError(receipt?.file ?? null, "document", true);
    if (problem || !receipt?.file) {
      setError(problem ?? "Upload the payment receipt.");
      return;
    }
    setBusy(true);
    const data = await storeFile(receipt.file, "receipts").catch(() => "");
    const saved = await saveScholarRecord({
      kind: "payment",
      scholarIdentifier: identifier,
      scholarName: name,
      payload: {
        purpose: annualFeePurpose,
        feeYear: String(year.index),
        installment: String(next.number),
        amount: String(value),
        paidOn,
        mode,
        transactionNumber: reference.trim(),
      },
      fileName: receipt.file.name,
      fileData: data || null,
    });
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onDone(
      `${ordinal(next.number)} instalment of ₹${formatInr(value)} submitted. The research office will verify it.`,
    );
  }

  return (
    <FormDialog
      title={`${ordinal(next.number ?? 1)} instalment · ${year.label}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Submit payment"
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <PaymentInstructions amount={next.due} purpose={annualFeePurpose} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Amount paid (₹)"
          htmlFor="fee-amount"
          required
          hint={
            next.mustPayAll
              ? "Final instalment: the full balance."
              : `Balance ₹${formatInr(next.due)}. Pay in full or in part.`
          }
        >
          <Input
            id="fee-amount"
            inputMode="numeric"
            value={amount}
            readOnly={next.mustPayAll}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </FormField>
        <FormField label="Date of payment" htmlFor="fee-date" required>
          <Input
            id="fee-date"
            type="date"
            value={paidOn}
            max={clientToday()}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </FormField>
        <FormField label="Mode" htmlFor="fee-mode" required>
          <NativeSelect
            id="fee-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            {feePaymentModes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Transaction reference / UTR" htmlFor="fee-ref" required>
          <Input
            id="fee-ref"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </FormField>
        <FormField
          label="Payment receipt"
          htmlFor="fee-receipt"
          required
          className="sm:col-span-2"
        >
          <FileUpload
            id="fee-receipt"
            acceptRule="document"
            value={receipt}
            onChange={setReceipt}
          />
        </FormField>
      </div>
    </FormDialog>
  );
}

function YearCard({
  year,
  onPay,
  onNotice,
}: {
  year: FeeYear;
  onPay: () => void;
  onNotice: (message: string) => void;
}) {
  const next = nextInstallment(year);
  const showBalanceRow = year.balance > 0 && year.status !== "Upcoming";
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
        <div>
          <h2 className="font-semibold text-primary">{year.label}</h2>
          <p className="text-xs text-muted-foreground">
            Annual fee ₹{formatInr(year.amount)} · paid ₹{formatInr(year.paid)}
            {year.pending ? ` · under verification ₹${formatInr(year.pending)}` : ""}
          </p>
        </div>
        <Badge variant={yearTone[year.status]}>{year.status}</Badge>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-5 py-2">Instalment</th>
              <th className="px-5 py-2">Paid on</th>
              <th className="px-5 py-2">Amount</th>
              <th className="px-5 py-2">Mode · Reference</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">
                <span className="sr-only">Receipt</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {year.installments.map((item) => (
              <tr key={item.record.id} className="border-t border-border">
                <td className="px-5 py-3 font-medium">{ordinal(item.number)}</td>
                <td className="px-5 py-3">
                  {item.paidOn ? formatIsoDate(item.paidOn) : "—"}
                </td>
                <td className="px-5 py-3 font-semibold tabular-nums">
                  ₹{formatInr(item.amount)}
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {[item.mode, item.reference].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-5 py-3">
                  <StatusPill
                    status={item.record.status === "Approved" ? "Approved" : "Pending"}
                  />
                </td>
                <td className="px-5 py-3 text-right">
                  <ViewFilesButton
                    fileName={item.record.fileName}
                    load={() => loadRecordFile(item.record)}
                    onMissing={onNotice}
                  />
                </td>
              </tr>
            ))}
            {showBalanceRow ? (
              <tr className="border-t border-border bg-secondary/5">
                <td className="px-5 py-3 font-semibold text-secondary">
                  {next.number ? ordinal(next.number) : "Balance"}
                </td>
                <td className="px-5 py-3 text-muted-foreground">Due</td>
                <td className="px-5 py-3 font-bold text-secondary tabular-nums">
                  ₹
                  {formatInr(next.number ? next.due : year.balance)}
                </td>
                <td className="px-5 py-3 text-muted-foreground" colSpan={2}>
                  {next.blocked ??
                    (next.mustPayAll
                      ? "Final instalment — full balance"
                      : "Balance to pay")}
                </td>
                <td className="px-5 py-3 text-right">
                  {next.number ? (
                    <Button type="button" size="sm" variant="gold" onClick={onPay}>
                      Pay now
                    </Button>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {year.installments.length === 0 && !showBalanceRow ? (
              <tr>
                <td colSpan={6} className="px-5 py-4 text-muted-foreground">
                  {year.status === "Upcoming" ? "Not due yet." : "No payment recorded."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function FeeScreen() {
  const ready = useClientReady();
  const session = usePortalSession();
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
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
  const [paying, setPaying] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!ready || !load || !session) {
    return <p className="text-sm text-muted-foreground">Loading fee…</p>;
  }

  const ledger = feeLedger(session.identifier, session.name, load.records, clientToday());
  const current = ledger.current;
  const myReminders = reminders.filter(
    (item) =>
      item.key.toLowerCase() === session.identifier.toLowerCase() &&
      (ledger.plan.find((year) => year.index === item.feeYear)?.balance ?? 0) > 0,
  );
  const payingYear = ledger.plan.find((year) => year.index === paying) ?? null;

  return (
    <section className="space-y-6">
      <PageTitle kicker="Scholar" title="Fee" />
      <ScholarIdentityHeader identifier={session.identifier} />
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {myReminders.map((item) => (
        <div
          key={`${item.key}-${item.feeYear}`}
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Fee reminder{item.dueOn ? ` · due ${formatIsoDate(item.dueOn)}` : ""}
            </p>
            <p className="mt-1 leading-6">{item.message}</p>
          </div>
        </div>
      ))}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Annual research fee"
          value={`₹${formatInr(current.amount)}`}
          note={ledger.studyMode}
        />
        <Tile
          label={`Paid · Year ${current.index}`}
          value={`₹${formatInr(current.paid)}`}
          tone="good"
        />
        <Tile
          label={`Balance · Year ${current.index}`}
          value={`₹${formatInr(current.balance)}`}
          tone={current.balance > 0 ? "due" : "good"}
          note={
            current.pending
              ? `₹${formatInr(current.pending)} under verification`
              : undefined
          }
        />
        <Tile
          label="Total outstanding"
          value={`₹${formatInr(ledger.outstanding)}`}
          tone={ledger.outstanding > 0 ? "due" : "good"}
          note="All years so far"
        />
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="size-4" aria-hidden="true" />
        The annual fee can be paid in up to {maxInstallments} instalments. The last
        instalment clears the balance.
        {current.balance === 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            <CheckCircle2 className="size-4" aria-hidden="true" /> This year is fully
            paid.
          </span>
        ) : null}
      </p>
      <div className="space-y-4">
        {[...ledger.plan].reverse().map((year) => (
          <YearCard
            key={year.index}
            year={year}
            onPay={() => {
              setNotice(null);
              setPaying(year.index);
            }}
            onNotice={setNotice}
          />
        ))}
      </div>
      <ScholarFeeStatus identifier={session.identifier} />
      {payingYear ? (
        <PayDialog
          year={payingYear}
          identifier={session.identifier}
          name={session.name.trim() || session.identifier}
          onClose={() => setPaying(null)}
          onDone={(message) => {
            setPaying(null);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
