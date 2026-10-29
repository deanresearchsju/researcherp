import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isOfficeRole } from "@/lib/access";
import { requestSession } from "@/lib/api-session";
import { ensureRegisterSeed, scholarBySignIn, supervisorForGuide } from "@/lib/register";
import type { CookieSession } from "@/lib/session";
import { insertOfficeNotice } from "@/lib/notices-server";
import { clientAddress, rateLimit } from "@/lib/rate-limit";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Notices for the research office as a whole (admin, Dean and staff). */
const officeRole = "office";
const everyone = "*";
const keepDays = 120;
const roles = new Set(["scholar", "supervisor", "admin", "staff", "dean", officeRole]);

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Every identifier a notice for this sign-in may have been addressed to. */
function recipientKeys(session: CookieSession) {
  const keys = new Set<string>([session.identifier]);
  if (session.role === "scholar") {
    const scholar = scholarBySignIn(session.identifier);
    if (scholar) {
      [
        scholar.email,
        scholar.registrationNumber,
        scholar.applicationNumber,
        scholar.fileNumber,
        scholar.id,
      ].forEach((key) => keys.add(key));
    }
  }
  if (session.role === "supervisor") {
    keys.add(session.name);
    const guide =
      supervisorForGuide(session.identifier) ?? supervisorForGuide(session.name);
    if (guide)
      [guide.supervisorId, guide.name, guide.email].forEach((key) => keys.add(key));
  }
  return [...keys].map((key) => key.trim().toLowerCase()).filter(Boolean);
}

function readerKey(session: CookieSession) {
  return `${session.role}:${session.identifier.trim().toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  const supabase = createAdminSupabase();
  if (!supabase) return NextResponse.json({ ok: true, notices: [] });
  const since = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();
  await ensureRegisterSeed();
  const keys = recipientKeys(session);
  const own = supabase
    .from("portal_notices")
    .select("id, created_at, role, identifier, title, detail, href, read_by")
    .gte("created_at", since)
    .eq("role", session.role)
    .in("identifier", [...keys, everyone])
    .order("created_at", { ascending: false })
    .limit(100);
  const office = isOfficeRole(session.role)
    ? supabase
        .from("portal_notices")
        .select("id, created_at, role, identifier, title, detail, href, read_by")
        .gte("created_at", since)
        .eq("role", officeRole)
        .order("created_at", { ascending: false })
        .limit(150)
    : null;
  const [mine, shared] = await Promise.all([own, office]);
  if (mine.error || shared?.error) {
    return NextResponse.json({
      ok: false,
      message:
        "Run supabase/migrations/20261021100000_portal_notices_inbox.sql in the Supabase SQL editor.",
      notices: [],
    });
  }
  const reader = readerKey(session);
  const notices = [...(mine.data ?? []), ...(shared?.data ?? [])]
    .filter((row) => !(row.read_by ?? []).includes(reader))
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      href: row.href,
      at: row.created_at,
    }));
  return NextResponse.json({ ok: true, notices });
}

type NoticeInput = {
  role: string;
  identifier: string;
  title: string;
  detail: string;
  href: string;
};

async function pushNotices(input: unknown) {
  const list = Array.isArray(input) ? input : [];
  const rows: NoticeInput[] = list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const role = clean(row.role, 20);
    const identifier = clean(row.identifier, 200).toLowerCase();
    const title = clean(row.title, 200);
    if (!roles.has(role) || !identifier || !title) return [];
    const href = clean(row.href, 300);
    return [
      {
        role,
        identifier,
        title,
        detail: clean(row.detail, 1000),
        href: href.startsWith("/") ? href : "",
      },
    ];
  });
  if (rows.length === 0) return fail("Nothing to send.");
  const supabase = createAdminSupabase();
  if (!supabase) return fail("The database is not configured.", 503);
  const { error } = await supabase.from("portal_notices").insert(rows.slice(0, 200));
  if (error) {
    const legacy = await supabase.from("portal_notices").insert(
      rows.slice(0, 200).map((row) => ({
        role: row.role,
        identifier: row.identifier,
        title: row.title,
        detail: row.detail,
      })),
    );
    if (legacy.error) return fail("The notice could not be saved.", 500);
  }
  return NextResponse.json({ ok: true, sent: rows.length });
}

async function markRead(session: CookieSession, ids: unknown) {
  const list = Array.isArray(ids)
    ? ids
        .filter((id): id is string => typeof id === "string" && id.length <= 64)
        .slice(0, 200)
    : [];
  if (list.length === 0) return NextResponse.json({ ok: true, read: 0 });
  const supabase = createAdminSupabase();
  if (!supabase) return fail("The database is not configured.", 503);
  const reader = readerKey(session);
  const { data, error } = await supabase
    .from("portal_notices")
    .select("id, read_by")
    .in("id", list);
  if (error) return fail("The notices could not be updated.", 500);
  for (const row of data ?? []) {
    const readBy = row.read_by ?? [];
    if (readBy.includes(reader)) continue;
    await supabase
      .from("portal_notices")
      .update({ read_by: [...readBy, reader] })
      .eq("id", row.id);
  }
  return NextResponse.json({ ok: true, read: data?.length ?? 0 });
}

/**
 * A website application tells the office it arrived. No sign-in exists yet, so the notice is
 * sent only for an application that is really on record and was made in the last few minutes.
 */
async function announceApplication(record: Record<string, unknown>) {
  const kind =
    record.kind === "supervisor" ? "supervisor" : record.kind === "phd" ? "phd" : null;
  const applicationNo = clean(record.applicationNo, 80);
  if (!kind || !applicationNo) return fail("Unknown application.");
  const supabase = createAdminSupabase();
  if (!supabase) return NextResponse.json({ ok: true });
  const table = kind === "phd" ? "phd_applications" : "supervisor_applications";
  const { data } = await supabase
    .from(table)
    .select("applicant_name, created_at")
    .eq("application_no", applicationNo)
    .maybeSingle();
  if (!data || Date.now() - new Date(data.created_at).getTime() > 15 * 60 * 1000) {
    return NextResponse.json({ ok: true });
  }
  const { count } = await supabase
    .from("portal_notices")
    .select("id", { count: "exact", head: true })
    .eq("role", officeRole)
    .ilike("detail", `${applicationNo}%`);
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true });
  await insertOfficeNotice({
    title:
      kind === "phd"
        ? `New Ph.D. application · ${data.applicant_name}`
        : `New supervisor recognition application · ${data.applicant_name}`,
    detail: `${applicationNo} was submitted on the website.`,
    href: "/admin/applications",
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The request could not be read.");
  }
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (record.action === "application") {
    const flood = rateLimit(
      `announce:${clientAddress(request.headers)}`,
      20,
      10 * 60_000,
    );
    if (!flood.allowed) return fail("Too many requests.", 429);
    return announceApplication(record);
  }
  const session = await requestSession(request);
  if (!session) return fail("Sign in first.", 401);
  if (record.action === "read") return markRead(session, record.ids);
  if (record.action === "push") return pushNotices(record.notices);
  return fail("Unknown action.");
}
