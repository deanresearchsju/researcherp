import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import type { Role } from "@/types";

export type PortalUser = {
  id: string;
  role: Role;
  name: string;
  identifier: string;
  password: string;
  mustReset: boolean;
  menus: string[] | null;
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
  return [];
}

export function isRetiredSignIn(user: { role: Role; name: string; identifier: string }) {
  const identifier = user.identifier.trim().toLowerCase();
  if (user.role === "scholar" && identifier === "scholar@example.com") return true;
  if (
    user.role === "scholar" &&
    identifier === "sju/phd/2026/0001" &&
    user.name.trim().toLowerCase() === "sample scholar"
  ) {
    return true;
  }
  return (
    user.role === "supervisor" &&
    (identifier === "supervisor@sju.test" || identifier === "sup-1001")
  );
}

function readForcedReset(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKeys.mustReset);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item) => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function writeForcedReset(ids: Set<string>) {
  window.localStorage.setItem(storageKeys.mustReset, JSON.stringify([...ids]));
}

function rememberMustReset(id: string, required: boolean) {
  const ids = readForcedReset();
  if (required) ids.add(id);
  else ids.delete(id);
  writeForcedReset(ids);
}

function missingResetColumn(message: string) {
  return /must_reset/i.test(message);
}

function missingMenuColumn(message: string) {
  return /menu_rights/i.test(message);
}

function readMenuStore(): Map<string, string[]> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(storageKeys.menuRights);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
    return new Map(
      Object.entries(parsed).flatMap(([id, value]) => {
        if (!Array.isArray(value)) return [];
        const menus = value.filter((item): item is string => typeof item === "string");
        return [[id, menus]];
      }),
    );
  } catch {
    return new Map();
  }
}

function writeMenuStore(id: string, menus: string[] | null) {
  const current = readMenuStore();
  if (menus === null) current.delete(id);
  else current.set(id, menus);
  window.localStorage.setItem(
    storageKeys.menuRights,
    JSON.stringify(Object.fromEntries(current)),
  );
}

function parseMenus(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is string => typeof item === "string" && item.startsWith("/"),
  );
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
          mustReset: record.mustReset === true,
          menus: parseMenus(record.menus),
        },
      ];
    });
    const active = users.filter((user) => !isRetiredSignIn(user));
    return active.length > 0 ? active : seedUsers();
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
  must_reset?: boolean;
  menu_rights?: unknown;
};

function mapUser(row: UserRow, menusFromColumn: boolean): PortalUser | null {
  if (!isRole(row.role)) return null;
  const forced = readForcedReset();
  const user = {
    id: row.id,
    role: row.role,
    name: row.name,
    identifier: row.identifier,
    password: row.password,
    mustReset: row.must_reset === true || forced.has(row.id),
    menus: menusFromColumn
      ? parseMenus(row.menu_rights)
      : (readMenuStore().get(row.id) ?? null),
  };
  return isRetiredSignIn(user) ? null : user;
}

export async function loadPortalUsers(): Promise<UserLoad> {
  const supabase = createSupabase();
  if (!supabase) {
    return { users: readBrowserUsers(), source: "browser", detail: null };
  }

  const full = await supabase
    .from("portal_users")
    .select("id, role, name, identifier, password, must_reset, menu_rights")
    .order("role", { ascending: true })
    .order("identifier", { ascending: true });

  const withoutMenus =
    full.error && missingMenuColumn(full.error.message)
      ? await supabase
          .from("portal_users")
          .select("id, role, name, identifier, password, must_reset")
          .order("role", { ascending: true })
          .order("identifier", { ascending: true })
      : null;

  const chosen = withoutMenus ?? full;
  const legacy =
    chosen.error && missingResetColumn(chosen.error.message)
      ? await supabase
          .from("portal_users")
          .select("id, role, name, identifier, password")
          .order("role", { ascending: true })
          .order("identifier", { ascending: true })
      : null;

  const data = legacy ? legacy.data : chosen.data;
  const error = legacy ? legacy.error : chosen.error;
  const menusFromColumn = !withoutMenus && !legacy;

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
      const user = mapUser(row, menusFromColumn);
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

export function publishPortalUsers(next: UserLoad) {
  publish(next);
}

export function readStoredPortalUsers() {
  return readBrowserUsers();
}

export function writeStoredPortalUsers(users: PortalUser[], detail: string | null) {
  writeBrowserUsers(users);
  publish({ users, source: "browser", detail });
}

export async function insertPortalUsers(
  rows: {
    role: Role;
    name: string;
    identifier: string;
    password: string;
    mustReset: boolean;
  }[],
): Promise<
  | { ok: true; users: PortalUser[]; resetStoredLocally: boolean }
  | { ok: false; message: string }
> {
  const supabase = createSupabase();
  if (!supabase) {
    return { ok: false, message: "The user table is not in the database yet." };
  }
  if (rows.length === 0) return { ok: true, users: [], resetStoredLocally: false };

  const inserted = await supabase
    .from("portal_users")
    .insert(
      rows.map((row) => ({
        role: row.role,
        name: row.name,
        identifier: row.identifier,
        password: row.password,
        must_reset: row.mustReset,
      })),
    )
    .select("id, role, name, identifier, password, must_reset");

  if (inserted.error && missingResetColumn(inserted.error.message)) {
    const retry = await supabase
      .from("portal_users")
      .insert(
        rows.map((row) => ({
          role: row.role,
          name: row.name,
          identifier: row.identifier,
          password: row.password,
        })),
      )
      .select("id, role, name, identifier, password");
    if (retry.error || !retry.data) {
      return {
        ok: false,
        message: retry.error?.message ?? "Those sign-ins could not be created.",
      };
    }
    for (const row of retry.data) {
      const source = rows.find(
        (item) =>
          item.role === row.role &&
          item.identifier.toLowerCase() === row.identifier.toLowerCase(),
      );
      if (source?.mustReset) rememberMustReset(row.id, true);
    }
    return {
      ok: true,
      users: retry.data.flatMap((row) => {
        const user = mapUser(row, false);
        return user ? [user] : [];
      }),
      resetStoredLocally: true,
    };
  }

  if (inserted.error || !inserted.data) {
    return {
      ok: false,
      message: inserted.error?.message ?? "Those sign-ins could not be created.",
    };
  }

  return {
    ok: true,
    users: inserted.data.flatMap((row) => {
      const user = mapUser(row, false);
      return user ? [user] : [];
    }),
    resetStoredLocally: false,
  };
}

export async function updatePortalUser(
  user: PortalUser,
  next: { name: string; password: string; mustReset: boolean; menus: string[] | null },
  source: UserSource,
) {
  const updated: PortalUser = {
    ...user,
    name: next.name.trim(),
    password: next.password,
    mustReset: next.mustReset,
    menus: next.menus,
  };

  if (source === "database" && !user.id.startsWith("seed-")) {
    const supabase = createSupabase();
    if (!supabase) return { ok: false as const, user };
    const saved = await supabase
      .from("portal_users")
      .update({
        name: updated.name,
        password: updated.password,
        must_reset: updated.mustReset,
        menu_rights: updated.menus,
      })
      .eq("id", user.id);
    if (saved.error && missingMenuColumn(saved.error.message)) {
      writeMenuStore(user.id, updated.menus);
      const retry = await supabase
        .from("portal_users")
        .update({
          name: updated.name,
          password: updated.password,
          must_reset: updated.mustReset,
        })
        .eq("id", user.id);
      if (retry.error && missingResetColumn(retry.error.message)) {
        const plain = await supabase
          .from("portal_users")
          .update({ name: updated.name, password: updated.password })
          .eq("id", user.id);
        if (plain.error) return { ok: false as const, user };
        rememberMustReset(user.id, updated.mustReset);
      } else if (retry.error) {
        return { ok: false as const, user };
      }
    } else if (saved.error && missingResetColumn(saved.error.message)) {
      const retry = await supabase
        .from("portal_users")
        .update({
          name: updated.name,
          password: updated.password,
          menu_rights: updated.menus,
        })
        .eq("id", user.id);
      if (retry.error) return { ok: false as const, user };
      rememberMustReset(user.id, updated.mustReset);
    } else if (saved.error) {
      return { ok: false as const, user };
    } else {
      rememberMustReset(user.id, false);
    }
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

export async function createPortalUser(
  input: {
    role: Role;
    name: string;
    identifier: string;
    password: string;
    menus: string[] | null;
  },
  source: UserSource,
) {
  const identifier = input.identifier.trim();
  const name = input.name.trim();
  const current = memory?.users ?? (await loadPortalUsers()).users;
  const taken = current.some(
    (user) =>
      user.role === input.role &&
      user.identifier.toLowerCase() === identifier.toLowerCase(),
  );
  if (taken) {
    return {
      ok: false as const,
      message: "That sign-in id already has this access.",
    };
  }

  const supabase = createSupabase();
  if (source === "database") {
    if (!supabase)
      return { ok: false as const, message: "That user could not be created." };
    const inserted = await supabase
      .from("portal_users")
      .insert({
        role: input.role,
        name,
        identifier,
        password: input.password,
        must_reset: true,
        menu_rights: input.menus,
      })
      .select("id, role, name, identifier, password, must_reset")
      .single();
    const withoutMenus =
      inserted.error && missingMenuColumn(inserted.error.message)
        ? await supabase
            .from("portal_users")
            .insert({
              role: input.role,
              name,
              identifier,
              password: input.password,
              must_reset: true,
            })
            .select("id, role, name, identifier, password, must_reset")
            .single()
        : null;
    const chosen = withoutMenus ?? inserted;
    const fallback =
      chosen.error && missingResetColumn(chosen.error.message)
        ? await supabase
            .from("portal_users")
            .insert({
              role: input.role,
              name,
              identifier,
              password: input.password,
            })
            .select("id, role, name, identifier, password")
            .single()
        : null;
    const data = fallback ? fallback.data : chosen.data;
    const error = fallback ? fallback.error : chosen.error;
    const user = data
      ? mapUser({ ...data, must_reset: true, menu_rights: input.menus }, true)
      : null;
    if (user && withoutMenus) writeMenuStore(user.id, input.menus);
    if (user && fallback) rememberMustReset(user.id, true);
    if (error || !user) {
      return { ok: false as const, message: "That user could not be created." };
    }
    if (memory) {
      publish({ ...memory, users: [...memory.users, user] });
    }
    return { ok: true as const, user };
  }

  const user: PortalUser = {
    id: `local-${crypto.randomUUID()}`,
    role: input.role,
    name,
    identifier,
    password: input.password,
    mustReset: true,
    menus: input.menus,
  };
  const users = [...readBrowserUsers(), user];
  writeBrowserUsers(users);
  publish({ users, source: "browser", detail: memory?.detail ?? null });
  return { ok: true as const, user };
}

export async function removePortalUser(user: PortalUser, source: UserSource) {
  const supabase = createSupabase();
  if (
    source === "database" &&
    !user.id.startsWith("seed-") &&
    !user.id.startsWith("local-")
  ) {
    if (!supabase) return { ok: false as const };
    const { error } = await supabase.from("portal_users").delete().eq("id", user.id);
    if (error) return { ok: false as const };
    if (memory) {
      publish({
        ...memory,
        users: memory.users.filter((item) => item.id !== user.id),
      });
    }
    return { ok: true as const };
  }

  const users = readBrowserUsers().filter((item) => item.id !== user.id);
  writeBrowserUsers(users);
  publish({ users, source: "browser", detail: memory?.detail ?? null });
  return { ok: true as const };
}
