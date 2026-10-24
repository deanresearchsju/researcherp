import { createSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

export const jsonLockConflict =
  "This record was changed in another session. Refresh, then save again.";

export type JsonBlobTable =
  | "doctoral_office"
  | "admission_office"
  | "research_register"
  | "news_board"
  | "research_areas"
  | "thesis_panels"
  | "exam_office";

export async function saveJsonBlob(
  table: JsonBlobTable,
  id: string,
  payload: Json,
  updatedAt: string | null,
) {
  const supabase = createSupabase();
  if (!supabase) {
    return { ok: false as const, conflict: false, message: "Supabase is not configured." };
  }
  const locked = await supabase.rpc("save_json_blob", {
    p_table: table,
    p_id: id,
    p_payload: payload,
    p_updated_at: updatedAt,
  });
  if (!locked.error && typeof locked.data === "string" && locked.data) {
    return { ok: true as const, updatedAt: locked.data };
  }
  if (locked.error && (locked.error.code === "P0001" || /conflict/i.test(locked.error.message))) {
    return { ok: false as const, conflict: true, message: jsonLockConflict };
  }
  const fallback = await supabase.from(table).upsert({ id, payload });
  if (fallback.error) {
    return { ok: false as const, conflict: false, message: fallback.error.message };
  }
  return { ok: true as const, updatedAt: updatedAt ?? new Date().toISOString() };
}
