import {
  researchRegister,
  type ResearchScholar,
  type ResearchSupervisor,
} from "@/data/research-register";
import { adminActionBlock, officeWriteBlock, registrationWriteBlock } from "@/lib/access";
import { storageKeys, studyModes } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { saveJsonBlob } from "@/lib/json-lock";
import {
  parseSupervisorStandings,
  supervisorIsActive,
  type SupervisorStanding,
} from "@/lib/portal-access";
import { toJson } from "@/lib/records";

export const registerMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013230000_research_register.sql. Until then, allotted registration numbers stay in this browser.";

export type RegistrationAllotment = {
  scholarId: string;
  registrationNumber: string;
};

export type ApprovedQuota = {
  name: string;
  quota: number;
  department: string;
  designation: string;
};

export type GuideAllotment = {
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
};

/** A supervisor leaving: scholars are transferred first, then the supervisor becomes past. */
export type SupervisorExit = {
  key: string;
  name: string;
  reason: "Resignation" | "Retirement" | "Other";
  lastDay: string;
  startedOn: string;
  /** Set when every scholar has been transferred and the supervisor moved to past supervisors. */
  completedOn: string;
};

/** A scholar who has passed the viva and left the active rolls. */
export type PassedOutScholar = {
  key: string;
  name: string;
  supervisorName: string;
  vivaOn: string;
  movedOn: string;
  movedBy: string;
};

/** A fee reminder the office shows on a scholar's home page until the fee year is paid. */
export type FeeReminder = {
  key: string;
  name: string;
  feeYear: number;
  message: string;
  dueOn: string;
  sentOn: string;
  sentBy: string;
};

export type RegisterLoad = {
  allotments: RegistrationAllotment[];
  quotas: ApprovedQuota[];
  standings: SupervisorStanding[];
  exits: SupervisorExit[];
  passedOut: PassedOutScholar[];
  reminders: FeeReminder[];
  source: "database" | "browser";
  updatedAt: string | null;
  detail: string | null;
};

export type { SupervisorStanding };

const rowId = "register";

function parseAllotments(value: unknown): RegistrationAllotment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<RegistrationAllotment>;
    if (!record.scholarId || !record.registrationNumber?.trim()) return [];
    return [
      {
        scholarId: record.scholarId,
        registrationNumber: record.registrationNumber.trim(),
      },
    ];
  });
}

function parseQuotas(value: unknown): ApprovedQuota[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<ApprovedQuota>;
    const quota = Number(record.quota);
    if (!record.name?.trim() || !Number.isInteger(quota) || quota < 0) return [];
    return [
      {
        name: record.name.trim(),
        quota,
        department: record.department?.trim() ?? "",
        designation: record.designation?.trim() ?? "",
      },
    ];
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseExits(value: unknown): SupervisorExit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!text(row.key) || !text(row.name)) return [];
    const reason = text(row.reason);
    return [
      {
        key: text(row.key),
        name: text(row.name),
        reason:
          reason === "Retirement" || reason === "Other"
            ? reason
            : ("Resignation" as const),
        lastDay: text(row.lastDay),
        startedOn: text(row.startedOn),
        completedOn: text(row.completedOn),
      },
    ];
  });
}

function parseReminders(value: unknown): FeeReminder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!text(row.key) || !text(row.message)) return [];
    return [
      {
        key: text(row.key),
        name: text(row.name),
        feeYear: Number(row.feeYear) || 1,
        message: text(row.message),
        dueOn: text(row.dueOn),
        sentOn: text(row.sentOn),
        sentBy: text(row.sentBy),
      },
    ];
  });
}

function parsePassedOut(value: unknown): PassedOutScholar[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!text(row.key) || !text(row.name)) return [];
    return [
      {
        key: text(row.key),
        name: text(row.name),
        supervisorName: text(row.supervisorName),
        vivaOn: text(row.vivaOn),
        movedOn: text(row.movedOn),
        movedBy: text(row.movedBy),
      },
    ];
  });
}

type StoredRegister = {
  allotments: RegistrationAllotment[];
  quotas: ApprovedQuota[];
  standings: SupervisorStanding[];
  exits: SupervisorExit[];
  passedOut: PassedOutScholar[];
  reminders: FeeReminder[];
};

const emptyStored = (): StoredRegister => ({
  allotments: [],
  quotas: [],
  standings: [],
  exits: [],
  passedOut: [],
  reminders: [],
});

function readStored(): StoredRegister {
  if (typeof window === "undefined") {
    return emptyStored();
  }
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(storageKeys.register) ?? "[]",
    );
    if (Array.isArray(parsed)) {
      return { ...emptyStored(), allotments: parseAllotments(parsed) };
    }
    if (!parsed || typeof parsed !== "object") {
      return emptyStored();
    }
    const record = parsed as Record<string, unknown>;
    return {
      allotments: parseAllotments(record.allotments),
      quotas: parseQuotas(record.quotas),
      standings: parseSupervisorStandings(record.standings),
      exits: parseExits(record.exits),
      passedOut: parsePassedOut(record.passedOut),
      reminders: parseReminders(record.reminders),
    };
  } catch {
    return emptyStored();
  }
}

function writeBrowser(stored: StoredRegister) {
  window.localStorage.setItem(storageKeys.register, JSON.stringify(stored));
}

function payloadOf(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function loadRegister(): Promise<RegisterLoad> {
  const supabase = createSupabase();
  if (!supabase)
    return { ...readStored(), source: "browser", updatedAt: null, detail: null };
  const { data, error } = await supabase
    .from("research_register")
    .select("payload, updated_at")
    .eq("id", rowId)
    .maybeSingle();
  if (error) {
    return {
      ...readStored(),
      source: "browser",
      updatedAt: null,
      detail: "The registration-number table is not in the database yet.",
    };
  }
  const payload = payloadOf(data?.payload);
  return {
    allotments: parseAllotments(payload?.allotments),
    quotas: parseQuotas(payload?.quotas),
    standings: parseSupervisorStandings(payload?.standings),
    exits: parseExits(payload?.exits),
    passedOut: parsePassedOut(payload?.passedOut),
    reminders: parseReminders(payload?.reminders),
    source: "database",
    updatedAt: data?.updated_at ?? null,
    detail: null,
  };
}

const emptyAllotments: RegistrationAllotment[] = [];
const emptyQuotas: ApprovedQuota[] = [];
const emptyStandings: SupervisorStanding[] = [];
const emptyExits: SupervisorExit[] = [];
const emptyPassedOut: PassedOutScholar[] = [];
const emptyReminders: FeeReminder[] = [];

let memory: RegisterLoad | null = null;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: RegisterLoad) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function subscribeRegister(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    void loadRegister().then((value) => {
      memory = value;
      loading = false;
      listeners.forEach((listener) => listener());
    });
  }
  return () => listeners.delete(onChange);
}

export function currentAllotments() {
  return memory?.allotments ?? emptyAllotments;
}

export function currentQuotas() {
  return memory?.quotas ?? emptyQuotas;
}

export function currentStandings() {
  return memory?.standings ?? emptyStandings;
}

export function currentRegister() {
  return memory;
}

export function currentExits() {
  return memory?.exits ?? emptyExits;
}

export function currentPassedOut() {
  return memory?.passedOut ?? emptyPassedOut;
}

export function currentReminders() {
  return memory?.reminders ?? emptyReminders;
}

/** Adds or replaces the reminder for each scholar and fee year. */
export async function saveFeeReminders(entries: readonly FeeReminder[]) {
  const current = memory ?? (await loadRegister());
  const reminders = [
    ...entries,
    ...current.reminders.filter(
      (item) =>
        !entries.some(
          (entry) => sameKey(entry.key, item.key) && entry.feeYear === item.feeYear,
        ),
    ),
  ];
  return persistRegister({ ...current, reminders });
}

export async function clearFeeReminder(key: string, feeYear: number) {
  const current = memory ?? (await loadRegister());
  return persistRegister({
    ...current,
    reminders: current.reminders.filter(
      (item) => !(sameKey(item.key, key) && item.feeYear === feeYear),
    ),
  });
}

function sameKey(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** The scholar has passed the viva and left the active rolls. */
export function isPassedOut(identifier: string, name = "") {
  return (memory?.passedOut ?? []).some(
    (item) =>
      (identifier.trim() && sameKey(item.key, identifier)) ||
      (name.trim() && sameKey(item.name, name)),
  );
}

/** Open (not yet completed) exit for this supervisor, by any of its keys or its name. */
export function exitFor(keys: readonly string[], name: string) {
  return (
    (memory?.exits ?? []).find(
      (item) =>
        keys.some((key) => key.trim() && sameKey(item.key, key)) ||
        sameGuide(item.name, name),
    ) ?? null
  );
}

/** Seats freed for a guide by scholars who passed out. */
export function releasedSeats(guideName: string) {
  return (memory?.passedOut ?? []).filter((item) =>
    sameGuide(item.supervisorName, guideName),
  ).length;
}

export function registrationOf(
  scholar: ResearchScholar,
  allotments: readonly RegistrationAllotment[],
) {
  return (
    allotments.find((item) => item.scholarId === scholar.id)?.registrationNumber ??
    scholar.registrationNumber
  );
}

export function registrationIsSaved(
  scholar: ResearchScholar,
  allotments: readonly RegistrationAllotment[],
) {
  return Boolean(registrationOf(scholar, allotments).trim());
}

export function batchOf(batchId: string) {
  return researchRegister.batches.find((batch) => batch.id === batchId) ?? null;
}

function nameTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/^dr\.?\s+/, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

export function sameGuide(left: string, right: string) {
  const first = nameTokens(left);
  const second = nameTokens(right);
  if (!first.length || !second.length) return false;
  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];
  return shorter.join("").length >= 5 && shorter.every((token) => longer.includes(token));
}

export function personalDetailsFromRegister(identifier: string, fallbackName: string) {
  const scholar = scholarBySignIn(identifier);
  if (!scholar) return { fullName: fallbackName };
  const category = scholar.category.trim().toLowerCase();
  const studyMode = studyModes.find((mode) => mode.toLowerCase() === category);
  return {
    fullName: scholar.name,
    mobile: scholar.phone,
    email: scholar.email,
    programme: scholar.department,
    ...(studyMode ? { studyMode } : {}),
  };
}

export function scholarSignInId(scholar: ResearchScholar) {
  return (
    scholar.email.trim() ||
    scholar.registrationNumber.trim() ||
    scholar.applicationNumber.trim() ||
    scholar.fileNumber.trim() ||
    scholar.id
  );
}

export function scholarBySignIn(identifier: string) {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  return (
    researchRegister.scholars.find((scholar) =>
      [
        scholar.email,
        scholar.applicationNumber,
        scholar.registrationNumber,
        scholar.fileNumber,
        scholar.id,
      ].some((value) => value.toLowerCase() === id),
    ) ?? null
  );
}

export function supervisorBySignIn(identifier: string) {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  return (
    researchRegister.supervisors.find((supervisor) =>
      [supervisor.email, supervisor.supervisorId, supervisor.name].some(
        (value) => value.trim().toLowerCase() === id,
      ),
    ) ?? supervisorForGuide(identifier)
  );
}

export function supervisorForAllotment(allotment: GuideAllotment) {
  const identifier = allotment.supervisorIdentifier.trim().toLowerCase();
  return (
    researchRegister.supervisors.find(
      (item) =>
        (identifier.length > 0 && item.supervisorId.toLowerCase() === identifier) ||
        sameGuide(item.name, allotment.supervisorName) ||
        sameGuide(item.name, allotment.supervisorIdentifier),
    ) ?? null
  );
}

function scholarOfAllotment(allotment: GuideAllotment) {
  return (
    scholarBySignIn(allotment.scholarIdentifier) ??
    researchRegister.scholars.find(
      (scholar) =>
        scholar.name.trim().toLowerCase() === allotment.scholarName.trim().toLowerCase(),
    ) ??
    null
  );
}

function allotmentMatches(supervisor: ResearchSupervisor, allotment: GuideAllotment) {
  const identifier = allotment.supervisorIdentifier.trim().toLowerCase();
  if (
    supervisor.supervisorId.trim().length > 0 &&
    identifier === supervisor.supervisorId.trim().toLowerCase()
  ) {
    return true;
  }
  return (
    sameGuide(supervisor.name, allotment.supervisorName) ||
    sameGuide(supervisor.name, allotment.supervisorIdentifier)
  );
}

export function netAllotments(
  supervisor: ResearchSupervisor,
  allocations: readonly GuideAllotment[],
) {
  const added = allocations.filter((item) => {
    if (!allotmentMatches(supervisor, item)) return false;
    const scholar = scholarOfAllotment(item);
    return !scholar || !sameGuide(scholar.guideName, supervisor.name);
  }).length;
  const movedAway = allocations.filter((item) => {
    if (allotmentMatches(supervisor, item)) return false;
    const scholar = scholarOfAllotment(item);
    return Boolean(scholar && sameGuide(scholar.guideName, supervisor.name));
  }).length;
  return added - movedAway - releasedSeats(supervisor.name);
}

export function vacancyBeforeAllotment(
  allotment: GuideAllotment,
  allocations: readonly GuideAllotment[],
  quotas: readonly ApprovedQuota[],
) {
  const supervisor = supervisorForAllotment(allotment);
  if (!supervisor) return null;
  const without = allocations.filter(
    (item) =>
      item.scholarIdentifier.trim().toLowerCase() !==
      allotment.scholarIdentifier.trim().toLowerCase(),
  );
  const scholar = scholarOfAllotment(allotment);
  const already = Boolean(scholar && sameGuide(scholar.guideName, supervisor.name));
  const keeping =
    already ||
    allocations.some(
      (item) =>
        item.scholarIdentifier.trim().toLowerCase() ===
          allotment.scholarIdentifier.trim().toLowerCase() &&
        allotmentMatches(supervisor, item),
    );
  return {
    supervisor,
    vacancy: guideFigures(supervisor, quotas, without).vacancy,
    keeping,
  };
}

export function guideFigures(
  supervisor: ResearchSupervisor,
  quotas: readonly ApprovedQuota[],
  allocations: readonly GuideAllotment[],
) {
  const approved = quotas.find((item) => sameGuide(item.name, supervisor.name));
  const quota = approved?.quota ?? supervisor.quota;
  const extra = netAllotments(supervisor, allocations);
  const currentScholars = Math.max(0, supervisor.currentScholars + extra);
  const vacancy = Math.max(
    0,
    (approved ? quota - supervisor.currentScholars : supervisor.vacancy) - extra,
  );
  const balance = Math.max(
    0,
    approved ? vacancy - supervisor.june2026Allotment : supervisor.balance - extra,
  );
  return { quota, vacancy, balance, currentScholars };
}

export function supervisorForGuide(name: string) {
  return (
    researchRegister.supervisors.find((item) => item.name === name) ??
    researchRegister.supervisors.find((item) => sameGuide(item.name, name)) ??
    null
  );
}

export const scholarDownloadHeaders = [
  "S. No.",
  "Batch",
  "Registration number",
  "File number",
  "Application number",
  "Name",
  "Department",
  "Phone",
  "Mail",
  "Title",
  "Category",
  "Working institution",
  "Guide",
  "Supervisor ID",
  "Guide designation",
  "Guide department",
  "Area of research",
  "Campus",
  "Quota",
  "Vacancy",
  "Balance",
  "July 2026 allotment",
  "Guide active",
  "1st DC",
  "2nd DC",
  "Confirmation",
  "Colloquium 1",
  "Colloquium 2",
  "Synopsis",
  "Thesis",
  "Viva",
] as const;

export function scholarDownloadRow(
  scholar: ResearchScholar,
  allotments: readonly RegistrationAllotment[],
  quotas: readonly ApprovedQuota[] = [],
  allocations: readonly GuideAllotment[] = [],
) {
  const guide = supervisorForGuide(scholar.guideName);
  const figures = guide ? guideFigures(guide, quotas, allocations) : null;
  return [
    String(scholar.serialNo),
    batchOf(scholar.batchId)?.name ?? "",
    registrationOf(scholar, allotments),
    scholar.fileNumber,
    scholar.applicationNumber,
    scholar.name,
    scholar.department,
    scholar.phone,
    scholar.email,
    scholar.title,
    scholar.category,
    scholar.institution,
    scholar.guideName,
    guide?.supervisorId ?? "",
    guide?.designation ?? "",
    guide?.department ?? "",
    guide?.researchArea ?? "",
    guide?.campus ?? "",
    figures ? String(figures.quota) : "",
    figures ? String(figures.vacancy) : "",
    figures ? String(figures.balance) : "",
    guide ? String(guide.june2026Allotment) : "",
    guide ? (guide.active ? "Yes" : "No") : "",
    scholar.firstDc,
    scholar.secondDc,
    scholar.confirmation,
    scholar.colloquium1,
    scholar.colloquium2,
    scholar.synopsis,
    scholar.thesis,
    scholar.viva,
  ];
}

export const supervisorDownloadHeaders = [
  "S. No.",
  "Guide name",
  "Supervisor ID",
  "Department",
  "Designation",
  "Area of research",
  "Active",
  "Current scholars",
  "Scholars on register",
  "Quota",
  "Vacancy",
  "July 2026 allotment",
  "Balance",
  "Campus",
  "Phone",
  "Mail ID",
  "On vacancy list",
] as const;

export function supervisorDownloadRow(
  supervisor: ResearchSupervisor,
  quotas: readonly ApprovedQuota[] = [],
  allocations: readonly GuideAllotment[] = [],
) {
  const onRegister = researchRegister.scholars.filter((scholar) =>
    sameGuide(scholar.guideName, supervisor.name),
  ).length;
  const figures = guideFigures(supervisor, quotas, allocations);
  return [
    String(supervisor.serialNo),
    supervisor.name,
    supervisor.supervisorId,
    supervisor.department,
    supervisor.designation,
    supervisor.researchArea,
    supervisor.active ? "Yes" : "No",
    String(figures.currentScholars),
    String(onRegister),
    String(figures.quota),
    String(figures.vacancy),
    String(supervisor.june2026Allotment),
    String(figures.balance),
    supervisor.campus,
    supervisor.phone,
    supervisor.email,
    supervisor.onVacancyList ? "Yes" : "No",
  ];
}

export function scholarsGuidedBy(name: string, identifier: string) {
  const id = identifier.trim().toLowerCase();
  const supervisor = researchRegister.supervisors.find(
    (item) =>
      (id.length > 0 && item.supervisorId.toLowerCase() === id) ||
      sameGuide(item.name, name),
  );
  if (!supervisor) return [];
  return researchRegister.scholars.filter((scholar) =>
    sameGuide(scholar.guideName, supervisor.name),
  );
}

async function persistRegister(next: RegisterLoad) {
  const stored: StoredRegister = {
    allotments: next.allotments,
    quotas: next.quotas,
    standings: next.standings ?? [],
    exits: next.exits ?? [],
    passedOut: next.passedOut ?? [],
    reminders: next.reminders ?? [],
  };
  const supabase = createSupabase();
  if (supabase && next.source === "database") {
    const saved = await saveJsonBlob(
      "research_register",
      rowId,
      toJson(stored),
      next.updatedAt,
    );
    if (!saved.ok) return { ok: false as const, message: saved.message };
    publish({ ...next, updatedAt: saved.updatedAt });
    return { ok: true as const };
  }
  writeBrowser(stored);
  publish({ ...next, source: "browser" });
  return { ok: true as const };
}

export function supervisorKeys(supervisor: ResearchSupervisor) {
  return [supervisor.email, supervisor.supervisorId, supervisor.name].filter((item) =>
    item.trim(),
  );
}

export function supervisorListingActive(
  supervisor: ResearchSupervisor,
  standings: readonly SupervisorStanding[],
) {
  return supervisorIsActive(supervisorKeys(supervisor), supervisor.active, standings);
}

export async function saveSupervisorStanding(
  supervisor: ResearchSupervisor,
  active: boolean,
  inactiveKind: "Inactive" | "Resigned" | null,
) {
  const current = memory ?? (await loadRegister());
  const keys = supervisorKeys(supervisor);
  const nextStanding: SupervisorStanding = {
    key: supervisor.email.trim() || supervisor.supervisorId.trim() || supervisor.name,
    active,
    inactiveKind: active ? null : (inactiveKind ?? "Inactive"),
  };
  const standings = [
    nextStanding,
    ...current.standings.filter(
      (item) => !keys.some((key) => key.toLowerCase() === item.key.trim().toLowerCase()),
    ),
  ];
  return persistRegister({ ...current, standings });
}

/** Standing for any supervisor, including those approved after the register was built. */
export async function saveStandingByKeys(
  keys: readonly string[],
  active: boolean,
  inactiveKind: "Inactive" | "Resigned" | null,
) {
  const current = memory ?? (await loadRegister());
  const live = keys.filter((key) => key.trim());
  if (live.length === 0)
    return { ok: false as const, message: "That supervisor has no key." };
  const nextStanding: SupervisorStanding = {
    key: live[0],
    active,
    inactiveKind: active ? null : (inactiveKind ?? "Inactive"),
  };
  const standings = [
    nextStanding,
    ...current.standings.filter((item) => !live.some((key) => sameKey(key, item.key))),
  ];
  return persistRegister({ ...current, standings });
}

export async function saveSupervisorExit(exit: SupervisorExit) {
  const current = memory ?? (await loadRegister());
  const exits = [exit, ...current.exits.filter((item) => !sameKey(item.key, exit.key))];
  return persistRegister({ ...current, exits });
}

export async function removeSupervisorExit(key: string) {
  const current = memory ?? (await loadRegister());
  return persistRegister({
    ...current,
    exits: current.exits.filter((item) => !sameKey(item.key, key)),
  });
}

export async function savePassedOut(entries: readonly PassedOutScholar[]) {
  const current = memory ?? (await loadRegister());
  const passedOut = [
    ...entries,
    ...current.passedOut.filter(
      (item) => !entries.some((entry) => sameKey(entry.key, item.key)),
    ),
  ];
  return persistRegister({ ...current, passedOut });
}

export async function restorePassedOut(key: string) {
  const current = memory ?? (await loadRegister());
  return persistRegister({
    ...current,
    passedOut: current.passedOut.filter((item) => !sameKey(item.key, key)),
  });
}

export async function saveApprovedQuota(entry: ApprovedQuota) {
  const current = memory ?? (await loadRegister());
  const quotas = [
    entry,
    ...current.quotas.filter((item) => !sameGuide(item.name, entry.name)),
  ];
  return persistRegister({ ...current, quotas });
}

function numberTaken(
  current: RegisterLoad,
  scholarId: string,
  registrationNumber: string,
  extra: readonly RegistrationAllotment[],
) {
  const key = registrationNumber.toLowerCase();
  const overlayTaken = [...current.allotments, ...extra].some(
    (item) =>
      item.scholarId !== scholarId && item.registrationNumber.toLowerCase() === key,
  );
  const rollTaken = researchRegister.scholars.some(
    (item) =>
      item.id !== scholarId && item.registrationNumber.trim().toLowerCase() === key,
  );
  return overlayTaken || rollTaken;
}

export async function allotRegistration(scholarId: string, registrationNumber: string) {
  const number = registrationNumber.trim();
  if (!number) {
    return { ok: false as const, message: "Enter a registration number." };
  }
  const scholar = researchRegister.scholars.find((item) => item.id === scholarId);
  if (!scholar) {
    return { ok: false as const, message: "That scholar is not on the register." };
  }
  const current = memory ?? (await loadRegister());
  const existing = registrationOf(scholar, current.allotments).trim();
  const blocked = registrationWriteBlock(Boolean(existing) && existing !== number);
  if (blocked) return blocked;
  if (existing === number) return { ok: true as const };
  if (numberTaken(current, scholarId, number, [])) {
    return {
      ok: false as const,
      message: "That registration number is already allotted.",
    };
  }
  const allotments = [
    ...current.allotments.filter((item) => item.scholarId !== scholarId),
    { scholarId, registrationNumber: number },
  ];
  return persistRegister({ ...current, allotments });
}

export function scholarForRegistrationCsv(record: {
  scholarId: string;
  applicationNumber: string;
  fileNumber: string;
  email: string;
}) {
  const id = record.scholarId.trim().toLowerCase();
  const application = record.applicationNumber.trim().toLowerCase();
  const fileNumber = record.fileNumber.trim().toLowerCase();
  const email = record.email.trim().toLowerCase();
  return (
    researchRegister.scholars.find((scholar) => {
      if (id && scholar.id.toLowerCase() === id) return true;
      if (application && scholar.applicationNumber.trim().toLowerCase() === application) {
        return true;
      }
      if (fileNumber && scholar.fileNumber.trim().toLowerCase() === fileNumber) {
        return true;
      }
      return Boolean(email && scholar.email.trim().toLowerCase() === email);
    }) ?? null
  );
}

export async function allotRegistrations(
  rows: readonly {
    scholarId: string;
    applicationNumber: string;
    fileNumber: string;
    email: string;
    registrationNumber: string;
  }[],
) {
  const writeBlocked = officeWriteBlock();
  if (writeBlocked) {
    return { ...writeBlocked, saved: 0, skipped: rows.length };
  }
  const canReplace = !adminActionBlock();
  const current = memory ?? (await loadRegister());
  const extra: RegistrationAllotment[] = [];
  let saved = 0;
  let skipped = 0;
  const messages: string[] = [];
  for (const row of rows) {
    const number = row.registrationNumber.trim();
    if (!number) {
      skipped += 1;
      continue;
    }
    const scholar = scholarForRegistrationCsv(row);
    if (!scholar) {
      skipped += 1;
      messages.push("A row did not match a scholar on the register.");
      continue;
    }
    if (number.length < 8 || number.length > 20) {
      skipped += 1;
      messages.push(
        `${scholar.applicationNumber || scholar.id}: registration number is not valid.`,
      );
      continue;
    }
    const existing = registrationOf(scholar, current.allotments).trim();
    if (existing && existing.toLowerCase() === number.toLowerCase()) {
      skipped += 1;
      continue;
    }
    if (existing && !canReplace) {
      skipped += 1;
      messages.push(
        `${scholar.applicationNumber || scholar.id}: a saved registration number can be changed only by an administrator.`,
      );
      continue;
    }
    if (numberTaken(current, scholar.id, number, extra)) {
      skipped += 1;
      messages.push(
        `${scholar.applicationNumber || scholar.id}: that registration number is already allotted.`,
      );
      continue;
    }
    const existingIndex = extra.findIndex((item) => item.scholarId === scholar.id);
    if (existingIndex >= 0)
      extra[existingIndex] = { scholarId: scholar.id, registrationNumber: number };
    else extra.push({ scholarId: scholar.id, registrationNumber: number });
    saved += 1;
  }
  if (saved === 0) {
    return {
      ok: false as const,
      message: messages[0] ?? "No registration number could be allotted from that file.",
      saved,
      skipped,
    };
  }
  const allotments = [
    ...current.allotments.filter(
      (item) => !extra.some((entry) => entry.scholarId === item.scholarId),
    ),
    ...extra,
  ];
  const persisted = await persistRegister({ ...current, allotments });
  if (!persisted.ok) return { ...persisted, saved: 0, skipped: rows.length };
  return {
    ok: true as const,
    saved,
    skipped,
    message:
      skipped > 0
        ? `${saved} registration numbers were allotted. ${skipped} rows were skipped.`
        : `${saved} registration numbers were allotted.`,
  };
}
