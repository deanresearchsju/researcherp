import {
  incompleteApplicationsCopy,
  phdApplicationSteps,
} from "@/data/incomplete-applications";
import { officeWriteBlock } from "@/lib/access";
import { matchesOpenPhdSession } from "@/lib/office";
import { createSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

export type IncompleteApplication = {
  mobile: string;
  email: string;
  name: string;
  school: string;
  subject: string;
  studyMode: string;
  session: string;
  year: string;
  step: number;
  stepLabel: string;
  updatedAt: string;
  followNote: string;
  followedAt: string | null;
};

export type IncompleteLoad = {
  rows: IncompleteApplication[];
  detail: string | null;
};

function textOf(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

export function phdStepLabel(step: number) {
  return phdApplicationSteps[step] ?? incompleteApplicationsCopy.started;
}

function mapDraft(row: {
  mobile: string;
  email: string;
  department: string;
  step: number;
  payload: Json;
  updated_at: string;
  follow_note: string;
  followed_at: string | null;
}): IncompleteApplication {
  const title = textOf(row.payload, "title");
  const fullName = textOf(row.payload, "fullName");
  return {
    mobile: row.mobile.trim(),
    email: textOf(row.payload, "email") || row.email.trim(),
    name: [title, fullName].filter(Boolean).join(" ").trim(),
    school: textOf(row.payload, "school") || row.department.trim(),
    subject: textOf(row.payload, "specialization"),
    studyMode: textOf(row.payload, "studyMode"),
    session: textOf(row.payload, "session"),
    year: textOf(row.payload, "year"),
    step: row.step,
    stepLabel: phdStepLabel(row.step),
    updatedAt: row.updated_at,
    followNote: row.follow_note?.trim() ?? "",
    followedAt: row.followed_at,
  };
}

async function submittedMobiles() {
  const supabase = createSupabase();
  if (!supabase) return new Set<string>();
  const { data, error } = await supabase
    .from("phd_applications")
    .select("payload")
    .limit(500);
  if (error || !data) return new Set<string>();
  const mobiles = new Set<string>();
  for (const row of data) {
    const session = textOf(row.payload, "session");
    const year = textOf(row.payload, "year");
    if ((session || year) && !matchesOpenPhdSession(session, year)) continue;
    const mobile = textOf(row.payload, "mobile");
    if (mobile) mobiles.add(mobile);
  }
  return mobiles;
}

export function isCurrentIncomplete(row: IncompleteApplication) {
  if (!row.session && !row.year) return true;
  return matchesOpenPhdSession(row.session, row.year);
}

export async function loadIncompleteApplications(): Promise<IncompleteLoad> {
  const supabase = createSupabase();
  if (!supabase) {
    return { rows: [], detail: incompleteApplicationsCopy.loadFailed };
  }
  const listed = await supabase.rpc("list_phd_drafts");
  if (listed.error || !listed.data) {
    return {
      rows: [],
      detail: `${incompleteApplicationsCopy.loadFailed} ${incompleteApplicationsCopy.migration}`,
    };
  }
  const submitted = await submittedMobiles();
  const rows = listed.data
    .map(mapDraft)
    .filter((row) => isCurrentIncomplete(row) && !submitted.has(row.mobile));
  return { rows, detail: null };
}

export async function saveIncompleteFollow(
  mobile: string,
  note: string,
  followed: boolean,
) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const supabase = createSupabase();
  if (!supabase)
    return { ok: false as const, message: incompleteApplicationsCopy.loadFailed };
  const { error } = await supabase.rpc("update_phd_draft_follow", {
    p_mobile: mobile,
    p_note: note,
    p_followed: followed,
  });
  if (error)
    return { ok: false as const, message: incompleteApplicationsCopy.loadFailed };
  return { ok: true as const };
}

export async function removeIncompleteApplication(mobile: string) {
  const blocked = officeWriteBlock();
  if (blocked) return blocked;
  const supabase = createSupabase();
  if (!supabase)
    return { ok: false as const, message: incompleteApplicationsCopy.loadFailed };
  const { error } = await supabase.rpc("delete_phd_draft_office", {
    p_mobile: mobile,
  });
  if (error)
    return { ok: false as const, message: incompleteApplicationsCopy.loadFailed };
  return { ok: true as const };
}
