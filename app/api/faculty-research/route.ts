import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import {
  createRecord,
  importRecords,
  isResearchKind,
  listRecords,
  recordHistory,
  setReview,
  researchAccess,
  updateRecord,
} from "@/lib/faculty-research-server";
import { canMenuAction } from "@/lib/access";
import { researchMenus } from "@/lib/faculty-research";
import { serverChecklist } from "@/lib/checklists-server";
import { evidenceList } from "@/lib/faculty-evidence";
import { toppersTag } from "@/lib/faculty-toppers";
import { linkReport } from "@/lib/link-report";
import { rateLimit } from "@/lib/rate-limit";
import { fail, readBody, sameOrigin } from "@/lib/request-body";

/**
 * Faculty publications and project proposals inside the portal. The office lists every record;
 * a scholar or supervisor lists and changes only their own. Every save is written to the audit
 * trail by the server.
 */
export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  const kind = request.nextUrl.searchParams.get("kind");
  if (!isResearchKind(kind)) return fail("Unknown record type.");
  const access = researchAccess(session, kind);
  if (!access.scope) return fail("This list is not open to your sign-in.", 403);
  const history = request.nextUrl.searchParams.get("history");
  if (history) {
    if (access.scope !== "all")
      return fail("This list is not open to your sign-in.", 403);
    const lines = await recordHistory(history);
    if (!lines.ok) return fail(lines.message, lines.status);
    return NextResponse.json({ ok: true, history: lines.value });
  }
  const found = await listRecords(
    kind,
    access.scope === "own"
      ? { role: session.role, identifier: session.identifier }
      : undefined,
  );
  if (!found.ok) return fail(found.message, found.status);
  const canUpload =
    access.scope === "all" &&
    (session.role === "admin" ||
      canMenuAction(session, researchMenus[kind].adminHref, "upload"));
  const canApprove =
    access.scope === "all" &&
    (session.role === "admin" ||
      session.role === "dean" ||
      canMenuAction(session, researchMenus[kind].adminHref, "approve"));
  return NextResponse.json({
    ok: true,
    records: found.value,
    canEdit: access.edit,
    canUpload,
    canApprove,
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("The request was refused.", 403);
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  // A sheet upload sends up to 200 rows at a time.
  const body = await readBody(request, 1_500_000);
  if (!body) return fail("The request could not be read.");
  const kind = body.kind;
  if (!isResearchKind(kind)) return fail("Unknown record type.");
  const access = researchAccess(session, kind);
  if (!access.scope || !access.edit)
    return fail("Your sign-in cannot change these records.", 403);
  const flood = rateLimit(
    `research:${session.role}:${session.identifier.toLowerCase()}`,
    200,
    60 * 60_000,
  );
  if (!flood.allowed) return fail("Too many requests. Try again later.", 429);
  const actor = {
    role: session.role,
    identifier: session.identifier,
    name: session.name.trim() || session.identifier,
  };
  const owner = { role: session.role, identifier: session.identifier };
  const errorsOf = (result: { errors?: Record<string, string> }) =>
    result.errors ? { errors: result.errors } : {};

  if (
    body.action === "approve" ||
    body.action === "reject" ||
    body.action === "reset-review" ||
    body.action === "withdraw-approval"
  ) {
    // The Dean and the administrator review; another office sign-in needs the Approve right.
    const mayApprove =
      access.scope === "all" &&
      (session.role === "admin" ||
        session.role === "dean" ||
        canMenuAction(session, researchMenus[kind].adminHref, "approve"));
    if (!mayApprove)
      return fail("Only the Dean or the administrator reviews records.", 403);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const done = await setReview(
      kind,
      ids,
      body.action === "approve"
        ? "approve"
        : body.action === "reject"
          ? "reject"
          : "reset",
      typeof body.note === "string" ? body.note : "",
      actor,
    );
    if (!done.ok) return fail(done.message, done.status);
    // The toppers count approved work only: refresh them now.
    revalidateTag(toppersTag, { expire: 0 });
    return NextResponse.json({ ok: true, count: done.value });
  }
  if (body.action === "check-links") {
    return NextResponse.json({ ok: true, ...(await linkReport(body)) });
  }
  if (body.action === "import") {
    const mayUpload =
      access.scope === "all" &&
      (session.role === "admin" ||
        canMenuAction(session, researchMenus[kind].adminHref, "upload"));
    if (!mayUpload) return fail("Your sign-in cannot upload records.", 403);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const done = await importRecords(kind, rows, actor);
    if (!done.ok) return fail(done.message, done.status);
    return NextResponse.json({ ok: true, outcomes: done.value });
  }
  if (body.action === "create") {
    // Faculty attach the mandatory evidence; the office may add a record without it.
    const evidence =
      access.scope === "own" ? await serverChecklist(evidenceList(kind)) : undefined;
    const made = await createRecord(kind, body.record, actor, owner, evidence);
    if (!made.ok) return fail(made.message, made.status, errorsOf(made));
    return NextResponse.json({ ok: true, record: made.value });
  }
  if (body.action === "update") {
    // Faculty change their own records until the Dean or the administrator approves them.
    const id = typeof body.id === "string" ? body.id : "";
    const saved =
      access.scope === "all"
        ? await updateRecord(kind, id, body.record, actor, null)
        : await updateRecord(kind, id, body.record, actor, owner, {
            evidence: await serverChecklist(evidenceList(kind)),
          });
    if (!saved.ok) return fail(saved.message, saved.status, errorsOf(saved));
    return NextResponse.json({ ok: true, record: saved.value });
  }
  return fail("Unknown action.");
}
