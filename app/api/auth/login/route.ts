import { NextResponse } from "next/server";

import { isOfficeRole, parseMenuRights, resolvedMenus } from "@/lib/access";
import { portalHome } from "@/lib/auth";
import type { CookieSession } from "@/lib/session";
import { hashSecret, isHashedSecret, verifySecret } from "@/lib/passwords";
import {
  parseLetterCases,
  parseSupervisorStandings,
  scholarLoginMessage,
  scholarMayUsePortal,
  supervisorMayUsePortal,
} from "@/lib/portal-access";
import {
  applyRegisterPayload,
  scholarBySignIn,
  supervisorBySignIn,
} from "@/lib/register";
import { loginBlocked, loginFailed, loginSucceeded } from "@/lib/login-guard";
import { encodeSessionCookie, sessionCookieName } from "@/lib/session";
import { startSignIn } from "@/lib/single-session";
import { portalAuthClient } from "@/lib/supabase/admin";
import { isRetiredSignIn } from "@/lib/users";
import type { Json } from "@/types/database";
import { ROLES, officeRoles, type Role } from "@/types";

const roles: readonly Role[] = ROLES;

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

async function portalGate(
  supabase: NonNullable<ReturnType<typeof portalAuthClient>>,
  role: "scholar" | "supervisor",
  identifier: string,
) {
  if (role === "scholar") {
    const [{ data }, { data: register }] = await Promise.all([
      supabase
        .from("admission_office")
        .select("payload")
        .eq("id", "office")
        .maybeSingle(),
      supabase
        .from("research_register")
        .select("payload")
        .eq("id", "register")
        .maybeSingle(),
    ]);
    applyRegisterPayload(register?.payload ?? null);
    const cases = parseLetterCases((data?.payload ?? null) as Json);
    if (scholarMayUsePortal(identifier, Boolean(scholarBySignIn(identifier)), cases)) {
      return null;
    }
    return scholarLoginMessage();
  }
  const [{ data: register }, { data: approved }] = await Promise.all([
    supabase
      .from("research_register")
      .select("payload")
      .eq("id", "register")
      .maybeSingle(),
    supabase.from("supervisor_applications").select("email").eq("status", "Approved"),
  ]);
  const payload = register?.payload;
  applyRegisterPayload(payload ?? null);
  const standings = parseSupervisorStandings(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      "standings" in payload
      ? payload.standings
      : [],
  );
  const emails = (approved ?? []).map((row) => row.email);
  const allowed = supervisorMayUsePortal(
    identifier,
    supervisorBySignIn(identifier),
    standings,
    emails,
  );
  return allowed.ok ? null : allowed.message;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Those credentials were not recognised. Check the details and try again.",
      },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Those credentials were not recognised. Check the details and try again.",
      },
      { status: 400 },
    );
  }
  const input = body as {
    role?: unknown;
    identifier?: unknown;
    password?: unknown;
    remember?: unknown;
  };
  if (
    !isRole(input.role) ||
    typeof input.identifier !== "string" ||
    typeof input.password !== "string"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Those credentials were not recognised. Check the details and try again.",
      },
      { status: 400 },
    );
  }

  const identifier = input.identifier.trim();
  const remember = input.remember === true;
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const wait = loginBlocked(address, identifier);
  if (wait > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: `Too many wrong attempts. Try again in ${wait} minute(s), or ask the research office to reset the password.`,
      },
      { status: 429 },
    );
  }
  const supabase = portalAuthClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Sign-in is not available yet." },
      { status: 503 },
    );
  }

  const officeSignIn = isOfficeRole(input.role);
  const lookup = supabase
    .from("portal_users")
    .select("id, role, name, identifier, password, must_reset, menu_rights");
  const scoped = officeSignIn
    ? lookup.in("role", [...officeRoles]).ilike("identifier", identifier)
    : lookup.eq("role", input.role).ilike("identifier", identifier);
  const full = await scoped.maybeSingle();
  const fallback =
    full.error && /menu_rights/i.test(full.error.message)
      ? await (officeSignIn
          ? supabase
              .from("portal_users")
              .select("id, role, name, identifier, password, must_reset")
              .in("role", [...officeRoles])
              .ilike("identifier", identifier)
              .maybeSingle()
          : supabase
              .from("portal_users")
              .select("id, role, name, identifier, password, must_reset")
              .eq("role", input.role)
              .ilike("identifier", identifier)
              .maybeSingle())
      : null;
  const { data, error } = fallback ?? full;

  if (error) {
    console.error("portal login lookup failed", error.message);
    return NextResponse.json(
      { ok: false, message: "Sign-in is not available yet." },
      { status: 503 },
    );
  }
  if (!data || !isRole(data.role) || typeof data.password !== "string") {
    loginFailed(address, identifier);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Those credentials were not recognised. Check the details and try again.",
      },
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
      {
        ok: false,
        message:
          "Those credentials were not recognised. Check the details and try again.",
      },
      { status: 401 },
    );
  }
  if (!verifySecret(input.password, data.password)) {
    loginFailed(address, identifier);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Those credentials were not recognised. Check the details and try again.",
      },
      { status: 401 },
    );
  }

  if (data.role === "scholar" || data.role === "supervisor") {
    const gate = await portalGate(supabase, data.role, data.identifier);
    if (gate) {
      return NextResponse.json({ ok: false, message: gate }, { status: 403 });
    }
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
    menus: resolvedMenus({
      role: data.role,
      identifier: data.identifier,
      menus: fallback
        ? null
        : parseMenuRights("menu_rights" in data ? data.menu_rights : null),
    }),
  };
  loginSucceeded(address, identifier);
  // A new sign-in replaces any earlier one of the same user (one sign-in at a time).
  const sid = await startSignIn(data.id);
  const token = await encodeSessionCookie(sid ? { ...session, sid } : session, remember);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Sign-in is not set up on this server. Please tell the administrator (the SESSION_SECRET setting is missing).",
      },
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
