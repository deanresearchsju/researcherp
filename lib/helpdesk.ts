import { storageKeys } from "@/lib/constants";
import { clientNowIso } from "@/lib/dates";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type HelpdeskMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
};

export type HelpdeskLoad = {
  items: HelpdeskMessage[];
  source: "database" | "browser";
};

export type HelpdeskDraft = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export const helpdeskMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261018130000_helpdesk_messages.sql. Until then, helpdesk messages stay in this browser.";

function asTrimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseHelpdeskMessage(value: unknown): HelpdeskMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asTrimmed(row.id);
  const name = asTrimmed(row.name);
  const email = asTrimmed(row.email);
  const phone = asTrimmed(row.phone);
  const subject = asTrimmed(row.subject);
  const message = asTrimmed(row.message);
  const createdAt = asTrimmed(row.createdAt) || asTrimmed(row.created_at);
  if (!id || !name || !email || !phone || !subject || !message || !createdAt) {
    return null;
  }
  return { id, name, email, phone, subject, message, createdAt };
}

function readLocal(): HelpdeskMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKeys.helpdesk);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const row = parseHelpdeskMessage(item);
      return row ? [row] : [];
    });
  } catch {
    return [];
  }
}

function writeLocal(items: HelpdeskMessage[]) {
  window.localStorage.setItem(storageKeys.helpdesk, JSON.stringify(items));
}

export function localHelpdeskMessages() {
  return readLocal();
}

export function subscribeHelpdesk(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKeys.helpdesk) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function rememberHelpdeskMessage(values: HelpdeskDraft): HelpdeskMessage {
  const row: HelpdeskMessage = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `local-${clientNowIso()}`,
    name: values.name,
    email: values.email,
    phone: values.phone,
    subject: values.subject,
    message: values.message,
    createdAt: clientNowIso(),
  };
  const next = [row, ...readLocal()].slice(0, 200);
  writeLocal(next);
  return row;
}

export function mergeHelpdeskMessages(
  remote: HelpdeskMessage[],
  local: HelpdeskMessage[],
) {
  const seen = new Set(remote.map((item) => item.id));
  const extras = local.filter((item) => !seen.has(item.id));
  return [...remote, ...extras].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || (error.message ?? "").includes("helpdesk_messages");
}

export async function loadHelpdeskMessages(): Promise<HelpdeskLoad> {
  const supabase = createAdminSupabase();
  if (!supabase) return { items: [], source: "browser" };
  const { data, error } = await supabase
    .from("helpdesk_messages")
    .select("id, name, email, phone, subject, message, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingTable(error)) console.error(error);
    return { items: [], source: "browser" };
  }
  return {
    items: (data ?? []).flatMap((row) => {
      const item = parseHelpdeskMessage(row);
      return item ? [item] : [];
    }),
    source: "database",
  };
}
