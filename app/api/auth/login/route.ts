import { NextResponse } from "next/server";

import { isPrincipalAdmin, parseMenuRights } from "@/lib/access";
import { portalHome } from "@/lib/auth";
import type { CookieSession } from "@/lib/session";
import { hashSecret, isHashedSecret, verifySecret } from "@/lib/passwords";
import { encodeSessionCookie, sessionCookieName } from "@/lib/session";
import { portalAuthClient } from "@/lib/supabase/admin";
import { isRetiredSignIn } from "@/lib/users";
import type { Role } from "@/types";

const roles: readonly Role[] = ["scholar", "supervisor", "admin"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Those credentials were not recognised. Check the details and try again." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, message: "Those credentials were not recognised. Check the details and try again." },
      { status: 400 },
    );
  }
  const input = body as { role?: unknown; identifier?: unknown; password?: unknown; remember?: unknown };
  if (!isRole(input.role) || typeof input.identifier !== "string" || typeof input.password !== "string") {
    return NextResponse.json(
      { ok: false, message: "Those credentials were not recognised. Check the details and try again." },
      { status: 400 },
    );
  }

  const identifier = input.identifier.trim();
  const remember = input.remember === true;
  const supabase = portalAuthClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Sign-in is not available yet." },
      { status: 503 },
    );
  }

  const full = await supabase
    .from("portal_users")
    .select("id, role, name, identifier, password, must_reset, menu_rights")
    .eq("role", input.role)
    .ilike("identifier", identifier)
    .maybeSingle();
  const fallback =
    full.error && /menu_rights/i.test(full.error.message)
      ? await supabase
          .from("portal_users")
          .select("id, role, name, identifier, password, must_reset")
          .eq("role", input.role)
          .ilike("identifier", identifier)
          .maybeSingle()
      : null;
  const { data, error } = fallback ?? full;

  if (error || !data || !isRole(data.role)) {
    return NextResponse.json(
      { ok: false, message: "Those credentials were not recognised. Check the details and try again." },
      { status: 401 },
    );
  }
  if (
    isRetiredSignIn({
      role: data.role,
      name: data.name,
      identifier: data.identifier,
    })
  ) {
    return NextResponse.json(
      { ok: false, message: "Those credentials were not recognised. Check the details and try again." },
      { status: 401 },
    );
  }
  if (!verifySecret(input.password, data.password)) {
    return NextResponse.json(
      { ok: false, message: "Those credentials were not recognised. Check the details and try again." },
      { status: 401 },
    );
  }

  if (!isHashedSecret(data.password)) {
    await supabase
      .from("portal_users")
      .update({ password: hashSecret(input.password) })
      .eq("id", data.id);
  }

  const session: CookieSession = {
    role: data.role,
    identifier: data.identifier,
    name: data.name,
    mustReset: data.must_reset === true,
    menus: isPrincipalAdmin({ role: data.role, identifier: data.identifier })
      ? null
      : fallback
        ? null
        : parseMenuRights("menu_rights" in data ? data.menu_rights : null),
  };
  const token = await encodeSessionCookie(session, remember);
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Sign-in is not available yet." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: session.mustReset ? "/login/reset" : portalHome(session.role),
    session,
  });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 7 : undefined,
  });
  return response;
}
