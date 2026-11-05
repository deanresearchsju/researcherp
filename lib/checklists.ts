import { admissionChecklist } from "@/data/admission";
import { checklist as applicationChecklist } from "@/data/checklist";
import { colloquiumCheck, synopsisChecklist, thesisChecklist } from "@/data/doctoral";
import { proposalStatuses, publicationTypes } from "@/lib/faculty-research";

/**
 * Every checklist of the ERP, kept by the administrator under Administration › Checklists: items
 * can be added, renamed, made mandatory or optional, and deleted. Until the administrator saves
 * a list, the list written in the code is used, so nothing changes on its own.
 */
export type ChecklistItem = {
  id: string;
  title: string;
  required: boolean;
  detail?: string;
  badge?: string;
  /** Only for these record types or statuses (evidence lists); empty means every record. */
  appliesTo?: string[];
  /** Read by the ERP itself (the colloquium minimum): it can be made optional but not removed. */
  locked?: boolean;
};

export const checklistIds = [
  "application",
  "admission",
  "synopsis",
  "thesis",
  "publication-evidence",
  "proposal-evidence",
] as const;
export type ChecklistKey = (typeof checklistIds)[number];

type Definition = {
  title: string;
  /** Where the list is used, shown beside it on the Checklists page. */
  usedIn: string;
  defaults: ChecklistItem[];
  withDetail?: boolean;
  withBadge?: boolean;
  /** The values an item may be limited to (publication types, proposal statuses). */
  appliesOptions?: readonly string[];
};

const textItems = (titles: readonly string[]): ChecklistItem[] =>
  titles.map((title) => ({
    id: title,
    title,
    required: true,
    ...(title === colloquiumCheck ? { locked: true } : {}),
  }));

const nonPatent = publicationTypes.filter(
  (type) => type !== "Patent" && type !== "Online course",
);

export const checklistCatalog: Record<ChecklistKey, Definition> = {
  application: {
    title: "Ph.D. application documents",
    usedIn: "Admission page (website)",
    withDetail: true,
    withBadge: true,
    defaults: applicationChecklist.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      required: item.required,
      ...(item.badge ? { badge: item.badge } : {}),
    })),
  },
  admission: {
    title: "Admission documents",
    usedIn: "Selection › certificate verification; scholar admission page",
    defaults: admissionChecklist.map((item) => ({
      id: item.id,
      title: item.title,
      required: item.required,
    })),
  },
  synopsis: {
    title: "Plagiarism check before synopsis",
    usedIn: "Plagiarism check › Before synopsis",
    defaults: textItems(synopsisChecklist),
  },
  thesis: {
    title: "Plagiarism check before thesis",
    usedIn: "Plagiarism check › Before thesis",
    defaults: textItems(thesisChecklist),
  },
  "publication-evidence": {
    title: "Publication evidence",
    usedIn: "Faculty publications (uploads with each record)",
    appliesOptions: publicationTypes,
    defaults: [
      {
        id: "first-page",
        title: "First page of the publication",
        required: true,
        appliesTo: [...nonPatent],
      },
      {
        id: "indexing-proof",
        title: "Indexing proof (Scopus / Web of Science)",
        required: false,
        appliesTo: ["Journal article", "Conference proceedings", "Book chapter"],
      },
      {
        id: "course-certificate",
        title: "Passing certificate (online course)",
        required: true,
        appliesTo: ["Online course"],
      },
      {
        id: "patent-proof",
        title: "Patent filing receipt or grant certificate",
        required: true,
        appliesTo: ["Patent"],
      },
    ],
  },
  "proposal-evidence": {
    title: "Project proposal evidence",
    usedIn: "Project proposals (uploads with each record)",
    appliesOptions: proposalStatuses,
    defaults: [
      { id: "submission-proof", title: "Proof of submission", required: true },
      {
        id: "sanction-order",
        title: "Sanction order",
        required: true,
        appliesTo: ["Accepted"],
      },
      {
        id: "utilisation-certificate",
        title: "Utilisation certificate",
        required: false,
        appliesTo: ["Accepted"],
      },
    ],
  },
};

export function isChecklistKey(value: unknown): value is ChecklistKey {
  return typeof value === "string" && (checklistIds as readonly string[]).includes(value);
}

const clip = (value: unknown, max: number) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** An id for a new item, from its title. */
export function itemId(title: string, taken: readonly string[]) {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "item";
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}

export type ChecklistCheck =
  { ok: true; items: ChecklistItem[] } | { ok: false; message: string };

/**
 * Checks a list the administrator saves: titles present and not repeated, ids kept, the items
 * the ERP reads itself (locked) still there, and only the fields this list uses.
 */
export function cleanChecklist(key: ChecklistKey, input: unknown): ChecklistCheck {
  const definition = checklistCatalog[key];
  if (!Array.isArray(input)) return { ok: false, message: "The list could not be read." };
  if (input.length === 0) return { ok: false, message: "Keep at least one item." };
  if (input.length > 60) return { ok: false, message: "At most 60 items." };
  const items: ChecklistItem[] = [];
  const titles = new Set<string>();
  for (const raw of input) {
    const entry = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const title = clip(entry.title, 300);
    if (!title) return { ok: false, message: "Every item needs a title." };
    if (titles.has(title.toLowerCase()))
      return { ok: false, message: `"${title}" is written twice.` };
    titles.add(title.toLowerCase());
    const taken = items.map((item) => item.id);
    const sentId = clip(entry.id, 300);
    // Plagiarism checks are kept by their wording, so their id follows the title.
    const id =
      key === "synopsis" || key === "thesis"
        ? title
        : sentId && !taken.includes(sentId)
          ? sentId
          : itemId(title, taken);
    const item: ChecklistItem = { id, title, required: entry.required === true };
    if (definition.withDetail) item.detail = clip(entry.detail, 400);
    if (definition.withBadge && clip(entry.badge, 40)) item.badge = clip(entry.badge, 40);
    if (definition.appliesOptions) {
      const applies = Array.isArray(entry.appliesTo)
        ? entry.appliesTo.filter(
            (value): value is string =>
              typeof value === "string" && definition.appliesOptions!.includes(value),
          )
        : [];
      if (applies.length > 0) item.appliesTo = [...new Set(applies)];
    }
    if (definition.defaults.some((base) => base.locked && base.id === id))
      item.locked = true;
    items.push(item);
  }
  for (const base of definition.defaults.filter((item) => item.locked)) {
    if (!items.some((item) => item.id === base.id))
      return {
        ok: false,
        message: `"${base.title}" is used by the ERP and cannot be removed.`,
      };
  }
  return { ok: true, items };
}

/** The items that apply to a record of this type or status. */
export function itemsFor(items: readonly ChecklistItem[], value: string) {
  return items.filter(
    (item) => !item.appliesTo?.length || item.appliesTo.includes(value),
  );
}

// ---- The lists in use, shared by every screen (loaded once from the server). ----

let saved: Partial<Record<ChecklistKey, ChecklistItem[]>> = {};
let version = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function applyChecklists(lists: Partial<Record<ChecklistKey, ChecklistItem[]>>) {
  saved = {};
  for (const key of checklistIds) {
    const check = lists[key] ? cleanChecklist(key, lists[key]) : null;
    if (check?.ok) saved[key] = check.items;
  }
  version += 1;
  listeners.forEach((listener) => listener());
}

export function checklistItems(key: ChecklistKey): ChecklistItem[] {
  return saved[key] ?? checklistCatalog[key].defaults;
}

/** The titles of a list (the plagiarism checks are kept by title); mandatory ones only if asked. */
export function checklistTitles(key: ChecklistKey, requiredOnly = false) {
  return checklistItems(key)
    .filter((item) => !requiredOnly || item.required)
    .map((item) => item.title);
}

export function subscribeChecklists(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadChecklists(force = false) {
  if (typeof window === "undefined") return Promise.resolve();
  if (loading && !force) return loading;
  loading = fetch("/api/checklists", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then(
      (
        data: {
          ok?: boolean;
          lists?: Partial<Record<ChecklistKey, ChecklistItem[]>>;
        } | null,
      ) => {
        if (data?.ok && data.lists) applyChecklists(data.lists);
      },
    )
    .catch(() => undefined);
  return loading;
}

/** The change counter, for screens that follow the lists. */
export function checklistsVersion() {
  return version;
}
