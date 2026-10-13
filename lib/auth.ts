import { sessionEventName, sessionStorageKey } from "@/lib/constants";
import { loadPortalUsers } from "@/lib/users";
import type { Role } from "@/types";

export function notifySessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(sessionEventName));
}

export type LoginInput = {
  role: Role;
  identifier: string;
  password: string;
  remember: boolean;
};

export type LoginResult =
  { ok: true; redirectTo: string } | { ok: false; message: string };

export type PreviewSession = {
  role: Role;
  identifier: string;
  name: string;
};

const dashboards: Record<Role, string> = {
  scholar: "/scholar/dashboard",
  supervisor: "/supervisor/dashboard",
  admin: "/admin/dashboard",
};

export async function mockLogin(input: LoginInput): Promise<LoginResult> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const identifier = input.identifier.trim().toLowerCase();
  const { users } = await loadPortalUsers();
  const recognised = users.find(
    (account) =>
      account.role === input.role &&
      account.identifier.toLowerCase() === identifier &&
      account.password === input.password,
  );
  if (!recognised) {
    return {
      ok: false,
      message: "Those credentials were not recognised. Check the details and try again.",
    };
  }

  const session: PreviewSession = {
    role: input.role,
    identifier: input.identifier.trim(),
    name: recognised.name,
  };

  if (typeof window !== "undefined") {
    const payload = JSON.stringify(session);
    window.localStorage.removeItem(sessionStorageKey);
    window.sessionStorage.removeItem(sessionStorageKey);
    const store = input.remember ? window.localStorage : window.sessionStorage;
    store.setItem(sessionStorageKey, payload);
    notifySessionChange();
  }

  return { ok: true, redirectTo: dashboards[input.role] };
}

export function readPreviewSession(): PreviewSession | null {
  if (typeof window === "undefined") return null;
  const raw =
    window.localStorage.getItem(sessionStorageKey) ??
    window.sessionStorage.getItem(sessionStorageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PreviewSession;
    if (!parsed.identifier || !parsed.role) return null;
    return { ...parsed, name: parsed.name ?? "" };
  } catch {
    return null;
  }
}

export function clearPreviewSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(sessionStorageKey);
  window.sessionStorage.removeItem(sessionStorageKey);
  notifySessionChange();
}
