import { allBatches } from "@/lib/batches";
import { isPartTimeMode } from "@/lib/constants";
import { currentFees } from "@/lib/fee-settings";
import type { ScholarRecord } from "@/lib/scholar-records";

/** A year's fee can be paid in at most three instalments. */
export const maxInstallments = 3;

export const annualFeePurpose = "Annual research fee";

export const feePaymentModes = [
  "UPI",
  "Net Banking",
  "Bank transfer",
  "Card",
  "Cash deposit",
] as const;

/** Merchant UPI of the university fee account (Central Bank of India). */
export const feeUpi = {
  id: "202509PRTqoWQWxHkhnpstqrsbrp@cbin",
  payee: "ST JOSEPH UNIVERSITY OPTIONAL FEES",
  qr: "/assets/fee-upi-qr.png",
} as const;

export type FeeInstallment = {
  record: ScholarRecord;
  number: number;
  amount: number;
  paidOn: string;
  mode: string;
  reference: string;
};

export type FeeYearStatus = "Paid" | "Partly paid" | "Unpaid" | "Upcoming";

export type FeeYear = {
  index: number;
  label: string;
  from: string;
  to: string;
  amount: number;
  /** Approved by the office. */
  paid: number;
  /** Submitted, waiting for the office. */
  pending: number;
  balance: number;
  installments: FeeInstallment[];
  status: FeeYearStatus;
};

const monthIndex: Record<string, number> = {
  january: 0,
  june: 5,
  july: 6,
};

function iso(year: number, month: number, day = 1) {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}

function shortMonth(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function annualFeeFor(studyMode: string) {
  const fees = currentFees();
  return isPartTimeMode(studyMode) ? fees.partTime : fees.fullTime;
}

/** Programme start: the admission batch's session, else January of the given fallback year. */
export function programmeStart(batchId: string, fallbackYear: number) {
  const batch = allBatches().find((item) => item.id === batchId);
  if (batch) {
    return iso(batch.year, monthIndex[batch.session.toLowerCase()] ?? 0);
  }
  return iso(fallbackYear, 0);
}

function amountOf(record: ScholarRecord) {
  const value = Number(String(record.payload.amount ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function isAnnualFee(record: ScholarRecord) {
  const purpose = (record.payload.purpose ?? "").toLowerCase();
  return (
    Boolean(record.payload.feeYear) ||
    purpose.includes("annual") ||
    purpose.includes("research fee")
  );
}

/**
 * Year-by-year annual fee for a scholar, from programme start to the current year.
 * Payments carry their fee year; older ones are placed by the date they were paid.
 */
export function feePlan(input: {
  start: string;
  studyMode: string;
  records: readonly ScholarRecord[];
  today: string;
}): FeeYear[] {
  const amount = annualFeeFor(input.studyMode);
  const startDate = new Date(`${input.start}T00:00:00Z`);
  const todayDate = new Date(`${input.today}T00:00:00Z`);
  const years = Math.max(
    1,
    Math.floor(
      todayDate.getUTCFullYear() -
        startDate.getUTCFullYear() +
        (todayDate.getUTCMonth() - startDate.getUTCMonth()) / 12,
    ) + 1,
  );
  const annual = input.records.filter(isAnnualFee);
  const plan: FeeYear[] = [];
  for (let index = 1; index <= years; index += 1) {
    const from = iso(startDate.getUTCFullYear() + index - 1, startDate.getUTCMonth());
    const to = iso(startDate.getUTCFullYear() + index, startDate.getUTCMonth(), 0);
    const mine = annual
      .filter((record) => {
        const tagged = Number(record.payload.feeYear);
        if (tagged) return tagged === index;
        const paidOn = record.payload.paidOn ?? record.createdAt.slice(0, 10);
        return paidOn >= from && paidOn <= to;
      })
      .filter((record) => record.status !== "Returned")
      .sort((left, right) =>
        (left.payload.paidOn ?? left.createdAt).localeCompare(
          right.payload.paidOn ?? right.createdAt,
        ),
      );
    const installments = mine.map((record, position) => ({
      record,
      number: Number(record.payload.installment) || position + 1,
      amount: amountOf(record),
      paidOn: record.payload.paidOn ?? "",
      mode: record.payload.mode ?? "",
      reference: record.payload.transactionNumber ?? "",
    }));
    const paid = installments
      .filter((item) => item.record.status === "Approved")
      .reduce((sum, item) => sum + item.amount, 0);
    const pending = installments
      .filter((item) => item.record.status !== "Approved")
      .reduce((sum, item) => sum + item.amount, 0);
    const balance = Math.max(0, amount - paid);
    const status: FeeYearStatus =
      balance === 0
        ? "Paid"
        : paid > 0
          ? "Partly paid"
          : from > input.today
            ? "Upcoming"
            : "Unpaid";
    plan.push({
      index,
      label: `Year ${index} · ${shortMonth(from)} – ${shortMonth(to)}`,
      from,
      to,
      amount,
      paid,
      pending,
      balance,
      installments,
      status,
    });
  }
  return plan;
}

/** Next instalment number and the amount rules for it, or a reason no payment is open. */
export function nextInstallment(year: FeeYear) {
  const open = year.amount - year.paid - year.pending;
  if (open <= 0) {
    return {
      number: null,
      due: 0,
      mustPayAll: false,
      blocked:
        year.pending > 0
          ? "Your payment is with the research office for verification."
          : "This year's fee is paid in full.",
    };
  }
  const number = year.installments.length + 1;
  if (number > maxInstallments) {
    return {
      number: null,
      due: open,
      mustPayAll: false,
      blocked:
        "Three instalments are already recorded for this year. Contact the research office.",
    };
  }
  return { number, due: open, mustPayAll: number === maxInstallments, blocked: null };
}

export function ordinal(value: number) {
  return value === 1 ? "1st" : value === 2 ? "2nd" : value === 3 ? "3rd" : `${value}th`;
}
