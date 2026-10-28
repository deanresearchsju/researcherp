import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decodeSessionCookie, sessionCookieName } from "@/lib/session";
import { signInIsCurrent } from "@/lib/single-session";

/**
 * Tells the browser whether this sign-in is still the user's current one. The browser asks every
 * minute and when the tab is opened again; when the user has signed in somewhere else, it signs
 * this one out.
 */
export async function GET(request: NextRequest) {
  const session = await decodeSessionCookie(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session)
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 401 });
  if (!(await signInIsCurrent(session))) {
    return NextResponse.json({ ok: false, reason: "replaced" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
