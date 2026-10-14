import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminSession, requestSession } from "@/lib/api-session";
import { insertPortalUserRows } from "@/lib/users-admin";
import type { Role } from "@/types";

const roles: readonly Role[] = ["scholar", "supervisor", "admin"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!isAdminSession(session)) {
    return NextResponse.json(
      { ok: false, message: "Only the office can add users." },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Those sign-ins could not be created." },
      { status: 400 },
    );
  }
  const rows =
    body && typeof body === "object" && "rows" in body && Array.isArray(body.rows)
      ? body.rows
      : [];
  const parsed: {
    role: Role;
    name: string;
    identifier: string;
    password: string;
    mustReset: boolean;
  }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as {
      role?: unknown;
      name?: unknown;
      identifier?: unknown;
      password?: unknown;
      mustReset?: unknown;
    };
    if (
      !isRole(item.role) ||
      typeof item.name !== "string" ||
      typeof item.identifier !== "string" ||
      typeof item.password !== "string"
    ) {
      continue;
    }
    parsed.push({
      role: item.role,
      name: item.name,
      identifier: item.identifier,
      password: item.password,
      mustReset: item.mustReset === true,
    });
  }
  const saved = await insertPortalUserRows(parsed);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, users: saved.users, resetStoredLocally: false });
}
