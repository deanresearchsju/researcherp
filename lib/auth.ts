import { sessionEventName, sessionStorageKey } from "@/lib/constants";
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
  mustReset: boolean;
  menus?: string[] | null;
};

const dashboards: Record<Role, string> = {
  scholar: "/scholar/dashboard",
  supervisor: "/supervisor/dashboard",
  admin: "/admin/dashboard",
};

export function portalHome(role: Role) {
  return dashboards[role];
}

export async function mockLogin(input: LoginInput): Promise<LoginResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: input.role,
      identifier: input.identifier,
      password: input.password,
      remember: input.remember,
    }),
  });
  let payload:
    | { ok: true; redirectTo: string; session: PreviewSession }
    | { ok: false; message: string };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return {
      ok: false,
      message:
        response.status >= 500
          ? "Sign-in is not available yet."
          : "Those credentials were not recognised. Check the details and try again.",
    };
  }
  if (!payload.ok) {
    return { ok: false, message: payload.message };
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(sessionStorageKey);
    window.sessionStorage.removeItem(sessionStorageKey);
    const store = input.remember ? window.localStorage : window.sessionStorage;
    store.setItem(sessionStorageKey, JSON.stringify(payload.session));
    notifySessionChange();
  }
  return { ok: true, redirectTo: payload.redirectTo };
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
    return {
      ...parsed,
      name: parsed.name ?? "",
      mustReset: parsed.mustReset === true,
      menus: parsed.menus,
    };
  } catch {
    return null;
  }
}

export function replacePreviewSession(session: PreviewSession) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(session);
  if (window.localStorage.getItem(sessionStorageKey)) {
    window.localStorage.setItem(sessionStorageKey, payload);
  } else {
    window.sessionStorage.setItem(sessionStorageKey, payload);
  }
  notifySessionChange();
}

export function clearPreviewSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(sessionStorageKey);
  window.sessionStorage.removeItem(sessionStorageKey);
  notifySessionChange();
  void fetch("/api/auth/logout", { method: "POST" });
}
