import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminSession, requestSession } from "@/lib/api-session";
import { createPortalUserRow, listPortalUsers } from "@/lib/users-admin";
import type { Role } from "@/types";

const roles: readonly Role[] = ["scholar", "supervisor", "admin"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Sign in to continue." }, { status: 401 });
  }
  const listed = await listPortalUsers();
  if (!listed.ok) {
    return NextResponse.json({ ok: false, message: listed.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true, users: listed.users });
}

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!isAdminSession(session)) {
    return NextResponse.json({ ok: false, message: "Only the office can add users." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "That user could not be created." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "That user could not be created." }, { status: 400 });
  }
  const input = body as {
    role?: unknown;
    name?: unknown;
    identifier?: unknown;
    password?: unknown;
    menus?: unknown;
  };
  if (
    !isRole(input.role) ||
    typeof input.name !== "string" ||
    typeof input.identifier !== "string" ||
    typeof input.password !== "string"
  ) {
    return NextResponse.json({ ok: false, message: "That user could not be created." }, { status: 400 });
  }
  const menus = Array.isArray(input.menus)
    ? input.menus.filter((item): item is string => typeof item === "string")
    : input.menus === null
      ? null
      : [];
  const created = await createPortalUserRow({
    role: input.role,
    name: input.name.trim(),
    identifier: input.identifier.trim(),
    password: input.password,
    menus,
  });
  if (!created.ok) {
    return NextResponse.json({ ok: false, message: created.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user: created.user });
}
