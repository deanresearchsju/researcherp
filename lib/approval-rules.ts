import { scholarRecordMenus } from "@/data/scholar-records";
import { adminActionBlock } from "@/lib/access";
import { readPreviewSession } from "@/lib/auth";
import { saveJsonBlob } from "@/lib/json-lock";
import { createSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

/**
 * Who approves what. The research office ticks, for each request, the steps it goes through
 * (the Supervisor, the Dean, the Vice Chancellor, in that order), so a change of rule (the Dean
 * decides alone this semester, the Vice Chancellor joins from the next) is a tick on the
 * Approval rules screen and not a change of the program. The last step ticked gives the final
 * approval; the steps before it recommend. A rule applies to requests made after it is saved: a
 * request already on its way keeps the steps it started with.
 */
export type ApprovalStage = "supervisor" | "dean" | "vc";

export const stageOrder: readonly ApprovalStage[] = ["supervisor", "dean", "vc"];

export const stageNames: Record<ApprovalStage, string> = {
  supervisor: "Supervisor",
  dean: "Dean",
  vc: "Vice Chancellor",
};

export type ApprovalItem = {
  id: string;
  label: string;
  group: string;
  /** What the request is, in a few words. */
  detail: string;
  /** The steps ticked when nothing has been changed. */
  usual: Record<ApprovalStage, boolean>;
};

const doctoral = "Doctoral progress";
const usualSteps = { supervisor: true, dean: true, vc: false };

export const approvalItems: readonly ApprovalItem[] = [
  {
    id: "rac",
    label: "RAC",
    group: doctoral,
    detail:
      "The Supervisor names the members; the Dean (or, without the Dean, the Vice Chancellor) selects them; the last step gives the final approval.",
    usual: { supervisor: true, dean: true, vc: true },
  },
  {
    id: "committee",
    label: "Doctoral committee reports",
    group: doctoral,
    detail: "First, second, third and fourth doctoral committee.",
    usual: usualSteps,
  },
  {
    id: "synopsis",
    label: "Synopsis",
    group: doctoral,
    detail: "The synopsis a scholar submits.",
    usual: usualSteps,
  },
  {
    id: "thesis",
    label: "Ph.D. thesis",
    group: doctoral,
    detail: "The thesis a scholar submits.",
    usual: usualSteps,
  },
  ...scholarRecordMenus
    .filter((menu) => menu.needsSupervisor)
    .map((menu): ApprovalItem => ({
      id: `record:${menu.kind}`,
      label: menu.label,
      group: "Scholar requests",
      detail: menu.summary,
      usual: usualSteps,
    })),
];

export type RuleChoice = Partial<Record<ApprovalStage, boolean>>;
export type RuleChange = { at: string; by: string; text: string };

export type RulesLoad = {
  rules: Record<string, RuleChoice>;
  changes: RuleChange[];
  updatedAt: string | null;
  detail: string | null;
};

const rowId = "approval_rules";
const empty: RulesLoad = { rules: {}, changes: [], updatedAt: null, detail: null };

export function itemById(id: string) {
  return approvalItems.find((item) => item.id === id);
}

/** True when the request goes through this step, today. Unlisted requests keep their usual steps. */
export function stageApplies(
  rules: Record<string, RuleChoice>,
  id: string,
  stage: ApprovalStage,
) {
  const item = itemById(id);
  if (!item) return stage === "supervisor" || stage === "dean";
  return rules[id]?.[stage] ?? item.usual[stage];
}

/** The steps of a request, in order. */
export function chainOf(rules: Record<string, RuleChoice>, id: string): ApprovalStage[] {
  return stageOrder.filter((stage) => stageApplies(rules, id, stage));
}

/** The steps of a request, in plain words. */
export function chainText(rules: Record<string, RuleChoice>, id: string) {
  const chain = chainOf(rules, id);
  if (chain.length === 0) return "No step ticked";
  return chain
    .map((stage, index) => {
      if (id === "rac") {
        if (stage === "supervisor") return "Supervisor names the members";
        if (index === chain.findIndex((entry) => entry !== "supervisor")) {
          return `${stageNames[stage]} selects`;
        }
      }
      return stageNames[stage];
    })
    .join(" → ");
}

/** Why the ticked steps cannot be saved; null when they can. */
export function rulesProblem(rules: Record<string, RuleChoice>) {
  for (const item of approvalItems) {
    const chain = chainOf(rules, item.id);
    if (chain.length === 0) return `${item.label}: tick at least one step.`;
    if (item.id === "rac" && !chain.includes("dean") && !chain.includes("vc")) {
      return "RAC: the Dean or the Vice Chancellor has to select the members.";
    }
  }
  return null;
}

/** The step a request waits at: the first of its steps not yet done; null when all are done. */
export function nextStage(
  chain: readonly ApprovalStage[],
  done: readonly ApprovalStage[],
) {
  return chain.find((stage) => !done.includes(stage)) ?? null;
}

/** Whether a sign-in of this role acts at the step (the administrator acts at every step). */
export function mayAct(role: string | undefined, stage: ApprovalStage | null) {
  if (!stage || !role) return false;
  if (role === "admin") return true;
  return (
    (stage === "supervisor" && role === "supervisor") ||
    (stage === "dean" && role === "dean") ||
    (stage === "vc" && role === "vc")
  );
}

function parse(value: unknown): Pick<RulesLoad, "rules" | "changes"> {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const rules: Record<string, RuleChoice> = {};
  const source =
    row.rules && typeof row.rules === "object" && !Array.isArray(row.rules)
      ? (row.rules as Record<string, unknown>)
      : {};
  for (const item of approvalItems) {
    const choice = source[item.id];
    if (!choice || typeof choice !== "object") continue;
    const entry = choice as Record<string, unknown>;
    rules[item.id] = Object.fromEntries(
      stageOrder.flatMap((stage) =>
        typeof entry[stage] === "boolean" ? [[stage, entry[stage]]] : [],
      ),
    ) as RuleChoice;
  }
  const changes = Array.isArray(row.changes)
    ? row.changes.flatMap((entry): RuleChange[] => {
        if (!entry || typeof entry !== "object") return [];
        const change = entry as Record<string, unknown>;
        return typeof change.text === "string"
          ? [
              {
                at: typeof change.at === "string" ? change.at : "",
                by: typeof change.by === "string" ? change.by : "",
                text: change.text,
              },
            ]
          : [];
      })
    : [];
  return { rules, changes: changes.slice(0, 60) };
}

export async function loadApprovalRules(): Promise<RulesLoad> {
  const supabase = createSupabase();
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("exam_office")
    .select("payload, updated_at")
    .eq("id", rowId)
    .maybeSingle();
  if (error) {
    return {
      ...empty,
      detail: "The approval rules could not be read; the usual steps apply.",
    };
  }
  if (!data) return empty;
  return { ...parse(data.payload), updatedAt: data.updated_at ?? null, detail: null };
}

let memory: RulesLoad | null = null;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: RulesLoad) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function subscribeApprovalRules(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    void loadApprovalRules().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

/** Puts rules in memory without saving them (what the tests use in place of the database). */
export function setApprovalRulesInMemory(rules: Record<string, RuleChoice>) {
  publish({ ...empty, rules });
}

export function currentApprovalRules() {
  return memory;
}

/** The steps a request made now goes through (the usual steps until the rules are read). */
export function approvalChain(id: string) {
  return chainOf(memory?.rules ?? {}, id);
}

/** Whether a request made now goes through the step (the usual steps until the rules are read). */
export function approvalNeeds(id: string, stage: ApprovalStage) {
  return stageApplies(memory?.rules ?? {}, id, stage);
}

/** The rules as ticked on the screen, saved for every sign-in. */
export async function saveApprovalRules(
  rules: Record<string, RuleChoice>,
  changeText: string,
) {
  const blocked = adminActionBlock();
  if (blocked) return blocked;
  const problem = rulesProblem(rules);
  if (problem) return { ok: false as const, message: problem };
  const signer = readPreviewSession();
  const by = signer ? signer.name.trim() || signer.identifier : "";
  const current = memory ?? (await loadApprovalRules());
  const changes = [
    { at: new Date().toISOString(), by, text: changeText },
    ...current.changes,
  ].slice(0, 60);
  const saved = await saveJsonBlob(
    "exam_office",
    rowId,
    { rules, changes } as unknown as Json,
    current.updatedAt,
  );
  if (!saved.ok) return { ok: false as const, message: saved.message };
  publish({ rules, changes, updatedAt: saved.updatedAt, detail: null });
  return { ok: true as const };
}
