import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isPrincipalAdmin } from "@/lib/access";
import { isAdminSession, requestSession } from "@/lib/api-session";
import {
  deletePortalUserRow,
  listPortalUsers,
  updatePortalUserRow,
} from "@/lib/users-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requestSession(request);
  if (!isAdminSession(session)) {
    return NextResponse.json(
      { ok: false, message: "Only the office can change users." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "That user could not be saved." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, message: "That user could not be saved." },
      { status: 400 },
    );
  }
  const input = body as {
    name?: unknown;
    password?: unknown;
    mustReset?: unknown;
    menus?: unknown;
  };
  if (typeof input.name !== "string") {
    return NextResponse.json(
      { ok: false, message: "That user could not be saved." },
      { status: 400 },
    );
  }
  const menus = Array.isArray(input.menus)
    ? input.menus.filter((item): item is string => typeof item === "string")
    : input.menus === null
      ? null
      : [];
  const saved = await updatePortalUserRow(id, {
    name: input.name,
    password: typeof input.password === "string" ? input.password : "",
    mustReset: input.mustReset === true,
    menus,
  });
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user: saved.user });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await requestSession(request);
  if (!isAdminSession(session)) {
    return NextResponse.json(
      { ok: false, message: "Only the office can remove users." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  const listed = await listPortalUsers();
  const user = listed.ok ? listed.users.find((item) => item.id === id) : undefined;
  if (user && isPrincipalAdmin(user)) {
    return NextResponse.json(
      { ok: false, message: "The office sign-in cannot be removed." },
      { status: 403 },
    );
  }
  const saved = await deletePortalUserRow(id);
  if (!saved.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
