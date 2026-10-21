"use client";

import { useState, useSyncExternalStore } from "react";

import { ApplicationViewer } from "@/components/portal/ApplicationViewer";
import { DeskPage } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { admissionArchiveCopy, archiveSessionOptions } from "@/data/admission";
import {
  archivedApplications,
  currentAdmission,
  subscribeAdmission,
} from "@/lib/admission";
import { formatIsoDate } from "@/lib/dates";
import { usePreviewSession } from "@/lib/use-preview-session";
import type { StoredApplication } from "@/lib/records";

function sessionRank(session: string) {
  const index = archiveSessionOptions.findIndex((item) => item === session);
  return index < 0 ? 99 : index;
}

function archivedOn(value: string) {
  const day = value.slice(0, 10);
  return day ? formatIsoDate(day) : "—";
}

export function AdmissionArchive() {
  const preview = usePreviewSession();
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<StoredApplication | null>(null);

  if (preview && preview.role !== "admin" && preview.role !== "dean") {
    return (
      <p className="text-sm text-muted-foreground">{admissionArchiveCopy.forbidden}</p>
    );
  }

  if (!store) {
    return (
      <p className="text-sm text-muted-foreground">Loading the admission archive…</p>
    );
  }

  const sessions = [...store.archived].sort((left, right) => {
    if (left.year !== right.year) return right.year.localeCompare(left.year);
    return sessionRank(left.session) - sessionRank(right.session);
  });
  const selectedId = sessionId || sessions[0]?.id || "";
  const current = sessions.find((item) => item.id === selectedId) ?? null;
  const applications = current ? archivedApplications(current) : [];
  const visible = applications.filter((row) =>
    textMatches(query, [row.applicationNo, row.applicantName, row.email, row.status]),
  );

  return (
    <DeskPage kicker={admissionArchiveCopy.kicker} title={admissionArchiveCopy.title}>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{admissionArchiveCopy.empty}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {sessions.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={item.id === selectedId ? "default" : "outline"}
                onClick={() => setSessionId(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {current ? (
            <p className="text-sm text-muted-foreground">
              {admissionArchiveCopy.archivedOn} {archivedOn(current.archivedAt)} ·{" "}
              {admissionArchiveCopy.count} {applications.length}
            </p>
          ) : null}
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[]}
            shown={visible.length}
            total={applications.length}
            filename="admission-archive.csv"
            downloadLabel="Download archive"
            headers={[
              "session",
              "year",
              "application_no",
              "applicant_name",
              "email",
              "status",
            ]}
            rows={visible.map((row) => [
              current?.session ?? "",
              current?.year ?? "",
              row.applicationNo,
              row.applicantName,
              row.email,
              row.status,
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-3 font-semibold">Application No.</th>
                  <th className="px-3 py-3 font-semibold">Applicant</th>
                  <th className="px-3 py-3 font-semibold">Email</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">
                    <span className="sr-only">{admissionArchiveCopy.view}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                      {admissionArchiveCopy.emptySession}
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.applicationNo}</td>
                      <td className="px-3 py-2 font-medium text-primary">
                        {row.applicantName}
                      </td>
                      <td className="px-3 py-2">{row.email || "—"}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setViewing(row)}
                        >
                          {admissionArchiveCopy.view}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {viewing ? (
        <ApplicationViewer application={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </DeskPage>
  );
}
