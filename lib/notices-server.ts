import { createAdminSupabase } from "@/lib/supabase/admin";

/** Server-side notice to the whole research office (admin, Dean and staff). */
export async function insertOfficeNotice(input: {
  title: string;
  detail: string;
  href: string;
}) {
  const supabase = createAdminSupabase();
  if (!supabase) return;
  const row = { role: "office", identifier: "*", ...input };
  const { error } = await supabase.from("portal_notices").insert(row);
  if (error) {
    // Before the inbox migration the table has no href column.
    await supabase.from("portal_notices").insert({
      role: row.role,
      identifier: row.identifier,
      title: row.title,
      detail: row.detail,
    });
  }
}
