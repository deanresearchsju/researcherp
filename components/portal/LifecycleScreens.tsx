"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { PrintActions, PrintPages } from "@/components/forms/PrintForm";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  completionKinds,
  examinerOutcomes,
  vivaOutcomes,
} from "@/data/doctoral";
import { university } from "@/lib/constants";
import {
  completionBlocked,
  currentDoctoral,
  decidePlagiarism,
  decideViva,
  latestPlagiarism,
  latestThesis,
  latestViva,
  plagiarismBlocked,
  reportsReady,
  revisionNeeded,
  reviseThesis,
  saveCompletion,
  saveExaminerReport,
  savePlagiarism,
  saveViva,
  subscribeDoctoral,
  vivaBlocked,
  type ExaminerOutcome,
  type ThesisSubmission,
} from "@/lib/doctoral";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { currentPanels, subscribePanels } from "@/lib/thesis-panels";
import { usePortalSession } from "@/lib/use-preview-session";

const remarksSchema = z.string().trim().min(2, "Enter the remarks.");

function idleSubscribe() {
  return () => undefined;
}

export function PlagiarismScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [similarity, setSimilarity] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading plagiarism…</p>;
  }

  const identifier = session?.identifier ?? "";
  const mine = latestPlagiarism(doctoral, identifier);
  const gate = plagiarismBlocked(doctoral, identifier);

  async function upload() {
    if (!session) return;
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the certificate.");
      return;
    }
    if (!similarity.trim()) {
      setNotice("Enter the similarity percentage.");
      return;
    }
    const data = await fileToDataUrl(file.file).catch(() => "");
    const saved = await savePlagiarism({
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      similarity: similarity.trim(),
      fileName: file.file.name,
      fileData: data || null,
    });
    setNotice(saved.ok ? "Certificate submitted." : saved.message);
    if (saved.ok) setFile(null);
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
    const saved = await decidePlagiarism(id, {
      status,
      remarks: note,
      decidedOn: new Date().toISOString().slice(0, 10),
    });
    setNotice(saved.ok ? status : saved.message);
  }

  const queue = doctoral.plagiarism.filter((item) => {
    if (mode !== "admin") return item.scholarIdentifier === identifier;
    return (
      (statusFilter === "" || item.status === statusFilter) &&
      textMatches(query, [item.scholarName, item.fileName, item.status, item.similarity])
    );
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Plagiarism</h1>
      </header>
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        gate ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">{gate}</p>
        ) : mine && mine.status !== "Rejected" ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {mine.fileName} · {mine.similarity}% · {mine.status}
            {mine.remarks ? ` · ${mine.remarks}` : ""}
          </p>
        ) : (
          <form
            className="space-y-4 rounded-xl border border-border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void upload();
            }}
          >
            <FormField label="Similarity %" htmlFor="similarity" required>
              <Input
                id="similarity"
                value={similarity}
                onChange={(event) => setSimilarity(event.target.value)}
              />
            </FormField>
            <FormField label="Certificate" htmlFor="plagiarism-file" required>
              <FileUpload
                id="plagiarism-file"
                acceptRule="document"
                value={file}
                onChange={setFile}
              />
            </FormField>
            <Button type="submit" variant="gold">
              Submit certificate
            </Button>
          </form>
        )
      ) : (
        <>
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
            total={doctoral.plagiarism.length}
            filename="plagiarism.csv"
            headers={["scholar", "similarity", "status"]}
            rows={queue.map((item) => [item.scholarName, item.similarity, item.status])}
          />
          <ul className="space-y-3">
            {queue.map((item) => (
              <li key={item.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-primary">
                    {item.scholarName} · {item.similarity}% · {item.fileName}
                  </p>
                  <Badge variant={item.status === "Approved" ? "gold" : "purple"}>
                    {item.status}
                  </Badge>
                </div>
                {item.status === "Submitted" ? (
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
                        Return
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function ExaminerReportScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const panels = useSyncExternalStore(
    mode === "admin" ? subscribePanels : idleSubscribe,
    mode === "admin" ? currentPanels : () => null,
    () => null,
  );
  const [files, setFiles] = useState<Record<string, StoredFile | null>>({});
  const [reviseFile, setReviseFile] = useState<StoredFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    Record<string, { outcome: ExaminerOutcome; remarks: string }>
  >({});
  const [query, setQuery] = useState("");

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading examiner reports…</p>;
  }

  const identifier = session?.identifier ?? "";
  const mine = latestThesis(doctoral, identifier);
  const namesFor = (thesis: ThesisSubmission) => {
    const panel = panels?.find((item) => item.thesisId === thesis.id);
    return {
      local: panel?.selectedLocal ?? "",
      indian: panel?.selectedIndian ?? "",
      foreign: panel?.selectedForeign ?? "",
    };
  };

  async function record(thesis: ThesisSubmission, group: "local" | "indian" | "foreign", name: string) {
    const key = `${thesis.id}-${group}`;
    const chosen = draft[key] ?? { outcome: "Recommended" as const, remarks: "" };
    if (chosen.outcome !== "Recommended" && chosen.remarks.trim().length < 2) {
      setNotice("Enter the remarks for a revision or rejection.");
      return;
    }
    const slot = files[key] ?? null;
    const problem = fileError(slot?.file ?? null, "document", false);
    if (problem) {
      setNotice(problem);
      return;
    }
    const data = slot?.file ? await fileToDataUrl(slot.file).catch(() => "") : "";
    const saved = await saveExaminerReport({
      thesisId: thesis.id,
      scholarIdentifier: thesis.scholarIdentifier,
      scholarName: thesis.scholarName,
      examinerName: name,
      group,
      version: thesis.version,
      outcome: chosen.outcome,
      remarks: chosen.remarks.trim(),
      fileName: slot?.file.name ?? "",
      fileData: data || null,
    });
    setNotice(saved.ok ? `${name} recorded.` : saved.message);
    if (saved.ok) {
      setFiles((current) => ({ ...current, [key]: null }));
    }
  }

  async function resubmit() {
    if (!mine) return;
    const problem = fileError(reviseFile?.file ?? null, "document", true);
    if (problem || !reviseFile?.file) {
      setNotice(problem ?? "Attach the revised thesis.");
      return;
    }
    const data = await fileToDataUrl(reviseFile.file).catch(() => "");
    const saved = await reviseThesis(mine.id, {
      fileName: reviseFile.file.name,
      fileData: data || null,
    });
    setNotice(saved.ok ? `Version ${mine.version + 1} saved.` : saved.message);
    if (saved.ok) setReviseFile(null);
  }

  const queue = doctoral.theses.filter((thesis) => {
    if (thesis.status !== "Approved") return false;
    if (mode !== "admin") return thesis.scholarIdentifier === identifier;
    return textMatches(query, [thesis.scholarName, thesis.title, thesis.fileName]);
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Examiner reports</h1>
      </header>
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        !mine || mine.status !== "Approved" ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            Examiner reports open after the research office records the examiners.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl border border-border bg-card p-4 text-sm">
              Thesis version {mine.version} · {mine.fileName}
            </p>
            <ul className="space-y-2">
              {doctoral.examinerReports
                .filter((item) => item.thesisId === mine.id && item.version === mine.version)
                .map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                    {item.group}: {item.outcome}
                    {item.remarks ? ` · ${item.remarks}` : ""}
                  </li>
                ))}
            </ul>
            {revisionNeeded(doctoral, mine) ? (
              <form
                className="space-y-4 rounded-xl border border-border bg-card p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void resubmit();
                }}
              >
                <FormField label="Revised thesis" htmlFor="revise-file" required>
                  <FileUpload
                    id="revise-file"
                    acceptRule="document"
                    value={reviseFile}
                    onChange={setReviseFile}
                  />
                </FormField>
                <Button type="submit" variant="gold">
                  Submit revision
                </Button>
              </form>
            ) : null}
          </div>
        )
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[]}
            shown={queue.length}
            total={doctoral.theses.length}
            filename="examiner-reports.csv"
            headers={["scholar", "title", "version"]}
            rows={queue.map((item) => [item.scholarName, item.title, String(item.version)])}
          />
          <ul className="space-y-4">
            {queue.map((thesis) => {
              const names = namesFor(thesis);
              const slots = [
                ["local", names.local],
                ["indian", names.indian],
                ["foreign", names.foreign],
              ] as const;
              return (
                <li key={thesis.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold text-primary">
                    {thesis.scholarName} · version {thesis.version}
                  </p>
                  {slots.map(([group, name]) => {
                    const key = `${thesis.id}-${group}`;
                    const existing = doctoral.examinerReports.find(
                      (item) =>
                        item.thesisId === thesis.id &&
                        item.group === group &&
                        item.version === thesis.version,
                    );
                    if (!name) {
                      return (
                        <p key={group} className="text-sm text-muted-foreground">
                          Record examiners on Thesis first ({group}).
                        </p>
                      );
                    }
                    if (existing) {
                      return (
                        <p key={group} className="text-sm">
                          {name}: {existing.outcome}
                          {existing.remarks ? ` · ${existing.remarks}` : ""}
                        </p>
                      );
                    }
                    const chosen = draft[key] ?? {
                      outcome: "Recommended" as ExaminerOutcome,
                      remarks: "",
                    };
                    return (
                      <div key={group} className="space-y-2 rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-primary">
                          {group}: {name}
                        </p>
                        <NativeSelect
                          aria-label={`${name} outcome`}
                          value={chosen.outcome}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [key]: {
                                ...chosen,
                                outcome: event.target.value as ExaminerOutcome,
                              },
                            }))
                          }
                        >
                          {examinerOutcomes.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </NativeSelect>
                        <Textarea
                          aria-label={`${name} remarks`}
                          value={chosen.remarks}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [key]: { ...chosen, remarks: event.target.value },
                            }))
                          }
                        />
                        <FileUpload
                          id={`${key}-file`}
                          acceptRule="document"
                          value={files[key] ?? null}
                          onChange={(value) =>
                            setFiles((current) => ({ ...current, [key]: value }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="gold"
                          onClick={() => void record(thesis, group, name)}
                        >
                          Save report
                        </Button>
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function VivaScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const panels = useSyncExternalStore(subscribePanels, currentPanels, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduledOn, setScheduledOn] = useState("");
  const [venue, setVenue] = useState("");
  const [panel, setPanel] = useState("");
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading viva…</p>;
  }

  const identifier = session?.identifier ?? "";
  const mine = latestViva(doctoral, identifier);
  const gate = vivaBlocked(doctoral, identifier);

  async function schedule(thesisRow: ThesisSubmission) {
    const panelNames = panels?.find((item) => item.thesisId === thesisRow.id);
    const chosen = {
      local: panelNames?.selectedLocal ?? "",
      indian: panelNames?.selectedIndian ?? "",
      foreign: panelNames?.selectedForeign ?? "",
    };
    const blocked = vivaBlocked(doctoral!, thesisRow.scholarIdentifier);
    if (blocked) {
      setNotice(blocked);
      return;
    }
    if (!scheduledOn || !venue.trim()) {
      setNotice("Enter the date and venue.");
      return;
    }
    const saved = await saveViva({
      scholarIdentifier: thesisRow.scholarIdentifier,
      scholarName: thesisRow.scholarName,
      scheduledOn,
      venue: venue.trim(),
      panel:
        panel.trim() ||
        [chosen.local, chosen.indian, chosen.foreign].filter(Boolean).join(", "),
    });
    setNotice(saved.ok ? "Viva scheduled." : saved.message);
  }

  async function decide(id: string, status: "Passed" | "Failed") {
    const minute = (minutes[id] ?? "").trim();
    const saved = await decideViva(id, {
      status,
      minutes: minute,
      remarks: (remarks[id] ?? "").trim(),
    });
    setNotice(saved.ok ? status : saved.message);
  }

  const readyTheses = doctoral.theses.filter((item) => {
    if (item.status !== "Approved") return false;
    if (latestViva(doctoral, item.scholarIdentifier)?.status === "Passed") return false;
    return reportsReady(doctoral, item);
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Viva</h1>
      </header>
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        gate && !mine ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">{gate}</p>
        ) : mine ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {mine.scheduledOn} · {mine.venue} · {mine.status}
            {mine.minutes ? ` · ${mine.minutes}` : ""}
          </p>
        ) : (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            The research office will schedule the viva here.
          </p>
        )
      ) : (
        <>
          <form
            className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <FormField label="Date" htmlFor="viva-date" required>
              <Input
                id="viva-date"
                type="date"
                value={scheduledOn}
                onChange={(event) => setScheduledOn(event.target.value)}
              />
            </FormField>
            <FormField label="Venue" htmlFor="viva-venue" required>
              <Input
                id="viva-venue"
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
              />
            </FormField>
            <FormField label="Panel" htmlFor="viva-panel" className="sm:col-span-2">
              <Input
                id="viva-panel"
                value={panel}
                onChange={(event) => setPanel(event.target.value)}
              />
            </FormField>
          </form>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[]}
            shown={doctoral.vivas.length}
            total={doctoral.vivas.length}
            filename="vivas.csv"
            headers={["scholar", "date", "venue", "status"]}
            rows={doctoral.vivas.map((item) => [
              item.scholarName,
              item.scheduledOn,
              item.venue,
              item.status,
            ])}
          />
          <ul className="space-y-3">
            {readyTheses
              .filter((item) => !doctoral.vivas.some((viva) => viva.scholarIdentifier === item.scholarIdentifier && viva.status === "Scheduled"))
              .filter((item) => textMatches(query, [item.scholarName, item.title]))
              .map((thesis) => (
                <li
                  key={thesis.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <p className="font-semibold text-primary">{thesis.scholarName}</p>
                  <Button type="button" size="sm" variant="gold" onClick={() => void schedule(thesis)}>
                    Schedule
                  </Button>
                </li>
              ))}
            {doctoral.vivas.map((viva) => (
              <li key={viva.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <p className="font-semibold text-primary">
                  {viva.scholarName} · {viva.scheduledOn} · {viva.status}
                </p>
                {viva.status === "Scheduled" ? (
                  <div className="space-y-2">
                    <Textarea
                      aria-label="Minutes"
                      placeholder="Minutes"
                      value={minutes[viva.id] ?? ""}
                      onChange={(event) =>
                        setMinutes((current) => ({
                          ...current,
                          [viva.id]: event.target.value,
                        }))
                      }
                    />
                    <Textarea
                      aria-label="Remarks"
                      placeholder="Remarks"
                      value={remarks[viva.id] ?? ""}
                      onChange={(event) =>
                        setRemarks((current) => ({
                          ...current,
                          [viva.id]: event.target.value,
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      {vivaOutcomes.map((outcome) => (
                        <Button
                          key={outcome}
                          type="button"
                          size="sm"
                          variant={outcome === "Passed" ? "gold" : "maroon"}
                          onClick={() => void decide(viva.id, outcome)}
                        >
                          {outcome}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{viva.minutes}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function CompletionScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof completionKinds)[number]>("Provisional");
  const [issuedOn, setIssuedOn] = useState("");
  const [remarks, setRemarks] = useState("");
  const [sheet, setSheet] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading completion…</p>;
  }

  const identifier = session?.identifier ?? "";
  const mine = doctoral.completions.filter((item) => item.scholarIdentifier === identifier);
  const readyScholars = doctoral.vivas.filter((item) => item.status === "Passed");

  async function issue(scholarIdentifier: string, scholarName: string) {
    const blocked = completionBlocked(doctoral!, scholarIdentifier);
    if (blocked) {
      setNotice(blocked);
      return;
    }
    if (!issuedOn) {
      setNotice("Enter the issue date.");
      return;
    }
    const saved = await saveCompletion({
      scholarIdentifier,
      scholarName,
      kind,
      issuedOn,
      remarks: remarks.trim(),
    });
    setNotice(saved.ok ? `${kind} issued.` : saved.message);
    if (saved.ok) setSheet(scholarName);
  }

  const shown = doctoral.completions.filter((item) =>
    textMatches(query, [item.scholarName, item.kind, item.issuedOn]),
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Completion</h1>
      </header>
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        mine.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {completionBlocked(doctoral, identifier) ?? "No certificate has been issued yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {mine.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                {item.kind} · {item.issuedOn}
                {item.remarks ? ` · ${item.remarks}` : ""}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <form
            className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <FormField label="Kind" htmlFor="completion-kind">
              <NativeSelect
                id="completion-kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as (typeof completionKinds)[number])
                }
              >
                {completionKinds.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Issued on" htmlFor="completion-date" required>
              <Input
                id="completion-date"
                type="date"
                value={issuedOn}
                onChange={(event) => setIssuedOn(event.target.value)}
              />
            </FormField>
            <FormField label="Remarks" htmlFor="completion-remarks" className="sm:col-span-2">
              <Textarea
                id="completion-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </FormField>
          </form>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[]}
            shown={shown.length}
            total={doctoral.completions.length}
            filename="completion.csv"
            headers={["scholar", "kind", "issued"]}
            rows={shown.map((item) => [item.scholarName, item.kind, item.issuedOn])}
          />
          <ul className="space-y-3">
            {readyScholars.map((viva) => (
              <li
                key={viva.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <p className="font-semibold text-primary">{viva.scholarName}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="gold"
                  onClick={() => void issue(viva.scholarIdentifier, viva.scholarName)}
                >
                  Issue {kind}
                </Button>
              </li>
            ))}
            {shown.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                {item.scholarName} · {item.kind} · {item.issuedOn}
              </li>
            ))}
          </ul>
          {sheet ? (
            <>
              <PrintActions>
                <Button type="button" variant="gold" onClick={() => window.print()}>
                  Print certificate
                </Button>
              </PrintActions>
              <PrintPages>
                <section className="pdf-page flex min-h-[277mm] flex-col rounded-xl border border-border bg-white p-10">
                  <p className="text-xs font-semibold tracking-wide text-secondary uppercase">
                    {university.researchOffice}
                  </p>
                  <h2 className="mt-4 font-serif text-3xl text-primary">{kind} certificate</h2>
                  <p className="mt-6 text-sm">{sheet}</p>
                  <p className="mt-2 text-sm">{issuedOn}</p>
                  <p className="mt-8 text-sm text-muted-foreground">{university.name}</p>
                </section>
              </PrintPages>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
