import { admissionWindow } from "@/data/home";
import { heroCopy } from "@/data/sections";
import {
  scholarRecordKinds,
  type RecordStatus,
  type ScholarRecordKind,
} from "@/data/scholar-records";
import { notifyOffice, pushNotice, recordAudit } from "@/lib/audit";
import { readPreviewSession } from "@/lib/auth";
import {
  admissionSessions,
  admissionSessionsCopy,
  admissionYear,
  storageKeys,
} from "@/lib/constants";
import { officeViewWriteBlock } from "@/lib/office-view";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";
import { ensureAdmission } from "@/lib/admission";
import {
  currentRegister,
  exitFor,
  isPassedOut,
  loadRegister,
  sameGuide,
  scholarBySignIn,
  scholarSignInId,
  scholarsGuidedBy,
  vacancyBeforeAllotment,
} from "@/lib/register";
import { syncAllottedVacancies } from "@/lib/vacancies";
import type { Database, Json } from "@/types/database";

export const officeMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013180000_office_controls.sql. Until then, these records stay in this browser.";

export type SiteSettings = {
  heroEyebrow: string;
  heroTitle: string;
  heroSummary: string;
  admissionLabel: string;
  admissionSession: string;
  deadlineLabel: string;
  deadline: string;
  phdOpen: boolean;
  supervisorOpen: boolean;
};

export const defaultSiteSettings: SiteSettings = {
  heroEyebrow: heroCopy.eyebrow,
  heroTitle: heroCopy.title,
  heroSummary: heroCopy.summary,
  admissionLabel: admissionWindow.label,
  admissionSession: admissionWindow.session,
  deadlineLabel: admissionWindow.deadlineLabel,
  deadline: admissionWindow.deadline,
  phdOpen: true,
  supervisorOpen: true,
};

export type PhdSessionMonth = (typeof admissionSessions)[number];

export function parsePhdSession(value: string): {
  month: PhdSessionMonth;
  year: string;
} {
  const match = value.match(/\b(January|July)\b[^\d]*(\d{4})/i);
  if (match) {
    const month: PhdSessionMonth = /^july$/i.test(match[1] ?? "") ? "July" : "January";
    return { month, year: match[2] ?? admissionYear };
  }
  const monthOnly = value.match(/\b(January|July)\b/i);
  if (monthOnly) {
    const month: PhdSessionMonth = /^july$/i.test(monthOnly[1] ?? "")
      ? "July"
      : "January";
    return { month, year: admissionYear };
  }
  return { month: admissionSessions[0], year: admissionYear };
}

export function formatPhdSession(month: string, year: string) {
  const session: PhdSessionMonth = month === "July" ? "July" : "January";
  return `${session} ${year.trim()}`.trim();
}

export function openPhdSession() {
  return parsePhdSession(
    currentOffice()?.settings.admissionSession ?? defaultSiteSettings.admissionSession,
  );
}

export function matchesOpenPhdSession(session: string, year: string) {
  const open = openPhdSession();
  return session.trim() === open.month && year.trim() === open.year;
}

export function payloadMatchesOpenPhdSession(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  const session = typeof record.session === "string" ? record.session : "";
  const year = typeof record.year === "string" ? record.year : "";
  return matchesOpenPhdSession(session, year);
}

export function formatPhdWindowLine(settings: SiteSettings) {
  const parts: string[] = [
    settings.phdOpen ? settings.admissionLabel : "Admissions closed",
  ];
  if (settings.phdOpen && settings.admissionSession.trim()) {
    parts.push(settings.admissionSession.trim());
  }
  parts.push(admissionSessionsCopy.hero);
  if (settings.phdOpen && settings.deadline.trim()) {
    const label = settings.deadlineLabel.trim();
    parts.push(label ? `${label} ${settings.deadline.trim()}` : settings.deadline.trim());
  }
  return parts.join(" · ");
}

export type Allocation = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
};

export type RacNominee = {
  key: (typeof nomineeKeys)[number];
  side: "internal" | "external";
  name: string;
  designation: string;
  department: string;
  institution: string;
  email: string;
  phone: string;
  specialization: string;
};

export type RacProposal = {
  id: string;
  kind: "constitution" | "reconstitution";
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
  status: "Submitted" | "Approved" | "Returned";
  nominees: RacNominee[];
  selectedInternal: string;
  selectedExternal: string;
  remarks: string;
  agenda: string;
  attendance: string;
  minutes: string;
  reason: string;
  decidedOn: string;
  decidedBy: string;
  createdAt: string;
};

export type OfficeRecord = {
  id: string;
  kind: ScholarRecordKind;
  scholarIdentifier: string;
  scholarName: string;
  status: RecordStatus;
  supervisorIdentifier: string;
  supervisorName: string;
  payload: Record<string, string>;
  fileName: string | null;
  createdAt: string;
};

export type OfficeState = {
  settings: SiteSettings;
  allocations: Allocation[];
  proposals: RacProposal[];
  records: OfficeRecord[];
  phdApplications: number;
  supervisorApplications: number;
  detail: string | null;
};

export function sameId(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function allocationFor(allocations: Allocation[], scholarIdentifier: string) {
  return (
    allocations.find((item) => sameId(item.scholarIdentifier, scholarIdentifier)) ?? null
  );
}

export function scholarsStillGuidedBy(
  name: string,
  identifier: string,
  allocations: readonly Allocation[],
) {
  return scholarsGuidedBy(name, identifier).filter((scholar) => {
    const keys = [
      scholarSignInId(scholar),
      scholar.email,
      scholar.registrationNumber,
      scholar.applicationNumber,
      scholar.fileNumber,
      scholar.id,
    ];
    return !allocations.some(
      (item) =>
        keys.some((key) => key.trim() && sameId(item.scholarIdentifier, key)) ||
        item.scholarName.trim().toLowerCase() === scholar.name.trim().toLowerCase(),
    );
  });
}

function racDecidedOn(proposal: RacProposal) {
  return proposal.decidedOn || proposal.createdAt.slice(0, 10);
}

function latestApprovedRac(proposals: readonly RacProposal[], scholarIdentifier: string) {
  return (
    proposals
      .filter(
        (item) =>
          item.status === "Approved" && sameId(item.scholarIdentifier, scholarIdentifier),
      )
      .sort((left, right) => racDecidedOn(right).localeCompare(racDecidedOn(left)))[0] ??
    null
  );
}

export function presentRac(proposals: RacProposal[], scholarIdentifier: string) {
  const latest = latestApprovedRac(proposals, scholarIdentifier);
  if (!latest) return null;
  const internal = latest.nominees.find((item) => item.key === latest.selectedInternal);
  const external = latest.nominees.find((item) => item.key === latest.selectedExternal);
  if (!internal || !external) return null;
  return {
    guide: latest.supervisorName,
    internal,
    external,
    approvedOn: racDecidedOn(latest),
    selectedBy: latest.decidedBy,
  };
}

/** Months a constituted RAC must stand before the supervisor can ask to change it. */
export const racChangeGapMonths = 6;

function addMonthsIso(iso: string, months: number) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

export type RacStanding = {
  /** Approved committee in force, if any. */
  approved: RacProposal | null;
  /** Nomination waiting for the Dean, if any. */
  pending: RacProposal | null;
  /** Kind of request the supervisor may send now, or null when none is allowed. */
  canRequest: RacProposal["kind"] | null;
  /** Earliest date a reconstitution may be requested. */
  changeOpensOn: string | null;
  /** Why no request is allowed, when canRequest is null. */
  blocked: string | null;
};

export function racStanding(
  proposals: readonly RacProposal[],
  scholarIdentifier: string,
  today = new Date().toISOString().slice(0, 10),
): RacStanding {
  const approved = latestApprovedRac(proposals, scholarIdentifier);
  const pending =
    proposals.find(
      (item) =>
        item.status === "Submitted" && sameId(item.scholarIdentifier, scholarIdentifier),
    ) ?? null;
  const changeOpensOn = approved
    ? addMonthsIso(racDecidedOn(approved), racChangeGapMonths)
    : null;
  if (pending) {
    return {
      approved,
      pending,
      canRequest: null,
      changeOpensOn,
      blocked: "A nomination is waiting for the Dean's selection.",
    };
  }
  if (!approved) {
    return {
      approved,
      pending,
      canRequest: "constitution",
      changeOpensOn,
      blocked: null,
    };
  }
  if (changeOpensOn && today < changeOpensOn) {
    return {
      approved,
      pending,
      canRequest: null,
      changeOpensOn,
      blocked: `The RAC was constituted on ${racDecidedOn(approved)}. A change can be requested from ${changeOpensOn}.`,
    };
  }
  return {
    approved,
    pending,
    canRequest: "reconstitution",
    changeOpensOn,
    blocked: null,
  };
}

const nomineeKeys = [
  "internal-1",
  "internal-2",
  "external-1",
  "external-2",
  "external-3",
] as const;

function isNominee(value: unknown): value is RacNominee {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<RacNominee>;
  return (
    typeof row.key === "string" &&
    (nomineeKeys as readonly string[]).includes(row.key) &&
    (row.side === "internal" || row.side === "external") &&
    typeof row.name === "string"
  );
}

function payloadOf(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") result[key] = item;
  }
  return result;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readSettings(): SiteSettings {
  const stored = readJson<Partial<SiteSettings>>(storageKeys.siteSettings);
  return {
    ...defaultSiteSettings,
    ...stored,
    phdOpen: stored?.phdOpen ?? true,
    supervisorOpen: stored?.supervisorOpen ?? true,
  };
}

function readAllocations(): Allocation[] {
  const stored = readJson<Allocation[]>(storageKeys.allocations);
  return Array.isArray(stored) ? stored : [];
}

function readProposals(): RacProposal[] {
  const stored = readJson<RacProposal[]>(storageKeys.racProposals);
  if (!Array.isArray(stored)) return [];
  return stored.map((item) => ({
    ...item,
    remarks: item.remarks ?? "",
    agenda: item.agenda ?? "",
    attendance: item.attendance ?? "",
    minutes: item.minutes ?? "",
    reason: item.reason ?? "",
    decidedOn: item.decidedOn ?? "",
    decidedBy: item.decidedBy ?? "",
  }));
}

function isKind(value: string): value is ScholarRecordKind {
  return (scholarRecordKinds as readonly string[]).includes(value);
}

function readRecords(): OfficeRecord[] {
  const stored = readJson<OfficeRecord[]>(storageKeys.scholarRecords);
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((item) => {
    if (!item?.id || !item.kind || !isKind(item.kind) || !item.scholarIdentifier)
      return [];
    return [
      {
        id: item.id,
        kind: item.kind,
        scholarIdentifier: item.scholarIdentifier,
        scholarName: item.scholarName ?? "",
        status: item.status ?? "Submitted",
        supervisorIdentifier: item.supervisorIdentifier ?? "",
        supervisorName: item.supervisorName ?? "",
        payload: item.payload ?? {},
        fileName: item.fileName ?? null,
        createdAt: item.createdAt ?? "",
      },
    ];
  });
}

let memory: OfficeState | null = null;
let loading = false;
const listeners = new Set<() => void>();

function publish(next: OfficeState) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function currentOffice() {
  return memory;
}

export function subscribeOffice(onChange: () => void) {
  listeners.add(onChange);
  if (!loading) {
    loading = true;
    void loadOffice().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

export function refreshOffice() {
  return loadOffice().then((value) => {
    publish(value);
    return value;
  });
}

function mergeProposals(
  remote: RacProposal[],
  local: RacProposal[],
  remoteFailed: boolean,
) {
  if (remoteFailed) return local;
  const seen = new Set(remote.map((item) => item.id));
  return [
    ...local.filter((item) => item.id.startsWith("local-") && !seen.has(item.id)),
    ...remote,
  ];
}

function mergeAllocations(
  remote: Allocation[],
  local: Allocation[],
  remoteFailed: boolean,
) {
  if (remoteFailed) return local;
  const seen = new Set(remote.map((item) => item.scholarIdentifier.toLowerCase()));
  return [
    ...remote,
    ...local.filter((item) => !seen.has(item.scholarIdentifier.toLowerCase())),
  ];
}

function settingsFromRow(row: {
  hero_eyebrow: string;
  hero_title: string;
  hero_summary: string;
  admission_label: string;
  admission_session: string;
  deadline_label: string;
  deadline: string;
  phd_open: boolean;
  supervisor_open: boolean;
}): SiteSettings {
  return {
    heroEyebrow: row.hero_eyebrow,
    heroTitle: row.hero_title,
    heroSummary: row.hero_summary,
    admissionLabel: row.admission_label,
    admissionSession: row.admission_session,
    deadlineLabel: row.deadline_label,
    deadline: row.deadline,
    phdOpen: row.phd_open,
    supervisorOpen: row.supervisor_open,
  };
}

async function loadOffice(): Promise<OfficeState> {
  const browser: OfficeState = {
    settings: readSettings(),
    allocations: readAllocations(),
    proposals: readProposals(),
    records: readRecords(),
    phdApplications: 0,
    supervisorApplications: 0,
    detail: null,
  };
  const supabase = createSupabase();
  if (!supabase) return browser;

  const [settings, allocations, proposals, records] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", "office").maybeSingle(),
    supabase.from("scholar_allocations").select("*").order("scholar_name"),
    supabase.from("rac_proposals").select("*").order("created_at", { ascending: false }),
    supabase
      .from("scholar_records")
      .select(
        "id, kind, scholar_identifier, scholar_name, status, payload, file_name, created_at, supervisor_identifier, supervisor_name",
      ),
  ]);
  const [phdCount, supervisorCount] = supabase
    ? await Promise.all([
        supabase.from("phd_applications").select("id", { count: "exact", head: true }),
        supabase
          .from("supervisor_applications")
          .select("id", { count: "exact", head: true }),
      ])
    : [null, null];

  const missing = Boolean(settings.error || allocations.error || proposals.error);
  if (missing && records.error) return { ...browser, detail: officeMigrationHint };

  const knownStatus = ["Submitted", "Supervisor approved", "Approved", "Returned"];
  const remoteRecords: OfficeRecord[] = (records.data ?? []).flatMap((row) => {
    if (!isKind(row.kind) || !knownStatus.includes(row.status)) return [];
    const status = row.status as RecordStatus;
    return [
      {
        id: row.id,
        kind: row.kind,
        scholarIdentifier: row.scholar_identifier,
        scholarName: row.scholar_name,
        status,
        supervisorIdentifier: row.supervisor_identifier ?? "",
        supervisorName: row.supervisor_name ?? "",
        payload: payloadOf(row.payload),
        fileName: row.file_name,
        createdAt: row.created_at,
      },
    ];
  });
  const remoteIds = new Set(remoteRecords.map((item) => item.id));
  const extras = browser.records.filter(
    (item) => item.id.startsWith("local-") && !remoteIds.has(item.id),
  );

  return {
    settings: settings.data ? settingsFromRow(settings.data) : browser.settings,
    allocations: mergeAllocations(
      allocations.error || !allocations.data
        ? []
        : allocations.data.map((row) => ({
            id: row.id,
            scholarIdentifier: row.scholar_identifier,
            scholarName: row.scholar_name,
            supervisorIdentifier: row.supervisor_identifier,
            supervisorName: row.supervisor_name,
          })),
      browser.allocations,
      Boolean(allocations.error),
    ),
    proposals: mergeProposals(
      proposals.error || !proposals.data
        ? []
        : proposals.data.flatMap((row) => {
            const nominees = Array.isArray(row.nominees)
              ? row.nominees.filter(isNominee)
              : [];
            if (nominees.length === 0) return [];
            if (row.kind !== "constitution" && row.kind !== "reconstitution") return [];
            if (
              row.status !== "Submitted" &&
              row.status !== "Approved" &&
              row.status !== "Returned"
            ) {
              return [];
            }
            return [
              {
                id: row.id,
                kind: row.kind,
                scholarIdentifier: row.scholar_identifier,
                scholarName: row.scholar_name,
                supervisorIdentifier: row.supervisor_identifier,
                supervisorName: row.supervisor_name,
                status: row.status,
                nominees,
                selectedInternal: row.selected_internal,
                selectedExternal: row.selected_external,
                remarks: typeof row.remarks === "string" ? row.remarks : "",
                agenda: typeof row.agenda === "string" ? row.agenda : "",
                attendance: typeof row.attendance === "string" ? row.attendance : "",
                minutes: typeof row.minutes === "string" ? row.minutes : "",
                reason: typeof row.reason === "string" ? row.reason : "",
                decidedOn: typeof row.decided_on === "string" ? row.decided_on : "",
                decidedBy: typeof row.decided_by === "string" ? row.decided_by : "",
                createdAt: row.created_at,
              },
            ];
          }),
      browser.proposals,
      Boolean(proposals.error),
    ),
    records: records.error ? browser.records : [...extras, ...remoteRecords],
    phdApplications: phdCount?.count ?? 0,
    supervisorApplications: supervisorCount?.count ?? 0,
    detail: missing || records.error ? officeMigrationHint : null,
  };
}

export async function saveSiteSettings(settings: SiteSettings) {
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const { error } = await supabase.from("site_settings").upsert({
      id: "office",
      hero_eyebrow: settings.heroEyebrow,
      hero_title: settings.heroTitle,
      hero_summary: settings.heroSummary,
      admission_label: settings.admissionLabel,
      admission_session: settings.admissionSession,
      deadline_label: settings.deadlineLabel,
      deadline: settings.deadline,
      phd_open: settings.phdOpen,
      supervisor_open: settings.supervisorOpen,
    });
    if (!error) {
      await recordAudit({
        action: settings.phdOpen ? "site:phd-open" : "site:phd-close",
        subject: "phd-applications",
        detail: `${settings.admissionSession} · Ph.D. ${settings.phdOpen ? "open" : "closed"} · recognition ${settings.supervisorOpen ? "open" : "closed"}`,
      });
      await refreshOffice();
      return { ok: true as const };
    }
  }
  window.localStorage.setItem(storageKeys.siteSettings, JSON.stringify(settings));
  await recordAudit({
    action: settings.phdOpen ? "site:phd-open" : "site:phd-close",
    subject: "phd-applications",
    detail: `${settings.admissionSession} · Ph.D. ${settings.phdOpen ? "open" : "closed"} · recognition ${settings.supervisorOpen ? "open" : "closed"}`,
  });
  await refreshOffice();
  return { ok: true as const };
}

async function refreshVacancyCounts(names: readonly string[]) {
  await syncAllottedVacancies(memory?.allocations ?? readAllocations(), names);
}

async function noticeRacNeeded(
  allocation: Pick<
    Allocation,
    "scholarIdentifier" | "scholarName" | "supervisorIdentifier" | "supervisorName"
  >,
  previous: Allocation | undefined,
) {
  if (
    previous &&
    sameId(previous.supervisorIdentifier, allocation.supervisorIdentifier)
  ) {
    return;
  }
  const standing = racStanding(
    memory?.proposals ?? readProposals(),
    allocation.scholarIdentifier,
  );
  if (standing.approved || standing.pending) return;
  await pushNotice({
    role: "supervisor",
    identifier: allocation.supervisorIdentifier,
    title: `New scholar · ${allocation.scholarName}`,
    detail:
      "No RAC is constituted for this scholar yet. Open RAC proposal to initiate it.",
    href: "/supervisor/rac",
  });
}

export async function saveAllocation(
  allocation: Omit<Allocation, "id"> & { id?: string },
) {
  const existing = memory?.allocations ?? readAllocations();
  const previous = existing.find((item) =>
    sameId(item.scholarIdentifier, allocation.scholarIdentifier),
  );
  const register = currentRegister() ?? (await loadRegister());
  if (isPassedOut(allocation.scholarIdentifier, allocation.scholarName)) {
    return {
      ok: false as const,
      message: `${allocation.scholarName} has passed out and cannot be allotted.`,
    };
  }
  const staying = Boolean(
    previous && sameGuide(previous.supervisorName, allocation.supervisorName),
  );
  if (!staying && exitFor([allocation.supervisorIdentifier], allocation.supervisorName)) {
    return {
      ok: false as const,
      message: `${allocation.supervisorName} is leaving and cannot take new scholars.`,
    };
  }
  const room = vacancyBeforeAllotment(allocation, existing, register.quotas);
  if (room && !room.keeping && room.vacancy < 1) {
    return { ok: false as const, message: `${room.supervisor.name} has no vacancy.` };
  }
  if (!room && !staying) {
    // Supervisor approved after the register was built: the approved number is the limit.
    const quota = register.quotas.find((item) =>
      sameGuide(item.name, allocation.supervisorName),
    );
    if (quota) {
      const load = existing.filter(
        (item) =>
          sameGuide(item.supervisorName, allocation.supervisorName) &&
          !sameId(item.scholarIdentifier, allocation.scholarIdentifier) &&
          !isPassedOut(item.scholarIdentifier, item.scholarName),
      ).length;
      if (load >= quota.quota) {
        return {
          ok: false as const,
          message: `${allocation.supervisorName} has no vacancy.`,
        };
      }
    }
  }
  const alreadyAllotted = existing.some((item) =>
    sameId(item.scholarIdentifier, allocation.scholarIdentifier),
  );
  if (!alreadyAllotted && !scholarBySignIn(allocation.scholarIdentifier)) {
    const admission = await ensureAdmission();
    const verified = admission.cases.some(
      (item) =>
        item.verification === "Approved" &&
        (sameId(item.email, allocation.scholarIdentifier) ||
          sameId(item.applicationNo, allocation.scholarIdentifier)),
    );
    if (!verified) {
      return {
        ok: false as const,
        message:
          "Allot after certificate verification, or choose a scholar already on the register.",
      };
    }
  }
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const { error } = await supabase.from("scholar_allocations").upsert(
      {
        scholar_identifier: allocation.scholarIdentifier,
        scholar_name: allocation.scholarName,
        supervisor_identifier: allocation.supervisorIdentifier,
        supervisor_name: allocation.supervisorName,
      },
      { onConflict: "scholar_identifier" },
    );
    if (!error) {
      await refreshOffice();
      await refreshVacancyCounts([
        allocation.supervisorName,
        previous?.supervisorName ?? "",
      ]);
      await noticeRacNeeded(allocation, previous);
      return { ok: true as const };
    }
  }
  const all = readAllocations().filter(
    (item) => !sameId(item.scholarIdentifier, allocation.scholarIdentifier),
  );
  all.push({
    id: allocation.id ?? `local-${crypto.randomUUID()}`,
    scholarIdentifier: allocation.scholarIdentifier,
    scholarName: allocation.scholarName,
    supervisorIdentifier: allocation.supervisorIdentifier,
    supervisorName: allocation.supervisorName,
  });
  window.localStorage.setItem(storageKeys.allocations, JSON.stringify(all));
  await refreshOffice();
  await refreshVacancyCounts([allocation.supervisorName, previous?.supervisorName ?? ""]);
  await noticeRacNeeded(allocation, previous);
  return { ok: true as const };
}

export async function removeAllocation(allocation: Allocation) {
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail && !allocation.id.startsWith("local-")) {
    await supabase.from("scholar_allocations").delete().eq("id", allocation.id);
  }
  const all = readAllocations().filter((item) => item.id !== allocation.id);
  window.localStorage.setItem(storageKeys.allocations, JSON.stringify(all));
  await refreshOffice();
  await refreshVacancyCounts([allocation.supervisorName]);
}

export type RacNomination = Pick<
  RacProposal,
  | "kind"
  | "scholarIdentifier"
  | "scholarName"
  | "supervisorIdentifier"
  | "supervisorName"
  | "nominees"
  | "reason"
>;

/** Internal members named per nomination; the Dean selects one. */
export const racInternalCount = 2;
/** External panel candidates named per nomination; the Dean selects one. */
export const racExternalCount = 3;

function nominationProblem(proposal: RacNomination) {
  const internal = proposal.nominees.filter((item) => item.side === "internal");
  const external = proposal.nominees.filter((item) => item.side === "external");
  if (internal.length !== racInternalCount) {
    return `Name ${racInternalCount} internal members.`;
  }
  if (external.length !== racExternalCount) {
    return `Name ${racExternalCount} candidates for the external panel.`;
  }
  const names = proposal.nominees.map((item) => item.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return "Each member can be named once.";
  }
  if (proposal.kind === "reconstitution" && proposal.reason.trim().length < 10) {
    return "Give the reason for changing the RAC.";
  }
  return null;
}

async function firstSaved(attempts: readonly (() => PromiseLike<{ error: unknown }>)[]) {
  for (const attempt of attempts) {
    const { error } = await attempt();
    if (!error) return true;
  }
  return false;
}

export async function saveRacProposal(proposal: RacNomination) {
  const blocked = officeViewWriteBlock();
  if (blocked) return blocked;
  const standing = racStanding(
    memory?.proposals ?? readProposals(),
    proposal.scholarIdentifier,
  );
  const pending = standing.pending;
  const editing =
    pending !== null &&
    sameId(pending.supervisorIdentifier, proposal.supervisorIdentifier);
  if (pending && !editing) {
    return {
      ok: false as const,
      message:
        "Another supervisor's nomination for this scholar is waiting for the Dean.",
    };
  }
  if (editing && pending && proposal.kind !== pending.kind) {
    return {
      ok: false as const,
      message: `The waiting nomination is a ${pending.kind}. Edit it as a ${pending.kind}.`,
    };
  }
  if (!editing) {
    if (!standing.canRequest) {
      return { ok: false as const, message: standing.blocked ?? "RAC is closed." };
    }
    if (proposal.kind !== standing.canRequest) {
      return {
        ok: false as const,
        message:
          standing.canRequest === "constitution"
            ? "The RAC is not constituted yet. Submit a constitution first."
            : "The RAC is already constituted. Submit a reconstitution to change it.",
      };
    }
  }
  const problem = nominationProblem(proposal);
  if (problem) return { ok: false as const, message: problem };

  const supabase = createSupabase();
  let stored = false;
  if (supabase && memory && !memory.detail) {
    if (editing && pending && !pending.id.startsWith("local-")) {
      stored = await firstSaved([
        () =>
          supabase
            .from("rac_proposals")
            .update({ nominees: toJson(proposal.nominees), reason: proposal.reason })
            .eq("id", pending.id)
            .eq("status", "Submitted"),
        () =>
          supabase
            .from("rac_proposals")
            .update({ nominees: toJson(proposal.nominees) })
            .eq("id", pending.id)
            .eq("status", "Submitted"),
      ]);
    } else if (!editing) {
      const row = {
        kind: proposal.kind,
        scholar_identifier: proposal.scholarIdentifier,
        scholar_name: proposal.scholarName,
        supervisor_identifier: proposal.supervisorIdentifier,
        supervisor_name: proposal.supervisorName,
        nominees: toJson(proposal.nominees),
      };
      stored = await firstSaved([
        () => supabase.from("rac_proposals").insert({ ...row, reason: proposal.reason }),
        () => supabase.from("rac_proposals").insert(row),
      ]);
    }
  }
  if (!stored) {
    const all = readProposals();
    const local = editing && pending ? all.find((item) => item.id === pending.id) : null;
    const next: RacProposal[] = local
      ? all.map((item) =>
          item.id === local.id
            ? { ...item, nominees: proposal.nominees, reason: proposal.reason }
            : item,
        )
      : [
          {
            ...proposal,
            id: `local-${crypto.randomUUID()}`,
            status: "Submitted",
            selectedInternal: "",
            selectedExternal: "",
            remarks: "",
            agenda: "",
            attendance: "",
            minutes: "",
            decidedOn: "",
            decidedBy: "",
            createdAt: new Date().toISOString(),
          },
          ...all,
        ];
    window.localStorage.setItem(storageKeys.racProposals, JSON.stringify(next));
  }
  await recordAudit({
    action: editing ? "rac:edited" : `rac:${proposal.kind}`,
    subject: proposal.scholarIdentifier,
    detail: `${proposal.scholarName} · ${proposal.supervisorName}`,
  });
  await notifyOffice({
    title: `RAC ${editing ? "nomination updated" : proposal.kind} · ${proposal.scholarName}`,
    detail: `${proposal.supervisorName} sent the nominations. The Dean selects the members.`,
    href: "/admin/rac",
  });
  await refreshOffice();
  return { ok: true as const, edited: editing };
}

type RacUpdate = Database["public"]["Tables"]["rac_proposals"]["Update"];

export async function decideRac(
  proposal: RacProposal,
  decision: {
    status: "Approved" | "Returned";
    selectedInternal: string;
    selectedExternal: string;
    remarks: string;
    agenda: string;
    attendance: string;
    minutes: string;
  },
) {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const signer = readPreviewSession();
  if (!signer || (signer.role !== "dean" && signer.role !== "admin")) {
    return {
      ok: false as const,
      message: "Only the Dean (or the administrator) selects RAC members.",
    };
  }
  const stored = (memory?.proposals ?? readProposals()).find(
    (item) => item.id === proposal.id,
  );
  if ((stored ?? proposal).status !== "Submitted") {
    return {
      ok: false as const,
      message: `This nomination is already ${(stored ?? proposal).status.toLowerCase()} and cannot be changed.`,
    };
  }
  if (decision.status === "Approved") {
    const internal = proposal.nominees.find(
      (item) => item.key === decision.selectedInternal && item.side === "internal",
    );
    const external = proposal.nominees.find(
      (item) => item.key === decision.selectedExternal && item.side === "external",
    );
    if (!internal || !external) {
      return {
        ok: false as const,
        message: "Select one internal member and one external panel member.",
      };
    }
    if (decision.minutes.trim().length < 2) {
      return { ok: false as const, message: "Enter the minutes before approving." };
    }
  }
  if (decision.status === "Returned" && decision.remarks.trim().length < 2) {
    return { ok: false as const, message: "Enter the remarks before returning." };
  }
  const decidedOn = new Date().toISOString().slice(0, 10);
  const decidedBy = signer.name.trim() || signer.identifier;
  const supabase = createSupabase();
  let saved = false;
  if (supabase && memory && !memory.detail && !proposal.id.startsWith("local-")) {
    const core = {
      status: decision.status,
      selected_internal: decision.selectedInternal,
      selected_external: decision.selectedExternal,
    };
    const notes = {
      remarks: decision.remarks,
      agenda: decision.agenda,
      attendance: decision.attendance,
      minutes: decision.minutes,
    };
    const update = (values: RacUpdate) => () =>
      supabase
        .from("rac_proposals")
        .update(values)
        .eq("id", proposal.id)
        .eq("status", "Submitted");
    saved = await firstSaved([
      update({ ...core, ...notes, decided_on: decidedOn, decided_by: decidedBy }),
      update({ ...core, ...notes }),
      update(core),
    ]);
  }
  if (!saved) {
    const all = readProposals().map((item) =>
      item.id === proposal.id
        ? {
            ...item,
            status: decision.status,
            selectedInternal: decision.selectedInternal,
            selectedExternal: decision.selectedExternal,
            remarks: decision.remarks,
            agenda: decision.agenda,
            attendance: decision.attendance,
            minutes: decision.minutes,
            decidedOn,
            decidedBy,
          }
        : item,
    );
    window.localStorage.setItem(storageKeys.racProposals, JSON.stringify(all));
  }
  await recordAudit({
    action: `rac:${decision.status}`,
    subject: proposal.id,
    detail: `${proposal.scholarName} · ${decidedBy} · ${decision.remarks}`.trim(),
  });
  const detail =
    decision.remarks || `The RAC nomination was ${decision.status.toLowerCase()}.`;
  await pushNotice({
    role: "scholar",
    identifier: proposal.scholarIdentifier,
    title: `RAC ${decision.status}`,
    detail,
    href: "/scholar/rac",
  });
  await pushNotice({
    role: "supervisor",
    identifier: proposal.supervisorIdentifier,
    title: `RAC ${decision.status} · ${proposal.scholarName}`,
    detail,
    href: "/supervisor/rac",
  });
  await refreshOffice();
  return { ok: true as const };
}

export function phdApplicationsOpen() {
  return currentOffice()?.settings.phdOpen ?? defaultSiteSettings.phdOpen;
}

export function supervisorApplicationsOpen() {
  return currentOffice()?.settings.supervisorOpen ?? defaultSiteSettings.supervisorOpen;
}
