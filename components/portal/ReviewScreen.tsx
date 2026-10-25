"use client";

import Link from "next/link";
import { useState } from "react";
import { useSyncExternalStore } from "react";

import {
  DeskPage,
  DeskSection,
  GateBanner,
  ProcessFlow,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { menuByKind } from "@/data/scholar-records";
import { formatIsoDate } from "@/lib/dates";
import { currentOffice, sameId, subscribeOffice } from "@/lib/office";
import { scholarBySignIn, scholarsGuidedBy, sameGuide } from "@/lib/register";
import {
  currentScholarRecords,
  loadRecordFile,
  setScholarRecordStatus,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";
import { recordViewStamp } from "@/lib/approved-documents";


export function ReviewScreen() {
  const session = usePortalSession();
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
  const leave = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("leave", onChange),
    () => currentScholarRecords("leave"),
    () => null,
  );
  const extension = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("extension", onChange),
    () => currentScholarRecords("extension"),
    () => null,
  );
  const titleChange = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("title_change", onChange),
    () => currentScholarRecords("title_change"),
    () => null,
  );
  const studyMode = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("study_mode_change", onChange),
    () => currentScholarRecords("study_mode_change"),
    () => null,
  );
  const abcId = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("abc_id", onChange),
    () => currentScholarRecords("abc_id"),
    () => null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  if (
    !office ||
    !publication ||
    !report ||
    !cancellation ||
    !change ||
    !leave ||
    !extension ||
    !titleChange ||
    !studyMode ||
    !abcId
  ) {
    return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  }
  if (!session || session.role !== "supervisor") {
    return (
      <p className="text-sm">
        <Link
          href="/login/supervisor"
          className="font-semibold text-primary hover:underline"
        >
          Sign in as a supervisor
        </Link>{" "}
        to review scholar requests.
      </p>
    );
  }

  const allotted = office.allocations.filter((item) =>
    sameId(item.supervisorIdentifier, session.identifier),
  );
  const guided = scholarsGuidedBy(session.name, session.identifier);
  const supervisorName = session.name;
  function isOwnScholar(identifier: string) {
    if (allotted.some((item) => sameId(item.scholarIdentifier, identifier))) return true;
    const scholar = scholarBySignIn(identifier);
    if (!scholar) return false;
    return (
      guided.some((item) => item.id === scholar.id) ||
      sameGuide(scholar.guideName, supervisorName)
    );
  }
  const records = [
    ...publication.records,
    ...report.records,
    ...cancellation.records,
    ...change.records,
    ...leave.records,
    ...extension.records,
    ...titleChange.records,
    ...studyMode.records,
    ...abcId.records,
  ]
    .filter((record) => isOwnScholar(record.scholarIdentifier))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  async function decide(
    record: ScholarRecord,
    status: "Supervisor approved" | "Returned",
  ) {
    const note = (remarks[record.id] ?? "").trim();
    if (status === "Returned" && note.length < 2) {
      setNotice("Enter the remarks before returning this request.");
      return;
    }
    const saved = await setScholarRecordStatus(record, status, note);
    setNotice(
      saved
        ? `${record.scholarName} marked ${status}.`
        : "That decision could not be saved.",
    );
  }

  return (
    <DeskPage kicker="Scholars" title="Scholar requests">
      <ProcessFlow>
        Scholar submits &gt;&gt; Supervisor recommendation &gt;&gt; Research office
      </ProcessFlow>
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {allotted.length === 0 && guided.length === 0 ? (
        <GateBanner>No scholar is allotted to you yet.</GateBanner>
      ) : null}
      {records.length === 0 ? (
        <GateBanner>No requests yet.</GateBanner>
      ) : (
        <DeskSection title="Requests waiting">
          <ul className="space-y-3 p-4">
            {records.map((record) => {
              const menu = menuByKind(record.kind);
              return (
                <li
                  key={record.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-card"
                >
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
                    <div className="flex flex-wrap items-center gap-2">
                      <ViewFilesButton
                        fileName={record.fileName}
                        load={() => loadRecordFile(record)}
                        stamp={recordViewStamp(record)}
                        onMissing={setNotice}
                      />
                      <Badge
                        variant={
                          record.status === "Approved"
                            ? "gold"
                            : record.status === "Returned"
                              ? "maroon"
                              : "purple"
                        }
                      >
                        {record.status}
                      </Badge>
                    </div>
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
                    <div className="mt-3 space-y-2">
                      <Textarea
                        aria-label={`Remarks for ${record.scholarName}`}
                        value={remarks[record.id] ?? ""}
                        onChange={(event) =>
                          setRemarks((current) => ({
                            ...current,
                            [record.id]: event.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="gold"
                          onClick={() => void decide(record, "Supervisor approved")}
                        >
                          {record.kind === "publication" ? "Approve" : "Recommend"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="maroon"
                          onClick={() => void decide(record, "Returned")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </DeskSection>
      )}
    </DeskPage>
  );
}
