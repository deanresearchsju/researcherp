import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canMenuAction, canOpenMenu, isOfficeRole, resolvedMenus } from "@/lib/access";
import { requestSession } from "@/lib/api-session";
import { allBanks } from "@/lib/faculty-bank";
import { academicYearOf, isAcademicYear } from "@/lib/faculty-incentives";
import {
  actOnClaim,
  incentiveBoard,
  saveRules,
  type ClaimAction,
} from "@/lib/faculty-incentives-server";
import { indiaToday } from "@/lib/faculty-research-server";
import { rateLimit } from "@/lib/rate-limit";
import { fail, readBody, sameOrigin } from "@/lib/request-body";
import type { CookieSession } from "@/lib/session";

/**
 * Publication incentives. The administrator and the Dean process claims; another office sign-in
 * does so with the menu and its Approve right. Only the administrator sets the yearly rules.
 */
const menu = "/admin/faculty-incentives";

function rightsOf(session: CookieSession) {
  if (!isOfficeRole(session.role)) return { view: false, act: false, rules: false };
  const lead = session.role === "admin" || session.role === "dean";
  const view = lead || canOpenMenu(menu, session.role, resolvedMenus(session));
  return {
    view,
    act: view && (lead || canMenuAction(session, menu, "approve")),
    rules: session.role === "admin",
  };
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  const rights = rightsOf(session);
  if (!rights.view) return fail("This list is not open to your sign-in.", 403);
  const asked = request.nextUrl.searchParams.get("year");
  const year = isAcademicYear(asked) ? asked : academicYearOf(indiaToday());
  const board = await incentiveBoard(year);
  if (!board.ok) return fail(board.message, board.status);
  // Bank accounts for crediting the incentives (in full: this list is for the office only).
  const banks = await allBanks();
  return NextResponse.json({ ok: true, year, ...board.value, rights, banks });
}

const actions: readonly ClaimAction[] = ["claim", "approve", "pay", "reject", "reopen"];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("The request was refused.", 403);
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  const rights = rightsOf(session);
  const body = await readBody(request, 50_000);
  if (!body) return fail("The request could not be read.");
  const flood = rateLimit(
    `incentives:${session.identifier.toLowerCase()}`,
    300,
    60 * 60_000,
  );
  if (!flood.allowed) return fail("Too many requests. Try again later.", 429);
  const actor = {
    role: session.role,
    identifier: session.identifier,
    name: session.name.trim() || session.identifier,
  };
  if (body.action === "rules") {
    if (!rights.rules)
      return fail("Only the administrator sets the incentive rules.", 403);
    const saved = await saveRules(String(body.year ?? ""), body.rules, actor);
    if (!saved.ok) return fail(saved.message);
    return NextResponse.json({ ok: true, rules: saved.rules });
  }
  if (!rights.act) return fail("Your sign-in cannot process incentives.", 403);
  const action = body.action as ClaimAction;
  if (!actions.includes(action)) return fail("Unknown action.");
  const done = await actOnClaim(
    String(body.recordId ?? ""),
    action,
    { amount: body.amount, remarks: body.remarks },
    actor,
  );
  if (!done.ok) return fail(done.message, done.status);
  return NextResponse.json({ ok: true, claim: done.value });
}
