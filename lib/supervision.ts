import { researchRegister } from "@/data/research-register";
import { sameId, type Allocation } from "@/lib/office";
import { batchOf, exitFor, guideFigures, isPassedOut, registrationOf, sameGuide, scholarSignInId, supervisorForGuide, supervisorKeys, supervisorListingActive, type ApprovedQuota, type RegistrationAllotment, type SupervisorStanding, registrationCompare } from "@/lib/register";
import type { PortalUser } from "@/lib/users";

export type GuideStatus = "Active" | "Leaving" | "Past";

export type GuideOption = {
  id: string;
  identifier: string;
  name: string;
  subject: string;
  designation: string;
  keys: string[];
  /** Seats left; null when no approved number is on record. */
  vacancy: number | null;
  status: GuideStatus;
};

export type ScholarRow = {
  identifier: string;
  name: string;
  subject: string;
  batchName: string;
  registration: string;
  currentName: string;
  currentIdentifier: string;
};

function statusOf(
  keys: readonly string[],
  name: string,
  activeInRegister: boolean,
): GuideStatus {
  const exit = exitFor(keys, name);
  if (exit?.completedOn) return "Past";
  if (exit) return "Leaving";
  return activeInRegister ? "Active" : "Past";
}

/** Scholars currently with a supervisor approved after the register was built. */
function newcomerLoad(name: string, allocations: readonly Allocation[]) {
  return allocations.filter(
    (item) =>
      sameGuide(item.supervisorName, name) &&
      !isPassedOut(item.scholarIdentifier, item.scholarName),
  ).length;
}

/**
 * Every supervisor the office can allot to or transfer from: the register, supervisors approved
 * later (from their approved number of scholars), and any other supervisor sign-in.
 */
export function guideOptions(
  allocations: readonly Allocation[],
  users: readonly PortalUser[],
  quotas: readonly ApprovedQuota[],
  standings: readonly SupervisorStanding[],
): GuideOption[] {
  const idCounts = new Map<string, number>();
  for (const supervisor of researchRegister.supervisors) {
    const identifier = supervisor.supervisorId.trim();
    if (identifier) idCounts.set(identifier, (idCounts.get(identifier) ?? 0) + 1);
  }
  const fromRegister: GuideOption[] = researchRegister.supervisors.map((supervisor) => {
    const identifier = supervisor.supervisorId.trim();
    const unique = identifier.length > 0 && idCounts.get(identifier) === 1;
    const keys = supervisorKeys(supervisor);
    return {
      id: `${supervisor.serialNo}-${supervisor.name}`,
      identifier: unique ? identifier : supervisor.name,
      name: supervisor.name,
      subject: supervisor.department,
      designation: supervisor.designation,
      keys,
      vacancy: guideFigures(supervisor, quotas, allocations).vacancy,
      status: statusOf(
        keys,
        supervisor.name,
        supervisorListingActive(supervisor, standings),
      ),
    };
  });
  const known = (name: string, identifier = "") =>
    fromRegister.some(
      (item) =>
        sameGuide(item.name, name) ||
        (identifier && item.identifier.toLowerCase() === identifier.toLowerCase()),
    );
  const fromApproved: GuideOption[] = quotas
    .filter((quota) => !known(quota.name))
    .map((quota) => {
      const user = users.find(
        (item) => item.role === "supervisor" && sameGuide(item.name, quota.name),
      );
      const identifier = user?.identifier ?? quota.name;
      const keys = [identifier, quota.name];
      return {
        id: `approved-${quota.name}`,
        identifier,
        name: quota.name,
        subject: quota.department,
        designation: quota.designation,
        keys,
        vacancy: Math.max(0, quota.quota - newcomerLoad(quota.name, allocations)),
        status: statusOf(keys, quota.name, true),
      };
    });
  const listed = [...fromRegister, ...fromApproved];
  const others: GuideOption[] = users
    .filter(
      (user) =>
        user.role === "supervisor" &&
        !listed.some(
          (item) =>
            item.identifier.toLowerCase() === user.identifier.toLowerCase() ||
            sameGuide(item.name, user.name),
        ),
    )
    .map((user) => ({
      id: user.id,
      identifier: user.identifier,
      name: user.name,
      subject: "",
      designation: "",
      keys: [user.identifier, user.name],
      vacancy: null,
      status: statusOf([user.identifier], user.name, true),
    }));
  return [...listed, ...others];
}

/** Active scholars and the supervisor each is with now. Passed-out scholars are left out. */
export function scholarRows(
  allocations: readonly Allocation[],
  allotments: readonly RegistrationAllotment[],
): ScholarRow[] {
  const registerRows = researchRegister.scholars.map((scholar) => {
    const identifier = scholarSignInId(scholar);
    const allocation =
      allocations.find((item) => sameId(item.scholarIdentifier, identifier)) ??
      allocations.find(
        (item) =>
          item.scholarName.trim().toLowerCase() === scholar.name.trim().toLowerCase(),
      );
    const guide = supervisorForGuide(scholar.guideName);
    return {
      identifier,
      name: scholar.name,
      subject: scholar.department,
      batchName: batchOf(scholar.batchId)?.name ?? "",
      registration:
        registrationOf(scholar, allotments) || scholar.applicationNumber || identifier,
      currentName:
        allocation?.supervisorName.trim() ||
        guide?.name.trim() ||
        scholar.guideName.trim(),
      currentIdentifier:
        allocation?.supervisorIdentifier.trim() ||
        guide?.supervisorId.trim() ||
        scholar.guideName.trim(),
    };
  });
  const extra = allocations
    .filter(
      (item) =>
        !registerRows.some((row) => sameId(row.identifier, item.scholarIdentifier)),
    )
    .map((item) => ({
      identifier: item.scholarIdentifier,
      name: item.scholarName,
      subject: "",
      batchName: "",
      registration: item.scholarIdentifier,
      currentName: item.supervisorName,
      currentIdentifier: item.supervisorIdentifier,
    }));
  return [...registerRows, ...extra]
    .filter((row) => !isPassedOut(row.identifier, row.name))
    .sort(
      (left, right) =>
        registrationCompare(
          left.registration.includes("@") ? "" : left.registration,
          right.registration.includes("@") ? "" : right.registration,
        ) || left.name.localeCompare(right.name),
    );
}

export function scholarsWith(rows: readonly ScholarRow[], guide: GuideOption) {
  return rows.filter(
    (row) =>
      guide.keys.some((key) => key.trim() && sameId(row.currentIdentifier, key)) ||
      sameGuide(row.currentName, guide.name),
  );
}

function subjectWords(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && word !== "and" && word !== "of");
}

/** Same subject when every word of the shorter name is a word of the longer one. */
function sameSubject(left: string, right: string) {
  const a = subjectWords(left);
  const b = subjectWords(right);
  if (a.length === 0 || b.length === 0) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((word) => long.includes(word));
}

/** Active supervisors with a free seat, same-subject ones first. */
export function transferTargets(
  guides: readonly GuideOption[],
  leaving: GuideOption,
  subject: string,
) {
  const wanted = subject || leaving.subject;
  return guides
    .filter(
      (guide) =>
        guide.status === "Active" &&
        guide.id !== leaving.id &&
        (guide.vacancy === null || guide.vacancy > 0),
    )
    .map((guide) => ({ guide, match: sameSubject(guide.subject, wanted) }))
    .sort(
      (left, right) =>
        Number(right.match) - Number(left.match) ||
        (right.guide.vacancy ?? 0) - (left.guide.vacancy ?? 0) ||
        left.guide.name.localeCompare(right.guide.name),
    );
}
