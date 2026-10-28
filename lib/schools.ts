import { schools as seed } from "@/data/schools";
import type { School } from "@/types";

const key = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The school a department belongs to (from the list of schools and their departments kept under
 * Research areas), or "" when the department is not in any school. Used for the Name of the
 * school on the supervisor pages and to place a supervisor's department on the application form.
 */
export function schoolOfDepartment(
  department: string,
  catalogue: readonly School[] = seed,
) {
  const wanted = key(department);
  if (!wanted) return "";
  const school = catalogue.find(
    (item) =>
      key(item.name) === wanted || item.areas.some((area) => key(area) === wanted),
  );
  return school?.name ?? "";
}
