/**
 * Confidential thesis evaluation panel: shared shapes and pure rules.
 * Safe to import on the server and in the browser; holds no data itself.
 */

export const evaluatorGroups = ["indian", "foreign", "local"] as const;
export type EvaluatorGroup = (typeof evaluatorGroups)[number];

export const evaluatorGroupLabel: Record<EvaluatorGroup, string> = {
  indian: "Indian (outside Tamil Nadu)",
  foreign: "Foreign",
  local: "Local (within Tamil Nadu)",
};

/** Names the supervisor gives in each group. */
export const evaluatorsPerGroup = 3;

export type Evaluator = {
  name: string;
  designation: string;
  institution: string;
  address: string;
  email: string;
  phone: string;
  /** Area of research. */
  specialization: string;
  /** The latest publications (five), named in words: no document is uploaded. */
  publications: string[];
};

export const publicationsRequired = 5;

export const inviteStatuses = [
  "Not contacted",
  "Invited",
  "Accepted",
  "Declined",
] as const;
export type InviteStatus = (typeof inviteStatuses)[number];

export type InviteEntry = {
  status: InviteStatus;
  invitedOn: string;
  respondedOn: string;
  note: string;
};

/** The Dean's order for one group (indexes into the nominees) and the invitation log per nominee. */
export type GroupPanel = {
  order: number[];
  invites: InviteEntry[];
};

export type EvaluationRecord = {
  scholarKey: string;
  scholarIdentifier: string;
  scholarName: string;
  supervisorIdentifier: string;
  supervisorName: string;
  title: string;
  domain: string;
  nominees: Record<EvaluatorGroup, Evaluator[]>;
  nominatedOn: string;
  /** The moment of each step, with the time, for the stamps on the printed sheet. */
  nominatedAt: string;
  /** The Dean checked the nominees (area of specialisation) and forwarded them to the Vice Chancellor. */
  approvedBy: string;
  approvedOn: string;
  approvedAt: string;
  /** The Vice Chancellor's first, second and third choice in each group. */
  selection: Record<EvaluatorGroup, GroupPanel> | null;
  selectedBy: string;
  selectedOn: string;
  selectedAt: string;
  updatedAt: string;
};

/** What a supervisor may see: own nominations only, never the Dean's choice or invitations. */
export type SupervisorEvaluationView = Omit<
  EvaluationRecord,
  | "selection"
  | "selectedBy"
  | "selectedOn"
  | "selectedAt"
  | "approvedBy"
  | "approvedOn"
  | "approvedAt"
> & { locked: boolean };

export function scholarKeyOf(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function blankEvaluator(): Evaluator {
  return {
    name: "",
    designation: "",
    institution: "",
    address: "",
    email: "",
    phone: "",
    specialization: "",
    publications: Array.from({ length: publicationsRequired }, () => ""),
  };
}

/** Exactly five entries, whatever was saved (older records had none). */
export function publicationList(value: unknown) {
  const list = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : [];
  return Array.from({ length: publicationsRequired }, (_, index) => list[index] ?? "");
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseEvaluator(value: unknown): Evaluator {
  const row =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    name: text(row.name),
    designation: text(row.designation),
    institution: text(row.institution),
    address: text(row.address),
    email: text(row.email),
    phone: text(row.phone),
    specialization: text(row.specialization),
    publications: publicationList(row.publications),
  };
}

function parseInvite(value: unknown): InviteEntry {
  const row =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const status = text(row.status);
  return {
    status: (inviteStatuses as readonly string[]).includes(status)
      ? (status as InviteStatus)
      : "Not contacted",
    invitedOn: text(row.invitedOn),
    respondedOn: text(row.respondedOn),
    note: text(row.note),
  };
}

export function parseEvaluationPayload(
  row: {
    scholar_key: string;
    scholar_identifier: string;
    scholar_name: string;
    supervisor_identifier: string;
    supervisor_name: string;
    updated_at: string;
  },
  payload: unknown,
): EvaluationRecord {
  const data =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nomineesRaw =
    data.nominees && typeof data.nominees === "object"
      ? (data.nominees as Record<string, unknown>)
      : {};
  const nominees = Object.fromEntries(
    evaluatorGroups.map((group) => [
      group,
      Array.isArray(nomineesRaw[group])
        ? (nomineesRaw[group] as unknown[]).map(parseEvaluator)
        : [],
    ]),
  ) as Record<EvaluatorGroup, Evaluator[]>;
  const selectionRaw =
    data.selection && typeof data.selection === "object"
      ? (data.selection as Record<string, unknown>)
      : null;
  const selection = selectionRaw
    ? (Object.fromEntries(
        evaluatorGroups.map((group) => {
          const panel =
            selectionRaw[group] && typeof selectionRaw[group] === "object"
              ? (selectionRaw[group] as Record<string, unknown>)
              : {};
          return [
            group,
            {
              order: Array.isArray(panel.order)
                ? (panel.order as unknown[]).filter(
                    (item): item is number => typeof item === "number",
                  )
                : [],
              invites: Array.isArray(panel.invites)
                ? (panel.invites as unknown[]).map(parseInvite)
                : [],
            },
          ];
        }),
      ) as Record<EvaluatorGroup, GroupPanel>)
    : null;
  return {
    scholarKey: row.scholar_key,
    scholarIdentifier: row.scholar_identifier,
    scholarName: row.scholar_name,
    supervisorIdentifier: row.supervisor_identifier,
    supervisorName: row.supervisor_name,
    title: text(data.title),
    domain: text(data.domain),
    nominees,
    nominatedOn: text(data.nominatedOn),
    nominatedAt: text(data.nominatedAt),
    approvedBy: text(data.approvedBy),
    approvedOn: text(data.approvedOn),
    approvedAt: text(data.approvedAt),
    selection,
    selectedBy: text(data.selectedBy),
    selectedOn: text(data.selectedOn),
    selectedAt: text(data.selectedAt),
    updatedAt: row.updated_at,
  };
}

export function evaluationPayload(record: EvaluationRecord) {
  return {
    title: record.title,
    domain: record.domain,
    nominees: record.nominees,
    nominatedOn: record.nominatedOn,
    nominatedAt: record.nominatedAt,
    approvedBy: record.approvedBy,
    approvedOn: record.approvedOn,
    approvedAt: record.approvedAt,
    selection: record.selection,
    selectedBy: record.selectedBy,
    selectedOn: record.selectedOn,
    selectedAt: record.selectedAt,
  };
}

export function supervisorView(record: EvaluationRecord): SupervisorEvaluationView {
  return {
    scholarKey: record.scholarKey,
    scholarIdentifier: record.scholarIdentifier,
    scholarName: record.scholarName,
    supervisorIdentifier: record.supervisorIdentifier,
    supervisorName: record.supervisorName,
    title: record.title,
    domain: record.domain,
    nominees: record.nominees,
    nominatedOn: record.nominatedOn,
    nominatedAt: record.nominatedAt,
    updatedAt: record.updatedAt,
    locked: record.selection !== null || Boolean(record.approvedOn),
  };
}

/** Index of the evaluator to approach now in this group, or null when everyone declined. */
export function activeIndex(panel: GroupPanel): number | null {
  const accepted = panel.order.find(
    (index) => panel.invites[index]?.status === "Accepted",
  );
  if (accepted !== undefined) return accepted;
  const next = panel.order.find((index) => panel.invites[index]?.status !== "Declined");
  return next ?? null;
}

export type GroupState = "To invite" | "Awaiting reply" | "Accepted" | "All declined";

export function groupState(panel: GroupPanel): GroupState {
  const index = activeIndex(panel);
  if (index === null) return "All declined";
  const status = panel.invites[index]?.status ?? "Not contacted";
  if (status === "Accepted") return "Accepted";
  if (status === "Invited") return "Awaiting reply";
  return "To invite";
}

/** True when one evaluator in every group has accepted. */
export function panelComplete(record: Pick<EvaluationRecord, "selection">) {
  return (
    record.selection !== null &&
    evaluatorGroups.every((group) => groupState(record.selection![group]) === "Accepted")
  );
}

export function nominationProblem(
  nominees: Record<EvaluatorGroup, Evaluator[]>,
  title: string,
  domain: string,
) {
  if (title.trim().length < 2) return "Enter the thesis title.";
  if (domain.trim().length < 2) return "Enter the domain.";
  for (const group of evaluatorGroups) {
    const list = nominees[group] ?? [];
    if (list.length !== evaluatorsPerGroup) {
      return `Name ${evaluatorsPerGroup} ${evaluatorGroupLabel[group].toLowerCase()} evaluators.`;
    }
    for (const person of list) {
      if (person.name.trim().length < 2 || person.institution.trim().length < 2) {
        return `Enter the name and institution of every ${evaluatorGroupLabel[group].toLowerCase()} evaluator.`;
      }
      if (!/^\S+@\S+\.\S+$/.test(person.email.trim())) {
        return `Enter a valid email for ${person.name || "each evaluator"}.`;
      }
      const who = person.name.trim() || "each evaluator";
      if (person.designation.trim().length < 2) return `Enter the designation of ${who}.`;
      if (person.address.trim().length < 5) return `Enter the address of ${who}.`;
      if (person.phone.replace(/\D/g, "").length < 8)
        return `Enter the contact number of ${who}.`;
      if (person.specialization.trim().length < 2)
        return `Enter the area of research of ${who}.`;
      if (publicationList(person.publications).some((item) => item.trim().length < 5)) {
        return `Name the latest ${publicationsRequired} publications of ${who}.`;
      }
    }
  }
  const names = evaluatorGroups.flatMap((group) =>
    nominees[group].map((person) => person.name.trim().toLowerCase()),
  );
  if (new Set(names).size !== names.length) return "Each evaluator can be named once.";
  return null;
}
