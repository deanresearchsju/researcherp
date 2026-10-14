import { sessionStorageKey, storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import type { Notice, Role } from "@/types";

export type AuditEntry = {
  id: string;
  at: string;
  actorRole: string;
  actorIdentifier: string;
  action: string;
  subject: string;
  detail: string;
};

export type InboxNotice = Notice & {
  role: Role;
  identifier: string;
};

function actorFromBrowser() {
  if (typeof window === "undefined") {
    return { role: "unknown", identifier: "unknown" };
  }
  try {
    const raw =
      window.localStorage.getItem(sessionStorageKey) ??
      window.sessionStorage.getItem(sessionStorageKey);
    if (!raw) return { role: "unknown", identifier: "unknown" };
    const parsed = JSON.parse(raw) as { role?: string; identifier?: string };
    return {
      role: parsed.role ?? "unknown",
      identifier: parsed.identifier ?? "unknown",
    };
  } catch {
    return { role: "unknown", identifier: "unknown" };
  }
}

function readLocal<T>(key: string, fallback: T) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const inboxListeners = new Set<() => void>();
let inboxMemory: InboxNotice[] | null = null;

function publishInbox(next: InboxNotice[]) {
  inboxMemory = next;
  inboxListeners.forEach((listener) => listener());
}

export function currentInbox() {
  return inboxMemory;
}

export function subscribeInbox(onChange: () => void) {
  inboxListeners.add(onChange);
  if (inboxMemory === null) {
    inboxMemory = readLocal<InboxNotice[]>(storageKeys.inbox, []);
    onChange();
  }
  return () => inboxListeners.delete(onChange);
}

export async function recordAudit(input: {
  action: string;
  subject: string;
  detail: string;
  actorRole?: string;
  actorIdentifier?: string;
}) {
  const actor = actorFromBrowser();
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorRole: input.actorRole ?? actor.role,
    actorIdentifier: input.actorIdentifier ?? actor.identifier,
    action: input.action,
    subject: input.subject,
    detail: input.detail,
  };
  const supabase = createSupabase();
  if (supabase) {
    await supabase.from("audit_log").insert({
      actor_role: entry.actorRole,
      actor_identifier: entry.actorIdentifier,
      action: entry.action,
      subject: entry.subject,
      detail: entry.detail,
    });
  }
  if (typeof window !== "undefined") {
    const stored = readLocal<AuditEntry[]>(storageKeys.auditLog, []);
    window.localStorage.setItem(
      storageKeys.auditLog,
      JSON.stringify([entry, ...stored].slice(0, 200)),
    );
  }
}

export async function pushNotice(input: {
  role: Role;
  identifier: string;
  title: string;
  detail: string;
}) {
  const notice: InboxNotice = {
    id: crypto.randomUUID(),
    role: input.role,
    identifier: input.identifier,
    title: input.title,
    detail: input.detail,
    time: new Date().toISOString().slice(0, 10),
  };
  const supabase = createSupabase();
  if (supabase) {
    await supabase.from("portal_notices").insert({
      role: notice.role,
      identifier: notice.identifier,
      title: notice.title,
      detail: notice.detail,
    });
  }
  if (typeof window !== "undefined") {
    const stored = readLocal<InboxNotice[]>(storageKeys.inbox, []);
    const next = [notice, ...stored].slice(0, 50);
    window.localStorage.setItem(storageKeys.inbox, JSON.stringify(next));
    publishInbox(next);
  }
}

export function noticesFor(role: Role, identifier: string, items: InboxNotice[]) {
  const key = identifier.trim().toLowerCase();
  return items.filter(
    (item) => item.role === role && item.identifier.trim().toLowerCase() === key,
  );
}
