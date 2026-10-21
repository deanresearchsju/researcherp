import { loginGateCopy } from "@/data/application-review";
import type { Json } from "@/types/database";

export type SupervisorStanding = {
  key: string;
  active: boolean;
  inactiveKind: "Inactive" | "Resigned" | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function parseSupervisorStandings(value: unknown): SupervisorStanding[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<SupervisorStanding>;
    const key = text(row.key);
    if (!key) return [];
    const kind = row.inactiveKind === "Resigned" ? "Resigned" : "Inactive";
    return [
      {
        key,
        active: row.active !== false,
        inactiveKind: row.active === false ? kind : null,
      },
    ];
  });
}

function standingFor(standings: readonly SupervisorStanding[], keys: readonly string[]) {
  return (
    standings.find((item) => keys.some((key) => key && sameText(item.key, key))) ?? null
  );
}

export function supervisorIsActive(
  keys: readonly string[],
  registerActive: boolean,
  standings: readonly SupervisorStanding[],
) {
  const standing = standingFor(standings, keys);
  if (standing) return standing.active;
  return registerActive;
}

export function standingKind(
  keys: readonly string[],
  standings: readonly SupervisorStanding[],
) {
  return standingFor(standings, keys)?.inactiveKind ?? "Inactive";
}

type LetterCase = {
  email: string;
  applicationNo: string;
  letterIssued: boolean;
  verification: string;
  selected: boolean;
};

export function parseLetterCases(payload: Json | null | undefined): LetterCase[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const cases = "cases" in payload ? payload.cases : null;
  if (!Array.isArray(cases)) return [];
  return cases.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const email = text(row.email);
    const applicationNo = text(row.applicationNo);
    if (!email && !applicationNo) return [];
    return [
      {
        email,
        applicationNo,
        letterIssued: row.letterIssued === true || row.verification === "Approved",
        verification: text(row.verification),
        selected: row.selected === true,
      },
    ];
  });
}

export function scholarMayUsePortal(
  identifier: string,
  onRegister: boolean,
  cases: readonly LetterCase[],
) {
  if (onRegister) return true;
  const id = identifier.trim().toLowerCase();
  if (!id) return false;
  const row = cases.find(
    (item) =>
      (item.email && item.email.toLowerCase() === id) ||
      (item.applicationNo && item.applicationNo.toLowerCase() === id),
  );
  if (!row) return false;
  // Sign-in opens only after the documents are submitted and verified.
  return row.verification === "Approved";
}

export function supervisorMayUsePortal(
  identifier: string,
  register: { email: string; supervisorId: string; name: string; active: boolean } | null,
  standings: readonly SupervisorStanding[],
  approvedEmails: readonly string[],
): { ok: true } | { ok: false; message: string } {
  const keys = register
    ? [register.email, register.supervisorId, register.name, identifier]
    : [identifier];
  const active = supervisorIsActive(keys, register?.active ?? false, standings);
  if (register && !active) {
    return { ok: false, message: loginGateCopy.supervisorInactive };
  }
  if (register && active) return { ok: true };
  // Supervisors approved after the register was built: a past (resigned) standing closes sign-in.
  const later = standingFor(standings, [identifier]);
  if (later && !later.active) {
    return { ok: false, message: loginGateCopy.supervisorInactive };
  }
  const id = identifier.trim().toLowerCase();
  if (approvedEmails.some((email) => email.trim().toLowerCase() === id)) {
    return { ok: true };
  }
  return { ok: false, message: loginGateCopy.supervisor };
}

export function scholarLoginMessage() {
  return loginGateCopy.scholar;
}
