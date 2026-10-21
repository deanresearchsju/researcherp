import type { NextRequest } from "next/server";

import { isOfficeRole } from "@/lib/access";
import { decodeSessionCookie, sessionCookieName, type CookieSession } from "@/lib/session";

export async function requestSession(request: NextRequest) {
  return decodeSessionCookie(request.cookies.get(sessionCookieName)?.value);
}

export function isAdminSession(session: CookieSession | null) {
  return session?.role === "admin";
}

export function isOfficeSession(session: CookieSession | null) {
  return Boolean(session && isOfficeRole(session.role));
}
