import { sameDepartment } from "@/lib/department-areas";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { currentRegister, subscribeRegister } from "@/lib/register";
import {
  currentAreaLoad,
  currentResearchAreas,
  subscribeResearchAreas,
} from "@/lib/research-areas";
import { guideOptions } from "@/lib/supervision";
import { schoolOfDepartment } from "@/lib/schools";
import { vacancySchoolName, type Vacancy } from "@/lib/vacancies";

/** Waits until a store has loaded its data (the stores load on the first subscription). */
function ready<T>(
  current: () => T | null,
  subscribe: (onChange: () => void) => () => void,
) {
  const now = current();
  if (now) return Promise.resolve(now);
  return new Promise<T | null>((resolve) => {
    let off: () => void = () => {};
    const timer = window.setTimeout(() => {
      off();
      resolve(current());
    }, 8000);
    off = subscribe(() => {
      if (!current()) return;
      window.clearTimeout(timer);
      off();
      resolve(current());
    });
  });
}

function shortName(name: string) {
  return name.replace(/^school of\s+/i, "");
}

/**
 * What the application form needs: every school and department of the University, each with
 * the vacancy now open under it. The vacancy is read from the supervisors list: the seats left
 * of every active supervisor (approved number less the scholars they guide, nothing for one who
 * is leaving), added up by department. A department with no vacancy is still listed, so the
 * applicant is told there is none.
 */
export async function loadLiveVacancies(): Promise<Vacancy[]> {
  await ready(currentRegister, subscribeRegister);
  const office = await ready(currentOffice, subscribeOffice);
  const register = currentRegister();
  const options = guideOptions(
    office?.allocations ?? [],
    [],
    register?.quotas ?? [],
    register?.standings ?? [],
  ).filter((item) => item.status === "Active" && item.vacancy !== null);

  // The schools are those the administrator keeps under Research areas.
  await ready(currentAreaLoad, subscribeResearchAreas);
  const rows: Vacancy[] = [];
  let serial = 1;
  const catalogue = currentResearchAreas();
  for (const school of catalogue) {
    const own = shortName(school.name).trim();
    // The departments kept for the school, and any department a supervisor of the school is in
    // that is not kept there yet: every department shown under the supervisors list is listed.
    const kept = school.areas.length > 0 ? school.areas : [own];
    const fromSupervisors = [
      ...new Set(options.map((item) => item.subject.trim())),
    ].filter(
      (subject) =>
        subject &&
        !kept.some((name) => sameDepartment(subject, name)) &&
        schoolOfDepartment(subject, catalogue) === school.name,
    );
    const departments = [...kept, ...fromSupervisors];
    for (const department of departments) {
      const seats = options
        .filter(
          (item) =>
            sameDepartment(item.subject, department) ||
            (departments.length === 1 && sameDepartment(item.subject, own)),
        )
        .reduce((sum, item) => sum + (item.vacancy ?? 0), 0);
      rows.push({
        id: `live-${serial}`,
        serialNo: serial,
        supervisorName: "",
        designation: "",
        department,
        researchArea: "",
        vacancyCount: seats,
        school: vacancySchoolName({ school: school.name, department }),
      });
      serial += 1;
    }
  }
  return rows;
}
