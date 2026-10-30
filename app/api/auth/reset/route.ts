import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { hashSecret, verifySecret } from "@/lib/passwords";
import { passwordProblem } from "@/lib/password-rules";
import { issuedPassword } from "@/lib/register-access";
import { requestSession } from "@/lib/api-session";
import { auditServer } from "@/lib/audit-server";
import { encodeSessionCookie, sessionCookieName } from "@/lib/session";
import { portalAuthClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Sign in again to set a new password." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "The new password could not be saved." },
      { status: 400 },
    );
  }
  const password =
    body &&
    typeof body === "object" &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password
      : "";
  const weak = passwordProblem(password, [session.identifier, session.name]);
  if (weak) return NextResponse.json({ ok: false, message: weak }, { status: 400 });

  const supabase = portalAuthClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "The new password could not be saved." },
      { status: 503 },
    );
  }
  const { data } = await supabase
    .from("portal_users")
    .select("id, password")
    .eq("role", session.role)
    .ilike("identifier", session.identifier)
    .maybeSingle();
  if (!data) {
    return NextResponse.json(
      { ok: false, message: "This sign-in could not be updated." },
      { status: 404 },
    );
  }
  if (verifySecret(password, data.password) || password === issuedPassword) {
    return NextResponse.json(
      {
        ok: false,
        message: "Choose a password that is different from the one you were given.",
      },
      { status: 400 },
    );
  }
  const saved = await supabase
    .from("portal_users")
    .update({ password: hashSecret(password), must_reset: false })
    .eq("id", data.id);
  if (saved.error) {
    return NextResponse.json(
      { ok: false, message: "The new password could not be saved." },
      { status: 500 },
    );
  }

  await auditServer({
    actorRole: session.role,
    actorIdentifier: session.identifier,
    action: "auth:password-set",
    subject: session.identifier,
    detail: "The user set a new password after a reset",
  });
  const next = { ...session, mustReset: false };
  const nextToken = await encodeSessionCookie(next, true);
  const response = NextResponse.json({ ok: true, session: next });
  if (nextToken) {
    response.cookies.set(sessionCookieName, nextToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return response;
}
