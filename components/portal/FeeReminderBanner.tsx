"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { feeLedger } from "@/lib/fee-ledger";
import { currentReminders, subscribeRegister } from "@/lib/register";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { formatInr } from "@/lib/utils";

/** Fee reminders from the office, shown on the scholar's home page until that year is paid. */
export function FeeReminderBanner({
  identifier,
  name,
}: {
  identifier: string;
  name: string;
}) {
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const reminders = useSyncExternalStore(
    subscribeRegister,
    currentReminders,
    currentReminders,
  );
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const mine = reminders.filter(
    (item) => item.key.toLowerCase() === identifier.toLowerCase(),
  );
  if (!load || mine.length === 0) return null;
  const ledger = feeLedger(identifier, name, load.records, clientToday());
  const live = mine.filter(
    (item) => (ledger.plan.find((year) => year.index === item.feeYear)?.balance ?? 0) > 0,
  );
  if (live.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      {live.map((item) => {
        const year = ledger.plan.find((entry) => entry.index === item.feeYear);
        return (
          <div
            key={`${item.key}-${item.feeYear}`}
            role="alert"
            className="flex flex-wrap items-start gap-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Fee reminder · Year {item.feeYear}
                {year ? ` · balance ₹${formatInr(year.balance)}` : ""}
                {item.dueOn ? ` · due ${formatIsoDate(item.dueOn)}` : ""}
              </p>
              <p className="mt-1 leading-6">{item.message}</p>
            </div>
            <Link
              href="/scholar/fee"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground"
            >
              Pay now
            </Link>
          </div>
        );
      })}
    </div>
  );
}
