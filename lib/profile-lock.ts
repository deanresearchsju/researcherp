/**
 * Basic information and profile: a scholar or a supervisor fills what is empty and cannot change
 * what is already there; the research office corrects anything. These checks run on the server
 * (app/api/db) as well as on the page, so they hold when a request is made by hand.
 */

const blank = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === "";

/** The fields that already hold a value and that the next version changes or empties. */
export function changedFilledFields(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  return Object.keys(existing).filter(
    (name) =>
      !blank(existing[name]) && String(existing[name]).trim() !== String(next[name] ?? "").trim(),
  );
}

function plain(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** A stable text of a value, so two copies of a record can be compared. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

/**
 * A supervisor saves the register only to fill the supervisor's own empty details. Everything
 * else in the register must come back exactly as it was, and in the three lists a supervisor's
 * entry touches (corrections, added supervisors, profiles) only the supervisor's own entry may
 * differ, and only by filling what was empty. Returns the reason to refuse, or null.
 */
export function supervisorRegisterViolation(
  stored: unknown,
  next: unknown,
  own: { keys: string[]; emails: string[]; names: string[] },
): string | null {
  const before = plain(stored);
  const after = plain(next);
  const ownKeys = new Set(own.keys.map(lower).filter(Boolean));
  const ownEmails = new Set(own.emails.map(lower).filter(Boolean));
  const ownNames = new Set(own.names.map(lower).filter(Boolean));
  const lists = ["supervisorEdits", "addedSupervisors", "profiles"];

  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (lists.includes(name)) continue;
    if (stable(before[name]) !== stable(after[name])) {
      return "Only the research office changes the register.";
    }
  }

  const isOwn = (list: string, entry: Record<string, unknown>) =>
    list === "addedSupervisors"
      ? ownEmails.has(lower(entry.email)) || ownNames.has(lower(entry.name))
      : ownKeys.has(lower(entry.key));
  const entries = (value: unknown) =>
    (Array.isArray(value) ? value : []).map((item) => plain(item));

  // What a supervisor may fill: the fields of the own entry, and only when still empty.
  const fillable: Record<string, string[]> = {
    supervisorEdits: ["phone", "campus", "researchArea"],
    addedSupervisors: ["phone", "campus", "researchArea"],
    profiles: ["researchArea", "bio", "vidwan"],
  };

  for (const list of lists) {
    const oldAll = entries(before[list]);
    const newAll = entries(after[list]);
    const others = (all: Record<string, unknown>[]) =>
      all
        .filter((entry) => !isOwn(list, entry))
        .map(stable)
        .sort();
    if (stable(others(oldAll)) !== stable(others(newAll))) {
      return "A supervisor may change only the supervisor's own details.";
    }
    const oldOwn = oldAll.find((entry) => isOwn(list, entry));
    const newOwn = newAll.filter((entry) => isOwn(list, entry));
    if (newOwn.length > 1) return "A supervisor may change only the supervisor's own details.";
    if (newOwn.length === 0) continue;
    const next = newOwn[0];
    if (!oldOwn) {
      // The first entry of the supervisor's own: never one shown to the public.
      if (list === "profiles" && next.published) {
        return "Only the research office shows a profile to the public.";
      }
      continue;
    }
    if (list === "supervisorEdits" && stable(oldOwn.onVacancyList) !== stable(next.onVacancyList)) {
      return "A supervisor may change only the empty details of the profile.";
    }
    const oldFields = list === "supervisorEdits" ? plain(oldOwn.fields) : oldOwn;
    const newFields = list === "supervisorEdits" ? plain(next.fields) : next;
    // Anything outside the fillable fields is not the supervisor's to change.
    for (const name of new Set([...Object.keys(oldFields), ...Object.keys(newFields)])) {
      if (fillable[list].includes(name)) continue;
      if (list !== "supervisorEdits" && ["updatedOn", "updatedBy"].includes(name)) continue;
      if (stable(oldFields[name]) !== stable(newFields[name])) {
        return "A supervisor may change only the empty details of the profile.";
      }
    }
    if (changedFilledFields(pick(oldFields, fillable[list]), pick(newFields, fillable[list])).length > 0) {
      return "What is already filled in cannot be changed. Ask the research office.";
    }
  }
  return null;
}

function pick(source: Record<string, unknown>, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, source[name]]));
}
