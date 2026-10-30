import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { auditServer } from "@/lib/audit-server";
import { insertOfficeNotice, insertUserNotice } from "@/lib/notices-server";
import { isAsker } from "@/lib/queries";
import {
  closeOwnQuery,
  createQuery,
  followUpQuery,
  loadQueries,
  queriesOf,
  replyToQuery,
} from "@/lib/queries-server";
import { rateLimit } from "@/lib/rate-limit";
import { isOfficeRole } from "@/lib/access";

/**
 * The questions a scholar or supervisor asks the research office (the Helpdesk). A person sees
 * only their own; the administrator, the Dean and the staff see all. The administrator and the
 * Dean reply; the question is then closed.
 */
const unreadable = "The questions could not be read. Try again.";

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  const all = await loadQueries();
  if (!all) return fail(unreadable, 503);
  if (isOfficeRole(session.role))
    return NextResponse.json({ ok: true, queries: all.items });
  if (!isAsker(session.role)) return NextResponse.json({ ok: true, queries: [] });
  return NextResponse.json({
    ok: true,
    queries: queriesOf(all.items, {
      role: session.role,
      identifier: session.identifier,
      name: session.name,
    }),
  });
}

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("The request could not be read.");
  }
  const text = (key: string) =>
    typeof body[key] === "string" ? (body[key] as string) : "";
  const action = text("action");
  const limited = rateLimit(
    `queries:${session.role}:${session.identifier.toLowerCase()}`,
    30,
    60 * 60_000,
  );
  if (!limited.allowed) return fail("Too many requests. Try again later.", 429);

  if (isAsker(session.role)) {
    const person = {
      role: session.role,
      identifier: session.identifier,
      name: session.name.trim() || session.identifier,
    };
    if (action === "create") {
      const made = await createQuery(person, {
        category: text("category"),
        subject: text("subject"),
        question: text("question"),
      });
      if (!made.ok) return fail(made.message, made.status);
      await auditServer({
        actorRole: session.role,
        actorIdentifier: session.identifier,
        action: "helpdesk:asked",
        subject: session.identifier,
        detail: `${person.name} asked: ${made.value.category} · ${made.value.subject}`,
      });
      await insertOfficeNotice({
        title: `Helpdesk · ${person.name}`,
        detail: `${made.value.category}: ${made.value.subject}`,
        href: "/admin/helpdesk",
      }).catch(() => null);
      return NextResponse.json({ ok: true, id: made.value.id });
    }
    if (action === "followup") {
      const done = await followUpQuery(person, text("id"), text("text"));
      if (!done.ok) return fail(done.message, done.status);
      await auditServer({
        actorRole: session.role,
        actorIdentifier: session.identifier,
        action: "helpdesk:followed-up",
        subject: session.identifier,
        detail: `${person.name} wrote again: ${done.value?.subject ?? ""}`,
      });
      await insertOfficeNotice({
        title: `Helpdesk · ${person.name} wrote again`,
        detail: done.value?.subject ?? "",
        href: "/admin/helpdesk",
      }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    if (action === "close") {
      const done = await closeOwnQuery(person, text("id"));
      if (!done.ok) return fail(done.message, done.status);
      await auditServer({
        actorRole: session.role,
        actorIdentifier: session.identifier,
        action: "helpdesk:closed",
        subject: session.identifier,
        detail: `${person.name} closed a question`,
      });
      return NextResponse.json({ ok: true });
    }
    return fail("Unknown action.");
  }

  // The administrator and the Dean reply; nobody else answers.
  if (session.role !== "admin" && session.role !== "dean") {
    return fail("Only the administrator and the Dean reply to questions.", 403);
  }
  if (action !== "reply") return fail("Unknown action.");
  const done = await replyToQuery(
    { role: session.role, name: session.name.trim() || session.identifier },
    text("id"),
    text("text"),
    body.close !== false,
  );
  if (!done.ok) return fail(done.message, done.status);
  const query = done.value;
  await auditServer({
    actorRole: session.role,
    actorIdentifier: session.identifier,
    action: body.close !== false ? "helpdesk:answered" : "helpdesk:replied",
    subject: query?.identifier ?? "",
    detail: `${session.name.trim() || session.identifier} replied${query ? ` to ${query.role} ${query.identifier}: ${query.subject}` : ""}`,
  });
  if (query) {
    await insertUserNotice({
      role: query.role,
      identifier: query.identifier,
      title:
        query.status === "Closed"
          ? "Your question was answered"
          : "Reply to your question",
      detail: query.subject,
      href: `/${query.role}/helpdesk`,
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
