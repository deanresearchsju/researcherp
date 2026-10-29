"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { FileUpload } from "@/components/forms/FileUpload";
import { PaymentInstructions } from "@/components/forms/PaymentInstructions";
import { FormDialog, StatusPill, ViewFilesButton } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { rupees, useFees } from "@/lib/fee-settings";
import { feePaymentModes } from "@/lib/fees";
import { fileError, type StoredFile } from "@/lib/files";
import { storeFile } from "@/lib/file-store";
import { sameId } from "@/lib/office";
import {
  loadRecordFile,
  saveScholarRecord,
  type ScholarRecord,
} from "@/lib/scholar-records";
import {
  isSubmissionFeePurpose,
  submissionFeePurpose,
  type SubmissionFeeKind,
} from "@/lib/submission-fees";

const copy: Record<SubmissionFeeKind, { title: string; upload: string }> = {
  synopsis: { title: "Synopsis fee", upload: "synopsis" },
  thesis: { title: "Ph.D. thesis fee", upload: "thesis" },
};

function PayDialog({
  kind,
  fee,
  identifier,
  name,
  onClose,
  onDone,
}: {
  kind: SubmissionFeeKind;
  fee: number;
  identifier: string;
  name: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [paidOn, setPaidOn] = useState(clientToday());
  const [mode, setMode] = useState<string>(feePaymentModes[0]);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<StoredFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paidOn || paidOn > clientToday()) return setError("Enter the date of payment.");
    if (reference.trim().length < 4) return setError("Enter the transaction reference.");
    const problem = fileError(receipt?.file ?? null, "pdfDocument", true);
    if (problem || !receipt?.file)
      return setError(problem ?? "Upload the payment receipt.");
    setBusy(true);
    const data = await storeFile(receipt.file, "receipts").catch(() => "");
    const saved = await saveScholarRecord({
      kind: "payment",
      scholarIdentifier: identifier,
      scholarName: name,
      payload: {
        purpose: submissionFeePurpose[kind],
        amount: String(fee),
        paidOn,
        mode,
        transactionNumber: reference.trim(),
      },
      fileName: receipt.file.name,
      fileData: data || null,
    });
    setBusy(false);
    if (!saved.ok) return setError(saved.message);
    onDone(
      `The ${copy[kind].upload} fee of ${rupees(fee)} is submitted. Accounts will verify it.`,
    );
  }

  return (
    <FormDialog
      title={`Pay the ${copy[kind].upload} fee`}
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
      <PaymentInstructions amount={fee} purpose={submissionFeePurpose[kind]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Amount (₹)"
          htmlFor="sub-fee-amount"
          hint="Fixed by the University."
        >
          <Input id="sub-fee-amount" value={String(fee)} readOnly />
        </FormField>
        <FormField label="Date of payment" htmlFor="sub-fee-date" required>
          <Input
            id="sub-fee-date"
            type="date"
            value={paidOn}
            max={clientToday()}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </FormField>
        <FormField label="Mode" htmlFor="sub-fee-mode" required>
          <NativeSelect
            id="sub-fee-mode"
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
        <FormField label="Transaction reference / UTR" htmlFor="sub-fee-ref" required>
          <Input
            id="sub-fee-ref"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </FormField>
        <FormField
          label="Payment receipt"
          htmlFor="sub-fee-receipt"
          required
          className="sm:col-span-2"
        >
          <FileUpload
            id="sub-fee-receipt"
            acceptRule="pdfDocument"
            value={receipt}
            onChange={setReceipt}
          />
        </FormField>
      </div>
    </FormDialog>
  );
}

/**
 * The synopsis or thesis submission fee of a scholar: what is due, the payments made and their
 * state, and the payment form. Accounts verifies each payment (Fees, Fee approvals); the upload
 * of the synopsis or thesis opens once it is verified.
 */
export function SubmissionFeePanel({
  kind,
  identifier,
  name,
  payments,
}: {
  kind: SubmissionFeeKind;
  identifier: string;
  name: string;
  payments: readonly ScholarRecord[];
}) {
  const fees = useFees();
  const fee = fees[kind];
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mine = payments
    .filter(
      (record) =>
        record.kind === "payment" &&
        sameId(record.scholarIdentifier, identifier) &&
        isSubmissionFeePurpose(record.payload.purpose ?? "", kind),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const approved = mine
    .filter((record) => record.status === "Approved")
    .reduce((sum, record) => sum + (Number(record.payload.amount) || 0), 0);
  const waiting = mine.some(
    (record) => record.status === "Submitted" || record.status === "Supervisor approved",
  );
  const settled = fee > 0 && approved >= fee;

  return (
    <section className="space-y-4">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-primary">{copy[kind].title}</h2>
        {fee <= 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No {copy[kind].upload} fee is fixed at present, so nothing is to be paid
            before the {copy[kind].upload} is uploaded.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Fixed by the University: {rupees(fee)}. Pay it, attach the receipt, and the{" "}
              {copy[kind].upload} upload opens once Accounts verifies the payment.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {settled ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> Paid and
                  verified.
                </span>
              ) : waiting ? (
                <span className="text-sm font-semibold text-secondary">
                  Under verification by Accounts.
                </span>
              ) : (
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    setNotice(null);
                    setPaying(true);
                  }}
                >
                  Pay the {copy[kind].upload} fee
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      {mine.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
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
              {mine.map((record) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    {record.payload.paidOn ? formatIsoDate(record.payload.paidOn) : "—"}
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">
                    {rupees(Number(record.payload.amount) || 0)}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {[record.payload.mode, record.payload.transactionNumber]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill
                      status={
                        record.status === "Approved"
                          ? "Approved"
                          : record.status === "Returned"
                            ? "Rejected"
                            : "Pending"
                      }
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ViewFilesButton
                      fileName={record.fileName}
                      load={() => loadRecordFile(record)}
                      onMissing={setNotice}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {paying ? (
        <PayDialog
          kind={kind}
          fee={fee}
          identifier={identifier}
          name={name}
          onClose={() => setPaying(false)}
          onDone={(message) => {
            setPaying(false);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
