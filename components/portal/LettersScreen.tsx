"use client";

import { Download, FilePen, FileText } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskTabs, PageTitle } from "@/components/portal/Desk";
import { LetterComposer } from "@/components/portal/LetterComposer";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  admissionCaseForIdentifier,
  archivedKeys,
  currentAdmission,
  approvalState,
  displayName,
  isLiveAdmissionCase,
  provisionalOrder,
  recordProvisionalLetter,
  subscribeAdmission,
  type AdmissionState,
} from "@/lib/admission";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  currentDoctoral,
  issueLetter,
  latestCommittee,
  latestThesis,
  letterFor,
  letterKinds,
  letterName,
  subscribeDoctoral,
  type DoctoralState,
  type IssuedLetter,
  type LetterDraft,
  type LetterKind,
} from "@/lib/doctoral";
import { downloadLetter, type LetterSigner } from "@/lib/letter-pdf";
import {
  completionDraft,
  confirmationDraft,
  provisionalDraft,
  recognitionDraft,
  vivaDraft,
} from "@/lib/letter-templates";
import { currentApplications, subscribeApplications } from "@/lib/records";
import { scholarBySignIn } from "@/lib/register";
import { scholarIdentity } from "@/lib/scholar-identity";

type Row = {
  key: string;
  kind: LetterKind;
  sourceId: string;
  name: string;
  detail: string;
  approvedOn: string;
  letter: IssuedLetter | null;
  /** The pre-filled letter for this approval. */
  draft: () => LetterDraft;
};

const tabLabels: Record<LetterKind, string> = {
  provisional: "Provisional selection",
  confirmation: "Confirmation",
  recognition: "Supervisor recognition",
  viva: "Viva communication",
  completion: "Ph.D. completion",
};

export function useLetterSigner(kind?: LetterKind): LetterSigner {
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  return {
    name: admission?.letter.deanName ?? "",
    title:
      kind === "provisional"
        ? (admission?.letter.deanTitle ?? "Dean Research")
        : "Dean Research",
    signature: admission?.progress.entrance.deanSignature || undefined,
  };
}

function subjectOf(doctoral: DoctoralState, identifier: string) {
  return (
    scholarBySignIn(identifier)?.department ||
    doctoral.enrollments.find((item) => item.scholarIdentifier === identifier)?.school ||
    admissionCaseForIdentifier(identifier, currentAdmission()?.cases ?? [])?.department ||
    ""
  );
}

function rowsFor(
  kind: LetterKind,
  doctoral: DoctoralState,
  admission: AdmissionState | null,
  today: string,
): Row[] {
  if (kind === "provisional") {
    if (!admission) return [];
    const keys = archivedKeys(admission.archived);
    const selected = provisionalOrder(
      admission.cases.filter((row) => isLiveAdmissionCase(row, keys)),
    );
    return selected.map((row, index) => ({
      key: row.applicationId,
      kind,
      sourceId: row.applicationId,
      name: displayName(row),
      detail: `${row.applicationNo} · ${row.department}`,
      approvedOn: row.letterIssuedOn,
      letter: letterFor(doctoral, kind, row.applicationId),
      draft: () => provisionalDraft(row, admission.letter, index + 1, today),
    }));
  }
  if (kind === "confirmation") {
    const approved = new Map<string, (typeof doctoral.committees)[number]>();
    for (const report of doctoral.committees) {
      if (report.kind !== "second" || report.status !== "Approved") continue;
      if (latestCommittee(doctoral, "second", report.scholarIdentifier)?.id !== report.id)
        continue;
      approved.set(report.scholarIdentifier.toLowerCase(), report);
    }
    return [...approved.values()].map((report) => {
      const admissionRow = admissionCaseForIdentifier(
        report.scholarIdentifier,
        admission?.cases ?? [],
      );
      const scholar = scholarBySignIn(report.scholarIdentifier);
      return {
        key: report.id,
        kind,
        sourceId: report.id,
        name: report.scholarName,
        detail: subjectOf(doctoral, report.scholarIdentifier),
        approvedOn: report.decidedOn,
        letter: letterFor(doctoral, kind, report.id),
        draft: () =>
          confirmationDraft({
            doctoral,
            sourceId: report.id,
            identifier: report.scholarIdentifier,
            name: report.scholarName,
            subject: subjectOf(doctoral, report.scholarIdentifier),
            provisionalRef:
              admissionRow?.letterNo && admission
                ? `${admission.letter.refPrefix}/${String(admissionRow.letterNo).padStart(2, "0")}`
                : scholar?.applicationNumber || admissionRow?.applicationNo || "",
            provisionalOn: admissionRow?.letterIssuedOn || "",
            today,
          }),
      };
    });
  }
  if (kind === "recognition") {
    const applications = (currentApplications() ?? []).filter(
      (item) => item.kind === "supervisor" && item.status === "Approved",
    );
    return applications.map((application) => ({
      key: application.id,
      kind,
      sourceId: application.id,
      name: application.applicantName,
      detail: application.applicationNo,
      approvedOn: application.createdAt.slice(0, 10),
      letter: letterFor(doctoral, kind, application.id),
      draft: () => recognitionDraft(doctoral, application, today),
    }));
  }
  const vivas = doctoral.vivas.filter((viva) =>
    kind === "completion" ? viva.status === "Passed" : viva.status !== "Failed",
  );
  return vivas.map((viva) => {
    const subject = subjectOf(doctoral, viva.scholarIdentifier);
    const supervisor = scholarIdentity(viva.scholarIdentifier).supervisorName;
    const title = latestThesis(doctoral, viva.scholarIdentifier)?.title ?? "";
    const input = {
      doctoral,
      viva,
      subject,
      title,
      supervisor: supervisor === "—" ? "" : supervisor,
      today,
    };
    return {
      key: viva.id,
      kind,
      sourceId: viva.id,
      name: viva.scholarName,
      detail: `${viva.scheduledOn ? formatIsoDate(viva.scheduledOn) : "Date to be fixed"} · ${viva.venue || "Venue to be fixed"}`,
      approvedOn: viva.scheduledOn,
      letter: letterFor(doctoral, kind, viva.id),
      draft: () => (kind === "completion" ? completionDraft(input) : vivaDraft(input)),
    };
  });
}

export function LettersScreen({ only }: { only?: LetterKind }) {
  const ready = useClientReady();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  useSyncExternalStore(subscribeApplications, currentApplications, () => null);
  const [tab, setTab] = useState<LetterKind>(only ?? "provisional");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [composing, setComposing] = useState<{
    draft: LetterDraft;
    reissue: boolean;
  } | null>(null);
  const kind = only ?? tab;
  const signer = useLetterSigner(kind);

  if (!ready || !doctoral)
    return <p className="text-sm text-muted-foreground">Loading letters…</p>;

  const today = clientToday();
  const rows = rowsFor(kind, doctoral, admission, today);
  // Provisional letters wait for the Research Advisory Board / Vice Chancellor approval.
  const awaitingApproval =
    kind === "provisional" &&
    admission !== null &&
    approvalState(
      admission.progress,
      admission.cases.filter(
        (row) =>
          isLiveAdmissionCase(row, archivedKeys(admission.archived)) &&
          !row.sessionClosed,
      ),
    ) !== "approved";
  const shown = rows.filter(
    (row) =>
      filterMatches(status, row.letter ? "Issued" : "Ready to issue") &&
      textMatches(query, [row.name, row.detail, row.letter?.refNo ?? ""]),
  );
  const counts = Object.fromEntries(
    letterKinds.map((item) => {
      const list = rowsFor(item, doctoral, admission, today);
      return [item, list.filter((row) => !row.letter).length];
    }),
  ) as Record<LetterKind, number>;

  async function issue(draft: LetterDraft) {
    const saved = await issueLetter(draft);
    if (!saved.ok) return { ok: false, message: saved.message };
    if (draft.kind === "provisional") {
      await recordProvisionalLetter(draft.sourceId, draft.issuedOn);
    }
    setComposing(null);
    setNotice(
      `${letterName(draft.kind)} ${draft.refNo} issued to ${draft.recipientName}.`,
    );
    return { ok: true };
  }

  const table = (
    <div className="space-y-3">
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "status",
            label: "Status",
            value: status,
            options: ["Ready to issue", "Issued"].map((value) => ({
              value,
              label: value,
            })),
            onChange: setStatus,
          },
        ]}
        shown={shown.length}
        total={rows.length}
        filename={`${kind}-letters.csv`}
        title={letterName(kind)}
        headers={["Name", "Details", "Status", "Reference", "Issued on", "Issued by"]}
        rows={shown.map((row) => [
          row.name,
          row.detail,
          row.letter ? "Issued" : "Ready to issue",
          row.letter?.refNo ?? "",
          row.letter ? formatIsoDate(row.letter.issuedOn) : "",
          row.letter?.issuedBy ?? "",
        ])}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              {["Name", "Letter", ""].map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  {rows.length === 0
                    ? "Nothing is approved for this letter yet."
                    : "Nothing matches these filters."}
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr key={row.key} className="border-t border-border align-middle">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.detail}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.letter ? (
                      <div>
                        <Badge variant="gold">Issued</Badge>
                        <p className="mt-1 font-mono text-xs">{row.letter.refNo}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatIsoDate(row.letter.issuedOn)}
                          {row.letter.issuedBy ? ` · ${row.letter.issuedBy}` : ""}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="purple">Ready to issue</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.letter ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-readonly-allow
                            onClick={() => void downloadLetter(row.letter!, signer)}
                          >
                            <Download className="size-4" aria-hidden="true" />
                            Download
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNotice(null);
                              setComposing({ draft: { ...row.letter! }, reissue: true });
                            }}
                          >
                            <FilePen className="size-4" aria-hidden="true" />
                            Correct
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="gold"
                          disabled={awaitingApproval}
                          title={
                            awaitingApproval
                              ? "The list must be approved by the Research Advisory Board or the Vice Chancellor first."
                              : undefined
                          }
                          onClick={() => {
                            setNotice(null);
                            setComposing({ draft: row.draft(), reissue: false });
                          }}
                        >
                          <FileText className="size-4" aria-hidden="true" />
                          Prepare letter
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="space-y-5">
      {only ? null : <PageTitle kicker="Center for Research" title="Letters" />}
      {awaitingApproval ? (
        <p
          role="status"
          className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-2 text-sm font-medium text-secondary"
        >
          Provisional letters open after the Research Advisory Board or the Vice
          Chancellor approves the list (Selection, Guide step).
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}
      {only ? null : (
        <DeskTabs
          tabs={letterKinds.map((item) => ({
            id: item,
            label: `${tabLabels[item]}${counts[item] ? ` (${counts[item]})` : ""}`,
          }))}
          value={tab}
          onChange={(id) => {
            setTab(id as LetterKind);
            setQuery("");
            setStatus("");
          }}
        />
      )}
      {table}
      {composing ? (
        <LetterComposer
          key={`${composing.draft.kind}-${composing.draft.sourceId}`}
          draft={composing.draft}
          signer={signer}
          reissue={composing.reissue}
          onClose={() => setComposing(null)}
          onIssue={issue}
        />
      ) : null}
    </section>
  );
}
