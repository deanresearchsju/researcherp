import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession, isOfficeSession } from "@/lib/api-session";
import { formatIsoDate } from "@/lib/dates";
import {
  hallTicketReady,
  loginDetails,
  phdAcknowledgement,
  recognitionReady,
  selectionLetterReady,
  supervisorAcknowledgement,
  type MailBody,
} from "@/lib/mail-templates";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { verifySecret } from "@/lib/passwords";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Sends the ERP's notification mail. The recipient is always read from the stored record,
 * never from the request, so this cannot be used to mail arbitrary addresses.
 */

type Row = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const asRow = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function numbers(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 400)
    : [];
}

async function deliver(items: readonly { to: string; mail: MailBody }[]) {
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    if (!looksLikeEmail(item.to)) {
      failed += 1;
      continue;
    }
    const result = await sendMail({ to: item.to, ...item.mail });
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return NextResponse.json({ ok: true, sent, failed, configured: true });
}

export async function POST(request: NextRequest) {
  if (!mailConfigured()) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, configured: false });
  }
  const supabase = createAdminSupabase();
  let body: Row;
  try {
    body = asRow(await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const event = text(body.event);

  /* ---- Acknowledgements: sent to the address on the application just submitted ---- */
  if (event === "ack") {
    const kind = body.kind === "supervisor" ? "supervisor" : "phd";
    const table = kind === "phd" ? "phd_applications" : "supervisor_applications";
    const { data } = await supabase
      .from(table)
      .select("id, application_no, applicant_name, email, payload, created_at")
      .ilike("application_no", text(body.applicationNo))
      .eq("date_of_birth", text(body.dateOfBirth))
      .maybeSingle();
    if (!data)
      return NextResponse.json({ ok: true, sent: 0, failed: 0, configured: true });
    const payload = asRow(data.payload);
    if (asRow(payload.mail).ack) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, configured: true });
    }
    // Mark first, so a double submit cannot send twice.
    await supabase
      .from(table)
      .update({
        payload: {
          ...payload,
          mail: { ...asRow(payload.mail), ack: new Date().toISOString() },
        } as Json,
      })
      .eq("id", data.id);
    const submittedOn = formatIsoDate(data.created_at.slice(0, 10));
    const mail =
      kind === "phd"
        ? phdAcknowledgement({
            name: data.applicant_name,
            applicationNo: data.application_no,
            school: text(payload.school),
            subject: text(payload.specialization),
            studyMode: text(payload.studyMode),
            submittedOn,
          })
        : supervisorAcknowledgement({
            name: data.applicant_name,
            applicationNo: data.application_no,
            designation: text(payload.designation),
            department: text(payload.department),
            submittedOn,
          });
    return deliver([{ to: data.email, mail }]);
  }

  /* ---- Everything else is sent by the research office ---- */
  const session = await requestSession(request);
  if (!isOfficeSession(session)) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  if (event === "hall-ticket" || event === "selection-letter") {
    const { data } = await supabase
      .from("admission_office")
      .select("payload")
      .eq("id", "office")
      .maybeSingle();
    const office = asRow(data?.payload);
    const cases = Array.isArray(office.cases) ? office.cases.map(asRow) : [];
    const reportBy = text(asRow(office.letter).reportBy);
    const wanted = new Set(
      numbers(body.applicationNos).map((item) => item.toLowerCase()),
    );
    const items = cases.flatMap((row) => {
      if (!wanted.has(text(row.applicationNo).toLowerCase())) return [];
      const name = [text(row.title), text(row.name)].filter(Boolean).join(" ");
      if (event === "hall-ticket") {
        if (!text(row.hallTicketNo)) return [];
        return [
          {
            to: text(row.email),
            mail: hallTicketReady({
              name,
              applicationNo: text(row.applicationNo),
              hallTicketNo: text(row.hallTicketNo),
            }),
          },
        ];
      }
      if (row.selected !== true || row.letterIssued !== true) return [];
      return [
        {
          to: text(row.email),
          mail: selectionLetterReady({
            name,
            applicationNo: text(row.applicationNo),
            reportBy,
          }),
        },
      ];
    });
    return deliver(items);
  }

  if (event === "recognition") {
    const { data } = await supabase
      .from("supervisor_applications")
      .select("application_no, applicant_name, email, status")
      .eq("status", "Approved")
      .in("application_no", numbers(body.applicationNos));
    return deliver(
      (data ?? []).map((row) => ({
        to: row.email,
        mail: recognitionReady({
          name: row.applicant_name,
          applicationNo: row.application_no,
        }),
      })),
    );
  }

  if (event === "credentials") {
    const role = body.role === "supervisor" ? "supervisor" : "scholar";
    const identifier = text(body.identifier);
    const password = typeof body.password === "string" ? body.password : "";
    const { data } = await supabase
      .from("portal_users")
      .select("name, identifier, password")
      .eq("role", role)
      .ilike("identifier", identifier)
      .maybeSingle();
    // Only a password that really belongs to the account may be mailed.
    if (
      !data ||
      typeof data.password !== "string" ||
      !verifySecret(password, data.password)
    ) {
      return NextResponse.json({ ok: false, message: "Not matched." }, { status: 400 });
    }
    return deliver([
      {
        to: data.identifier,
        mail: loginDetails({
          name: data.name,
          role,
          username: data.identifier,
          password,
        }),
      },
    ]);
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
