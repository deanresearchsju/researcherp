"use client";

import { Check, Copy, Landmark, QrCode } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { university } from "@/lib/constants";
import { feeUpi } from "@/lib/fees";
import { cn, formatInr } from "@/lib/utils";

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-readonly-allow
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** University fee account: scan-to-pay UPI QR and bank transfer details. */
export function PaymentInstructions({
  amount,
  purpose,
  className,
}: {
  amount?: number;
  purpose?: string;
  className?: string;
}) {
  const bank = university.bank;
  const rows: [string, string][] = [
    ["Account name", bank.accountName],
    ["Account number", bank.accountNumber],
    ["IFSC", bank.ifsc],
    ["Bank", bank.bankName],
    ["Branch", bank.branch],
  ];
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-primary to-purple-deep px-4 py-3 text-primary-foreground">
        <p className="text-sm font-semibold">
          How to pay{purpose ? ` · ${purpose}` : ""}
        </p>
        {amount ? (
          <p className="rounded-full bg-card/15 px-3 py-1 text-sm font-bold">
            ₹{formatInr(amount)}
          </p>
        ) : null}
      </div>
      <div className="grid gap-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2 border-b border-border p-4 md:border-r md:border-b-0">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-secondary uppercase">
            <QrCode className="size-4" aria-hidden="true" /> Scan &amp; pay (UPI)
          </p>
          <Image
            src={feeUpi.qr}
            alt="UPI QR code for St. Joseph University fee account"
            width={200}
            height={200}
            className="size-48 rounded-lg border border-border bg-white p-1"
          />
          <p className="text-center text-[0.7rem] leading-4 text-muted-foreground">
            BHIM · Google Pay · PhonePe · Paytm · any UPI app
          </p>
          <div className="flex max-w-full items-center gap-1">
            <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[0.68rem]">
              {feeUpi.id}
            </code>
            <CopyValue value={feeUpi.id} label="UPI ID" />
          </div>
        </div>
        <div className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-secondary uppercase">
            <Landmark className="size-4" aria-hidden="true" /> Bank transfer (NEFT / RTGS
            / IMPS)
          </p>
          <dl className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="flex items-center gap-1 text-right font-semibold text-foreground">
                  {value}
                  {label === "Account number" || label === "IFSC" ? (
                    <CopyValue value={value} label={label} />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Keep the transaction reference and upload the receipt below. The research
            office verifies every payment.
          </p>
        </div>
      </div>
    </section>
  );
}
