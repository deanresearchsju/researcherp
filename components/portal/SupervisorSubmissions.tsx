"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { ApprovalBadge, ApprovalTrail } from "@/components/portal/ApprovalTrail";
import { DeskPage, FormDialog, GateBanner, ViewFilesButton } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { submissionSummary } from "@/lib/approval-flow";
import {
  currentDoctoral,
  recommendSubmission,
  subscribeDoctoral,
  type SynopsisSubmission,
  type ThesisSubmission,
} from "@/lib/doctoral";
import { currentOffice, sameId, scholarsStillGuidedBy, subscribeOffice } from "@/lib/office";
import { scholarSignInId } from "@/lib/register";
import { usePortalSession } from "@/lib/use-preview-session";
import { chainViewStamp } from "@/lib/approved-documents";

type Item =
  | { kind: "synopsis"; label: string; row: SynopsisSubmission }
  | { kind: "thesis"; label: string; row: ThesisSubmission };

/**
 * The guide's approval of the synopsis and thesis their scholars submit. An approved document
 * goes on to the Dean; a returned one goes back to the scholar with the guide's remarks. The
 * guide's name, date and time are kept on the document.
 */
export function SupervisorSubmissions() {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [acting, setActing] = useState<{ item: Item; status: "Recommended" | "Returned" } | null>(
    null,
  );
  const [remarks, setRemarks] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ready || !doctoral || !office || !session) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const mine = [
    ...office.allocations
      .filter((item) => sameId(item.supervisorIdentifier, session.identifier))
      .map((item) => item.scholarIdentifier),
    ...scholarsStillGuidedBy(session.name, session.identifier, office.allocations).map(
      (scholar) => scholarSignInId(scholar),
    ),
  ];
  const ofMine = (identifier: string) => mine.some((key) => sameId(key, identifier));
  const items: Item[] = [
    ...doctoral.synopses
      .filter((row) => ofMine(row.scholarIdentifier))
      .map((row) => ({ kind: "synopsis" as const, label: "Synopsis", row })),
    ...doctoral.theses
      .filter((row) => ofMine(row.scholarIdentifier))
      .map((row) => ({ kind: "thesis" as const, label: "Thesis", row })),
  ].sort((left, right) => right.row.createdAt.localeCompare(left.row.createdAt));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acting) return;
    const saved = await recommendSubmission(acting.item.kind, acting.item.row.id, {
      status: acting.status,
      remarks,
    });
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setNotice(
      acting.status === "Recommended"
        ? `${acting.item.row.scholarName}'s ${acting.item.label.toLowerCase()} is approved and sent to the Dean.`
        : `${acting.item.row.scholarName}'s ${acting.item.label.toLowerCase()} is rejected.`,
    );
    setActing(null);
  }

  return (
    <DeskPage kicker="Supervision" title="Synopsis & thesis">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {items.length === 0 ? (
        <GateBanner>No synopsis or thesis from your scholars yet.</GateBanner>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const waiting =
              item.row.status === "Submitted" &&
              item.row.needsSupervisor &&
              item.row.supervisorStatus === "";
            return (
              <li
                key={`${item.kind}-${item.row.id}`}
                className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">
                      {item.row.scholarName} · {item.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.kind === "thesis" ? `${item.row.title} · ` : ""}
                      {item.row.fileName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ViewFilesButton
                      fileName={item.row.fileName}
                      data={item.row.fileData}
                      stamp={chainViewStamp(item.label, item.row)}
                      onMissing={setNotice}
                    />
                    <ApprovalBadge summary={submissionSummary(item.row)} />
                    {waiting ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="gold"
                          onClick={() => {
                            setError(null);
                            setRemarks("");
                            setActing({ item, status: "Recommended" });
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setError(null);
                            setRemarks("");
                            setActing({ item, status: "Returned" });
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <ApprovalTrail summary={submissionSummary(item.row)} />
              </li>
            );
          })}
        </ul>
      )}
      {acting ? (
        <FormDialog
          title={`${acting.status === "Recommended" ? "Approve" : "Reject"} · ${acting.item.row.scholarName}`}
          onClose={() => setActing(null)}
          onSubmit={(event) => void submit(event)}
          submitLabel={
            acting.status === "Recommended" ? "Approve and send to the Dean" : "Reject with comments"
          }
          size="sm"
        >
          {error ? (
            <p role="alert" className="text-sm text-secondary">
              {error}
            </p>
          ) : null}
          <FormField
            label={acting.status === "Recommended" ? "Remarks (optional)" : "Remarks"}
            htmlFor="submission-guide-remarks"
            required={acting.status === "Returned"}
          >
            <Textarea
              id="submission-guide-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </FormField>
        </FormDialog>
      ) : null}
    </DeskPage>
  );
}
