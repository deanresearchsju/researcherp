"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskPage, DeskSection } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import {
  approvalItems,
  chainText,
  currentApprovalRules,
  saveApprovalRules,
  rulesProblem,
  stageApplies,
  stageNames,
  stageOrder,
  subscribeApprovalRules,
  type ApprovalItem,
  type ApprovalStage,
  type RuleChoice,
} from "@/lib/approval-rules";
import { formatMoment } from "@/lib/approval-flow";
import { usePreviewSession } from "@/lib/use-preview-session";

const stages: { id: ApprovalStage; label: string }[] = [
  { id: "supervisor", label: "Supervisor" },
  { id: "dean", label: "Dean" },
  { id: "vc", label: "Vice Chancellor" },
];

function Cell({
  item,
  stage,
  checked,
  editable,
  onChange,
}: {
  item: ApprovalItem;
  stage: ApprovalStage;
  checked: boolean;
  editable: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={`${item.label}: ${stageNames[stage]}`}
      className="size-4"
      checked={checked}
      disabled={!editable}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

/**
 * Who approves what. Each request is a row; the steps it goes through are ticked. The Dean's
 * step is always there. A change applies to requests made after it is saved.
 */
export function ApprovalRulesScreen() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const load = useSyncExternalStore(
    subscribeApprovalRules,
    currentApprovalRules,
    () => null,
  );
  const [draft, setDraft] = useState<Record<string, RuleChoice> | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready || !load) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const editable = session?.role === "admin";
  const rules = draft ?? load.rules;
  const changed = draft !== null;
  const groups = [...new Set(approvalItems.map((item) => item.group))];

  function set(item: ApprovalItem, stage: ApprovalStage, value: boolean) {
    setNotice("");
    setDraft((current) => ({
      ...(current ?? load?.rules ?? {}),
      [item.id]: { ...(current ?? load?.rules ?? {})[item.id], [stage]: value },
    }));
  }

  /** What the ticks changed, in words, for the log. */
  function describe() {
    const lines: string[] = [];
    for (const item of approvalItems) {
      const before = chainText(load?.rules ?? {}, item.id);
      const after = chainText(rules, item.id);
      if (before !== after) lines.push(`${item.label}: ${before} → ${after}`);
    }
    return lines.join("; ");
  }

  async function save() {
    const text = describe();
    if (!text) {
      setDraft(null);
      return;
    }
    const problem = rulesProblem(rules);
    if (problem) return setNotice(problem);
    setBusy(true);
    const saved = await saveApprovalRules(rules, text);
    setBusy(false);
    if (!saved.ok) return setNotice(saved.message);
    setDraft(null);
    setNotice("Saved. It applies to requests made from now on.");
  }

  return (
    <DeskPage kicker="Administration" title="Approval rules">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Tick, for each request, the steps it goes through. The Dean&apos;s step is always
        there. A change applies to requests made after you save it: a request already on
        its way keeps the steps it started with. For the RAC, switch off the Vice
        Chancellor to end with the Dean&apos;s approval (a nomination already with the
        Vice Chancellor can then be finished by the Dean).
      </p>
      {!editable ? (
        <p className="text-sm font-medium text-secondary">
          Only the administrator changes the rules; you can read them here.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {load.detail ? <p className="text-sm text-secondary">{load.detail}</p> : null}
      {groups.map((group) => (
        <DeskSection key={group} title={group}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2">Request</th>
                  <th className="w-24 px-3 py-2 text-center">Supervisor</th>
                  <th className="w-20 px-3 py-2 text-center">Dean</th>
                  <th className="w-28 px-3 py-2 text-center">Vice Chancellor</th>
                  <th className="px-4 py-2">The steps now</th>
                </tr>
              </thead>
              <tbody>
                {approvalItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <tr key={item.id} className="border-t border-border align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary">{item.label}</p>
                        <p className="max-w-md text-xs leading-5 text-muted-foreground">
                          {item.detail}
                        </p>
                      </td>
                      {stages.map((stage) => (
                        <td key={stage.id} className="px-3 py-3 text-center">
                          <Cell
                            item={item}
                            stage={stage.id}
                            checked={stageApplies(rules, item.id, stage.id)}
                            editable={editable}
                            onChange={(value) => set(item, stage.id, value)}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-xs leading-5">
                        <p className="font-semibold text-primary">
                          {chainText(rules, item.id)}
                        </p>
                        {stageOrder.some(
                          (stage) =>
                            stageApplies(rules, item.id, stage) !== item.usual[stage],
                        ) ? (
                          <p className="text-secondary">Not the usual steps</p>
                        ) : (
                          <p className="text-muted-foreground">The usual steps</p>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DeskSection>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="gold"
          disabled={!editable || !changed || busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save the rules"}
        </Button>
        {changed ? (
          <Button type="button" variant="outline" onClick={() => setDraft(null)}>
            Undo my ticks
          </Button>
        ) : null}
      </div>
      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        Fixed steps, not listed above: NPTEL courses and the subjects of the course work
        go to the Dean; fees are checked by Accounts; marks are entered and verified by
        the Controllers of Examinations.
      </p>
      {load.changes.length > 0 ? (
        <DeskSection title="Earlier changes">
          <ul className="divide-y divide-border text-sm">
            {load.changes.slice(0, 15).map((change, index) => (
              <li key={`${change.at}-${index}`} className="px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {formatMoment(change.at)} · {change.by}
                </p>
                <p>{change.text}</p>
              </li>
            ))}
          </ul>
        </DeskSection>
      ) : null}
    </DeskPage>
  );
}
