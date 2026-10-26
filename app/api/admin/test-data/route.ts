import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isPrincipalAdmin } from "@/lib/access";
import { requestSession } from "@/lib/api-session";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { resetPhrase, testDataAreas } from "@/lib/test-data";

const switchOff =
  "Clearing test data is switched off. Set ALLOW_TEST_DATA_RESET=true in the server settings while testing, and remove it before the real work begins.";

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

async function principal(request: NextRequest) {
  const session = await requestSession(request);
  return session && isPrincipalAdmin(session) ? session : null;
}

function enabled() {
  return process.env.ALLOW_TEST_DATA_RESET === "true";
}

/** The areas that can be cleared, with how much each holds now. */
export async function GET(request: NextRequest) {
  const session = await principal(request);
  if (!session) return fail("Only the administrator can open this.", 403);
  const db = createAdminSupabase();
  if (!db) return fail("The database is not connected.", 503);
  const areas = await Promise.all(
    testDataAreas.map(async (area) => ({
      id: area.id,
      label: area.label,
      description: area.description,
      warning: area.warning ?? "",
      count: await area.count(db).catch(() => -1),
    })),
  );
  return NextResponse.json({ ok: true, enabled: enabled(), phrase: resetPhrase, areas });
}

type Body = { action?: string; areas?: unknown; confirm?: unknown };

export async function POST(request: NextRequest) {
  const session = await principal(request);
  if (!session) return fail("Only the administrator can do this.", 403);
  if (!enabled()) return fail(switchOff, 403);
  const db = createAdminSupabase();
  if (!db) return fail("The database is not connected.", 503);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("That request could not be read.");
  }
  const ids = Array.isArray(body.areas)
    ? body.areas.filter((item): item is string => typeof item === "string")
    : [];
  const chosen = testDataAreas.filter((area) => ids.includes(area.id));
  if (chosen.length === 0) return fail("Choose what to clear.");

  if (body.action === "export") {
    const data: Record<string, unknown> = {};
    for (const area of chosen) data[area.id] = await area.snapshot(db);
    return NextResponse.json({ ok: true, exportedAt: new Date().toISOString(), data });
  }

  if (body.action === "reset") {
    if (body.confirm !== resetPhrase) return fail(`Type ${resetPhrase} to confirm.`);
    const done: string[] = [];
    try {
      for (const area of chosen) {
        await area.clear(db);
        done.push(area.label);
      }
    } catch (error) {
      return fail(
        `${done.length ? `Cleared: ${done.join(", ")}. ` : ""}Stopped at an error: ${error instanceof Error ? error.message : "unknown"}`,
        500,
      );
    }
    await db.from("audit_log").insert({
      actor_role: session.role,
      actor_identifier: session.identifier,
      action: "test-data:cleared",
      subject: chosen.map((area) => area.id).join(","),
      detail: "Test data cleared",
    });
    return NextResponse.json({ ok: true, cleared: done });
  }
  return fail("Unknown request.");
}
