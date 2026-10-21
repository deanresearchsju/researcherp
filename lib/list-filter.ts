/**
 * List filters hold one or more chosen values in a single string so existing pages keep their
 * `useState("")` filters. Empty means "All".
 */
const separator = "\u001f";

export function filterValues(selected: string) {
  return selected === "" ? [] : selected.split(separator);
}

export function joinFilterValues(values: readonly string[]) {
  return values.filter((value) => value !== "").join(separator);
}

/** True when nothing is chosen, or the candidate is one of the chosen values. */
export function filterMatches(selected: string, candidate: string) {
  return selected === "" || filterValues(selected).includes(candidate);
}
