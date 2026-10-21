import { NextRequest, NextResponse } from "next/server";

import { isOfficeSession, requestSession } from "@/lib/api-session";
import { parseHelpdeskMessage, type HelpdeskMessage } from "@/lib/helpdesk";
import { insertOfficeNotice } from "@/lib/notices-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validation";

const saveError = "The message could not be sent. Please try again.";
const listError = "Helpdesk messages could not be loaded.";

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || (error.message ?? "").includes("helpdesk_messages");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: saveError }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: saveError }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, source: "browser" as const });
  }

  try {
    const { data, error } = await supabase
      .from("helpdesk_messages")
      .insert({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        subject: parsed.data.subject,
        message: parsed.data.message,
      })
      .select("id, name, email, phone, subject, message, created_at")
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ok: true, source: "browser" as const });
      }
      console.error(error);
      return NextResponse.json({ ok: false, message: saveError }, { status: 500 });
    }
    const item = parseHelpdeskMessage(data);
    await insertOfficeNotice({
      title: `Helpdesk message · ${parsed.data.name}`,
      detail: parsed.data.subject,
      href: "/admin/helpdesk",
    }).catch(() => null);
    return NextResponse.json({
      ok: true,
      source: "database" as const,
      item,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: saveError }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!isOfficeSession(session)) {
    return NextResponse.json({ ok: false, message: listError }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, source: "browser" as const, items: [] });
  }

  try {
    const { data, error } = await supabase
      .from("helpdesk_messages")
      .select("id, name, email, phone, subject, message, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ok: true, source: "browser" as const, items: [] });
      }
      console.error(error);
      return NextResponse.json({ ok: false, message: listError }, { status: 500 });
    }
    const items: HelpdeskMessage[] = (data ?? []).flatMap((row) => {
      const item = parseHelpdeskMessage(row);
      return item ? [item] : [];
    });
    return NextResponse.json({ ok: true, source: "database" as const, items });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: listError }, { status: 500 });
  }
}
