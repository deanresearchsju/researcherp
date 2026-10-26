import { recordAudit } from "@/lib/audit";
import { readPreviewSession } from "@/lib/auth";
import { storageKeys } from "@/lib/constants";
import { clientToday } from "@/lib/dates";
import {
  allocate,
  assignSlot,
  defaultReserved,
  defaultTwoFrom,
  emptyPlan,
  finalise,
  type Duty,
  type InvigilationPlan,
  type InvigilationScope,
  type Invigilator,
  type ReservedDuty,
  type Sitting,
} from "@/lib/invigilation-core";
import { saveJsonBlob } from "@/lib/json-lock";
import { officeViewWriteBlock } from "@/lib/office-view";
import { toJson } from "@/lib/records";
import { createSupabase } from "@/lib/supabase/client";

/* ------------------------------------------------------------------------------------------
 * The invigilators and the duty plans of the entrance test and the course-work examination,
 * kept as one office record (the exam_office table, row "invigilation").
 * ---------------------------------------------------------------------------------------- */

export type InvigilationState = {
  pool: Invigilator[];
  plans: Record<InvigilationScope, InvigilationPlan>;
  updatedAt: string | null;
  detail: string | null;
};

type Stored = Pick<InvigilationState, "pool" | "plans">;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const positive = (value: unknown, fallback: number, min = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min ? number : fallback;
};

function parsePool(value: unknown): Invigilator[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = text(item.id);
    const name = text(item.name);
    if (!id || !name || seen.has(id.toLowerCase())) return [];
    seen.add(id.toLowerCase());
    return [
      {
        id,
        name,
        designation: text(item.designation),
        department: text(item.department),
        phone: text(item.phone),
        unavailable: Array.isArray(item.unavailable)
          ? item.unavailable.filter(
              (day): day is string =>
                typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day),
            )
          : [],
      },
    ];
  });
}

function parsePlan(scope: InvigilationScope, value: unknown): InvigilationPlan {
  const base = emptyPlan(scope);
  if (!value || typeof value !== "object") return base;
  const item = value as Record<string, unknown>;
  const duties: Duty[] = Array.isArray(item.duties)
    ? item.duties.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const duty = entry as Record<string, unknown>;
        const slots = positive(duty.slots, 1, 1);
        const assigned = Array.isArray(duty.assigned)
          ? duty.assigned.map((id) => (typeof id === "string" ? id : ""))
          : [];
        while (assigned.length < slots) assigned.push("");
        return text(duty.date) && text(duty.room)
          ? [
              {
                date: text(duty.date),
                time: text(duty.time),
                venue: text(duty.venue),
                room: text(duty.room),
                strength: positive(duty.strength, 0),
                slots,
                assigned: assigned.slice(0, slots),
              },
            ]
          : [];
      })
    : [];
  const reserved: ReservedDuty[] = Array.isArray(item.reserved)
    ? item.reserved.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        return text(row.invigilatorId) && text(row.date)
          ? [
              {
                date: text(row.date),
                time: text(row.time),
                invigilatorId: text(row.invigilatorId),
              },
            ]
          : [];
      })
    : [];
  return {
    scope,
    twoFrom: positive(item.twoFrom, defaultTwoFrom, 1),
    reservedPerSitting: positive(item.reservedPerSitting, defaultReserved),
    examination: text(item.examination),
    chiefSuperintendent: text(item.chiefSuperintendent),
    duties,
    reserved,
    status: item.status === "Final" ? "Final" : "Draft",
    finalisedOn: text(item.finalisedOn),
    finalisedBy: text(item.finalisedBy),
  };
}

function parseStored(payload: unknown): Stored {
  const item = (payload && typeof payload === "object" ? payload : {}) as Record<
    string,
    unknown
  >;
  const plans = (
    item.plans && typeof item.plans === "object" ? item.plans : {}
  ) as Record<string, unknown>;
  return {
    pool: parsePool(item.pool),
    plans: {
      entrance: parsePlan("entrance", plans.entrance),
      "course-work": parsePlan("course-work", plans["course-work"]),
    },
  };
}

const emptyStored = (): Stored => parseStored({});
const migrationHint =
  "The invigilation record could not be read from the database. It is kept in this browser until the connection works.";

/* ------------------------------------------- store -------------------------------------- */

let memory: InvigilationState | null = null;
let loading = false;
let stamp: string | null = null;
const listeners = new Set<() => void>();

function publish(next: InvigilationState) {
  memory = next;
  listeners.forEach((listener) => listener());
}

function readBrowser(): Stored {
  try {
    const saved = window.localStorage.getItem(storageKeys.invigilation);
    return saved ? parseStored(JSON.parse(saved)) : emptyStored();
  } catch {
    return emptyStored();
  }
}

async function load(): Promise<InvigilationState> {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) return { ...browser, updatedAt: null, detail: null };
  const { data, error } = await supabase
    .from("exam_office")
    .select("payload, updated_at")
    .eq("id", "invigilation")
    .maybeSingle();
  if (error) return { ...browser, updatedAt: null, detail: migrationHint };
  if (!data?.payload) return { ...browser, updatedAt: null, detail: null };
  stamp = data.updated_at ?? null;
  return { ...parseStored(data.payload), updatedAt: stamp, detail: null };
}

export function currentInvigilation() {
  return memory;
}

export function subscribeInvigilation(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    void load().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

async function save(next: Stored) {
  const blocked = officeViewWriteBlock();
  if (blocked) return blocked;
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const saved = await saveJsonBlob("exam_office", "invigilation", toJson(next), stamp);
    if (saved.ok) {
      stamp = saved.updatedAt;
      publish({ ...next, updatedAt: stamp, detail: null });
      return { ok: true as const };
    }
    if (saved.conflict) {
      return { ok: false as const, message: saved.message, conflict: true as const };
    }
  }
  try {
    window.localStorage.setItem(storageKeys.invigilation, JSON.stringify(next));
  } catch {
    return {
      ok: false as const,
      message: "This browser cannot store the invigilation records.",
    };
  }
  publish({ ...next, updatedAt: stamp, detail: memory?.detail ?? migrationHint });
  return { ok: true as const };
}

type Outcome = { ok: true } | { ok: false; message: string };

/** Applies a change to the latest record and saves it; on a clash it reads again and retries. */
async function commit(change: (state: Stored) => string | null): Promise<Outcome> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = memory ?? { ...emptyStored(), updatedAt: null, detail: null };
    const state: Stored = structuredClone({ pool: current.pool, plans: current.plans });
    const problem = change(state);
    if (problem) return { ok: false, message: problem };
    const saved = await save(state);
    if (saved.ok) return { ok: true };
    if (!("conflict" in saved && saved.conflict))
      return { ok: false, message: saved.message };
    publish(await load());
  }
  return {
    ok: false,
    message: "The invigilation records are busy. Try again in a moment.",
  };
}

function who() {
  const session = readPreviewSession();
  return {
    role: session?.role ?? null,
    name: session ? session.name.trim() || session.identifier : "",
  };
}

function officeOnly(): string | null {
  const { role } = who();
  return role === "admin" || role === "staff"
    ? null
    : "Only the Research Office can do this.";
}

/* ----------------------------------------- actions -------------------------------------- */

export async function saveInvigilator(person: Invigilator, replacing: string | null) {
  return commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const id = person.id.trim();
    if (!id || !person.name.trim()) return "Enter the ID and the name.";
    const clash = state.pool.some(
      (item) =>
        item.id.toLowerCase() === id.toLowerCase() &&
        item.id.toLowerCase() !== (replacing ?? "").toLowerCase(),
    );
    if (clash) return "Another invigilator has this ID.";
    const clean = { ...person, id, name: person.name.trim() };
    state.pool = replacing
      ? state.pool.map((item) => (item.id === replacing ? clean : item))
      : [...state.pool, clean];
    if (replacing && replacing !== id) {
      for (const plan of Object.values(state.plans)) {
        plan.duties.forEach((duty) => {
          duty.assigned = duty.assigned.map((value) =>
            value === replacing ? id : value,
          );
        });
        plan.reserved.forEach((item) => {
          if (item.invigilatorId === replacing) item.invigilatorId = id;
        });
      }
    }
    return null;
  });
}

/** Adds many at once (a pasted list or the supervisor register); existing IDs are skipped. */
export async function addInvigilators(people: readonly Invigilator[]) {
  let added = 0;
  const outcome = await commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    added = 0;
    const known = new Set(state.pool.map((item) => item.id.toLowerCase()));
    for (const person of people) {
      const id = person.id.trim();
      if (!id || !person.name.trim() || known.has(id.toLowerCase())) continue;
      known.add(id.toLowerCase());
      state.pool.push({ ...person, id, name: person.name.trim() });
      added += 1;
    }
    return null;
  });
  return { ...outcome, added };
}

export async function removeInvigilator(id: string) {
  return commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const used = Object.values(state.plans).some(
      (plan) =>
        plan.duties.some((duty) => duty.assigned.includes(id)) ||
        plan.reserved.some((item) => item.invigilatorId === id),
    );
    if (used)
      return "This invigilator has duties in a plan. Take them off the plan first.";
    state.pool = state.pool.filter((item) => item.id !== id);
    return null;
  });
}

export async function savePlanSettings(
  scope: InvigilationScope,
  values: Pick<
    InvigilationPlan,
    "twoFrom" | "reservedPerSitting" | "examination" | "chiefSuperintendent"
  >,
) {
  return commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const plan = state.plans[scope];
    if (plan.status === "Final") return "The plan is final. Reopen it first.";
    if (!Number.isInteger(values.twoFrom) || values.twoFrom < 1) {
      return "Two invigilators from: enter a number of candidates, 1 or more.";
    }
    if (!Number.isInteger(values.reservedPerSitting) || values.reservedPerSitting < 0) {
      return "Reserved invigilators: enter 0 or more.";
    }
    state.plans[scope] = { ...plan, ...values };
    return null;
  });
}

/** Builds the plan afresh from the rooms and seated candidates. Returns shortages to show. */
export async function autoAllot(scope: InvigilationScope, sittings: readonly Sitting[]) {
  let shortages: string[] = [];
  const outcome = await commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const plan = state.plans[scope];
    if (plan.status === "Final") return "The plan is final. Reopen it first.";
    if (sittings.length === 0) return "There are no rooms with seated candidates yet.";
    if (state.pool.length === 0) return "Add the invigilators first.";
    const result = allocate(sittings, state.pool, plan);
    shortages = result.shortages;
    state.plans[scope] = { ...plan, duties: result.duties, reserved: result.reserved };
    return null;
  });
  return { ...outcome, shortages };
}

export async function setSlot(
  scope: InvigilationScope,
  dutyIndex: number,
  slot: number,
  invigilatorId: string,
) {
  return commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const result = assignSlot(
      state.plans[scope],
      state.pool,
      dutyIndex,
      slot,
      invigilatorId,
    );
    if ("error" in result) return result.error;
    state.plans[scope] = result.plan;
    return null;
  });
}

export async function setReserved(
  scope: InvigilationScope,
  date: string,
  time: string,
  index: number,
  invigilatorId: string,
) {
  return commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const plan = state.plans[scope];
    if (plan.status === "Final") return "The plan is final. Reopen it first.";
    const mine = plan.reserved
      .map((item, at) => ({ item, at }))
      .filter(({ item }) => item.date === date && item.time === time);
    const target = mine[index];
    if (!target) return "That reserved place does not exist.";
    if (!invigilatorId) {
      plan.reserved = plan.reserved.filter((_, at) => at !== target.at);
      return null;
    }
    const person = state.pool.find((item) => item.id === invigilatorId);
    if (!person) return "Choose an invigilator from the list.";
    if (person.unavailable.includes(date))
      return `${person.name} is not available on ${date}.`;
    const busy =
      plan.duties.some(
        (duty) =>
          duty.date === date &&
          duty.time === time &&
          duty.assigned.includes(invigilatorId),
      ) ||
      plan.reserved.some(
        (item, at) =>
          at !== target.at &&
          item.date === date &&
          item.time === time &&
          item.invigilatorId === invigilatorId,
      );
    if (busy) return `${person.name} is already on duty in that sitting.`;
    plan.reserved = plan.reserved.map((item, at) =>
      at === target.at ? { ...item, invigilatorId } : item,
    );
    return null;
  });
}

export async function finalisePlan(scope: InvigilationScope) {
  let summary = "";
  const outcome = await commit((state) => {
    const denied = officeOnly();
    if (denied) return denied;
    const plan = state.plans[scope];
    if (plan.status === "Final") return "The plan is already final.";
    if (!plan.chiefSuperintendent.trim())
      return "Enter the Chief Superintendent's name first.";
    if (!plan.examination.trim())
      return "Enter the examination heading for the letters first.";
    const result = finalise(plan, state.pool, who().name, clientToday());
    if ("error" in result) return result.error;
    state.plans[scope] = result.plan;
    summary = `${plan.duties.length} room(s), ${plan.reserved.length} reserved`;
    return null;
  });
  if (outcome.ok) {
    await recordAudit({
      action: "invigilation:finalised",
      subject: scope,
      detail: summary,
    });
  }
  return outcome;
}

export async function reopenPlan(scope: InvigilationScope) {
  const outcome = await commit((state) => {
    if (who().role !== "admin") return "Only the administrator can reopen a final plan.";
    const plan = state.plans[scope];
    state.plans[scope] = { ...plan, status: "Draft", finalisedBy: "", finalisedOn: "" };
    return null;
  });
  if (outcome.ok) {
    await recordAudit({
      action: "invigilation:reopened",
      subject: scope,
      detail: "Plan reopened",
    });
  }
  return outcome;
}
