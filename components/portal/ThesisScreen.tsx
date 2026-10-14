"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { thesisChecklist } from "@/data/doctoral";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import {
  currentDoctoral,
  decideThesis,
  latestCommittee,
  latestPlagiarism,
  latestSynopsis,
  saveThesis,
  subscribeDoctoral,
  thesisDeadline,
  type ThesisEvaluator,
  type ThesisSubmission,
} from "@/lib/doctoral";
import { referenceDate } from "@/lib/constants";
import {
  currentPanels,
  savePanel,
  subscribePanels,
  type ThesisPanel,
} from "@/lib/thesis-panels";
import { usePortalSession } from "@/lib/use-preview-session";

const person = z.object({
  name: z.string().trim().min(2, "Enter the name."),
  institution: z.string().trim().min(2, "Enter the institution."),
  email: z.string().trim().email("Enter an email address."),
});

const schema = z.object({
  title: z.string().trim().min(2, "Enter the title."),
  domain: z.string().trim().min(2, "Enter the domain."),
  local: z.tuple([person, person, person]),
  indian: z.tuple([person, person, person]),
  foreign: z.tuple([person, person, person]),
});

type Values = z.infer<typeof schema>;

const blank = { name: "", institution: "", email: "" };

function idleSubscribe() {
  return () => undefined;
}

function idlePanels(): ThesisPanel[] | null {
  return null;
}

function panelFor(panels: ThesisPanel[] | null, thesisId: string) {
  return panels?.find((item) => item.thesisId === thesisId) ?? null;
}

export function ThesisScreen({ mode }: { mode: "admin" | "scholar" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const panels = useSyncExternalStore(
    mode === "admin" ? subscribePanels : idleSubscribe,
    mode === "admin" ? currentPanels : idlePanels,
    () => null,
  );
  const [checks, setChecks] = useState<string[]>([]);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sheet, setSheet] = useState<ThesisSubmission | null>(null);
  const [selection, setSelection] = useState<Record<string, ThesisPanel>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      title: "",
      domain: "",
      local: [blank, blank, blank],
      indian: [blank, blank, blank],
      foreign: [blank, blank, blank],
    },
  });

  if (!ready || !doctoral || (mode === "admin" && !panels)) {
    return <p className="text-sm text-muted-foreground">Loading thesis…</p>;
  }

  const identifier = session?.identifier ?? "";
  const fourth = latestCommittee(doctoral, "fourth", identifier);
  const synopsis = latestSynopsis(doctoral, identifier);
  const deadline =
    synopsis?.status === "Approved" ? thesisDeadline(synopsis.decidedOn) : "";
  const open = fourth?.status === "Approved" && deadline && referenceDate <= deadline;
  const own =
    doctoral.theses.find((item) => item.scholarIdentifier === identifier) ?? null;
  const queue =
    mode === "admin"
      ? doctoral.theses.filter(
          (thesis) =>
            (statusFilter === "" || thesis.status === statusFilter) &&
            textMatches(query, [thesis.scholarName, thesis.title, thesis.domain, thesis.status]),
        )
      : [];

  async function upload(values: Values) {
    if (!session || !open) return;
    if (checks.length !== thesisChecklist.length) {
      setNotice("Complete the checklist.");
      return;
    }
    const problem = fileError(file?.file ?? null, "document", true);
    if (problem || !file?.file) {
      setNotice(problem ?? "Attach the thesis.");
      return;
    }
    const data = await fileToDataUrl(file.file).catch(() => "");
    const saved = await saveThesis({
      scholarIdentifier: session.identifier,
      scholarName: session.name,
      title: values.title,
      domain: values.domain,
      checks,
      fileName: file.file.name,
      fileData: data || null,
      local: values.local,
      indian: values.indian,
      foreign: values.foreign,
    });
    setNotice(
      saved.ok
        ? "Thesis submitted. The research office will choose the examiners."
        : saved.message,
    );
  }

  function chosen(thesis: ThesisSubmission, group: "local" | "indian" | "foreign") {
    const current = selection[thesis.id] ?? panelFor(panels, thesis.id);
    const key =
      group === "local"
        ? "selectedLocal"
        : group === "indian"
          ? "selectedIndian"
          : "selectedForeign";
    return current?.[key] ?? "";
  }

  function choose(
    thesis: ThesisSubmission,
    group: "local" | "indian" | "foreign",
    name: string,
  ) {
    const current = selection[thesis.id] ??
      panelFor(panels, thesis.id) ?? {
        thesisId: thesis.id,
        selectedLocal: "",
        selectedIndian: "",
        selectedForeign: "",
      };
    const key =
      group === "local"
        ? "selectedLocal"
        : group === "indian"
          ? "selectedIndian"
          : "selectedForeign";
    setSelection((existing) => ({
      ...existing,
      [thesis.id]: { ...current, [key]: name },
    }));
  }

  async function seal(thesis: ThesisSubmission) {
    const panel = selection[thesis.id] ?? panelFor(panels, thesis.id);
    if (!panel?.selectedLocal || !panel.selectedIndian || !panel.selectedForeign) {
      setNotice("Select one local, one Indian, and one foreign evaluator.");
      return;
    }
    const panelSaved = await savePanel(panel);
    if (!panelSaved.ok) {
      setNotice(panelSaved.message);
      return;
    }
    const saved = await decideThesis(thesis.id, {
      status: "Approved",
      remarks: "",
      decidedOn: new Date().toISOString().slice(0, 10),
    });
    if (saved.ok) setSheet(thesis);
    setNotice(
      saved.ok
        ? "Examiners recorded. Print the confidential sheet from this screen only."
        : saved.message,
    );
  }

  async function rejectThesis(thesis: ThesisSubmission) {
    const note = (remarks[thesis.id] ?? "").trim();
    if (note.length < 2) {
      setNotice("Enter the remarks before rejecting the thesis.");
      return;
    }
    const saved = await decideThesis(thesis.id, {
      status: "Rejected",
      remarks: note,
      decidedOn: new Date().toISOString().slice(0, 10),
    });
    setNotice(saved.ok ? "Thesis returned with remarks." : saved.message);
  }

  const groups = [
    ["local", "Local"],
    ["indian", "Indian"],
    ["foreign", "Foreign"],
  ] as const;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-primary">Thesis</h1>
      </header>
      {mode === "scholar" ? (
        own && own.status !== "Rejected" ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold text-primary">{own.title}</p>
            <p className="text-muted-foreground">{own.domain}</p>
            <p className="mt-2">
              {own.status}
              {deadline ? ` · Submit by ${deadline}` : ""}
            </p>
            {latestPlagiarism(doctoral, identifier)?.status !== "Approved" ? (
              <p className="mt-2 text-muted-foreground">
                Upload the plagiarism certificate. Examiners cannot be recorded until it
                is approved.
              </p>
            ) : null}
          </div>
        ) : !open ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {fourth?.status === "Approved"
              ? `The thesis window closed on ${deadline}.`
              : "The fourth doctoral committee has to be approved before the thesis opens."}
          </p>
        ) : (
          <form
            className="space-y-4 rounded-xl border border-border bg-card p-4"
            onSubmit={form.handleSubmit(upload)}
            noValidate
          >
            <p className="text-sm text-muted-foreground">Submit by {deadline}.</p>
            <FormField
              label="Title"
              htmlFor="thesis-title"
              required
              error={form.formState.errors.title?.message}
            >
              <Input id="thesis-title" {...form.register("title")} />
            </FormField>
            <FormField
              label="Domain"
              htmlFor="thesis-domain"
              required
              error={form.formState.errors.domain?.message}
            >
              <Input id="thesis-domain" {...form.register("domain")} />
            </FormField>
            {thesisChecklist.map((item) => (
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
            {groups.map(([key, label]) => (
              <fieldset
                key={key}
                className="space-y-3 rounded-xl border border-border p-3"
              >
                <legend className="px-1 text-sm font-semibold text-primary">
                  Three {label.toLowerCase()} evaluators
                </legend>
                {([0, 1, 2] as const).map((index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-3">
                    <Input
                      aria-label={`${label} ${index + 1} name`}
                      {...form.register(`${key}.${index}.name`)}
                      placeholder="Name"
                    />
                    <Input
                      aria-label={`${label} ${index + 1} institution`}
                      {...form.register(`${key}.${index}.institution`)}
                      placeholder="Institution"
                    />
                    <Input
                      aria-label={`${label} ${index + 1} email`}
                      {...form.register(`${key}.${index}.email`)}
                      placeholder="Email"
                    />
                  </div>
                ))}
              </fieldset>
            ))}
            <FormField label="Thesis" htmlFor="thesis-file" required>
              <FileUpload
                id="thesis-file"
                acceptRule="document"
                value={file}
                onChange={setFile}
              />
            </FormField>
            <Button type="submit" variant="gold">
              Submit thesis
            </Button>
          </form>
        )
      ) : (
        <div className="space-y-4">
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
        <ul className="space-y-4">
          {queue.map((thesis) => (
            <li
              key={thesis.id}
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary">{thesis.scholarName}</p>
                  <p className="text-sm">{thesis.title}</p>
                  <p className="text-sm text-muted-foreground">{thesis.domain}</p>
                </div>
                <Badge variant={thesis.status === "Approved" ? "gold" : "purple"}>
                  {thesis.status}
                </Badge>
              </div>
              {thesis.remarks ? (
                <p className="text-sm text-muted-foreground">{thesis.remarks}</p>
              ) : null}
              {thesis.status === "Submitted" ? (
                <>
                  {latestPlagiarism(doctoral, thesis.scholarIdentifier)?.status !==
                  "Approved" ? (
                    <p className="text-sm text-muted-foreground">
                      The plagiarism certificate has to be approved before examiners can
                      be recorded.
                    </p>
                  ) : null}
                  {groups.map(([key, label]) => (
                    <fieldset key={key}>
                      <legend className="text-sm font-semibold text-primary">{label}</legend>
                      {thesis[key].map((person: ThesisEvaluator) => (
                        <label
                          key={person.email}
                          className="mt-1 flex items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name={`${thesis.id}-${key}`}
                            checked={chosen(thesis, key) === person.name}
                            onChange={() => choose(thesis, key, person.name)}
                          />
                          {person.name} · {person.institution}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  <Textarea
                    aria-label="Remarks"
                    value={remarks[thesis.id] ?? ""}
                    onChange={(event) =>
                      setRemarks((current) => ({
                        ...current,
                        [thesis.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="gold" onClick={() => void seal(thesis)}>
                      Record examiners and open the sheet
                    </Button>
                    <Button
                      type="button"
                      variant="maroon"
                      onClick={() => void rejectThesis(thesis)}
                    >
                      Return
                    </Button>
                  </div>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      )}
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
      {mode === "admin" && sheet ? (
        <>
          <PrintActions>
            <p className="text-xs font-semibold tracking-wide text-secondary uppercase">
              Confidential
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This sheet stays on the research office screen. Scholars and supervisors do
              not see the selected examiners.
            </p>
            <Button
              type="button"
              className="mt-4"
              variant="gold"
              onClick={() => window.print()}
            >
              Download examiner PDF
            </Button>
          </PrintActions>
          <PrintPages>
            <section className="pdf-page flex min-h-[277mm] flex-col rounded-xl border border-border bg-white p-10 text-sm text-foreground">
              <p className="text-xs font-semibold tracking-wide text-secondary">
                Confidential · research office only
              </p>
              <h2 className="mt-4 font-serif text-3xl text-primary">Thesis examiners</h2>
              <p className="mt-6">Scholar: {sheet.scholarName}</p>
              <p>Title: {sheet.title}</p>
              <p>Domain: {sheet.domain}</p>
              <ul className="mt-4 space-y-1">
                <li>
                  Local:{" "}
                  {(selection[sheet.id] ?? panelFor(panels, sheet.id))?.selectedLocal}
                </li>
                <li>
                  Indian:{" "}
                  {(selection[sheet.id] ?? panelFor(panels, sheet.id))?.selectedIndian}
                </li>
                <li>
                  Foreign:{" "}
                  {(selection[sheet.id] ?? panelFor(panels, sheet.id))?.selectedForeign}
                </li>
              </ul>
            </section>
          </PrintPages>
        </>
      ) : null}
    </section>
  );
}
