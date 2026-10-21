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

export type InboxNotice = Notice & {
  /** Page the notice is about; opening it clears the notice. */
  href: string;
};

/** Role value for notices meant for the whole research office (admin, Dean and staff). */
export const officeNoticeRole = "office";

const inboxListeners = new Set<() => void>();
let inboxMemory: InboxNotice[] | null = null;
let inboxTimer: number | null = null;
let inboxLoading = false;
const pendingReads = new Set<string>();

function publishInbox(next: InboxNotice[]) {
  inboxMemory = next;
  inboxListeners.forEach((listener) => listener());
}

export function currentInbox() {
  return inboxMemory;
}

/** Loads the signed-in person's unread notices from the server. */
export async function refreshInbox() {
  if (typeof window === "undefined" || inboxLoading) return;
  inboxLoading = true;
  try {
    const response = await fetch("/api/notices", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as {
      notices?: { id: string; title: string; detail: string; href: string; at: string }[];
    } | null;
    const notices = (data?.notices ?? [])
      .filter((item) => !pendingReads.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        href: item.href ?? "",
        time: item.at,
      }));
    publishInbox(notices);
  } catch {
    if (inboxMemory === null) publishInbox([]);
  } finally {
    inboxLoading = false;
  }
}

export function subscribeInbox(onChange: () => void) {
  inboxListeners.add(onChange);
  if (typeof window !== "undefined" && inboxTimer === null) {
    void refreshInbox();
    inboxTimer = window.setInterval(() => void refreshInbox(), 60_000);
    window.addEventListener("focus", () => void refreshInbox());
  }
  return () => {
    inboxListeners.delete(onChange);
  };
}

/** Clears notices once opened; they stay cleared on every device. */
export async function markNoticesRead(ids: readonly string[]) {
  const fresh = ids.filter((id) => !pendingReads.has(id));
  if (fresh.length === 0) return;
  fresh.forEach((id) => pendingReads.add(id));
  publishInbox((inboxMemory ?? []).filter((item) => !fresh.includes(item.id)));
  await fetch("/api/notices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read", ids: fresh }),
  }).catch(() => null);
}

type NoticeInput = {
  role: Role | typeof officeNoticeRole;
  identifier: string;
  title: string;
  detail: string;
  href?: string;
};

async function sendNotices(notices: readonly NoticeInput[]) {
  if (typeof window === "undefined" || notices.length === 0) return;
  await fetch("/api/notices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "push", notices }),
  }).catch(() => null);
}

/** Sends a notice to one person (scholar, supervisor or office account). */
export async function pushNotice(input: NoticeInput) {
  if (!input.identifier.trim()) return;
  await sendNotices([input]);
}

/** Sends a notice to the whole research office: every admin, Dean and staff sign-in. */
export async function notifyOffice(input: {
  title: string;
  detail: string;
  href?: string;
}) {
  await sendNotices([{ role: officeNoticeRole, identifier: "*", ...input }]);
}

/** Notices are already scoped to the signed-in person by the server. */
export function noticesFor(_role: Role, _identifier: string, items: InboxNotice[]) {
  return items;
}
