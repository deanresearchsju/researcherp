"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import {
  hardcopyNotice,
  schoolNeedsIndexedPair,
  synopsisChecklist,
} from "@/data/doctoral";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import {
  currentDoctoral,
  decideSynopsis,
  enrollmentFor,
  latestCommittee,
  latestSynopsis,
  publicationEligibility,
  reportTarget,
  saveSynopsis,
  subscribeDoctoral,
} from "@/lib/doctoral";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";

const remarksSchema = z.string().trim().min(2, "Enter the remarks.");

export function SynopsisScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const reports = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("six_month_report", onChange),
    () => currentScholarRecords("six_month_report"),
    () => null,
  );
  const papers = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("publication", onChange),
    () => currentScholarRecords("publication"),
    () => null,
  );
  const [checks, setChecks] = useState<string[]>([]);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [popup, setPopup] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  if (!ready || !doctoral || !reports || !papers) {
    return <p className="text-sm text-muted-foreground">Loading synopsis…</p>;
  }

  function eligibility(identifier: string) {
    const enrollment = enrollmentFor(doctoral!, identifier);
    const approvedReports = reports!.records.filter(
      (record) => record.scholarIdentifier === identifier && record.status === "Approved",
    ).length;
    const needed = enrollment ? reportTarget(enrollment.studyMode) : 6;
    const publication = publicationEligibility(
      enrollment?.school ?? "",
      papers!.records
        .filter((record) => record.scholarIdentifier === identifier)
        .map((record) => ({
          indexing: record.payload.indexing ?? "",
          status: record.status,
        })),
    );
    const third = latestCommittee(doctoral!, "third", identifier);
    const missing = [
      third?.status === "Approved" ? null : "Third doctoral committee approval",
      approvedReports >= needed
        ? null
        : `${needed} approved six-month reports (${approvedReports} approved)`,
      publication.met ? null : publication.detail,
    ].filter((item): item is string => Boolean(item));
    return { enrollment, missing, publication, needed, approvedReports };
  }

  async function upload() {
    if (!session) return;
    const review = eligibility(session.identifier);
    if (review.missing.length || checks.length !== synopsisChecklist.length) {
      setNotice(
        review.missing.length
          ? `Still needed: ${review.missing.join("; ")}.`
          : "Complete the checklist.",
      );
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the synopsis.");
      return;
    }
    const data = await fileToDataUrl(file.file).catch(() => "");
    const saved = await saveSynopsis({
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      checks,
      fileName: file.file.name,
      fileData: data || null,
    });
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setFile(null);
    setPopup(true);
  }

  async function decide(id: string, status: "Approved" | "Rejected") {
    const note = remarks[id] ?? "";
    if (status === "Rejected") {
      const parsed = remarksSchema.safeParse(note);
      if (!parsed.success) {
        setNotice(parsed.error.issues[0]?.message ?? "Enter the remarks.");
        return;
      }
    }
    const saved = await decideSynopsis(id, {
      status,
      remarks: note,
      decidedOn: new Date().toISOString().slice(0, 10),
    });
    setNotice(saved.ok ? status : saved.message);
  }

  const identifier = session?.identifier ?? "";
  const own = latestSynopsis(doctoral, identifier);
  const review = session ? eligibility(identifier) : null;
  const queue = doctoral.synopses.filter((item) => {
    if (mode !== "admin") return item.scholarIdentifier === identifier;
    return (
      (statusFilter === "" || item.status === statusFilter) &&
      textMatches(query, [item.scholarName, item.fileName, item.status, item.remarks])
    );
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Synopsis</h1>
      </header>
      {mode === "scholar" && review ? (
        own && own.status !== "Rejected" ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {own.fileName} · {own.status}
            {own.remarks ? ` · ${own.remarks}` : ""}
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {own?.status === "Rejected" ? (
              <p className="text-sm text-secondary">
                Returned: {own.remarks}. Upload the corrected synopsis.
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {review.enrollment
                ? `${review.enrollment.studyMode} · ${review.enrollment.school} · ${review.approvedReports} of ${review.needed} reports`
                : "A course-work batch is required before the synopsis."}
              {review.enrollment
                ? schoolNeedsIndexedPair(review.enrollment.school)
                  ? " · indexed pair"
                  : " · two Scopus papers"
                : ""}
            </p>
            {review.missing.map((item) => (
              <p key={item} className="text-sm text-secondary">
                {item}
              </p>
            ))}
            {synopsisChecklist.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checks.includes(item)}
                  onChange={(event) =>
                    setChecks((current) =>
                      event.target.checked
                        ? [...current, item]
                        : current.filter((entry) => entry !== item),
                    )
                  }
                />
                {item}
              </label>
            ))}
            <FormField label="Synopsis" htmlFor="synopsis-file" required>
              <FileUpload
                id="synopsis-file"
                acceptRule="document"
                value={file}
                onChange={setFile}
              />
            </FormField>
            <Button type="button" variant="gold" onClick={() => void upload()}>
              Upload synopsis
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
          total={doctoral.synopses.length}
          filename="synopsis.csv"
          headers={["scholar", "file", "status", "remarks"]}
          rows={queue.map((item) => [item.scholarName, item.fileName, item.status, item.remarks])}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      <ul className="space-y-3">
        {queue.map((item) => (
          <li
            key={item.id}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-primary">
                {item.scholarName} · {item.fileName}
              </p>
              <Badge
                variant={
                  item.status === "Approved"
                    ? "gold"
                    : item.status === "Rejected"
                      ? "maroon"
                      : "purple"
                }
              >
                {item.status}
              </Badge>
            </div>
            {mode === "admin" && item.status === "Submitted" ? (
              <div className="space-y-2">
                <Textarea
                  aria-label="Remarks"
                  value={remarks[item.id] ?? ""}
                  onChange={(event) =>
                    setRemarks((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={() => void decide(item.id, "Approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="maroon"
                    onClick={() => void decide(item.id, "Rejected")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {popup ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hardcopy-title"
        >
          <div className="max-w-md rounded-2xl bg-card p-6 shadow-card">
            <h2 id="hardcopy-title" className="font-serif text-2xl text-primary">
              Hard copy
            </h2>
            <p className="mt-3 text-sm leading-6">{hardcopyNotice}</p>
            <Button
              type="button"
              className="mt-4"
              variant="gold"
              onClick={() => setPopup(false)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
