"use client";

import { useSyncExternalStore } from "react";

import { StatusPill } from "@/components/portal/Desk";
import { paymentCopy, paymentKinds, type FeeStatus } from "@/data/payments";
import type { RecordStatus } from "@/data/scholar-records";
import type { PaymentMark } from "@/lib/admission";
import { currentAdmission, subscribeAdmission } from "@/lib/admission";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";

export function ScholarFeeStatus({ identifier }: { identifier: string }) {
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const annual = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );

  const application = admission?.cases.find(
    (row) => sameId(row.email, identifier) || sameId(row.applicationNo, identifier),
  );
  const course = doctoral?.registrations.filter((row) =>
    sameId(row.scholarIdentifier, identifier),
  );
  const courseStatus =
    course && course.length > 0
      ? course.every((row) => row.paymentStatus === "Approved")
        ? "Approved"
        : course.some((row) => row.paymentStatus === "Returned")
          ? "Returned"
          : "Pending"
      : null;
  const latestAnnual = annual?.records
    .filter((row) => sameId(row.scholarIdentifier, identifier))
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  const rows: {
    label: string;
    status: FeeStatus | PaymentMark | RecordStatus | null;
  }[] = [
    {
      label: paymentKinds[0].label,
      status: application?.payment ?? null,
    },
    {
      label: paymentKinds[1].label,
      status: courseStatus,
    },
    {
      label: paymentKinds[2].label,
      status: latestAnnual?.status ?? null,
    },
  ];

  return (
    <section className="mt-6 rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">{paymentCopy.scholarTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{paymentCopy.scholarDetail}</p>
      </div>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[12rem_1fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd>{row.status ? <StatusPill status={row.status} /> : "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
