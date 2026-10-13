import { testAccounts } from "@/data/test-accounts";
import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import type { Role } from "@/types";

export type PortalUser = {
  id: string;
  role: Role;
  name: string;
  identifier: string;
  password: string;
};

export type UserSource = "database" | "browser";

export type UserLoad = {
  users: PortalUser[];
  source: UserSource;
  detail: string | null;
};

export const userMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013161000_portal_users.sql. Until then, name and password changes stay in this browser.";

const roles: readonly Role[] = ["scholar", "supervisor", "admin"];

function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}

export function seedUsers(): PortalUser[] {
  return testAccounts.map((account) => ({
    id: `seed-${account.role}-${account.identifier.toLowerCase()}`,
    role: account.role,
    name: account.name,
    identifier: account.identifier,
    password: account.password,
  }));
}

function readBrowserUsers(): PortalUser[] {
  if (typeof window === "undefined") return seedUsers();
  try {
    const raw = window.localStorage.getItem(storageKeys.portalUsers);
    if (!raw) return seedUsers();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedUsers();
    const users = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Partial<PortalUser>;
      if (
        !record.id ||
        !record.role ||
        !isRole(record.role) ||
        !record.identifier ||
        !record.password
      ) {
        return [];
      }
      return [
        {
          id: record.id,
          role: record.role,
          name: record.name?.trim() || record.identifier,
          identifier: record.identifier,
          password: record.password,
        },
      ];
    });
    return users.length > 0 ? users : seedUsers();
  } catch {
    return seedUsers();
  }
}

function writeBrowserUsers(users: PortalUser[]) {
  window.localStorage.setItem(storageKeys.portalUsers, JSON.stringify(users));
}

type UserRow = {
  id: string;
  role: string;
  name: string;
  identifier: string;
  password: string;
};

function mapUser(row: UserRow): PortalUser | null {
  if (!isRole(row.role)) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    identifier: row.identifier,
    password: row.password,
  };
}

export async function loadPortalUsers(): Promise<UserLoad> {
  const supabase = createSupabase();
  if (!supabase) {
    return { users: readBrowserUsers(), source: "browser", detail: null };
  }

  const { data, error } = await supabase
    .from("portal_users")
    .select("id, role, name, identifier, password")
    .order("role", { ascending: true })
    .order("identifier", { ascending: true });

  if (error || !data) {
    return {
      users: readBrowserUsers(),
      source: "browser",
      detail: "The user table is not in the database yet.",
    };
  }

  if (data.length === 0) {
    return { users: seedUsers(), source: "browser", detail: "The user table is empty." };
  }

  return {
    users: data.flatMap((row) => {
      const user = mapUser(row);
      return user ? [user] : [];
    }),
    source: "database",
    detail: null,
  };
}

let memory: UserLoad | null = null;
let loading = false;
const listeners = new Set<() => void>();

export function subscribePortalUsers(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    void loadPortalUsers().then((value) => {
      memory = value;
      loading = false;
      listeners.forEach((listener) => listener());
    });
  }
  return () => listeners.delete(onChange);
}

export function currentPortalUsers() {
  return memory;
}

function publish(next: UserLoad) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export async function updatePortalUser(
  user: PortalUser,
  next: { name: string; password: string },
  source: UserSource,
) {
  const updated: PortalUser = {
    ...user,
    name: next.name.trim(),
    password: next.password,
  };

  if (source === "database" && !user.id.startsWith("seed-")) {
    const supabase = createSupabase();
    if (!supabase) return { ok: false as const, user };
    const { error } = await supabase
      .from("portal_users")
      .update({ name: updated.name, password: updated.password })
      .eq("id", user.id);
    if (error) return { ok: false as const, user };
    if (memory) {
      publish({
        ...memory,
        users: memory.users.map((item) => (item.id === user.id ? updated : item)),
      });
    }
    return { ok: true as const, user: updated };
  }

  const users = readBrowserUsers().map((item) => (item.id === user.id ? updated : item));
  writeBrowserUsers(users);
  publish({
    users,
    source: "browser",
    detail: memory?.detail ?? null,
  });
  return { ok: true as const, user: updated };
}
