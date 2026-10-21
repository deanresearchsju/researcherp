import { NextResponse } from "next/server";

import { phdSessionCode } from "@/lib/applications";
import { parsePhdSession } from "@/lib/office";
import { insertOfficeNotice } from "@/lib/notices-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { assertPhdUploads } from "@/lib/upload-guard";
import type { Json } from "@/types/database";

const saveError =
  "The application could not be saved. Please try again, or email the Center for Research.";

export const maxDuration = 60;

function payloadOf(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => payloadOf(item));
  if (typeof value === "object") {
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = payloadOf(item);
    }
    return result;
  }
  return null;
}

async function announce(applicationNo: string, applicantName: string) {
  await insertOfficeNotice({
    title: `New Ph.D. application · ${applicantName}`,
    detail: `${applicationNo} was submitted on the website.`,
    href: "/admin/applications",
  }).catch(() => null);
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: saveError }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, message: saveError }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const dateOfBirth = textField(record.dateOfBirth);
  const applicantName = textField(record.applicantName);
  const email = textField(record.email);
  const studyMode = textField(record.studyMode);
  const session = textField(record.session);
  const year = textField(record.year);
  const payload = payloadOf(record.payload);
  const uploads = assertPhdUploads(payload);
  if (!uploads.ok) {
    return NextResponse.json({ ok: false, message: uploads.message }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: saveError }, { status: 503 });
  }

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("site_settings")
      .select("phd_open, admission_session")
      .eq("id", "office")
      .maybeSingle();
    if (settingsError) {
      console.error(settingsError);
      return NextResponse.json({ ok: false, message: saveError }, { status: 500 });
    }
    if (!settings?.phd_open) {
      return NextResponse.json(
        { ok: false, message: "Admissions are currently closed." },
        { status: 403 },
      );
    }
    const open = parsePhdSession(settings.admission_session);
    if (session && session !== open.month) {
      return NextResponse.json(
        { ok: false, message: "Admissions are currently closed." },
        { status: 403 },
      );
    }
    const sessionMonth = session || open.month;
    const sessionYear = year || open.year;
    const code = phdSessionCode(sessionMonth) || "Jan";

    const submitted = await supabase.rpc("submit_phd_application", {
      p_date_of_birth: dateOfBirth,
      p_applicant_name: applicantName,
      p_email: email,
      p_study_mode: studyMode,
      p_year: sessionYear,
      p_code: code,
      p_payload: payload,
    });
    if (!submitted.error && typeof submitted.data === "string" && submitted.data.trim()) {
      await announce(submitted.data.trim(), applicantName);
      return NextResponse.json({ ok: true, applicationNo: submitted.data.trim() });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const issued = await supabase.rpc("issue_application_number", {
        p_kind: "phd",
        p_year: sessionYear,
        p_code: code,
      });
      if (issued.error || typeof issued.data !== "string" || !issued.data.trim()) {
        console.error(issued.error);
        return NextResponse.json({ ok: false, message: saveError }, { status: 500 });
      }
      const applicationNo = issued.data.trim();
      const { error } = await supabase.from("phd_applications").insert({
        application_no: applicationNo,
        date_of_birth: dateOfBirth,
        applicant_name: applicantName,
        email,
        study_mode: studyMode,
        status: "Acknowledgement sent",
        payload,
      });
      if (!error) {
        await announce(applicationNo, applicantName);
        return NextResponse.json({ ok: true, applicationNo });
      }
      if (error.code !== "23505") {
        console.error(error);
        return NextResponse.json({ ok: false, message: saveError }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: false, message: saveError }, { status: 409 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: saveError }, { status: 500 });
  }
}
