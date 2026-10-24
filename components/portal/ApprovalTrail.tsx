"use client";

import { Check, Clock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMoment, type ApprovalSummary } from "@/lib/approval-flow";
import { cn } from "@/lib/utils";

/** The one-line status of a document that goes to the Supervisor and then the Dean. */
export function ApprovalBadge({
  summary,
  showDetail = false,
}: {
  summary: ApprovalSummary;
  showDetail?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge variant={summary.tone}>{summary.label}</Badge>
      {showDetail && summary.detail ? (
        <span className="text-xs text-muted-foreground">{summary.detail}</span>
      ) : null}
    </span>
  );
}

/** Each step of the approval with who acted and the exact date and time. */
export function ApprovalTrail({ summary }: { summary: ApprovalSummary }) {
  return (
    <ol className="grid gap-2 text-sm sm:grid-cols-3">
      {summary.steps.map((step) => (
        <li
          key={step.label}
          className={cn(
            "rounded-lg border px-3 py-2",
            step.state === "done" && "border-accent/50 bg-accent/10",
            step.state === "returned" && "border-secondary/40 bg-secondary/10",
            step.state === "pending" && "border-border text-muted-foreground",
          )}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            {step.state === "done" ? (
              <Check className="size-3.5 text-primary" aria-hidden="true" />
            ) : step.state === "returned" ? (
              <X className="size-3.5 text-secondary" aria-hidden="true" />
            ) : (
              <Clock className="size-3.5" aria-hidden="true" />
            )}
            {step.label}
          </p>
          {step.state === "pending" ? (
            <p className="text-xs">Pending</p>
          ) : (
            <>
              {step.by ? <p className="text-xs font-medium">{step.by}</p> : null}
              <p className="text-xs">{formatMoment(step.at) || "—"}</p>
              {step.note ? <p className="mt-0.5 text-xs">{step.note}</p> : null}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
