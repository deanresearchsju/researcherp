import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { applyRegisterPayload, scholarSignInId, scholarsGuidedBy } from "@/lib/register";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  activeIndex,
  evaluationPayload,
  evaluatorGroups,
  evaluatorsPerGroup,
  nominationProblem,
  parseEvaluationPayload,
  scholarKeyOf,
  supervisorView,
  type EvaluationRecord,
  type Evaluator,
  type EvaluatorGroup,
  type InviteEntry,
} from "@/lib/thesis-evaluation-model";
import type { Json } from "@/types/database";

const migrationHint =
  "Run supabase/migrations/20261020150000_thesis_evaluation.sql in the Supabase SQL editor.";

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function same(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

type Row = {
  scholar_key: string;
  scholar_identifier: string;
  scholar_name: string;
  supervisor_identifier: string;
  supervisor_name: string;
  payload: Json;
  updated_at: string;
};

async function loadRows(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  supervisorIdentifier?: string,
) {
  const query = supabase.from("thesis_evaluation").select("*");
  const { data, error } = supervisorIdentifier
    ? await query.ilike("supervisor_identifier", supervisorIdentifier)
    : await query;
  if (error) return null;
  return (data as Row[]).map((row) => parseEvaluationPayload(row, row.payload));
}

async function loadRecord(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  scholarKey: string,
) {
  const { data, error } = await supabase
    .from("thesis_evaluation")
    .select("*")
    .eq("scholar_key", scholarKey)
    .maybeSingle();
  if (error) return { error: true as const };
  return {
    error: false as const,
    record: data ? parseEvaluationPayload(data, data.payload) : null,
  };
}

async function saveRecord(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  record: EvaluationRecord,
) {
  const { error } = await supabase.from("thesis_evaluation").upsert(
    {
      scholar_key: record.scholarKey,
      scholar_identifier: record.scholarIdentifier,
      scholar_name: record.scholarName,
      supervisor_identifier: record.supervisorIdentifier,
      supervisor_name: record.supervisorName,
      payload: evaluationPayload(record) as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scholar_key" },
  );
  return !error;
}

async function audit(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  actor: { role: string; identifier: string },
  action: string,
  subject: string,
  detail = "",
) {
  await supabase.from("audit_log").insert({
    actor_role: actor.role,
    actor_identifier: actor.identifier,
    action,
    subject,
    detail,
  });
}

/** The supervisor guides this scholar through an allotment or the register. */
async function guides(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  supervisor: { identifier: string; name: string },
  scholarIdentifier: string,
) {
  const { data } = await supabase
    .from("scholar_allocations")
    .select("scholar_identifier, supervisor_identifier");
  if (
    (data ?? []).some(
      (row) =>
        same(row.supervisor_identifier, supervisor.identifier) &&
        same(row.scholar_identifier, scholarIdentifier),
    )
  ) {
    return true;
  }
  const { data: register } = await supabase
    .from("research_register")
    .select("payload")
    .eq("id", "register")
    .maybeSingle();
  applyRegisterPayload(register?.payload ?? null);
  return scholarsGuidedBy(supervisor.name, supervisor.identifier).some((scholar) =>
    [
      scholarSignInId(scholar),
      scholar.email,
      scholar.registrationNumber,
      scholar.id,
    ].some((key) => key.trim() && same(key, scholarIdentifier)),
  );
}

/** The Dean has accepted the scholar's synopsis. */
async function synopsisAccepted(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  scholarIdentifier: string,
) {
  const { data } = await supabase
    .from("doctoral_office")
    .select("payload")
    .eq("id", "office")
    .maybeSingle();
  const payload = data?.payload;
  const synopses =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).synopses
      : null;
  if (!Array.isArray(synopses)) return false;
  return synopses.some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.scholarIdentifier === "string" &&
      same(row.scholarIdentifier, scholarIdentifier) &&
      row.status === "Approved"
    );
  });
}

function canDecide(role: string) {
  return role === "dean" || role === "admin";
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in to continue.", 401);
  const supabase = createAdminSupabase();
  if (!supabase) return fail(migrationHint, 503);
  if (canDecide(session.role)) {
    const records = await loadRows(supabase);
    if (!records) return fail(migrationHint, 503);
    return NextResponse.json({ ok: true, role: "office", records });
  }
  if (session.role === "supervisor") {
    const records = await loadRows(supabase, session.identifier);
    if (!records) return fail(migrationHint, 503);
    return NextResponse.json({
      ok: true,
      role: "supervisor",
      records: records.map(supervisorView),
    });
  }
  return fail("This record is confidential.", 403);
}

function parseNominees(value: unknown): Record<EvaluatorGroup, Evaluator[]> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const result = {} as Record<EvaluatorGroup, Evaluator[]>;
  for (const group of evaluatorGroups) {
    const list = raw[group];
    if (!Array.isArray(list)) return null;
    result[group] = list.slice(0, evaluatorsPerGroup).map((item) => {
      const row =
        item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const pick = (key: string) =>
        typeof row[key] === "string" ? (row[key] as string).trim().slice(0, 300) : "";
      return {
        name: pick("name"),
        designation: pick("designation"),
        institution: pick("institution"),
        address: pick("address"),
        email: pick("email"),
        phone: pick("phone"),
        specialization: pick("specialization"),
      };
    });
  }
  return result;
}

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!session) return fail("Sign in to continue.", 401);
  const supabase = createAdminSupabase();
  if (!supabase) return fail(migrationHint, 503);
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return fail("That request was not valid.");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("That request was not valid.");
  }
  const action = body.action;
  const scholarIdentifier =
    typeof body.scholarIdentifier === "string" ? body.scholarIdentifier.trim() : "";
  if (!scholarIdentifier) return fail("Select a scholar.");
  const scholarKey = scholarKeyOf(scholarIdentifier);
  const loaded = await loadRecord(supabase, scholarKey);
  if (loaded.error) return fail(migrationHint, 503);
  const existing = loaded.record;

  if (action === "nominate") {
    if (session.role !== "supervisor") {
      return fail("Only the supervisor nominates evaluators.", 403);
    }
    if (!(await guides(supabase, session, scholarIdentifier))) {
      return fail("This scholar is not with you.", 403);
    }
    if (!(await synopsisAccepted(supabase, scholarIdentifier))) {
      return fail("Nominations open after the Dean accepts the synopsis.");
    }
    if (existing?.selection) {
      return fail("The Dean has already decided on these nominations.");
    }
    if (existing && !same(existing.supervisorIdentifier, session.identifier)) {
      return fail("Another supervisor has nominated evaluators for this scholar.", 403);
    }
    const nominees = parseNominees(body.nominees);
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 400) : "";
    const domain =
      typeof body.domain === "string" ? body.domain.trim().slice(0, 200) : "";
    if (!nominees) return fail("Name the evaluators.");
    const problem = nominationProblem(nominees, title, domain);
    if (problem) return fail(problem);
    const record: EvaluationRecord = {
      scholarKey,
      scholarIdentifier,
      scholarName:
        typeof body.scholarName === "string" && body.scholarName.trim()
          ? body.scholarName.trim()
          : (existing?.scholarName ?? scholarIdentifier),
      supervisorIdentifier: session.identifier,
      supervisorName: session.name || session.identifier,
      title,
      domain,
      nominees,
      nominatedOn: today(),
      selection: null,
      selectedBy: "",
      selectedOn: "",
      updatedAt: "",
    };
    if (!(await saveRecord(supabase, record))) return fail(migrationHint, 503);
    await audit(supabase, session, "evaluators:nominated", scholarIdentifier);
    return NextResponse.json({ ok: true });
  }

  if (!canDecide(session.role)) {
    return fail("Only the Dean or the administrator can do this.", 403);
  }
  if (!existing) return fail("The supervisor has not nominated evaluators yet.");

  if (action === "select") {
    const orderRaw =
      body.order && typeof body.order === "object"
        ? (body.order as Record<string, unknown>)
        : {};
    const invited =
      existing.selection &&
      evaluatorGroups.some((group) =>
        existing.selection![group].invites.some(
          (item) => item.status !== "Not contacted",
        ),
      );
    if (invited)
      return fail("Invitations have started. The order cannot be changed now.");
    const selection = {} as NonNullable<EvaluationRecord["selection"]>;
    for (const group of evaluatorGroups) {
      const order = Array.isArray(orderRaw[group])
        ? (orderRaw[group] as unknown[]).filter(
            (item): item is number => typeof item === "number",
          )
        : [];
      const count = existing.nominees[group].length;
      const valid =
        order.length === count &&
        new Set(order).size === count &&
        order.every((index) => index >= 0 && index < count);
      if (!valid) return fail("Set the order for every group.");
      selection[group] = {
        order,
        invites: existing.nominees[group].map((): InviteEntry => ({
          status: "Not contacted",
          invitedOn: "",
          respondedOn: "",
          note: "",
        })),
      };
    }
    const record = {
      ...existing,
      selection,
      selectedBy: session.name || session.identifier,
      selectedOn: today(),
    };
    if (!(await saveRecord(supabase, record))) return fail(migrationHint, 503);
    await audit(supabase, session, "evaluators:selected", scholarIdentifier);
    return NextResponse.json({ ok: true });
  }

  if (action === "invite") {
    if (!existing.selection) return fail("The Dean has to select the evaluators first.");
    const group = body.group;
    if (
      typeof group !== "string" ||
      !(evaluatorGroups as readonly string[]).includes(group)
    ) {
      return fail("Select the group.");
    }
    const status = body.status;
    if (status !== "Invited" && status !== "Accepted" && status !== "Declined") {
      return fail("Select the response.");
    }
    const panel = existing.selection[group as EvaluatorGroup];
    const index = activeIndex(panel);
    if (index === null) return fail("Every evaluator in this group has declined.");
    const current = panel.invites[index];
    if (current.status === "Accepted")
      return fail("This evaluator has already accepted.");
    if (status === "Invited" && current.status !== "Not contacted") {
      return fail("This evaluator has already been invited.");
    }
    if (status !== "Invited" && current.status !== "Invited") {
      return fail("Send the invitation first.");
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const invites = panel.invites.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            status,
            invitedOn: status === "Invited" ? today() : item.invitedOn,
            respondedOn: status === "Invited" ? "" : today(),
            note: note || item.note,
          }
        : item,
    );
    const record = {
      ...existing,
      selection: { ...existing.selection, [group]: { ...panel, invites } },
    };
    if (!(await saveRecord(supabase, record))) return fail(migrationHint, 503);
    await audit(
      supabase,
      session,
      `evaluators:${status.toLowerCase()}`,
      scholarIdentifier,
      group,
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen") {
    const record = { ...existing, selection: null, selectedBy: "", selectedOn: "" };
    if (!(await saveRecord(supabase, record))) return fail(migrationHint, 503);
    await audit(supabase, session, "evaluators:reopened", scholarIdentifier);
    return NextResponse.json({ ok: true });
  }

  return fail("That action is not known.");
}
