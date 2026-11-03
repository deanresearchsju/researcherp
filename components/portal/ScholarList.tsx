"use client";

import { IndianRupee, Lock, PencilLine, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { DeskModal, PageTitle } from "@/components/portal/Desk";
import { RegisterImport } from "@/components/portal/RegisterImport";
import { ResearchRegister } from "@/components/portal/ResearchRegister";
import { useScholarEntry } from "@/components/portal/ScholarEntryDialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { menuByKind } from "@/data/scholar-records";
import { formatIsoDate } from "@/lib/dates";
import { sameId } from "@/lib/office";
import {
  currentScholarRecords,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { useScholarReports } from "@/lib/use-report-sources";
import { usePreviewSession } from "@/lib/use-preview-session";

const menu = menuByKind("personal_details");

type EntryState = "Not entered" | "Sent by scholar" | "Locked";

/**
 * Scholar register › Scholar list: every scholar of the register with the work the office does
 * for each one in the same row — enter (and lock) the scholar's details, record the fee already
 * paid, enter the RAC. The scholar's name opens Scholar information.
 */
export function ScholarList() {
  const router = useRouter();
  const session = usePreviewSession();
  const corrects = session?.role === "admin" || session?.role === "staff";
  const data = useScholarReports();
  const reports = data.ready ? data.reports : [];
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("personal_details", onChange),
    () => currentScholarRecords("personal_details"),
    () => null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ScholarRecord | null>(null);
  const entry = useScholarEntry((message) => setNotice(message || null));

  const recordOf = (identifier: string) =>
    load?.records
      .filter((item) => sameId(item.scholarIdentifier, identifier))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const stateOf = (record: ScholarRecord | null): EntryState =>
    !record ? "Not entered" : record.status === "Approved" ? "Locked" : "Sent by scholar";
  const reportOf = (identifier: string) =>
    reports.find((report) => sameId(report.identifier, identifier)) ?? null;

  const states = reports.map((report) => stateOf(recordOf(report.identifier)));
  const counts = [
    ["Scholars", reports.length],
    ["Details entered and locked", states.filter((state) => state === "Locked").length],
    ["Details still to enter", states.filter((state) => state !== "Locked").length],
  ] as const;

  function actions(identifier: string, name: string) {
    if (!data.ready || !load) return null;
    const record = recordOf(identifier);
    const state = stateOf(record);
    const report = reportOf(identifier);
    return (
      <>
        {record ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-readonly-allow
            onClick={() => setViewing(record)}
          >
            {state === "Locked" ? <Lock className="size-4" aria-hidden="true" /> : null}
            View details
          </Button>
        ) : null}
        {state !== "Locked" ? (
          <Button
            type="button"
            size="sm"
            variant="gold"
            onClick={() => entry.details(identifier, name, record ?? undefined)}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            {record ? "Review & lock" : "Enter details"}
          </Button>
        ) : corrects ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => entry.details(identifier, name, record ?? undefined)}
          >
            <PencilLine className="size-4" aria-hidden="true" />
            Correct
          </Button>
        ) : null}
        {report && report.feeBalance > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => entry.fee(identifier, name)}
          >
            <IndianRupee className="size-4" aria-hidden="true" />
            Fee paid
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <section className="space-y-5">
      <PageTitle kicker="Scholar register" title="Scholar list" />
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}
      {data.ready && load ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {counts.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <RegisterImport kind="scholars" onDone={setNotice} />
      <ResearchRegister
        embedded
        onOpen={(identifier) =>
          router.push(
            `/admin/register?tab=register&scholar=${encodeURIComponent(identifier)}`,
          )
        }
        rowActions={actions}
      />
      {entry.dialogs}
      {viewing ? (
        <DeskModal
          title={`Scholar details · ${viewing.scholarName}`}
          onClose={() => setViewing(null)}
        >
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {menu.fields.map((field) => (
              <div key={field.name}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="font-medium break-words text-primary">
                  {viewing.payload[field.name] || "—"}
                </dd>
              </div>
            ))}
          </dl>
          {viewing.status === "Approved" ? (
            <p className="text-xs text-muted-foreground">
              <Badge variant="gold">Locked</Badge>
              {viewing.payload.approvedBy ? ` by ${viewing.payload.approvedBy}` : ""}
              {viewing.payload.approvedOn
                ? ` on ${formatIsoDate(viewing.payload.approvedOn)}`
                : ""}
            </p>
          ) : null}
        </DeskModal>
      ) : null}
    </section>
  );
}
