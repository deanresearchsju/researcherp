import { auditServer } from "@/lib/audit-server";
import {
  academicYearOf,
  approvable,
  cleanRules,
  computeIncentive,
  countsAgainstCeiling,
  facultyKeyOf,
  incentiveDate,
  isAcademicYear,
  policyRules,
  type ClaimStatus,
  type IncentiveClaim,
  type IncentiveRules,
} from "@/lib/faculty-incentives";
import { recordTitle, valueText, type ResearchRecord } from "@/lib/faculty-research";
import { listRecords, type Actor, type Result } from "@/lib/faculty-research-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type ClaimRow = Database["public"]["Tables"]["faculty_incentive_claims"]["Row"];

const unreadable = "The incentives could not be read. Try again.";
const unsaved = "The incentive could not be saved. Try again.";

function toClaim(row: ClaimRow): IncentiveClaim {
  return {
    id: row.id,
    recordId: row.record_id,
    facultyKey: row.faculty_key,
    facultyName: row.faculty_name,
    designation: row.designation,
    academicYear: row.academic_year,
    basis: row.basis,
    computed: Number(row.computed),
    claimed: Number(row.claimed),
    approved: Number(row.approved),
    status: row.status as ClaimStatus,
    remarks: row.remarks,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Every academic year with its own rules, and the rules of each. */
export async function loadAllRules(): Promise<Record<string, IncentiveRules> | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("faculty_incentive_settings")
    .select("id, payload");
  if (error) {
    console.error(error);
    return null;
  }
  const rules: Record<string, IncentiveRules> = {};
  for (const row of data ?? [])
    if (isAcademicYear(row.id)) rules[row.id] = cleanRules(row.payload);
  return rules;
}

/** The rules of a year: its own, else the latest earlier year's, else the policy's rates. */
export function rulesFor(all: Record<string, IncentiveRules>, year: string) {
  if (all[year]) return { rules: all[year], from: year };
  const earlier = Object.keys(all)
    .filter((item) => item < year)
    .sort()
    .pop();
  return earlier
    ? { rules: all[earlier], from: earlier }
    : { rules: policyRules, from: "" };
}

export async function saveRules(year: string, input: unknown, actor: Actor) {
  if (!isAcademicYear(year))
    return { ok: false as const, message: "Choose the academic year." };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false as const, message: unsaved };
  const rules = cleanRules(input);
  const { error } = await supabase.from("faculty_incentive_settings").upsert({
    id: year,
    payload: rules as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: actor.identifier,
  });
  if (error) {
    console.error(error);
    return { ok: false as const, message: unsaved };
  }
  const ceilings = Object.entries(rules.ceilings)
    .map(([designation, value]) => `${designation} ₹${value}`)
    .join(", ");
  await auditServer({
    actorRole: actor.role,
    actorIdentifier: actor.identifier,
    action: "faculty-incentive:rules",
    subject: year,
    detail: `${actor.name} saved the incentive rules for ${year}. Ceilings: ${ceilings}. Scopus ${rules.scopus.join("/")}; book ₹${rules.book}; patent ₹${rules.patentGrant}; SCI ${rules.sci.map((row) => row.join("/")).join(" | ")}`,
  });
  return { ok: true as const, rules };
}

export async function loadClaims(): Promise<IncentiveClaim[] | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("faculty_incentive_claims")
    .select("*")
    .limit(10000);
  if (error) {
    console.error(error);
    return null;
  }
  return (data ?? []).map((row) => toClaim(row as ClaimRow));
}

export type IncentiveRow = {
  record: ResearchRecord;
  academicYear: string;
  computed: number;
  basis: string;
  claim: IncentiveClaim | null;
};

/** The publications and patents of an academic year, each with its incentive and claim. */
export async function incentiveBoard(year: string): Promise<
  Result<{
    rows: IncentiveRow[];
    rules: IncentiveRules;
    rulesFrom: string;
    years: string[];
    claims: IncentiveClaim[];
  }>
> {
  const [records, all, claims] = await Promise.all([
    listRecords("publication"),
    loadAllRules(),
    loadClaims(),
  ]);
  if (!records.ok || !all || !claims)
    return { ok: false, status: 500, message: unreadable };
  const { rules, from } = rulesFor(all, year);
  const years = new Set<string>(Object.keys(all));
  const rows: IncentiveRow[] = [];
  for (const record of records.value) {
    const recordYear = academicYearOf(incentiveDate(record.values));
    if (recordYear) years.add(recordYear);
    if (recordYear !== year) continue;
    const computed = computeIncentive(record, rules);
    rows.push({
      record,
      academicYear: recordYear,
      computed: computed.amount,
      basis: computed.basis,
      claim: claims.find((claim) => claim.recordId === record.id) ?? null,
    });
  }
  return {
    ok: true,
    value: {
      rows,
      rules,
      rulesFrom: from,
      years: [...years].sort().reverse(),
      claims: claims.filter((claim) => claim.academicYear === year),
    },
  };
}

export type ClaimAction = "claim" | "approve" | "pay" | "reject" | "reopen";

/**
 * Moves a claim on. A claim is recorded with the policy amount (or a lower or higher amount the
 * office enters, with a remark); on approval the amount is cut to what is left under the
 * ceiling of the faculty member's cadre for that academic year.
 */
export async function actOnClaim(
  recordId: string,
  action: ClaimAction,
  input: { amount?: unknown; remarks?: unknown },
  actor: Actor,
): Promise<Result<IncentiveClaim>> {
  if (!/^[0-9a-f-]{36}$/i.test(recordId))
    return { ok: false, status: 400, message: "Unknown record." };
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false, status: 503, message: unsaved };
  const records = await listRecords("publication");
  const all = await loadAllRules();
  const claims = await loadClaims();
  if (!records.ok || !all || !claims)
    return { ok: false, status: 500, message: unreadable };
  const record = records.value.find((item) => item.id === recordId);
  if (!record)
    return { ok: false, status: 404, message: "The publication was not found." };
  const year = academicYearOf(incentiveDate(record.values));
  if (!year) return { ok: false, status: 400, message: "The publication has no date." };
  const { rules } = rulesFor(all, year);
  const computed = computeIncentive(record, rules);
  const existing = claims.find((claim) => claim.recordId === recordId) ?? null;
  const remarks =
    typeof input.remarks === "string" ? input.remarks.trim().slice(0, 500) : "";
  const now = new Date().toISOString();
  const designation = valueText(record.values, "designation");
  const facultyKey = facultyKeyOf(record.values);
  const title = recordTitle("publication", record.values);
  const name = valueText(record.values, "facultyName");
  let change: Database["public"]["Tables"]["faculty_incentive_claims"]["Update"] = {};
  let line = "";

  if (action === "claim") {
    if (!record.approvedAt)
      return {
        ok: false,
        status: 409,
        message: "Check and approve the publication first (Faculty publications).",
      };
    if (existing && existing.status !== "Rejected")
      return { ok: false, status: 409, message: "This publication is already claimed." };
    const sent = Number(input.amount);
    const claimed =
      input.amount === undefined || input.amount === "" ? computed.amount : sent;
    if (!Number.isFinite(claimed) || claimed < 0 || claimed > 10_000_000)
      return { ok: false, status: 400, message: "Enter the amount claimed." };
    if (claimed !== computed.amount && !remarks)
      return {
        ok: false,
        status: 400,
        message: "Give a remark when the amount differs from the policy.",
      };
    if (claimed <= 0)
      return { ok: false, status: 400, message: "There is nothing to claim." };
    change = {
      faculty_name: name,
      designation,
      academic_year: year,
      basis: computed.basis,
      computed: computed.amount,
      claimed,
      approved: 0,
      status: "Claimed",
      remarks,
    };
    line = `claimed ₹${claimed} (policy ₹${computed.amount}, ${computed.basis})`;
  } else {
    if (!existing) return { ok: false, status: 404, message: "Record the claim first." };
    if (action === "approve") {
      if (existing.status !== "Claimed")
        return {
          ok: false,
          status: 409,
          message: "Only a claim waiting for approval can be approved.",
        };
      const ceiling = rules.ceilings[designation] ?? 0;
      if (ceiling <= 0)
        return {
          ok: false,
          status: 409,
          message: `Set the ${year} ceiling for ${designation || "this designation"} under Rules first.`,
        };
      const soFar = claims
        .filter(
          (claim) =>
            claim.id !== existing.id &&
            claim.facultyKey === facultyKey &&
            claim.academicYear === year &&
            countsAgainstCeiling(claim.status),
        )
        .reduce((sum, claim) => sum + claim.approved, 0);
      const allowed = approvable(existing.claimed, ceiling, soFar);
      if (allowed.amount <= 0)
        return {
          ok: false,
          status: 409,
          message: `The ${year} ceiling of ₹${ceiling} for ${designation} is already reached.`,
        };
      change = {
        status: "Approved",
        approved: allowed.amount,
        designation,
        ...(remarks ? { remarks } : {}),
      };
      line = `approved ₹${allowed.amount}${allowed.capped ? ` (cut to the ceiling: ₹${ceiling}, ₹${soFar} already approved)` : ""}`;
    } else if (action === "pay") {
      if (existing.status !== "Approved")
        return {
          ok: false,
          status: 409,
          message: "Only an approved claim can be marked paid.",
        };
      change = { status: "Paid", ...(remarks ? { remarks } : {}) };
      line = `marked paid ₹${existing.approved}`;
    } else if (action === "reject") {
      if (existing.status === "Paid")
        return { ok: false, status: 409, message: "A paid claim cannot be rejected." };
      if (!remarks)
        return { ok: false, status: 400, message: "Give the reason for rejecting." };
      change = { status: "Rejected", approved: 0, remarks };
      line = `rejected: ${remarks}`;
    } else if (action === "reopen") {
      if (existing.status !== "Approved" && existing.status !== "Rejected")
        return {
          ok: false,
          status: 409,
          message: "Only an approved or rejected claim can be reopened.",
        };
      change = { status: "Claimed", approved: 0, ...(remarks ? { remarks } : {}) };
      line = "reopened";
    } else return { ok: false, status: 400, message: "Unknown action." };
  }

  const stamp = { updated_at: now, updated_by: actor.identifier };
  const saved = existing
    ? await supabase
        .from("faculty_incentive_claims")
        .update({ ...change, ...stamp })
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabase
        .from("faculty_incentive_claims")
        .insert({
          record_id: recordId,
          faculty_key: facultyKey,
          academic_year: year,
          ...change,
          ...stamp,
        })
        .select("*")
        .single();
  if (saved.error || !saved.data) {
    console.error(saved.error);
    return { ok: false, status: 500, message: unsaved };
  }
  await auditServer({
    actorRole: actor.role,
    actorIdentifier: actor.identifier,
    action: `faculty-incentive:${action}`,
    subject: recordId,
    detail: `${actor.name} ${line} for ${name} (${designation}, ${year}): "${title}"`,
  });
  return { ok: true, value: toClaim(saved.data as ClaimRow) };
}
