"use client";

import { useEffect, useState } from "react";

import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import {
  activeIndex,
  evaluatorGroupLabel,
  evaluatorGroups,
  type EvaluationRecord,
  type Evaluator,
  type EvaluatorGroup,
  type SupervisorEvaluationView,
} from "@/lib/thesis-evaluation-model";

type Result = { ok: true } | { ok: false; message: string };

async function call(body: Record<string, unknown>): Promise<Result> {
  try {
    const response = await fetch("/api/thesis-evaluators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
    } | null;
    if (response.ok && payload?.ok) return { ok: true };
    return { ok: false, message: payload?.message ?? "That change could not be saved." };
  } catch {
    return { ok: false, message: "The server could not be reached." };
  }
}

export type EvaluationLoad =
  | { ok: true; role: "office"; records: EvaluationRecord[] }
  | { ok: true; role: "supervisor"; records: SupervisorEvaluationView[] }
  | { ok: false; message: string };

export async function loadEvaluations(): Promise<EvaluationLoad> {
  try {
    const response = await fetch("/api/thesis-evaluators", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as EvaluationLoad | null;
    if (payload && "ok" in payload) return payload;
    return { ok: false, message: "The evaluator list could not be loaded." };
  } catch {
    return { ok: false, message: "The server could not be reached." };
  }
}

export function nominateEvaluators(input: {
  scholarIdentifier: string;
  scholarName: string;
  title: string;
  domain: string;
  nominees: Record<EvaluatorGroup, Evaluator[]>;
}) {
  return call({ action: "nominate", ...input });
}

export function selectEvaluators(
  scholarIdentifier: string,
  order: Record<EvaluatorGroup, number[]>,
) {
  return call({ action: "select", scholarIdentifier, order });
}

export function recordInvitation(
  scholarIdentifier: string,
  group: EvaluatorGroup,
  status: "Invited" | "Accepted" | "Declined",
  note = "",
) {
  return call({ action: "invite", scholarIdentifier, group, status, note });
}

export function reopenNominations(scholarIdentifier: string) {
  return call({ action: "reopen", scholarIdentifier });
}

/** A mailto link for the office to invite the evaluator from its own mail account. */
export function invitationMailto(record: EvaluationRecord, evaluator: Evaluator) {
  const subject = `Invitation to evaluate a Ph.D. thesis — ${university.name}`;
  const body = [
    `Dear ${evaluator.designation ? `${evaluator.designation} ` : ""}${evaluator.name},`,
    "",
    `${university.name}, ${university.researchOffice}, invites you to evaluate a Ph.D. thesis.`,
    "",
    `Title: ${record.title}`,
    `Domain: ${record.domain}`,
    "",
    "Kindly let us know whether you are able to accept this evaluation.",
    "",
    "Regards,",
    "Dean Research",
    university.name,
    university.email,
  ].join("\n");
  return `mailto:${encodeURIComponent(evaluator.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Confidential PDF for the administrator and the Dean: scholar, title, domain and the evaluators in order. */
export async function downloadEvaluatorSheet(record: EvaluationRecord) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const left = 16;
  const width = 178;
  let y = 18;

  const line = (text: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const rows = doc.splitTextToSize(text, width) as string[];
    for (const row of rows) {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(row, left, y);
      y += size * 0.5;
    }
  };

  line(university.name, 14, true);
  line(university.researchOffice, 11);
  y += 2;
  line("CONFIDENTIAL — Thesis evaluation panel", 12, true);
  line("For the Dean and the administrator only.", 9);
  y += 4;
  line(`Scholar: ${record.scholarName}`, 10, true);
  line(`Title: ${record.title}`);
  line(`Domain: ${record.domain}`);
  line(`Supervisor: ${record.supervisorName}`);
  if (record.selectedOn) {
    line(`Selected by ${record.selectedBy} on ${formatIsoDate(record.selectedOn)}`, 9);
  }
  y += 4;

  for (const group of evaluatorGroups) {
    const panel = record.selection?.[group];
    const order = panel?.order.length
      ? panel.order
      : record.nominees[group].map((_, i) => i);
    const current = panel ? activeIndex(panel) : null;
    line(`${evaluatorGroupLabel[group]} evaluator`, 11, true);
    order.forEach((index, rank) => {
      const person = record.nominees[group][index];
      if (!person) return;
      const invite = panel?.invites[index];
      const state = invite
        ? `${invite.status}${invite.invitedOn ? ` · invited ${formatIsoDate(invite.invitedOn)}` : ""}${invite.respondedOn ? ` · replied ${formatIsoDate(invite.respondedOn)}` : ""}`
        : "";
      line(
        `${rank + 1}. ${person.name}${index === current ? "  (current)" : ""}`,
        10,
        index === current,
      );
      line(
        [person.designation, person.institution, person.address]
          .filter(Boolean)
          .join(", "),
        9,
      );
      line(
        [person.email, person.phone, person.specialization].filter(Boolean).join(" · "),
        9,
      );
      if (state) line(state, 9);
      y += 1.5;
    });
    y += 3;
  }

  line(`Printed ${formatIsoDate(new Date().toISOString().slice(0, 10))}`, 8);
  const safe = record.scholarName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`thesis-evaluators-${safe || "scholar"}.pdf`);
}

/** Office-only: the confidential panels, loaded once per screen. Empty for anyone else. */
export function useEvaluationPanels(enabled: boolean) {
  const [records, setRecords] = useState<EvaluationRecord[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadEvaluations().then((load) => {
      if (live) setRecords(load.ok && load.role === "office" ? load.records : []);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return enabled ? records : [];
}

/** Names of the evaluators who accepted, by group, for one scholar. */
export function acceptedEvaluators(
  records: readonly EvaluationRecord[] | null,
  scholarIdentifier: string,
): Record<EvaluatorGroup, string> {
  const record = records?.find(
    (item) => item.scholarKey === scholarIdentifier.trim().toLowerCase(),
  );
  const names = { indian: "", foreign: "", local: "" } as Record<EvaluatorGroup, string>;
  if (!record?.selection) return names;
  for (const group of evaluatorGroups) {
    const panel = record.selection[group];
    const index = activeIndex(panel);
    if (index !== null && panel.invites[index]?.status === "Accepted") {
      names[group] = record.nominees[group][index]?.name ?? "";
    }
  }
  return names;
}
