import { isOfficeRole } from "@/lib/access";
import type { DbActor } from "@/lib/db-policy";

/**
 * The register that came with the ERP holds every scholar's and supervisor's mobile number and
 * e-mail address. The office needs them all; a scholar or supervisor needs their own and those of
 * the person they work with. Everyone else's are left blank before the register leaves the server.
 * (Only the stored "seed" register is shown this way: it is never written back by a screen.)
 */

type Person = Record<string, unknown>;

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/** A name without titles and punctuation, so "Dr. A. Kumar" and "A Kumar" are the same guide. */
function guideKey(value: unknown) {
  return text(value)
    .replace(/\b(dr|prof|professor|mr|mrs|ms|rev|fr|sr)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function hide(person: Person) {
  return { ...person, phone: "", email: "" };
}

function isSeed(
  payload: unknown,
): payload is { scholars: Person[]; supervisors: Person[] } {
  return (
    Boolean(payload) &&
    typeof payload === "object" &&
    Array.isArray((payload as Person).scholars) &&
    Array.isArray((payload as Person).supervisors)
  );
}

export function projectRegisterSeed(payload: unknown, actor: DbActor) {
  if (!isSeed(payload)) return payload;
  if (!actor || isOfficeRole(actor.role)) return payload;
  const me = text(actor.identifier);
  const scholars = payload.scholars;
  const supervisors = payload.supervisors;

  const ownScholar = (person: Person) =>
    [
      person.email,
      person.applicationNumber,
      person.registrationNumber,
      person.fileNumber,
      person.id,
    ].some((value) => text(value) === me);
  const ownSupervisor = (person: Person) =>
    [person.email, person.supervisorId, person.name].some((value) => text(value) === me);

  // Whose details this person may see besides their own: the guide of a scholar, the scholars of a guide.
  const myGuides = new Set<string>();
  const myScholarsGuide = new Set<string>();
  if (actor.role === "scholar") {
    for (const scholar of scholars)
      if (ownScholar(scholar)) myGuides.add(guideKey(scholar.guideName));
  }
  if (actor.role === "supervisor") {
    for (const supervisor of supervisors) {
      if (ownSupervisor(supervisor)) myScholarsGuide.add(guideKey(supervisor.name));
    }
  }

  return {
    ...payload,
    scholars: scholars.map((scholar) => {
      if (actor.role === "scholar" && ownScholar(scholar)) return scholar;
      if (actor.role === "supervisor" && myScholarsGuide.has(guideKey(scholar.guideName)))
        return scholar;
      return hide(scholar);
    }),
    supervisors: supervisors.map((supervisor) => {
      if (actor.role === "supervisor" && ownSupervisor(supervisor)) return supervisor;
      if (actor.role === "scholar" && myGuides.has(guideKey(supervisor.name)))
        return supervisor;
      return hide(supervisor);
    }),
  };
}

/** Applies the register view to rows read from research_register (a list or a single row). */
export function projectRegisterRows(body: unknown, actor: DbActor): unknown {
  if (Array.isArray(body)) return body.map((row) => projectRegisterRows(row, actor));
  if (body && typeof body === "object" && "payload" in body) {
    const row = body as Person;
    return { ...row, payload: projectRegisterSeed(row.payload, actor) };
  }
  return body;
}
