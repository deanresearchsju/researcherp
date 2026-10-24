"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskPage,
  DeskSection,
  DeskTable,
  DeskTabs,
  FormDialog,
  GateBanner,
  ProcessFlow,
  ScholarIdentityHeader,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import {
  hardcopyNotice,
  schoolNeedsIndexedPair,
  synopsisChecklist,
} from "@/data/doctoral";
import { processFlows } from "@/data/portal-desk";
import { fileError, type StoredFile } from "@/lib/files";
import {
  currentDoctoral,
  decideSynopsis,
  enrollmentFor,
  latestCommittee,
  latestSynopsis,
  plagiarismIssued,
  publicationEligibility,
  reportTarget,
  saveSynopsis,
  subscribeDoctoral,
} from "@/lib/doctoral";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";
import { researchTitleOf } from "@/lib/research-title";
import Link from "next/link";
import { useFees } from "@/lib/fee-settings";
import { submissionFeeBlock } from "@/lib/submission-fees";
import { storeFile } from "@/lib/file-store";
import { ApprovalBadge, ApprovalTrail } from "@/components/portal/ApprovalTrail";
import { submissionSummary } from "@/lib/approval-flow";

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
  const titleChanges = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("title_change", onChange),
    () => currentScholarRecords("title_change"),
    () => null,
  );
  useFees();
  const payments = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const [file, setFile] = useState<StoredFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [popup, setPopup] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState("new");

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
    const title = researchTitleOf(doctoral!, identifier, titleChanges?.records ?? []);
    const missing = [
      title.title && (title.stage === "Final" || title.stage === "Locked")
        ? null
        : "Research title finalised in the second doctoral committee",
      third?.status === "Approved" ? null : "Third doctoral committee approval",
      approvedReports >= needed
        ? null
        : `${needed} approved six-month reports (${approvedReports} approved)`,
      publication.met ? null : publication.detail,
    ].filter((item): item is string => Boolean(item));
    return { enrollment, missing, publication, needed, approvedReports, title };
  }

  async function upload() {
    if (!session) return;
    const review = eligibility(session.identifier);
    const certificate = plagiarismIssued(doctoral!, session.identifier, "synopsis");
    if (review.missing.length || !certificate) {
      setNotice(
        review.missing.length
          ? `Still needed: ${review.missing.join("; ")}.`
          : "The research office has to issue the plagiarism certificate first.",
      );
      return;
    }
    const feeBlocked = submissionFeeBlock(
      "synopsis",
      session.identifier,
      payments?.records ?? [],
    );
    if (feeBlocked) {
      setNotice(feeBlocked);
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the synopsis.");
      return;
    }
    const data = await storeFile(file.file, "thesis").catch(() => "");
    const saved = await saveSynopsis({
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      checks: certificate.checks.length ? certificate.checks : [...synopsisChecklist],
      fileName: file.file.name,
      fileData: data || null,
    });
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setFile(null);
    setUploading(false);
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
      filterMatches(statusFilter, item.status) &&
      textMatches(query, [item.scholarName, item.fileName, item.status, item.remarks])
    );
  });


  return (
    <DeskPage title="Synopsis">
      <ProcessFlow>{processFlows.synopsis}</ProcessFlow>
      {mode === "scholar" ? <ScholarIdentityHeader identifier={identifier} /> : null}
      {mode === "scholar" ? (
        <DeskTabs
          tabs={[
            { id: "details", label: "Synopsis details" },
            { id: "new", label: "New request" },
            { id: "history", label: "Request history" },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      {mode === "scholar" && tab === "details" ? (
        <>
          <DeskSection title="Synopsis details">
            <DeskTable headers={["File", "Status", "Remarks", ""]} empty={!own}>
              {own ? (
                <tr className="border-t border-border">
                  <td className="px-4 py-3">{own.fileName}</td>
                  <td className="px-4 py-3">{own.status}</td>
                  <td className="px-4 py-3">{own.remarks || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <ViewFilesButton
                      fileName={own.fileName}
                      data={own.fileData}
                      onMissing={setNotice}
                    />
                  </td>
                </tr>
              ) : null}
            </DeskTable>
          </DeskSection>
        </>
      ) : null}
      {mode === "scholar" && review && tab === "new" ? (
        own && own.status !== "Rejected" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GateBanner>
              {own.fileName} · {own.status}
              {own.remarks ? ` · ${own.remarks}` : ""}
            </GateBanner>
            <ViewFilesButton
              fileName={own.fileName}
              data={own.fileData}
              onMissing={setNotice}
            />
          </div>
        ) : review.missing.length ? (
          <GateBanner tone="danger">
            Still needed: {review.missing.join("; ")}.
          </GateBanner>
        ) : !plagiarismIssued(doctoral, session?.identifier ?? "", "synopsis") ? (
          <GateBanner>
            The research office will verify the checklist and issue the plagiarism
            certificate. The synopsis upload opens after that.
          </GateBanner>
        ) : submissionFeeBlock(
            "synopsis",
            session?.identifier ?? "",
            payments?.records ?? [],
          ) ? (
          <GateBanner>
            {submissionFeeBlock(
              "synopsis",
              session?.identifier ?? "",
              payments?.records ?? [],
            )}{" "}
            <Link
              href="/scholar/records/payment-history"
              className="font-semibold underline"
            >
              Go to Payment history
            </Link>
          </GateBanner>
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {own?.status === "Rejected" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-secondary">
                  Rejected: {own.remarks}. Upload the corrected synopsis.
                </p>
                <ViewFilesButton
                  fileName={own.fileName}
                  data={own.fileData}
                  onMissing={setNotice}
                />
              </div>
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
            <p className="text-sm font-semibold text-primary">
              Checklist verified and plagiarism certificate issued by the research office.
            </p>
            <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2 text-sm">
              <p className="text-[0.65rem] font-bold tracking-[0.14em] text-secondary uppercase">
                Research title · locked once you submit
              </p>
              <p className="mt-0.5 font-semibold text-primary">{review.title.title}</p>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="gold"
                onClick={() => {
                  setNotice(null);
                  setUploading(true);
                }}
              >
                Upload synopsis
              </Button>
            </div>
            {uploading ? (
              <FormDialog
                title="Upload synopsis"
                onClose={() => setUploading(false)}
                onSubmit={(event) => {
                  event.preventDefault();
                  void upload();
                }}
                submitLabel="Upload synopsis"
              >
                {notice ? (
                  <p role="alert" className="text-sm text-secondary">
                    {notice}
                  </p>
                ) : null}
                <FormField label="Synopsis" htmlFor="synopsis-file" required>
                  <FileUpload
                    id="synopsis-file"
                    acceptRule="document"
                    value={file}
                    onChange={setFile}
                  />
                </FormField>
              </FormDialog>
            ) : null}
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
          rows={queue.map((item) => [
            item.scholarName,
            item.fileName,
            item.status,
            item.remarks,
          ])}
        />
      ) : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" && tab !== "history" ? null : (
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
                <div className="flex flex-wrap items-center gap-2">
                  <ViewFilesButton
                    fileName={item.fileName}
                    data={item.fileData}
                    onMissing={setNotice}
                  />
                  <ApprovalBadge summary={submissionSummary(item)} />
                </div>
              </div>
              <ApprovalTrail summary={submissionSummary(item)} />
              {mode === "admin" &&
              item.status === "Submitted" &&
              item.needsSupervisor &&
              item.supervisorStatus !== "Recommended" ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for the supervisor&apos;s approval.
                </p>
              ) : null}
              {mode === "admin" &&
              item.status === "Submitted" &&
              (!item.needsSupervisor || item.supervisorStatus === "Recommended") ? (
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
      )}
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
    </DeskPage>
  );
}
