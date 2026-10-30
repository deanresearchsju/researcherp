import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * A line in the audit trail written by the server itself (sign-ins, sign-outs, password changes),
 * where the browser has no say in who did it. A failure to write never stops the request.
 */
export async function auditServer(entry: {
  actorRole: string;
  actorIdentifier: string;
  action: string;
  subject: string;
  detail?: string;
}) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return;
    await supabase.from("audit_log").insert({
      actor_role: entry.actorRole.slice(0, 40),
      actor_identifier: entry.actorIdentifier.slice(0, 200),
      action: entry.action.slice(0, 120),
      subject: entry.subject.slice(0, 240),
      detail: (entry.detail ?? "").slice(0, 2000),
    });
  } catch {
    // The trail is a record, not a gate.
  }
}
