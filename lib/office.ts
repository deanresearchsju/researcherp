import { admissionWindow } from "@/data/home";
import { heroCopy } from "@/data/sections";
import {
  scholarRecordKinds,
  type RecordStatus,
  type ScholarRecordKind,
} from "@/data/scholar-records";
import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";
import { currentRegister, loadRegister, vacancyBeforeAllotment } from "@/lib/register";
import { syncAllottedVacancies } from "@/lib/vacancies";
import type { Json } from "@/types/database";

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

export type Allocation = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
};

export type RacNominee = {
  key: "internal-1" | "internal-2" | "external-1" | "external-2";
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

export function presentRac(proposals: RacProposal[], scholarIdentifier: string) {
  const latest = proposals
    .filter(
      (item) =>
        item.status === "Approved" && sameId(item.scholarIdentifier, scholarIdentifier),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!latest) return null;
  const internal = latest.nominees.find((item) => item.key === latest.selectedInternal);
  const external = latest.nominees.find((item) => item.key === latest.selectedExternal);
  if (!internal || !external) return null;
  return {
    guide: latest.supervisorName,
    internal,
    external,
    approvedOn: latest.createdAt,
  };
}

const nomineeKeys = ["internal-1", "internal-2", "external-1", "external-2"] as const;

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
  return Array.isArray(stored) ? stored : [];
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
      await refreshOffice();
      return { ok: true as const };
    }
  }
  window.localStorage.setItem(storageKeys.siteSettings, JSON.stringify(settings));
  await refreshOffice();
  return { ok: true as const };
}

async function refreshVacancyCounts(names: readonly string[]) {
  await syncAllottedVacancies(memory?.allocations ?? readAllocations(), names);
}

export async function saveAllocation(
  allocation: Omit<Allocation, "id"> & { id?: string },
) {
  const existing = memory?.allocations ?? readAllocations();
  const previous = existing.find((item) =>
    sameId(item.scholarIdentifier, allocation.scholarIdentifier),
  );
  const register = currentRegister() ?? (await loadRegister());
  const room = vacancyBeforeAllotment(allocation, existing, register.quotas);
  if (room && !room.keeping && room.vacancy < 1) {
    return { ok: false as const, message: `${room.supervisor.name} has no vacancy.` };
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

export async function saveRacProposal(
  proposal: Omit<
    RacProposal,
    "id" | "createdAt" | "status" | "selectedInternal" | "selectedExternal"
  >,
) {
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const { error } = await supabase.from("rac_proposals").insert({
      kind: proposal.kind,
      scholar_identifier: proposal.scholarIdentifier,
      scholar_name: proposal.scholarName,
      supervisor_identifier: proposal.supervisorIdentifier,
      supervisor_name: proposal.supervisorName,
      nominees: toJson(proposal.nominees),
    });
    if (!error) {
      await refreshOffice();
      return { ok: true as const };
    }
  }
  const all = readProposals();
  all.unshift({
    ...proposal,
    id: `local-${crypto.randomUUID()}`,
    status: "Submitted",
    selectedInternal: "",
    selectedExternal: "",
    createdAt: new Date().toISOString(),
  });
  window.localStorage.setItem(storageKeys.racProposals, JSON.stringify(all));
  await refreshOffice();
  return { ok: true as const };
}

export async function decideRac(
  proposal: RacProposal,
  decision: {
    status: "Approved" | "Returned";
    selectedInternal: string;
    selectedExternal: string;
  },
) {
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail && !proposal.id.startsWith("local-")) {
    const { error } = await supabase
      .from("rac_proposals")
      .update({
        status: decision.status,
        selected_internal: decision.selectedInternal,
        selected_external: decision.selectedExternal,
      })
      .eq("id", proposal.id);
    if (!error) {
      await refreshOffice();
      return true;
    }
  }
  const all = readProposals().map((item) =>
    item.id === proposal.id
      ? {
          ...item,
          status: decision.status,
          selectedInternal: decision.selectedInternal,
          selectedExternal: decision.selectedExternal,
        }
      : item,
  );
  window.localStorage.setItem(storageKeys.racProposals, JSON.stringify(all));
  await refreshOffice();
  return true;
}

export function phdApplicationsOpen() {
  return currentOffice()?.settings.phdOpen ?? defaultSiteSettings.phdOpen;
}

export function supervisorApplicationsOpen() {
  return currentOffice()?.settings.supervisorOpen ?? defaultSiteSettings.supervisorOpen;
}
