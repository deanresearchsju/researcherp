"use client";

import Link from "next/link";
import { useState } from "react";
import { useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { menuByKind, scholarRecordMenus } from "@/data/scholar-records";
import { formatIsoDate } from "@/lib/dates";
import { currentOffice, sameId, subscribeOffice } from "@/lib/office";
import {
  currentScholarRecords,
  setScholarRecordStatus,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePreviewSession } from "@/lib/use-preview-session";

const reviewMenus = scholarRecordMenus.filter((menu) => menu.needsSupervisor);

export function ReviewScreen() {
  const session = usePreviewSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const publication = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("publication", onChange),
    () => currentScholarRecords("publication"),
    () => null,
  );
  const report = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("six_month_report", onChange),
    () => currentScholarRecords("six_month_report"),
    () => null,
  );
  const cancellation = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("phd_cancellation", onChange),
    () => currentScholarRecords("phd_cancellation"),
    () => null,
  );
  const change = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("supervisor_change", onChange),
    () => currentScholarRecords("supervisor_change"),
    () => null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!office || !publication || !report || !cancellation || !change) {
    return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  }
  if (!session || session.role !== "supervisor") {
    return (
      <p className="text-sm">
        <Link href="/login/supervisor" className="font-semibold text-primary hover:underline">
          Sign in as a supervisor
        </Link>{" "}
        to review scholar requests.
      </p>
    );
  }

  const allotted = office.allocations.filter((item) =>
    sameId(item.supervisorIdentifier, session.identifier),
  );
  const records = [...publication.records, ...report.records, ...cancellation.records, ...change.records]
    .filter((record) =>
      allotted.some((item) => sameId(item.scholarIdentifier, record.scholarIdentifier)),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  async function decide(record: ScholarRecord, status: "Supervisor approved" | "Returned") {
    const saved = await setScholarRecordStatus(record, status);
    setNotice(saved ? `${record.scholarName} marked ${status}.` : "That decision could not be saved.");
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Supervisor
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Scholar requests</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Publications, six-month reports, supervisor-change requests, and Ph.D. cancellation requests from scholars allotted to you. The research office approves after you.
      </p>
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {allotted.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No scholar is allotted to you yet.</p>
      ) : null}
      {records.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {records.map((record) => {
            const menu = menuByKind(record.kind);
            return (
              <li key={record.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-primary">
                      {menu.label} · {record.scholarName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatIsoDate(record.createdAt.slice(0, 10))}
                      {record.fileName ? ` · ${record.fileName}` : ""}
                    </p>
                  </div>
                  <Badge variant={record.status === "Approved" ? "gold" : record.status === "Returned" ? "maroon" : "purple"}>
                    {record.status}
                  </Badge>
                </div>
                <div className="mt-3 text-sm">
                  {menu.fields.map((field) => (
                    <p key={field.name}>
                      <span className="text-muted-foreground">{field.label}: </span>
                      {record.payload[field.name] || "—"}
                    </p>
                  ))}
                </div>
                {record.status === "Submitted" ? (
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" variant="gold" onClick={() => void decide(record, "Supervisor approved")}>
                      Recommend
                    </Button>
                    <Button type="button" size="sm" variant="maroon" onClick={() => void decide(record, "Returned")}>
                      Return
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Menus covered: {reviewMenus.map((menu) => menu.label).join(", ")}.
      </p>
    </div>
  );
}
