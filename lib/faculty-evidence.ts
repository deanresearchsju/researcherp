import { itemsFor, type ChecklistItem, type ChecklistKey } from "@/lib/checklists";
import {
  evidenceOf,
  valueText,
  type ResearchKind,
  type ResearchValues,
} from "@/lib/faculty-research";

/**
 * The evidence uploaded with a publication or proposal (the first page of a paper, a sanction
 * order …). Which files are asked for, and which are mandatory, is kept by the administrator under
 * Checklists; an item may be limited to some publication types or proposal statuses.
 */
export function evidenceList(kind: ResearchKind): ChecklistKey {
  return kind === "publication" ? "publication-evidence" : "proposal-evidence";
}

/** The items that apply to this record: by publication type, or by proposal status. */
export function evidenceItemsFor(
  kind: ResearchKind,
  values: ResearchValues,
  items: readonly ChecklistItem[],
) {
  const value =
    kind === "publication" ? valueText(values, "type") : valueText(values, "status");
  return itemsFor(items, value);
}

/** The mandatory items still without a file, by title. */
export function missingEvidence(
  kind: ResearchKind,
  values: ResearchValues,
  items: readonly ChecklistItem[],
) {
  const uploaded = evidenceOf(values);
  return evidenceItemsFor(kind, values, items)
    .filter((item) => item.required && !uploaded[item.id])
    .map((item) => item.title);
}
