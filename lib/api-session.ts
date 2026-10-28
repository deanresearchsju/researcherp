import type { NextRequest } from "next/server";

import { isOfficeRole } from "@/lib/access";
import { signInIsCurrent } from "@/lib/single-session";
import {
  decodeSessionCookie,
  sessionCookieName,
  type CookieSession,
} from "@/lib/session";

/** The signed-in user of a request, or null when the cookie is missing, forged, or replaced by a newer sign-in. */
export async function requestSession(request: NextRequest) {
  const session = await decodeSessionCookie(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) return null;
  return (await signInIsCurrent(session)) ? session : null;
}

export function isAdminSession(session: CookieSession | null) {
  return session?.role === "admin";
}

export function isOfficeSession(session: CookieSession | null) {
  return Boolean(session && isOfficeRole(session.role));
}
