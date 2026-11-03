"use client";

import {
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  ExternalLink,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { DeskModal } from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { evidenceItemsFor, evidenceList, missingEvidence } from "@/lib/faculty-evidence";
import {
  allFields,
  approvedLabel,
  displayValue,
  evidenceOf,
  formatDay,
  isApproved,
  isRejected,
  isShown,
  pendingLabel,
  recordDate,
  recordTitle,
  rejectedLabel,
  valueText,
  type ResearchKind,
  type ResearchRecord,
} from "@/lib/faculty-research";
import { useChecklist } from "@/lib/use-checklist";
import { cn } from "@/lib/utils";

type Check = { status: "ok" | "missing" | "unknown"; message: string } | null;
type Verdict = "ok" | "bad" | "unknown" | "busy";

function StatusBadge({ record }: { record: ResearchRecord }) {
  if (isApproved(record))
    return (
      <Badge variant="gold">
        <BadgeCheck className="mr-1 size-3.5" aria-hidden="true" />
        {approvedLabel}
      </Badge>
    );
  if (isRejected(record)) return <Badge variant="maroon">{rejectedLabel}</Badge>;
  return <Badge variant="outline">{pendingLabel}</Badge>;
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "busy")
    return (
      <Loader2
        className="size-4 animate-spin text-muted-foreground"
        aria-label="Checking"
      />
    );
  if (verdict === "ok")
    return <CheckCircle2 className="size-4 text-primary" aria-label="Passed" />;
  if (verdict === "bad")
    return <XCircle className="size-4 text-secondary" aria-label="Failed" />;
  return <CircleHelp className="size-4 text-muted-foreground" aria-label="Not known" />;
}

const doiHref = (doi: string) =>
  `https://doi.org/${doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")}`;

/**
 * The Dean's and the administrator's review of one record at a time: the automatic checks (the
 * affiliation, the joining date, the DOI at doi.org, the web link, the evidence files), every
 * field with a tick box, the files to open, and Approve or Reject. Previous and Next move through
 * the list shown behind it; after a decision the next record waiting opens.
 */
export function ResearchReviewDialog({
  kind,
  records,
  startId,
  canReview,
  canEdit,
  onEdit,
  onReviewed,
  onClose,
}: {
  kind: ResearchKind;
  records: readonly ResearchRecord[];
  startId: string;
  canReview: boolean;
  canEdit: boolean;
  onEdit: (record: ResearchRecord) => void;
  onReviewed: (message: string) => void;
  onClose: () => void;
}) {
  const [currentId, setCurrentId] = useState(startId);
  const index = Math.max(
    0,
    records.findIndex((item) => item.id === currentId),
  );
  const record = records[index];
  const evidenceItems = useChecklist(evidenceList(kind));
  const [ticked, setTicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState<{ id: string; doi: Check; link: Check } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const v = record?.values ?? {};
  const doi = valueText(v, "doi");
  const link = valueText(v, "link");

  // The DOI and the web link are checked online as each record opens.
  useEffect(() => {
    if (!record || (!doi && !link)) return;
    let gone = false;
    void fetch("/api/faculty-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check-links", kind, doi, link }),
    })
      .then((response) => response.json())
      .then((data: { doi?: Check; link?: Check }) => {
        if (!gone)
          setLinks({ id: record.id, doi: data.doi ?? null, link: data.link ?? null });
      })
      .catch(() => {
        if (!gone) setLinks({ id: record.id, doi: null, link: null });
      });
    return () => {
      gone = true;
    };
  }, [record, doi, link, kind]);

  if (!record) return null;

  const fields = allFields(kind).filter(
    (field) =>
      isShown(field, v) &&
      field.type !== "confirm" &&
      field.key !== "mobile" &&
      field.key !== "dob" &&
      displayValue(field, v),
  );
  const uploaded = evidenceOf(v);
  const files = evidenceItemsFor(kind, v, evidenceItems);
  const checkKeys = [
    ...fields.map((field) => field.key),
    ...files.map((item) => `file:${item.id}`),
  ];
  const allTicked = checkKeys.every((key) => ticked.includes(key));
  const myLinks = links?.id === record.id ? links : null;
  const linkVerdict = (value: string, check: Check | undefined): Verdict =>
    !value
      ? "unknown"
      : !myLinks
        ? "busy"
        : check?.status === "ok"
          ? "ok"
          : check?.status === "missing"
            ? "bad"
            : "unknown";
  const joined = valueText(v, "joinedOn");
  const date = recordDate(kind, v);
  const missing = missingEvidence(kind, v, evidenceItems);
  const automatic: { label: string; verdict: Verdict; detail: string }[] = [
    ...(kind === "publication"
      ? [
          {
            label: "University affiliation",
            verdict: (valueText(v, "sjuAffiliation") === "Yes" ? "ok" : "bad") as Verdict,
            detail:
              valueText(v, "sjuAffiliation") === "Yes"
                ? "Confirmed by the faculty member"
                : "Not confirmed",
          },
        ]
      : []),
    {
      label: "Dated after joining SJU",
      verdict: (!joined || !date ? "unknown" : date >= joined ? "ok" : "bad") as Verdict,
      detail: joined
        ? `${formatDay(date)} · joined ${formatDay(joined)}`
        : "No joining date given",
    },
    ...(kind === "publication"
      ? [
          {
            label: "DOI at doi.org",
            verdict: linkVerdict(doi, myLinks?.doi),
            detail: doi ? (myLinks?.doi?.message ?? "Checking…") : "No DOI given",
          },
        ]
      : []),
    {
      label: "Web link",
      verdict: linkVerdict(link, myLinks?.link),
      detail: link ? (myLinks?.link?.message ?? "Checking…") : "No link given",
    },
    {
      label: "Evidence files",
      verdict: (missing.length ? "bad" : files.length ? "ok" : "unknown") as Verdict,
      detail: missing.length
        ? `Missing: ${missing.join(", ")}`
        : `${Object.keys(uploaded).length} uploaded`,
    },
  ];

  function go(step: number) {
    const next = records[index + step];
    if (!next) return;
    setCurrentId(next.id);
    setTicked([]);
    setNote("");
    setMessage("");
  }

  async function decide(action: "approve" | "reject" | "reset-review") {
    if (action === "reject" && note.trim().length < 3) {
      setMessage("Write the reason for rejecting.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/faculty-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind, ids: [record.id], note }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        setMessage(data?.message ?? "Not saved.");
        setBusy(false);
        return;
      }
    } catch {
      setMessage("Check the connection.");
      setBusy(false);
      return;
    }
    setBusy(false);
    const verb =
      action === "approve"
        ? "Checked & approved"
        : action === "reject"
          ? "Rejected"
          : "Set back to waiting";
    // Straight on to the next record still waiting, if there is one.
    const next = records
      .slice(index + 1)
      .find((item) => !isApproved(item) && !isRejected(item));
    onReviewed(`${verb}: ${recordTitle(kind, v)}`);
    if (next) {
      setCurrentId(next.id);
      setTicked([]);
      setNote("");
    } else onClose();
  }

  return (
    <DeskModal
      title={`Review · ${index + 1} of ${records.length}`}
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
            {kind === "publication" ? valueText(v, "type") : "Project proposal"} ·{" "}
            {formatDay(date)}
          </p>
          <h3 className="mt-1 font-semibold text-primary">{recordTitle(kind, v)}</h3>
          <p className="text-sm text-muted-foreground">
            {valueText(v, "facultyName")} · {valueText(v, "designation")} ·{" "}
            {valueText(v, "department")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge record={record} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Previous record"
            disabled={index === 0}
            data-readonly-allow
            onClick={() => go(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Next record"
            disabled={index >= records.length - 1}
            data-readonly-allow
            onClick={() => go(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {isRejected(record) && record.reviewNote ? (
        <p className="rounded-xl border border-secondary/30 bg-secondary/5 px-4 py-2 text-sm text-secondary">
          Rejected: {record.reviewNote}
        </p>
      ) : null}

      <section aria-label="Automatic checks" className="grid gap-2 sm:grid-cols-2">
        {automatic.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              item.verdict === "bad"
                ? "border-secondary/40 bg-secondary/5"
                : "border-border",
            )}
          >
            <span className="mt-0.5">
              <VerdictIcon verdict={item.verdict} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-primary">{item.label}</span>
              <span className="block text-xs break-words text-muted-foreground">
                {item.detail}
              </span>
            </span>
          </div>
        ))}
      </section>

      <section aria-label="Fields to check" className="rounded-xl border border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <p className="text-xs font-semibold text-primary">
            Checked {checkKeys.filter((key) => ticked.includes(key)).length} of{" "}
            {checkKeys.length}
          </p>
          <button
            type="button"
            data-readonly-allow
            className="text-xs font-semibold text-primary hover:underline"
            onClick={() => setTicked(allTicked ? [] : checkKeys)}
          >
            {allTicked ? "Untick all" : "Tick all"}
          </button>
        </div>
        <ul className="divide-y divide-border">
          {fields.map((field) => {
            const value = displayValue(field, v);
            const on = ticked.includes(field.key);
            return (
              <li key={field.key} className="flex items-start gap-3 px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  aria-label={`Checked: ${field.label}`}
                  checked={on}
                  onChange={() =>
                    setTicked((current) =>
                      on
                        ? current.filter((key) => key !== field.key)
                        : [...current, field.key],
                    )
                  }
                />
                <span className="w-40 shrink-0 text-xs text-muted-foreground">
                  {field.label}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {field.key === "doi" ? (
                    <a
                      href={doiHref(value)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {value} <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : field.key === "link" ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {value} <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : (
                    value
                  )}
                </span>
              </li>
            );
          })}
          {files.map((item) => {
            const key = `file:${item.id}`;
            const on = ticked.includes(key);
            const ref = uploaded[item.id];
            return (
              <li key={key} className="flex items-start gap-3 px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  aria-label={`Checked: ${item.title}`}
                  checked={on}
                  onChange={() =>
                    setTicked((current) =>
                      on ? current.filter((entry) => entry !== key) : [...current, key],
                    )
                  }
                />
                <span className="w-40 shrink-0 text-xs text-muted-foreground">
                  {item.title}
                </span>
                <span className="min-w-0 flex-1">
                  {ref ? (
                    <a
                      href={ref}
                      target="_blank"
                      rel="noreferrer"
                      data-readonly-allow
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      <FileText className="size-4" aria-hidden="true" /> Open file
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-secondary">
                      <CircleAlert className="size-4" aria-hidden="true" />
                      {item.required ? "Not uploaded (mandatory)" : "Not uploaded"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {canReview ? (
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            Remarks (needed to reject; shown to the faculty member)
          </span>
          <Textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-secondary">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex gap-2">
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onEdit(record)}
            >
              Edit details
            </Button>
          ) : null}
        </div>
        {canReview ? (
          <div className="flex flex-wrap gap-2">
            {isApproved(record) || isRejected(record) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void decide("reset-review")}
              >
                Set back to waiting
              </Button>
            ) : null}
            {!isRejected(record) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void decide("reject")}
              >
                Reject
              </Button>
            ) : null}
            {!isApproved(record) ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                disabled={busy || !allTicked}
                title={allTicked ? undefined : "Tick every field and file first"}
                onClick={() => void decide("approve")}
              >
                {busy ? "Saving…" : "Check & approve"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </DeskModal>
  );
}
