import { NextResponse } from "next/server";

/** Reads a small JSON object from a request; anything larger, or not an object, is refused. */
export async function readBody(request: Request, limit = 24_000) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) return null;
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > limit) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** A form posted from another website is refused (the browser always names the origin). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}
