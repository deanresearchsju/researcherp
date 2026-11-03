import { auditServer } from "@/lib/audit-server";
import {
  checklistCatalog,
  checklistIds,
  cleanChecklist,
  type ChecklistItem,
  type ChecklistKey,
} from "@/lib/checklists";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/** The saved checklists (only those the administrator has saved; the rest use the code's list). */
export async function loadSavedChecklists(): Promise<Partial<
  Record<ChecklistKey, ChecklistItem[]>
> | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("erp_checklists").select("id, items");
  if (error) {
    console.error(error);
    return null;
  }
  const lists: Partial<Record<ChecklistKey, ChecklistItem[]>> = {};
  for (const row of data ?? []) {
    const key = row.id as ChecklistKey;
    if (!(checklistIds as readonly string[]).includes(key)) continue;
    const check = cleanChecklist(key, row.items);
    if (check.ok) lists[key] = check.items;
  }
  return lists;
}

/** One list in use on the server: the saved one, or the code's list. */
export async function serverChecklist(key: ChecklistKey) {
  const lists = await loadSavedChecklists();
  return lists?.[key] ?? checklistCatalog[key].defaults;
}

function describe(before: readonly ChecklistItem[], after: readonly ChecklistItem[]) {
  const lines: string[] = [];
  for (const item of after) {
    const old = before.find((entry) => entry.id === item.id);
    if (!old) lines.push(`added "${item.title}"${item.required ? " (mandatory)" : ""}`);
    else {
      if (old.title !== item.title)
        lines.push(`renamed "${old.title}" to "${item.title}"`);
      if (old.required !== item.required)
        lines.push(`"${item.title}" made ${item.required ? "mandatory" : "optional"}`);
      if ((old.detail ?? "") !== (item.detail ?? ""))
        lines.push(`"${item.title}" note changed`);
      if ((old.appliesTo ?? []).join(",") !== (item.appliesTo ?? []).join(","))
        lines.push(
          `"${item.title}" applies to ${(item.appliesTo ?? []).join(", ") || "all"}`,
        );
    }
  }
  for (const item of before)
    if (!after.some((entry) => entry.id === item.id))
      lines.push(`deleted "${item.title}"`);
  if (
    before.map((item) => item.id).join("|") !== after.map((item) => item.id).join("|") &&
    lines.length === 0
  )
    lines.push("order changed");
  return lines;
}

export async function saveChecklist(
  key: ChecklistKey,
  input: unknown,
  actor: { role: string; identifier: string; name: string },
) {
  const check = cleanChecklist(key, input);
  if (!check.ok) return check;
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false as const, message: "The list could not be saved." };
  const before = await serverChecklist(key);
  const { error } = await supabase.from("erp_checklists").upsert({
    id: key,
    items: check.items as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: actor.identifier,
  });
  if (error) {
    console.error(error);
    return { ok: false as const, message: "The list could not be saved." };
  }
  const changes = describe(before, check.items);
  await auditServer({
    actorRole: actor.role,
    actorIdentifier: actor.identifier,
    action: "checklist:saved",
    subject: key,
    detail: `${actor.name} saved ${checklistCatalog[key].title}: ${changes.join("; ") || "no change"}`,
  });
  return { ok: true as const, items: check.items };
}
