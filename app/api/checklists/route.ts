import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { isChecklistKey } from "@/lib/checklists";
import { loadSavedChecklists, saveChecklist } from "@/lib/checklists-server";
import { clientAddress, rateLimit } from "@/lib/rate-limit";
import { fail, readBody, sameOrigin } from "@/lib/request-body";

/**
 * The checklists of the ERP. Anybody may read them (the application checklist is on the
 * website); only the administrator saves them, and every save is written to the audit trail.
 */
export async function GET(request: NextRequest) {
  const flood = rateLimit(
    `checklists:${clientAddress(request.headers)}`,
    300,
    10 * 60_000,
  );
  if (!flood.allowed) return fail("Too many requests. Try again later.", 429);
  const lists = await loadSavedChecklists();
  return NextResponse.json(
    { ok: true, lists: lists ?? {} },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("The request was refused.", 403);
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  if (session.role !== "admin")
    return fail("Only the administrator changes checklists.", 403);
  const body = await readBody(request, 200_000);
  if (!body) return fail("The request could not be read.");
  if (!isChecklistKey(body.id)) return fail("Unknown checklist.");
  const saved = await saveChecklist(body.id, body.items, {
    role: session.role,
    identifier: session.identifier,
    name: session.name.trim() || session.identifier,
  });
  if (!saved.ok) return fail(saved.message);
  return NextResponse.json({ ok: true, items: saved.items });
}
