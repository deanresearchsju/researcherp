"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskPage,
  FormDialog,
  GateBanner,
  ScholarIdentityHeader,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { thesisChecklist } from "@/data/doctoral";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  currentDoctoral,
  decideThesis,
  latestSynopsis,
  plagiarismIssued,
  saveThesis,
  subscribeDoctoral,
  thesisBlocked,
  thesisOpensOn,
  type ThesisSubmission,
} from "@/lib/doctoral";
import { fileError, type StoredFile } from "@/lib/files";
import { loadEvaluations } from "@/lib/thesis-evaluation";
import {
  panelComplete,
  scholarKeyOf,
  type EvaluationRecord,
} from "@/lib/thesis-evaluation-model";
import { usePortalSession } from "@/lib/use-preview-session";
import { researchTitleOf } from "@/lib/research-title";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import Link from "next/link";
import { useFees } from "@/lib/fee-settings";
import { submissionFeeBlock } from "@/lib/submission-fees";
import { storeFile } from "@/lib/file-store";
import { ApprovalBadge, ApprovalTrail } from "@/components/portal/ApprovalTrail";
import { submissionSummary } from "@/lib/approval-flow";

const schema = z.object({
  title: z.string().trim().min(2, "Enter the title."),
  domain: z.string().trim().min(2, "Enter the domain."),
});

type Values = z.infer<typeof schema>;

function ScholarThesis({ identifier, name }: { identifier: string; name: string }) {
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
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
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { title: "", domain: "" },
  });
  if (!doctoral) return <p className="text-sm text-muted-foreground">Loading thesis…</p>;

  const synopsis = latestSynopsis(doctoral, identifier);
  const opens = synopsis?.status === "Approved" ? thesisOpensOn(synopsis) : "";
  const own =
    doctoral.theses
      .filter((item) => item.scholarIdentifier === identifier)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const feeBlocked = submissionFeeBlock("thesis", identifier, payments?.records ?? []);
  const blocked = thesisBlocked(doctoral, identifier) ?? feeBlocked;
  const lockedTitle = researchTitleOf(
    doctoral,
    identifier,
    titleChanges?.records ?? [],
  ).title;

  async function upload(values: Values) {
    const certificate = plagiarismIssued(doctoral!, identifier, "thesis");
    if (!certificate) {
      setNotice("The research office has to issue the plagiarism certificate first.");
      return;
    }
    if (feeBlocked) {
      setNotice(feeBlocked);
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the thesis.");
      return;
    }
    const data = await storeFile(file.file, "thesis").catch(() => "");
    const saved = await saveThesis({
      scholarIdentifier: identifier,
      scholarName: name,
      title: lockedTitle || values.title,
      domain: values.domain,
      checks: certificate.checks.length ? certificate.checks : [...thesisChecklist],
      fileName: file.file.name,
      fileData: data || null,
      local: [],
      indian: [],
      foreign: [],
    });
    setNotice(saved.ok ? "Thesis submitted to the research office." : saved.message);
    if (saved.ok) {
      setSubmitting(false);
      setFile(null);
    }
  }

  return (
    <div className="space-y-4">
      <ScholarIdentityHeader identifier={identifier} />
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {own && own.status !== "Rejected" ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-card">
          <div>
            <p className="font-semibold text-primary">{own.title}</p>
            <p className="text-muted-foreground">{own.domain}</p>
            <div className="mt-2">
              <ApprovalBadge summary={submissionSummary(own)} showDetail />
            </div>
            <div className="mt-3">
              <ApprovalTrail summary={submissionSummary(own)} />
            </div>
          </div>
          <ViewFilesButton
            fileName={own.fileName}
            data={own.fileData}
            onMissing={setNotice}
          />
        </div>
      ) : blocked ? (
        <GateBanner tone={feeBlocked && blocked === feeBlocked ? undefined : "danger"}>
          {blocked}
          {feeBlocked && blocked === feeBlocked ? (
            <>
              {" "}
              <Link
                href="/scholar/records/payment-history"
                className="font-semibold underline"
              >
                Go to Payment history
              </Link>
            </>
          ) : null}
        </GateBanner>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm text-muted-foreground">
            {own?.status === "Rejected"
              ? `Rejected: ${own.remarks}. Submit the corrected thesis.`
              : `Open since ${opens ? formatIsoDate(opens) : formatIsoDate(clientToday())}.`}
          </p>
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              setNotice(null);
              if (lockedTitle) form.setValue("title", lockedTitle);
              setSubmitting(true);
            }}
          >
            Submit thesis
          </Button>
        </div>
      )}
      {submitting ? (
        <FormDialog
          title="Submit thesis"
          onClose={() => setSubmitting(false)}
          onSubmit={form.handleSubmit(upload)}
          submitLabel="Submit thesis"
        >
          {notice ? (
            <p role="alert" className="text-sm text-secondary">
              {notice}
            </p>
          ) : null}
          <FormField
            label="Title"
            htmlFor="thesis-title"
            required
            error={form.formState.errors.title?.message}
          >
            <Input
              id="thesis-title"
              readOnly={Boolean(lockedTitle)}
              className={lockedTitle ? "bg-muted" : undefined}
              {...form.register("title")}
            />
            {lockedTitle ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Locked research title from the second doctoral committee.
              </p>
            ) : null}
          </FormField>
          <FormField
            label="Domain"
            htmlFor="thesis-domain"
            required
            error={form.formState.errors.domain?.message}
          >
            <Input id="thesis-domain" {...form.register("domain")} />
          </FormField>
          <FormField label="Thesis" htmlFor="thesis-file" required>
            <FileUpload
              id="thesis-file"
              acceptRule="document"
              value={file}
              onChange={setFile}
            />
          </FormField>
        </FormDialog>
      ) : null}
    </div>
  );
}

function OfficeThesis() {
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [panels, setPanels] = useState<EvaluationRecord[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [returning, setReturning] = useState<ThesisSubmission | null>(null);
  const [remarks, setRemarks] = useState("");
  const canDecide = session?.role === "dean" || session?.role === "admin";

  useEffect(() => {
    if (!canDecide) return;
    let live = true;
    void loadEvaluations().then((load) => {
      if (live) setPanels(load.ok && load.role === "office" ? load.records : []);
    });
    return () => {
      live = false;
    };
  }, [canDecide]);

  if (!doctoral) return <p className="text-sm text-muted-foreground">Loading thesis…</p>;

  const queue = doctoral.theses.filter(
    (thesis) =>
      filterMatches(statusFilter, thesis.status) &&
      textMatches(query, [
        thesis.scholarName,
        thesis.title,
        thesis.domain,
        thesis.status,
      ]),
  );

  function readiness(thesis: ThesisSubmission) {
    if (!plagiarismIssued(doctoral!, thesis.scholarIdentifier, "thesis")) {
      return "Thesis plagiarism certificate not issued.";
    }
    if (!canDecide) return "Only the Dean or the administrator accepts the thesis.";
    if (thesis.needsSupervisor && thesis.supervisorStatus !== "Recommended") {
      return "Waiting for the supervisor's approval.";
    }
    const panel = panels?.find(
      (item) => item.scholarKey === scholarKeyOf(thesis.scholarIdentifier),
    );
    if (!panel || !panelComplete(panel)) {
      return "One Indian, one foreign and one local evaluator have to accept first.";
    }
    return null;
  }

  async function accept(thesis: ThesisSubmission) {
    const saved = await decideThesis(thesis.id, {
      status: "Approved",
      remarks: "",
      decidedOn: clientToday(),
    });
    setNotice(
      saved.ok ? `${thesis.scholarName}'s thesis is sent for evaluation.` : saved.message,
    );
  }

  async function sendBack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!returning) return;
    if (remarks.trim().length < 2) {
      setNotice("Enter the remarks before returning the thesis.");
      return;
    }
    const saved = await decideThesis(returning.id, {
      status: "Rejected",
      remarks: remarks.trim(),
      decidedOn: clientToday(),
    });
    setNotice(saved.ok ? "Thesis returned with remarks." : saved.message);
    if (saved.ok) {
      setReturning(null);
      setRemarks("");
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
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
        total={doctoral.theses.length}
        filename="theses.csv"
        headers={["scholar", "title", "domain", "status"]}
        rows={queue.map((thesis) => [
          thesis.scholarName,
          thesis.title,
          thesis.domain,
          thesis.status,
        ])}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-4 py-3 font-semibold">Scholar</th>
              <th className="px-4 py-3 font-semibold">Title · Domain</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No thesis submitted yet.
                </td>
              </tr>
            ) : (
              queue.map((thesis) => {
                const waiting = thesis.status === "Submitted" ? readiness(thesis) : null;
                return (
                  <tr key={thesis.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-semibold text-primary">
                      {thesis.scholarName}
                    </td>
                    <td className="px-4 py-3">
                      <p>{thesis.title}</p>
                      <p className="text-muted-foreground">{thesis.domain}</p>
                      {thesis.remarks ? (
                        <p className="text-muted-foreground">{thesis.remarks}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <ApprovalBadge summary={submissionSummary(thesis)} />
                      {waiting ? (
                        <p className="mt-1 text-xs text-muted-foreground">{waiting}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ViewFilesButton
                          fileName={thesis.fileName}
                          data={thesis.fileData}
                          onMissing={setNotice}
                        />
                        {thesis.status === "Submitted" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="gold"
                              disabled={Boolean(waiting)}
                              onClick={() => void accept(thesis)}
                            >
                              Send for evaluation
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNotice(null);
                                setRemarks("");
                                setReturning(thesis);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {returning ? (
        <FormDialog
          title={`Reject thesis · ${returning.scholarName}`}
          onClose={() => setReturning(null)}
          onSubmit={(event) => void sendBack(event)}
          submitLabel="Reject thesis"
          size="sm"
        >
          {notice ? (
            <p role="alert" className="text-sm text-secondary">
              {notice}
            </p>
          ) : null}
          <FormField label="Remarks" htmlFor="thesis-remarks" required>
            <Textarea
              id="thesis-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </FormField>
        </FormDialog>
      ) : null}
    </div>
  );
}

export function ThesisScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  if (!ready) return <p className="text-sm text-muted-foreground">Loading thesis…</p>;
  return (
    <DeskPage kicker="Doctoral progress" title="Thesis">
      {mode === "scholar" ? (
        <ScholarThesis
          identifier={session?.identifier ?? ""}
          name={session?.name ?? ""}
        />
      ) : (
        <OfficeThesis />
      )}
    </DeskPage>
  );
}
