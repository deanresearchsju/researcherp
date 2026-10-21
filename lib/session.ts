import {
  menuActionKey,
  menuActionKinds,
  menuHrefs,
  parseMenuActionKey,
  rightsMarker,
} from "@/lib/access";
import { ROLES, type Role } from "@/types";

export const sessionCookieName = "sju-portal-session";

export type CookieSession = {
  role: Role;
  identifier: string;
  name: string;
  mustReset: boolean;
  menus: string[] | null;
};

/**
 * Rights are packed as one base-32 flag per catalog menu so the cookie stays under the
 * browser's 4 KB limit; a full office rights list written out in full is about 7 KB.
 */
type CookiePayload = Omit<CookieSession, "menus"> & {
  exp: number;
  menus?: string[] | null;
  m?: string;
  mc?: string;
};

function catalogStamp(role: Role) {
  let hash = 2166136261;
  for (const char of menuHrefs(role).join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function packMenus(role: Role, menus: string[]) {
  const flags = new Map<string, number>();
  menus.forEach((item) => {
    const action = parseMenuActionKey(item);
    const href = action ? action.href : item;
    const bit = action ? 2 << menuActionKinds.indexOf(action.action) : 1;
    flags.set(href, (flags.get(href) ?? 0) | bit);
  });
  const version = menus.includes(rightsMarker) ? "2" : "1";
  return (
    version +
    menuHrefs(role)
      .map((href) => (flags.get(href) ?? 0).toString(32))
      .join("")
  );
}

function unpackMenus(role: Role, packed: string) {
  const menus: string[] = [];
  menuHrefs(role).forEach((href, index) => {
    const flags = Number.parseInt(packed.charAt(index + 1) || "0", 32);
    if (flags & 1) menus.push(href);
    menuActionKinds.forEach((action, bit) => {
      if (flags & (2 << bit)) menus.push(menuActionKey(href, action));
    });
  });
  if (packed.startsWith("2")) menus.push(rightsMarker);
  return menus;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function secret() {
  return (
    process.env.SESSION_SECRET || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
  );
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const raw = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(raw);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function encodeSessionCookie(session: CookieSession, remember: boolean) {
  if (!secret()) return null;
  const { menus, ...rest } = session;
  const payload: CookiePayload = {
    ...rest,
    exp: Date.now() + (remember ? 7 : 1) * 24 * 60 * 60 * 1000,
    ...(menus === null
      ? { menus: null }
      : { m: packMenus(session.role, menus), mc: catalogStamp(session.role) }),
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

export async function decodeSessionCookie(token: string | undefined) {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await sign(body);
  if (signature.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < signature.length; i += 1) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(body)) as CookiePayload;
    if (!parsed.identifier || !isRole(parsed.role) || parsed.exp < Date.now()) {
      return null;
    }
    if (typeof parsed.m === "string" && parsed.mc !== catalogStamp(parsed.role)) {
      return null;
    }
    const menus =
      typeof parsed.m === "string"
        ? unpackMenus(parsed.role, parsed.m)
        : Array.isArray(parsed.menus)
          ? parsed.menus.filter(
              (item): item is string => typeof item === "string" && item.startsWith("/"),
            )
          : parsed.role === "admin" && parsed.identifier.trim().toLowerCase() === "admin"
            ? null
            : [];
    return {
      role: parsed.role,
      identifier: parsed.identifier,
      name: parsed.name ?? "",
      mustReset: parsed.mustReset === true,
      menus,
    } satisfies CookieSession;
  } catch {
    return null;
  }
}
