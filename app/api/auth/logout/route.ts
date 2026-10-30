import { NextResponse, type NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { auditServer } from "@/lib/audit-server";
import { sessionCookieName } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (session) {
    await auditServer({
      actorRole: session.role,
      actorIdentifier: session.identifier,
      action: "auth:sign-out",
      subject: session.identifier,
      detail: `${session.name} signed out`,
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
