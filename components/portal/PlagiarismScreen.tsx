"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskTabs,
  FormDialog,
  GateBanner,
  ManageCard,
  PageTitle,
  ScholarIdentityHeader,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { synopsisChecklist, thesisChecklist } from "@/data/doctoral";
import { formatIsoDate } from "@/lib/dates";
import {
  currentDoctoral,
  issuePlagiarism,
  latestSynopsis,
  plagiarismBlocked,
  plagiarismIssued,
  subscribeDoctoral,
  type DoctoralState,
  type PlagiarismStage,
} from "@/lib/doctoral";
import { fileError, type StoredFile } from "@/lib/files";
import { sameId } from "@/lib/office";
import { usePortalSession } from "@/lib/use-preview-session";
import { storeFile } from "@/lib/file-store";
import { inputRules } from "@/lib/input-rules";

const stageLabel: Record<PlagiarismStage, string> = {
  synopsis: "Before synopsis",
  thesis: "Before thesis",
};

function checklistFor(stage: PlagiarismStage): readonly string[] {
  return stage === "synopsis" ? synopsisChecklist : thesisChecklist;
}

/** Scholars who reached the step before this stage, plus anyone already issued. */
function candidates(doctoral: DoctoralState, stage: PlagiarismStage) {
  const people = new Map<string, { identifier: string; name: string }>();
  const add = (identifier: string, name: string) => {
    const key = identifier.trim().toLowerCase();
    if (key && !people.has(key)) people.set(key, { identifier, name });
  };
  if (stage === "synopsis") {
    doctoral.committees
      .filter((item) => item.kind === "third" && item.status === "Approved")
      .forEach((item) => add(item.scholarIdentifier, item.scholarName));
  } else {
    doctoral.synopses
      .filter((item) => item.status === "Approved")
      .forEach((item) => add(item.scholarIdentifier, item.scholarName));
  }
  doctoral.plagiarism
    .filter((item) => item.stage === stage)
    .forEach((item) => add(item.scholarIdentifier, item.scholarName));
  return [...people.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function IssueDialog({
  stage,
  scholar,
  onClose,
  onIssued,
}: {
  stage: PlagiarismStage;
  scholar: { identifier: string; name: string };
  onClose: () => void;
  onIssued: (message: string) => void;
}) {
  const checklist = checklistFor(stage);
  const [checks, setChecks] = useState<string[]>([]);
  const [similarity, setSimilarity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<StoredFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const complete = checklist.every((item) => checks.includes(item));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete) {
      setError("Tick every checklist item before issuing the certificate.");
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setError(problem ?? "Attach the plagiarism report.");
      return;
    }
    setBusy(true);
    const data = await storeFile(file.file, "thesis").catch(() => "");
    const saved = await issuePlagiarism({
      stage,
      scholarIdentifier: scholar.identifier,
      scholarName: scholar.name,
      checks,
      similarity,
      fileName: file.file.name,
      fileData: data || null,
      remarks,
    });
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onIssued(`Plagiarism certificate issued to ${scholar.name}.`);
  }

  return (
    <FormDialog
      title={`${stageLabel[stage]} · ${scholar.name}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Issue certificate"
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-primary">
          Checklist ({checks.length}/{checklist.length})
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
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
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Similarity %" htmlFor="plag-similarity" required>
          <Input
            id="plag-similarity"
            inputMode="decimal"
            value={similarity}
            disabled={!complete}
            onChange={(event) => setSimilarity(inputRules.score.mask(event.target.value))}
          />
        </FormField>
        <FormField label="Plagiarism report" htmlFor="plag-file" required>
          <FileUpload
            id="plag-file"
            acceptRule="document"
            value={file}
            onChange={setFile}
          />
        </FormField>
        <FormField label="Remarks" htmlFor="plag-remarks" className="sm:col-span-2">
          <Textarea
            id="plag-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </FormField>
      </div>
    </FormDialog>
  );
}

function ScholarView({
  doctoral,
  identifier,
}: {
  doctoral: DoctoralState;
  identifier: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <ScholarIdentityHeader identifier={identifier} />
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {(["synopsis", "thesis"] as const).map((stage) => {
          const issued = plagiarismIssued(doctoral, identifier, stage);
          const blocked = issued ? null : plagiarismBlocked(doctoral, identifier, stage);
          return (
            <ManageCard
              key={stage}
              eyebrow="Plagiarism certificate"
              title={stageLabel[stage]}
              status={
                issued
                  ? { label: "Issued", tone: "open" }
                  : blocked
                    ? { label: "Not yet", tone: "neutral" }
                    : { label: "With the office", tone: "pending" }
              }
              facts={
                issued
                  ? [
                      { label: "Similarity", value: `${issued.similarity}%` },
                      { label: "Issued on", value: formatIsoDate(issued.decidedOn) },
                    ]
                  : [
                      {
                        label: "Status",
                        value:
                          blocked ?? "The research office is checking the checklist.",
                      },
                    ]
              }
              extra={
                issued ? (
                  <div className="mt-4">
                    <ViewFilesButton
                      fileName={issued.fileName}
                      data={issued.fileData}
                      onMissing={setNotice}
                    />
                  </div>
                ) : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export function PlagiarismScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [stage, setStage] = useState<PlagiarismStage>("synopsis");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<{ identifier: string; name: string } | null>(
    null,
  );

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading plagiarism…</p>;
  }

  if (mode === "scholar") {
    return (
      <section className="space-y-6">
        <PageTitle kicker="Doctoral progress" title="Plagiarism" />
        <ScholarView doctoral={doctoral} identifier={session?.identifier ?? ""} />
      </section>
    );
  }

  const canIssue = session?.role === "admin" || session?.role === "dean";
  const rows = candidates(doctoral, stage)
    .filter((row) => textMatches(query, [row.name, row.identifier]))
    .map((row) => {
      const issued = plagiarismIssued(doctoral, row.identifier, stage);
      const blocked = issued ? null : plagiarismBlocked(doctoral, row.identifier, stage);
      const next =
        stage === "synopsis"
          ? latestSynopsis(doctoral, row.identifier)
          : doctoral.theses.find((item) =>
              sameId(item.scholarIdentifier, row.identifier),
            );
      return { ...row, issued, blocked, next };
    });

  return (
    <section className="space-y-6">
      <PageTitle kicker="Doctoral progress" title="Plagiarism" />
      {doctoral.detail ? (
        <p className="text-sm text-secondary">{doctoral.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {!canIssue ? (
        <GateBanner>
          Only the Dean or the administrator issues the certificate.
        </GateBanner>
      ) : null}
      <DeskTabs
        tabs={[
          { id: "synopsis", label: "Before synopsis" },
          { id: "thesis", label: "Before thesis" },
        ]}
        value={stage}
        onChange={(id) => setStage(id as PlagiarismStage)}
      />
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={rows.length}
        total={candidates(doctoral, stage).length}
        filename={`plagiarism-${stage}.csv`}
        headers={["scholar", "status", "similarity", "issued on", "issued by"]}
        rows={rows.map((row) => [
          row.name,
          row.issued ? "Issued" : (row.blocked ?? "Ready for checking"),
          row.issued?.similarity ?? "",
          row.issued?.decidedOn ?? "",
          row.issued?.issuedBy ?? "",
        ])}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-4 py-3 font-semibold">Scholar</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Certificate</th>
              <th className="px-4 py-3 font-semibold">
                {stage === "synopsis" ? "Synopsis" : "Thesis"}
              </th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {stage === "synopsis"
                    ? "No scholar has an approved third doctoral committee yet."
                    : "No scholar has an approved synopsis yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.identifier} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium text-primary">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.issued ? (
                      <span className="font-semibold text-primary">Issued</span>
                    ) : row.blocked ? (
                      <span className="text-muted-foreground">{row.blocked}</span>
                    ) : (
                      <span className="font-semibold text-secondary">
                        Ready for checking
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.issued ? (
                      <div className="space-y-1">
                        <p>
                          {row.issued.similarity}% · {formatIsoDate(row.issued.decidedOn)}
                          {row.issued.issuedBy ? ` · ${row.issued.issuedBy}` : ""}
                        </p>
                        <ViewFilesButton
                          fileName={row.issued.fileName}
                          data={row.issued.fileData}
                          onMissing={setNotice}
                        />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.next ? row.next.status : "Not submitted"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!row.issued && !row.blocked && canIssue ? (
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-purple-deep"
                        onClick={() => {
                          setNotice(null);
                          setIssuing({ identifier: row.identifier, name: row.name });
                        }}
                      >
                        Check &amp; issue
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {issuing ? (
        <IssueDialog
          stage={stage}
          scholar={issuing}
          onClose={() => setIssuing(null)}
          onIssued={(message) => {
            setIssuing(null);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
