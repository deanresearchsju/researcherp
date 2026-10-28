import { readPreviewSession } from "@/lib/auth";
import { saveJsonBlob } from "@/lib/json-lock";
import { createSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

/**
 * Who has guided each scholar, in order: every allotment, change and transfer of a guide. It is
 * for the administrator and the Dean only; it is read only when they open it, and neither the
 * supervisor nor the scholar has a screen that shows it.
 */
export type GuideChange = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  fromName: string;
  fromIdentifier: string;
  toName: string;
  toIdentifier: string;
  kind: "Allotted" | "Changed" | "Removed";
  /** The moment of the change (ISO). */
  on: string;
  by: string;
  role: string;
};

const table = "admission_office" as const;
const rowId = "guide_history";
const browserKey = "sju-guide-history";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parse(value: unknown): GuideChange[] {
  const list = (value as { changes?: unknown } | null)?.changes;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = text(row.id);
    if (!id) return [];
    const kind = text(row.kind);
    return [
      {
        id,
        scholarIdentifier: text(row.scholarIdentifier),
        scholarName: text(row.scholarName),
        fromName: text(row.fromName),
        fromIdentifier: text(row.fromIdentifier),
        toName: text(row.toName),
        toIdentifier: text(row.toIdentifier),
        kind: kind === "Changed" || kind === "Removed" ? kind : "Allotted",
        on: text(row.on),
        by: text(row.by),
        role: text(row.role),
      },
    ];
  });
}

async function read() {
  const supabase = createSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .select("payload, updated_at")
      .eq("id", rowId)
      .maybeSingle();
    if (!error) {
      return {
        changes: parse(data?.payload),
        stamp: data?.updated_at ?? null,
        remote: true,
      };
    }
  }
  try {
    const saved = window.localStorage.getItem(browserKey);
    return { changes: saved ? parse(JSON.parse(saved)) : [], stamp: null, remote: false };
  } catch {
    return { changes: [], stamp: null, remote: false };
  }
}

async function write(changes: GuideChange[], stamp: string | null, remote: boolean) {
  if (remote) {
    const saved = await saveJsonBlob(table, rowId, { changes } as unknown as Json, stamp);
    if (saved.ok) return true;
    if (saved.conflict) return false;
  }
  try {
    window.localStorage.setItem(browserKey, JSON.stringify({ changes }));
    return true;
  } catch {
    return false;
  }
}

/** The history for the administrator and the Dean, newest first. */
export async function loadGuideHistory() {
  const role = readPreviewSession()?.role;
  if (role !== "admin" && role !== "dean") return [];
  const { changes } = await read();
  return [...changes].sort((a, b) => b.on.localeCompare(a.on));
}

type ChangeInput = Pick<
  GuideChange,
  | "scholarIdentifier"
  | "scholarName"
  | "fromName"
  | "fromIdentifier"
  | "toName"
  | "toIdentifier"
  | "kind"
>;

/** Adds one entry; a failure here never blocks the allotment itself. */
export async function recordGuideChange(entry: ChangeInput) {
  try {
    const session = readPreviewSession();
    const change: GuideChange = {
      ...entry,
      id: crypto.randomUUID(),
      on: new Date().toISOString(),
      by: session?.name?.trim() || session?.identifier || "",
      role: session?.role ?? "",
    };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await read();
      if (await write([...current.changes, change], current.stamp, current.remote))
        return;
    }
  } catch {
    // The history is a record; it must not stop the work it records.
  }
}

/** Drops the entries of scholars taken out of the ERP again (a taken-back admission session). */
export async function forgetGuideHistory(identifiers: readonly string[]) {
  const wanted = identifiers.map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await read();
      const kept = current.changes.filter(
        (item) => !wanted.includes(item.scholarIdentifier.trim().toLowerCase()),
      );
      if (kept.length === current.changes.length) return;
      if (await write(kept, current.stamp, current.remote)) return;
    }
  } catch {
    // Nothing to clean up.
  }
}
