import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { hashSecret } from "@/lib/passwords";
import { passwordChangeProblem } from "@/lib/password-change";
import { requestSession } from "@/lib/api-session";
import { auditServer } from "@/lib/audit-server";
import { encodeSessionCookie, sessionCookieName } from "@/lib/session";
import { startSignIn } from "@/lib/single-session";
import { portalAuthClient } from "@/lib/supabase/admin";

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, message }, { status });

const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(key: string) {
  const now = Date.now();
  const seen = attempts.get(key);
  if (!seen || seen.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  seen.count += 1;
  return seen.count > 8;
}

/** Any signed-in user changes their own password: the current one is asked for first. */
export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in again to change your password.", 401);
  if (tooMany(`${session.role}:${session.identifier.toLowerCase()}`)) {
    return fail("Too many attempts. Try again in a few minutes.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The new password could not be saved.", 400);
  }
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const current = typeof input.current === "string" ? input.current : "";
  const next = typeof input.password === "string" ? input.password : "";

  const supabase = portalAuthClient();
  if (!supabase) return fail("The new password could not be saved.", 503);
  const { data } = await supabase
    .from("portal_users")
    .select("id, password")
    .eq("role", session.role)
    .ilike("identifier", session.identifier)
    .maybeSingle();
  if (!data) return fail("This sign-in could not be updated.", 404);

  const problem = passwordChangeProblem({
    current,
    next,
    stored: data.password,
    personal: [session.identifier, session.name],
  });
  if (problem) return fail(problem, 400);

  const saved = await supabase
    .from("portal_users")
    .update({ password: hashSecret(next), must_reset: false })
    .eq("id", data.id);
  if (saved.error) return fail("The new password could not be saved.", 500);
  // Any other sign-in of this user ends now; this one carries on with a fresh id.
  const sid = await startSignIn(data.id);
  await auditServer({
    actorRole: session.role,
    actorIdentifier: session.identifier,
    action: "auth:password-changed",
    subject: session.identifier,
    detail: "The user changed their own password",
  });
  const response = NextResponse.json({ ok: true });
  if (sid) {
    const token = await encodeSessionCookie({ ...session, sid }, true);
    if (token) {
      response.cookies.set(sessionCookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }
  return response;
}
