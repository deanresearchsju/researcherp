import { NextResponse } from "next/server";

import { createRecord, facultyFile, indiaToday, isResearchKind } from "@/lib/faculty-research-server";
import { cleanValues, identityFields } from "@/lib/faculty-research";
import { serverChecklist } from "@/lib/checklists-server";
import { evidenceList } from "@/lib/faculty-evidence";
import { linkReport } from "@/lib/link-report";
import { clientAddress, rateLimit } from "@/lib/rate-limit";
import { fail, readBody, sameOrigin } from "@/lib/request-body";

/**
 * The open page for faculty publications and project proposals. A faculty member gives a mobile
 * number and date of birth; the records saved under both are shown, with the personal details of
 * the latest one so that they are typed only the first time. Records can only be added here:
 * nothing is changed or deleted. Every action is counted per network and per mobile number.
 */
const tooMany = "Too many requests. Please try again later.";
const otherBirthDate =
  "This mobile number is saved with another date of birth. Check the date of birth, or contact the research office.";

function limited(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, message: tooMany },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** The mobile number and date of birth, checked with the same rules as the form. */
function identityFrom(body: Record<string, unknown>) {
  const probe = cleanValues("publication", { mobile: body.mobile, dob: body.dob }, indiaToday());
  const errors = probe.ok ? {} : probe.errors;
  if (errors.mobile || errors.dob) return { errors: { mobile: errors.mobile, dob: errors.dob } };
  const mobile = String(body.mobile)
    .replace(/[\s-]/g, "")
    .replace(/^(\+91|0)(?=\d{10}$)/, "");
  return { mobile, dob: String(body.dob) };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("The request was refused.", 403);
  const address = clientAddress(request.headers);
  const flood = rateLimit(`research-public:${address}`, 600, 60 * 60_000);
  if (!flood.allowed) return limited(flood.retryAfterSeconds);
  const body = await readBody(request);
  if (!body) return fail("The request could not be read.");
  if (body.action === "check-links") {
    const checks = rateLimit(`research-links:${address}`, 40, 10 * 60_000);
    if (!checks.allowed) return limited(checks.retryAfterSeconds);
    return NextResponse.json({ ok: true, ...(await linkReport(body)) });
  }
  const who = identityFrom(body);
  if (!("mobile" in who))
    return fail("Enter the mobile number and date of birth.", 400, { errors: who.errors });
  const { mobile, dob } = who as { mobile: string; dob: string };

  if (body.action === "lookup") {
    const byAddress = rateLimit(`research-lookup:${address}`, 15, 15 * 60_000);
    const byMobile = rateLimit(`research-lookup-mobile:${mobile}`, 10, 15 * 60_000);
    if (!byAddress.allowed || !byMobile.allowed)
      return limited(Math.max(byAddress.retryAfterSeconds, byMobile.retryAfterSeconds));
    const file = await facultyFile(mobile, dob);
    if (!file.ok) return fail(file.message, file.status);
    if (file.value.otherBirthDate) return fail(otherBirthDate, 409);
    return NextResponse.json({ ok: true, records: file.value.records, profile: file.value.profile });
  }

  if (body.action === "submit") {
    // A field hidden from people ("website") is filled only by robots: they are told it worked.
    if (typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ ok: true, records: [], profile: null });
    }
    const kind = body.kind;
    if (!isResearchKind(kind)) return fail("Choose publication or project proposal.");
    const bySubmitter = rateLimit(`research-submit:${address}`, 200, 60 * 60_000);
    const byMobile = rateLimit(`research-submit-mobile:${mobile}`, 300, 24 * 60 * 60_000);
    if (!bySubmitter.allowed || !byMobile.allowed)
      return limited(Math.max(bySubmitter.retryAfterSeconds, byMobile.retryAfterSeconds));
    const before = await facultyFile(mobile, dob);
    if (!before.ok) return fail(before.message, before.status);
    if (before.value.otherBirthDate) return fail(otherBirthDate, 409);
    const sent =
      body.record && typeof body.record === "object" && !Array.isArray(body.record)
        ? (body.record as Record<string, unknown>)
        : {};
    // The personal details are the saved ones once a record exists; the first record brings them.
    const record: Record<string, unknown> = { ...sent, mobile, dob };
    // A detail missing from the saved ones (the date of joining, for records saved before it was
    // asked) is taken from this record once.
    if (before.value.profile)
      for (const field of identityFields) {
        const saved = before.value.profile[field.key];
        if (typeof saved === "string" && saved) record[field.key] = saved;
      }
    const name = String(record.facultyName ?? "").slice(0, 120);
    const made = await createRecord(
      kind,
      record,
      { role: "public", identifier: mobile, name: name || "A faculty member" },
      { role: "public", identifier: mobile },
      await serverChecklist(evidenceList(kind)),
    );
    if (!made.ok)
      return fail(made.message, made.status, made.errors ? { errors: made.errors } : {});
    const after = await facultyFile(mobile, dob);
    return NextResponse.json({
      ok: true,
      records: after.ok ? after.value.records : [],
      profile: after.ok ? after.value.profile : null,
    });
  }

  return fail("Unknown action.");
}
