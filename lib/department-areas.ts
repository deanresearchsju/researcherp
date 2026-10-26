/** A department as the supervisors' profiles name it, with its key research areas. */
export type DepartmentAreas = { department: string; areas: string[] };

function plain(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The key areas of a profile's "area of research" line: short topics, not sentences. */
export function keyAreasOf(researchArea: string) {
  const seen = new Set<string>();
  return researchArea
    .split(/[,;\n]/)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || part.length > 60 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** CSE for Computer Science and Engineering: the first letters of the main words. */
function initials(name: string) {
  return plain(name)
    .split(" ")
    .filter((word) => word && word !== "and" && word !== "of" && word !== "the")
    .map((word) => word[0])
    .join("");
}

export function sameDepartment(profileDepartment: string, departmentName: string) {
  const left = plain(profileDepartment);
  const right = plain(departmentName);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.replace(/ /g, "") === initials(departmentName)) return true;
  return left.replace(/ /g, "") === right.replace(/ /g, "");
}

/** The key areas of every supervisor in a department, once each. */
export function areasForDepartment(
  departmentName: string,
  entries: readonly DepartmentAreas[],
) {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const entry of entries) {
    if (!sameDepartment(entry.department, departmentName)) continue;
    for (const area of entry.areas) {
      const key = area.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(area);
    }
  }
  return found;
}
