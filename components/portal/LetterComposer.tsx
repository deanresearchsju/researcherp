"use client";

import { Eye, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "@/components/portal/Desk";
import { FilePreview } from "@/components/portal/FilePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { letterName, type LetterDraft } from "@/lib/doctoral";
import { letterDataUrl, letterFileName, type LetterSigner } from "@/lib/letter-pdf";

const textareaClass =
  "w-full rounded-xl border border-input bg-white px-3 py-2 text-sm leading-6 focus:border-primary focus:outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Edit every part of an official letter, preview the PDF, and issue it. Opened pre-filled from
 * the approval the letter is for.
 */
export function LetterComposer({
  draft: initial,
  signer,
  reissue = false,
  onClose,
  onIssue,
}: {
  draft: LetterDraft;
  signer: LetterSigner;
  reissue?: boolean;
  onClose: () => void;
  onIssue: (draft: LetterDraft) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [draft, setDraft] = useState(initial);
  const [body, setBody] = useState(initial.body.join("\n\n"));
  const [toLines, setToLines] = useState(initial.toLines.join("\n"));
  const [copyTo, setCopyTo] = useState(initial.copyTo.join("\n"));
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function current(): LetterDraft {
    return {
      ...draft,
      toLines: toLines
        .split("\n")
        .map((row) => row.trim())
        .filter(Boolean),
      copyTo: copyTo
        .split("\n")
        .map((row) => row.trim())
        .filter(Boolean),
      body: body
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
      details: draft.details.filter((row) => row.label.trim() || row.value.trim()),
    };
  }

  function set<K extends keyof LetterDraft>(key: K, value: LetterDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError("");
  }

  function setDetail(index: number, key: "label" | "value", value: string) {
    set(
      "details",
      draft.details.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
    );
  }

  return (
    <>
      <FormDialog
        title={`${reissue ? "Correct & reissue" : "Issue"} · ${letterName(draft.kind)}`}
        submitLabel={reissue ? "Reissue letter" : "Approve & issue letter"}
        busy={busy}
        size="lg"
        onClose={onClose}
        extraActions={
          <Button
            type="button"
            variant="outline"
            data-readonly-allow
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void letterDataUrl(current(), signer)
                .then(setPreview)
                .catch(() => setError("The preview could not be prepared."))
                .finally(() => setBusy(false));
            }}
          >
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </Button>
        }
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void onIssue(current())
            .then((result) => {
              if (!result.ok)
                setError(result.message ?? "The letter could not be issued.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <div className="space-y-5 text-sm">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="font-semibold text-primary">{draft.recipientName}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {draft.recipientRole}
            </p>
          </div>

          <Section title="Reference">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Input
                value={draft.refNo}
                onChange={(event) => set("refNo", event.target.value)}
                aria-label="Reference number"
              />
              <Input
                type="date"
                value={draft.issuedOn}
                onChange={(event) => set("issuedOn", event.target.value)}
                aria-label="Date"
              />
            </div>
            <Input
              value={draft.title}
              placeholder="Heading printed above the letter (optional)"
              onChange={(event) => set("title", event.target.value)}
              aria-label="Heading"
            />
          </Section>

          <Section title="Addressed to (one line each)">
            <textarea
              rows={3}
              className={textareaClass}
              value={toLines}
              onChange={(event) => setToLines(event.target.value)}
            />
          </Section>

          <Section title="Subject and reference">
            <textarea
              rows={2}
              className={textareaClass}
              value={draft.subject}
              onChange={(event) => set("subject", event.target.value)}
              aria-label="Subject"
            />
            <textarea
              rows={2}
              className={textareaClass}
              value={draft.reference}
              onChange={(event) => set("reference", event.target.value)}
              aria-label="Reference"
            />
          </Section>

          <Section title="Details table">
            <div className="space-y-2">
              {draft.details.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[11rem_minmax(0,1fr)_auto] gap-2"
                >
                  <Input
                    value={row.label}
                    placeholder="Label"
                    onChange={(event) => setDetail(index, "label", event.target.value)}
                  />
                  <Input
                    value={row.value}
                    placeholder="Value"
                    onChange={(event) => setDetail(index, "value", event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove row"
                    onClick={() =>
                      set(
                        "details",
                        draft.details.filter((_, at) => at !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  set("details", [...draft.details, { label: "", value: "" }])
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Add row
              </Button>
            </div>
          </Section>

          <Section title="Letter text">
            <textarea
              rows={14}
              className={textareaClass}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-label="Letter text"
            />
            <p className="text-xs text-muted-foreground">
              Leave a blank line between paragraphs. Start a line with “- ” to print it as
              a list item.
            </p>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="Closing">
              <Input
                value={draft.closing}
                onChange={(event) => set("closing", event.target.value)}
                aria-label="Closing"
              />
              <p className="text-xs text-muted-foreground">
                Signed by {signer.name || "the Dean Research"}, {signer.title}
                {signer.signature ? " · with signature" : ""}.
              </p>
            </Section>
            <Section title="Copy to (one per line)">
              <textarea
                rows={3}
                className={textareaClass}
                value={copyTo}
                onChange={(event) => setCopyTo(event.target.value)}
              />
            </Section>
          </div>
          {error ? <p className="text-secondary">{error}</p> : null}
        </div>
      </FormDialog>
      {preview ? (
        <FilePreview
          fileName={letterFileName(current())}
          data={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
