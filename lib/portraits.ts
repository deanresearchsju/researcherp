import { loadStoredApplications, type StoredApplication } from "@/lib/records";
import type { Json } from "@/types/database";

export type PortraitIndex = {
  byKey: Record<string, string>;
};

let memory: PortraitIndex | null = null;
let loading = false;
const listeners = new Set<() => void>();

function photoFromPayload(payload: Json) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const images = "images" in payload ? payload.images : null;
  if (!images || typeof images !== "object" || Array.isArray(images)) return null;
  const photo = "photo" in images ? images.photo : null;
  return typeof photo === "string" && photo.startsWith("data:") ? photo : null;
}

function key(value: string) {
  return value.trim().toLowerCase();
}

function indexRecords(records: StoredApplication[]): PortraitIndex {
  const byKey: Record<string, string> = {};
  for (const record of records) {
    const photo = photoFromPayload(record.payload);
    if (!photo) continue;
    for (const value of [record.email, record.applicationNo, record.applicantName]) {
      if (value.trim()) byKey[key(value)] = photo;
    }
  }
  return { byKey };
}

function publish(next: PortraitIndex) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function currentPortraits() {
  return memory;
}

export function subscribePortraits(onChange: () => void) {
  listeners.add(onChange);
  if (!loading && !memory) {
    loading = true;
    void loadStoredApplications().then((loaded) => {
      loading = false;
      publish(indexRecords(loaded.records));
    });
  }
  return () => listeners.delete(onChange);
}

/** The application-photo index, loading it when needed. */
export async function ensurePortraits() {
  if (memory) return memory;
  const loaded = await loadStoredApplications();
  publish(indexRecords(loaded.records));
  return memory ?? { byKey: {} };
}

export function portraitFor(
  index: PortraitIndex | null,
  identifier: string,
  name: string,
) {
  if (!index) return null;
  return index.byKey[key(identifier)] ?? index.byKey[key(name)] ?? null;
}
