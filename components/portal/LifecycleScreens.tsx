"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskModal,
  DeskPage,
  FormDialog,
  GateBanner,
  ScholarIdentityHeader,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { PrintActions, PrintPages } from "@/components/forms/PrintForm";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { completionKinds, examinerOutcomes, vivaOutcomes } from "@/data/doctoral";
import { university } from "@/lib/constants";
import {
  completionBlocked,
  currentDoctoral,
  decideViva,
  latestThesis,
  latestViva,
  reportsReady,
  revisionNeeded,
  reviseThesis,
  saveCompletion,
  saveExaminerReport,
  saveViva,
  subscribeDoctoral,
  vivaBlocked,
  type ExaminerOutcome,
  type ThesisSubmission,
} from "@/lib/doctoral";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { acceptedEvaluators, useEvaluationPanels } from "@/lib/thesis-evaluation";
import { evaluatorGroupLabel } from "@/lib/thesis-evaluation-model";
import { usePortalSession } from "@/lib/use-preview-session";

export function ExaminerReportScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const panels = useEvaluationPanels(
    mode === "admin" && (session?.role === "admin" || session?.role === "dean"),
  );
  const [files, setFiles] = useState<Record<string, StoredFile | null>>({});
  const [reviseFile, setReviseFile] = useState<StoredFile | null>(null);
  const [revising, setRevising] = useState(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
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
  const namesFor = (thesis: ThesisSubmission) =>
    acceptedEvaluators(panels, thesis.scholarIdentifier);

  async function record(
    thesis: ThesisSubmission,
    group: "local" | "indian" | "foreign",
    name: string,
  ) {
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
      examinerName: `${evaluatorGroupLabel[group]} examiner`,
      group,
      version: thesis.version,
      outcome: chosen.outcome,
      remarks: chosen.remarks.trim(),
      fileName: slot?.file.name ?? "",
      fileData: data || null,
    });
    setNotice(saved.ok ? `${name} recorded.` : saved.message);
    if (saved.ok) {
      setRecordingKey(null);
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
    if (saved.ok) {
      setReviseFile(null);
      setRevising(false);
    }
  }

  const queue = doctoral.theses.filter((thesis) => {
    if (thesis.status !== "Approved") return false;
    if (mode !== "admin") return thesis.scholarIdentifier === identifier;
    return textMatches(query, [thesis.scholarName, thesis.title, thesis.fileName]);
  });

  return (
    <DeskPage title="Examiner reports">
      {mode === "scholar" ? <ScholarIdentityHeader identifier={identifier} /> : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        !mine || mine.status !== "Approved" ? (
          <GateBanner>
            Examiner reports open after the research office records the examiners.
          </GateBanner>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm">
              <p>
                Thesis version {mine.version} · {mine.fileName}
              </p>
              <ViewFilesButton
                fileName={mine.fileName}
                data={mine.fileData}
                onMissing={setNotice}
              />
            </div>
            <ul className="space-y-2">
              {doctoral.examinerReports
                .filter(
                  (item) => item.thesisId === mine.id && item.version === mine.version,
                )
                .map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-4 text-sm"
                  >
                    {item.group}: {item.outcome}
                    {item.remarks ? ` · ${item.remarks}` : ""}
                  </li>
                ))}
            </ul>
            {revisionNeeded(doctoral, mine) ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                  <p className="text-sm font-semibold text-primary">
                    An examiner asked for a revision.
                  </p>
                  <Button type="button" variant="gold" onClick={() => setRevising(true)}>
                    Submit revision
                  </Button>
                </div>
                {revising ? (
                  <FormDialog
                    title="Submit revised thesis"
                    onClose={() => setRevising(false)}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void resubmit();
                    }}
                    submitLabel="Submit revision"
                  >
                    {notice ? (
                      <p role="alert" className="text-sm text-secondary">
                        {notice}
                      </p>
                    ) : null}
                    <FormField label="Revised thesis" htmlFor="revise-file" required>
                      <FileUpload
                        id="revise-file"
                        acceptRule="document"
                        value={reviseFile}
                        onChange={setReviseFile}
                      />
                    </FormField>
                  </FormDialog>
                ) : null}
              </>
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
            rows={queue.map((item) => [
              item.scholarName,
              item.title,
              String(item.version),
            ])}
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
                <li
                  key={thesis.id}
                  className="space-y-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-primary">
                      {thesis.scholarName} · version {thesis.version}
                    </p>
                    <ViewFilesButton
                      fileName={thesis.fileName}
                      data={thesis.fileData}
                      onMissing={setNotice}
                    />
                  </div>
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
                      <div
                        key={group}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <p className="text-sm">
                          <span className="font-semibold text-primary capitalize">
                            {group}
                          </span>{" "}
                          · {name} ·{" "}
                          <span className="text-muted-foreground">Pending</span>
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setNotice(null);
                            setRecordingKey(key);
                          }}
                        >
                          Record report
                        </Button>
                        {recordingKey === key ? (
                          <DeskModal
                            title={`Examiner report · ${name}`}
                            onClose={() => setRecordingKey(null)}
                            size="md"
                          >
                            {notice ? (
                              <p role="alert" className="text-sm text-secondary">
                                {notice}
                              </p>
                            ) : null}
                            <FormField label="Outcome" htmlFor={`${key}-outcome`}>
                              <NativeSelect
                                id={`${key}-outcome`}
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
                            </FormField>
                            <Textarea
                              placeholder="Remarks"
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
                          </DeskModal>
                        ) : null}
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </DeskPage>
  );
}

export function VivaScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const panels = useEvaluationPanels(
    mode === "admin" && (session?.role === "admin" || session?.role === "dean"),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduledOn, setScheduledOn] = useState("");
  const [venue, setVenue] = useState("");
  const [panel, setPanel] = useState("");
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [scheduling, setScheduling] = useState<ThesisSubmission | null>(null);
  const [recording, setRecording] = useState<string | null>(null);

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading viva…</p>;
  }

  const identifier = session?.identifier ?? "";
  const mine = latestViva(doctoral, identifier);
  const gate = vivaBlocked(doctoral, identifier);

  async function schedule(thesisRow: ThesisSubmission) {
    const chosen = acceptedEvaluators(panels, thesisRow.scholarIdentifier);
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
    if (saved.ok) setScheduling(null);
  }

  async function decide(id: string, status: "Passed" | "Failed") {
    const minute = (minutes[id] ?? "").trim();
    const saved = await decideViva(id, {
      status,
      minutes: minute,
      remarks: (remarks[id] ?? "").trim(),
    });
    setNotice(saved.ok ? `Viva recorded as ${status.toLowerCase()}.` : saved.message);
    if (saved.ok) setRecording(null);
  }

  const readyTheses = doctoral.theses.filter((item) => {
    if (item.status !== "Approved") return false;
    if (latestViva(doctoral, item.scholarIdentifier)?.status === "Passed") return false;
    return reportsReady(doctoral, item);
  });

  return (
    <DeskPage title="Viva">
      {mode === "scholar" ? <ScholarIdentityHeader identifier={identifier} /> : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        gate && !mine ? (
          <GateBanner tone="danger">{gate}</GateBanner>
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
          {scheduling ? (
            <FormDialog
              title={`Schedule viva · ${scheduling.scholarName}`}
              onClose={() => setScheduling(null)}
              onSubmit={(event) => {
                event.preventDefault();
                void schedule(scheduling);
              }}
              submitLabel="Schedule viva"
            >
              {notice ? (
                <p role="alert" className="text-sm text-secondary">
                  {notice}
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </FormDialog>
          ) : null}
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
              .filter(
                (item) =>
                  !doctoral.vivas.some(
                    (viva) =>
                      viva.scholarIdentifier === item.scholarIdentifier &&
                      viva.status === "Scheduled",
                  ),
              )
              .filter((item) => textMatches(query, [item.scholarName, item.title]))
              .map((thesis) => (
                <li
                  key={thesis.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <p className="font-semibold text-primary">{thesis.scholarName}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={() => {
                      setNotice(null);
                      setScheduling(thesis);
                    }}
                  >
                    Schedule viva
                  </Button>
                </li>
              ))}
            {doctoral.vivas.map((viva) => (
              <li
                key={viva.id}
                className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-primary">
                    {viva.scholarName} · {viva.scheduledOn} · {viva.venue}
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusPill
                      status={
                        viva.status === "Passed"
                          ? "Approved"
                          : viva.status === "Failed"
                            ? "Rejected"
                            : "Pending"
                      }
                    />
                    {viva.status === "Scheduled" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setNotice(null);
                          setRecording(viva.id);
                        }}
                      >
                        Record result
                      </Button>
                    ) : null}
                  </div>
                </div>
                {viva.status === "Scheduled" && recording === viva.id ? (
                  <DeskModal
                    title={`Viva result · ${viva.scholarName}`}
                    onClose={() => setRecording(null)}
                    size="md"
                  >
                    {notice ? (
                      <p role="alert" className="text-sm text-secondary">
                        {notice}
                      </p>
                    ) : null}
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
                  </DeskModal>
                ) : viva.minutes ? (
                  <p className="text-sm text-muted-foreground">{viva.minutes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </DeskPage>
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
  const [issuing, setIssuing] = useState<{ identifier: string; name: string } | null>(
    null,
  );

  if (!ready || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading completion…</p>;
  }

  const identifier = session?.identifier ?? "";
  const mine = doctoral.completions.filter(
    (item) => item.scholarIdentifier === identifier,
  );
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
    if (saved.ok) {
      setSheet(scholarName);
      setIssuing(null);
    }
  }

  const shown = doctoral.completions.filter((item) =>
    textMatches(query, [item.scholarName, item.kind, item.issuedOn]),
  );

  return (
    <DeskPage title="Completion">
      {mode === "scholar" ? <ScholarIdentityHeader identifier={identifier} /> : null}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "scholar" ? (
        mine.length === 0 ? (
          <GateBanner>
            {completionBlocked(doctoral, identifier) ??
              "No certificate has been issued yet."}
          </GateBanner>
        ) : (
          <ul className="space-y-3">
            {mine.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 text-sm"
              >
                {item.kind} · {item.issuedOn}
                {item.remarks ? ` · ${item.remarks}` : ""}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {issuing ? (
            <FormDialog
              title={`Issue certificate · ${issuing.name}`}
              onClose={() => setIssuing(null)}
              onSubmit={(event) => {
                event.preventDefault();
                void issue(issuing.identifier, issuing.name);
              }}
              submitLabel="Issue"
            >
              {notice ? (
                <p role="alert" className="text-sm text-secondary">
                  {notice}
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
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
                <FormField
                  label="Remarks"
                  htmlFor="completion-remarks"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="completion-remarks"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                  />
                </FormField>
              </div>
            </FormDialog>
          ) : null}
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
                  onClick={() => {
                    setNotice(null);
                    setIssuing({
                      identifier: viva.scholarIdentifier,
                      name: viva.scholarName,
                    });
                  }}
                >
                  Issue certificate
                </Button>
              </li>
            ))}
            {shown.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 text-sm"
              >
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
                  <h2 className="mt-4 font-serif text-3xl text-primary">
                    {kind} certificate
                  </h2>
                  <p className="mt-6 text-sm">{sheet}</p>
                  <p className="mt-2 text-sm">{issuedOn}</p>
                  <p className="mt-8 text-sm text-muted-foreground">{university.name}</p>
                </section>
              </PrintPages>
            </>
          ) : null}
        </>
      )}
    </DeskPage>
  );
}
