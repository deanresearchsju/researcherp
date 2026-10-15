"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskPage,
  GateBanner,
  ScholarIdentityHeader,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { dcCopy } from "@/data/doctoral";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import {
  confirmationReady,
  currentDoctoral,
  decideCommittee,
  latestCommittee,
  latestSynopsis,
  saveCommittee,
  subscribeDoctoral,
  type CommitteeKind,
} from "@/lib/doctoral";
import { usePortalSession } from "@/lib/use-preview-session";

const remarksSchema = z.string().trim().min(2, "Enter the remarks.");

export function CommitteeScreen({
  kind,
  mode,
}: {
  kind: CommitteeKind;
  mode: "admin" | "scholar";
}) {
  const ready = useClientReady();
  const copy = dcCopy[kind];
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [agenda, setAgenda] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  if (!ready || !doctoral)
    return <p className="text-sm text-muted-foreground">Loading the committee report…</p>;

  const identifier = session?.identifier ?? "";
  const mine = latestCommittee(doctoral, kind, identifier);
  const second = latestCommittee(doctoral, "second", identifier);
  const synopsis = latestSynopsis(doctoral, identifier);
  const gate =
    kind === "first"
      ? null
      : kind === "second"
        ? confirmationReady(doctoral, identifier)
          ? null
          : "Semester 1 and semester 2 results have to be published first. That is four papers."
        : kind === "third"
          ? second?.status === "Approved"
            ? null
            : "The second doctoral committee has to be approved first."
          : synopsis?.status === "Approved"
            ? null
            : "The synopsis has to be approved first.";

  async function upload() {
    if (!session) return;
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the report.");
      return;
    }
    const data = await fileToDataUrl(file.file).catch(() => "");
    const saved = await saveCommittee({
      kind,
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      fileName: file.file.name,
      fileData: data || null,
    });
    setNotice(saved.ok ? "Report submitted." : saved.message);
    if (saved.ok) setFile(null);
  }

  async function decide(id: string, status: "Approved" | "Rejected") {
    const note = remarks[id] ?? "";
    const minute = (minutes[id] ?? "").trim();
    if (status === "Rejected") {
      const parsed = remarksSchema.safeParse(note);
      if (!parsed.success) {
        setNotice(parsed.error.issues[0]?.message ?? "Enter the remarks.");
        return;
      }
    }
    if (status === "Approved" && minute.length < 2) {
      setNotice("Enter the minutes before approving.");
      return;
    }
    const saved = await decideCommittee(id, {
      status,
      remarks: note,
      agenda: (agenda[id] ?? "").trim(),
      attendance: (attendance[id] ?? "").trim(),
      minutes: minute,
      decidedOn: new Date().toISOString().slice(0, 10),
    });
    setNotice(saved.ok ? status : saved.message);
  }

  const queue = doctoral.committees.filter((item) => {
    if (item.kind !== kind) return false;
    if (mode !== "admin") return item.scholarIdentifier === identifier;
    return (
      (statusFilter === "" || item.status === statusFilter) &&
      textMatches(query, [item.scholarName, item.fileName, item.status, item.remarks])
    );
  });

  return (
    <DeskPage title={copy.title}>
      {mode === "scholar" ? <ScholarIdentityHeader identifier={identifier} /> : null}
      {mode === "scholar" ? (
        gate ? (
          <GateBanner tone="danger">{gate}</GateBanner>
        ) : mine && mine.status !== "Rejected" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <p>
              {mine.fileName} · {mine.status}
              {mine.remarks ? ` · ${mine.remarks}` : ""}
            </p>
            <ViewFilesButton
              fileName={mine.fileName}
              data={mine.fileData}
              onMissing={setNotice}
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {mine?.status === "Rejected" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-secondary">
                  Returned: {mine.remarks}. Upload the corrected report.
                </p>
                <ViewFilesButton
                  fileName={mine.fileName}
                  data={mine.fileData}
                  onMissing={setNotice}
                />
              </div>
            ) : null}
            <FormField label="Committee report" htmlFor={`${kind}-report`} required>
              <FileUpload
                id={`${kind}-report`}
                acceptRule="document"
                value={file}
                onChange={setFile}
              />
            </FormField>
            <Button type="button" variant="gold" onClick={() => void upload()}>
              Upload report
            </Button>
          </div>
        )
      ) : null}
      {mode === "admin" ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          filters={[
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              options: ["Submitted", "Approved", "Rejected"].map((item) => ({
                value: item,
                label: item,
              })),
              onChange: setStatusFilter,
            },
          ]}
          shown={queue.length}
          total={doctoral.committees.filter((item) => item.kind === kind).length}
          filename={`${kind}-committee.csv`}
          headers={["scholar", "file", "status", "remarks", "decided"]}
          rows={queue.map((report) => [
            report.scholarName,
            report.fileName,
            report.status,
            report.remarks,
            report.decidedOn,
          ])}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      <ul className="space-y-3">
        {queue.map((report) => (
          <li
            key={report.id}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-primary">
                {report.scholarName} · {report.fileName}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ViewFilesButton
                  fileName={report.fileName}
                  data={report.fileData}
                  onMissing={setNotice}
                />
                <Badge
                  variant={
                    report.status === "Approved"
                      ? "gold"
                      : report.status === "Rejected"
                        ? "maroon"
                        : "purple"
                  }
                >
                  {report.status}
                </Badge>
              </div>
            </div>
            {report.remarks ? (
              <p className="text-sm text-muted-foreground">{report.remarks}</p>
            ) : null}
            {report.minutes ? (
              <p className="text-sm text-muted-foreground">{report.minutes}</p>
            ) : null}
            {mode === "admin" && report.status === "Submitted" ? (
              <div className="space-y-2">
                <Textarea
                  aria-label="Agenda"
                  placeholder="Agenda"
                  value={agenda[report.id] ?? ""}
                  onChange={(event) =>
                    setAgenda((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
                <Textarea
                  aria-label="Attendance"
                  placeholder="Attendance"
                  value={attendance[report.id] ?? ""}
                  onChange={(event) =>
                    setAttendance((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
                <Textarea
                  aria-label="Minutes"
                  placeholder="Minutes"
                  value={minutes[report.id] ?? ""}
                  onChange={(event) =>
                    setMinutes((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
                <Textarea
                  aria-label="Remarks"
                  placeholder="Remarks"
                  value={remarks[report.id] ?? ""}
                  onChange={(event) =>
                    setRemarks((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={() => void decide(report.id, "Approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="maroon"
                    onClick={() => void decide(report.id, "Rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </DeskPage>
  );
}
