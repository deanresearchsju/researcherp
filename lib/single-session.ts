import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieSession } from "@/lib/session";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * One sign-in at a time for each user. A sign-in is given a new id (kept in the portal_users
 * row and in the signed cookie); the newest one wins and an earlier cookie stops working.
 * Until the migration 20261027100000_single_sign_in.sql has been run, the column does not
 * exist and every sign-in is accepted as before.
 */
function db() {
  const client = createAdminSupabase();
  return client ? (client as unknown as SupabaseClient) : null;
}

const recent = new Map<string, { ok: boolean; until: number }>();
const keepFor = 4000;

/** Gives a user a new sign-in id. Returns "" when the column is not there yet. */
export async function startSignIn(userId: string) {
  const client = db();
  if (!client) return "";
  const sid = randomUUID();
  const { error } = await client
    .from("portal_users")
    .update({ session_id: sid })
    .eq("id", userId);
  if (error) return "";
  return sid;
}

/** True when this cookie is the user's newest sign-in (or sign-in tracking is not on). */
export async function signInIsCurrent(
  session: Pick<CookieSession, "role" | "identifier" | "sid">,
) {
  const mark = `${session.role}|${session.identifier.toLowerCase()}|${session.sid ?? ""}`;
  const seen = recent.get(mark);
  if (seen && seen.until > Date.now()) return seen.ok;
  const client = db();
  if (!client) return true;
  const { data, error } = await client
    .from("portal_users")
    .select("session_id")
    .eq("role", session.role)
    .ilike("identifier", session.identifier)
    .maybeSingle();
  // No column yet, or no row to compare: do not lock anybody out.
  if (error || !data) return true;
  const stored = (data as { session_id?: string | null }).session_id ?? "";
  const ok = !stored || stored === (session.sid ?? "");
  recent.set(mark, { ok, until: Date.now() + keepFor });
  if (recent.size > 500) recent.clear();
  return ok;
}

export function forgetSignIn() {
  recent.clear();
}
