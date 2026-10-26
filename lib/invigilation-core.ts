/* ------------------------------------------------------------------------------------------
 * Invigilation duty: the rules, with no browser or database code so they can be tested.
 *
 * - A room gets one invigilator; a room whose strength reaches the threshold gets two.
 * - A few invigilators of every sitting are kept on "reserved duty" for absentees and extras.
 * - Nobody is on two rooms in the same sitting; duties are spread evenly over the pool; a
 *   person's unavailable dates are respected.
 * - A final plan can not be changed (the office reopens it first).
 * ---------------------------------------------------------------------------------------- */

export type InvigilationScope = "entrance" | "course-work";

export const scopeLabel: Record<InvigilationScope, string> = {
  entrance: "Selection entrance test",
  "course-work": "Course work examination",
};

export type Invigilator = {
  id: string;
  name: string;
  designation: string;
  department: string;
  phone: string;
  /** ISO dates the person can not be given duty. */
  unavailable: string[];
};

/** One room of one sitting (a date and a time at a venue) and the candidates seated in it. */
export type Sitting = {
  date: string;
  time: string;
  venue: string;
  room: string;
  strength: number;
};

export type Duty = Sitting & {
  /** 1 or 2 invigilators, by the room's strength. */
  slots: number;
  /** Invigilator ids; an empty string is a slot not filled yet. */
  assigned: string[];
};

export type ReservedDuty = {
  date: string;
  time: string;
  invigilatorId: string;
};

export type PlanStatus = "Draft" | "Final";

export type InvigilationPlan = {
  scope: InvigilationScope;
  /** A room with at least this many candidates gets two invigilators. */
  twoFrom: number;
  /** Invigilators kept on reserved duty in each sitting. */
  reservedPerSitting: number;
  /** "Semester Examination, April 2026" style heading of the letter. */
  examination: string;
  chiefSuperintendent: string;
  duties: Duty[];
  reserved: ReservedDuty[];
  status: PlanStatus;
  finalisedOn: string;
  finalisedBy: string;
};

export const defaultTwoFrom = 40;
export const defaultReserved = 2;

export function emptyPlan(scope: InvigilationScope): InvigilationPlan {
  return {
    scope,
    twoFrom: defaultTwoFrom,
    reservedPerSitting: defaultReserved,
    examination: "",
    chiefSuperintendent: "",
    duties: [],
    reserved: [],
    status: "Draft",
    finalisedOn: "",
    finalisedBy: "",
  };
}

export const sittingKey = (item: { date: string; time: string }) =>
  `${item.date}|${item.time}`;

export function slotsFor(strength: number, twoFrom: number) {
  return strength >= Math.max(1, twoFrom) ? 2 : 1;
}

/* ----------------------------------------- allocation ----------------------------------- */

export type AllocationResult = {
  duties: Duty[];
  reserved: ReservedDuty[];
  /** Plain-language problems, such as too few invigilators for a sitting. */
  shortages: string[];
};

function compareSittings(left: Sitting, right: Sitting) {
  return (
    left.date.localeCompare(right.date) ||
    left.time.localeCompare(right.time) ||
    left.venue.localeCompare(right.venue) ||
    left.room.localeCompare(right.room, undefined, { numeric: true })
  );
}

/**
 * Fills every room of every sitting, then the reserved duty, taking each time the available
 * invigilators who have the fewest duties so far (a tie goes to the earlier one in the list).
 */
export function allocate(
  sittings: readonly Sitting[],
  pool: readonly Invigilator[],
  options: { twoFrom: number; reservedPerSitting: number },
): AllocationResult {
  const duties: Duty[] = sittings
    .filter((item) => item.strength > 0)
    .map((item) => ({
      ...item,
      slots: slotsFor(item.strength, options.twoFrom),
      assigned: [],
    }))
    .sort(compareSittings);
  const reserved: ReservedDuty[] = [];
  const shortages: string[] = [];
  const load = new Map(pool.map((person) => [person.id, 0]));

  const sessions = new Map<string, Duty[]>();
  for (const duty of duties) {
    const key = sittingKey(duty);
    sessions.set(key, [...(sessions.get(key) ?? []), duty]);
  }

  for (const [key, rooms] of sessions) {
    const [date, time] = key.split("|");
    const free = pool
      .filter((person) => !person.unavailable.includes(date))
      .map((person, order) => ({ person, order }));
    const taken = new Set<string>();
    const pick = () => {
      const next = free
        .filter((item) => !taken.has(item.person.id))
        .sort(
          (left, right) =>
            (load.get(left.person.id) ?? 0) - (load.get(right.person.id) ?? 0) ||
            left.order - right.order,
        )[0];
      if (!next) return "";
      taken.add(next.person.id);
      load.set(next.person.id, (load.get(next.person.id) ?? 0) + 1);
      return next.person.id;
    };
    let missing = 0;
    for (const duty of rooms) {
      for (let slot = 0; slot < duty.slots; slot += 1) {
        const id = pick();
        if (!id) missing += 1;
        duty.assigned.push(id);
      }
    }
    for (let count = 0; count < options.reservedPerSitting; count += 1) {
      const id = pick();
      if (!id) {
        missing += 1;
        continue;
      }
      reserved.push({ date, time, invigilatorId: id });
    }
    if (missing > 0) {
      shortages.push(
        `${date} ${time}: ${missing} more invigilator(s) are needed than are available.`,
      );
    }
  }

  return { duties, reserved, shortages };
}

/* ------------------------------------------- checks ------------------------------------- */

/** Everything a person is on in one sitting, room duty and reserved. */
function bookings(plan: Pick<InvigilationPlan, "duties" | "reserved">) {
  const seen = new Map<string, string[]>();
  const add = (id: string, key: string, where: string) => {
    if (!id) return;
    const mark = `${id}|${key}`;
    seen.set(mark, [...(seen.get(mark) ?? []), where]);
  };
  for (const duty of plan.duties) {
    duty.assigned.forEach((id) => add(id, sittingKey(duty), duty.room));
  }
  for (const item of plan.reserved) add(item.invigilatorId, sittingKey(item), "Reserved");
  return seen;
}

export function planProblems(
  plan: Pick<InvigilationPlan, "duties" | "reserved">,
  pool: readonly Invigilator[],
) {
  const problems: string[] = [];
  const names = new Map(pool.map((person) => [person.id, person.name]));
  for (const [mark, where] of bookings(plan)) {
    if (where.length > 1) {
      const [id, date, time] = mark.split("|");
      problems.push(
        `${names.get(id) ?? id} is on more than one duty on ${date} ${time}: ${where.join(", ")}.`,
      );
    }
  }
  const unfilled = plan.duties.reduce(
    (sum, duty) => sum + duty.assigned.filter((id) => !id).length,
    0,
  );
  if (unfilled > 0) problems.push(`${unfilled} invigilator place(s) are still empty.`);
  const missing = new Set(
    [
      ...plan.duties.flatMap((duty) => duty.assigned),
      ...plan.reserved.map((item) => item.invigilatorId),
    ].filter((id) => id && !names.has(id)),
  );
  if (missing.size > 0)
    problems.push(`${missing.size} invigilator(s) are no longer in the list.`);
  return problems;
}

/** Puts a person on a place of a room, or empties it; refuses a double booking. */
export function assignSlot(
  plan: InvigilationPlan,
  pool: readonly Invigilator[],
  dutyIndex: number,
  slot: number,
  invigilatorId: string,
): { plan: InvigilationPlan } | { error: string } {
  if (plan.status === "Final")
    return { error: "The plan is final. Reopen it to change a duty." };
  const duty = plan.duties[dutyIndex];
  if (!duty || slot < 0 || slot >= duty.slots)
    return { error: "That place does not exist." };
  if (invigilatorId) {
    const person = pool.find((item) => item.id === invigilatorId);
    if (!person) return { error: "Choose an invigilator from the list." };
    if (person.unavailable.includes(duty.date)) {
      return { error: `${person.name} is not available on ${duty.date}.` };
    }
    const key = sittingKey(duty);
    const busy =
      plan.duties.some(
        (item, index) =>
          sittingKey(item) === key &&
          item.assigned.some(
            (id, place) =>
              id === invigilatorId && !(index === dutyIndex && place === slot),
          ),
      ) ||
      plan.reserved.some(
        (item) => sittingKey(item) === key && item.invigilatorId === invigilatorId,
      );
    if (busy) return { error: `${person.name} is already on duty in that sitting.` };
  }
  const duties = plan.duties.map((item, index) =>
    index === dutyIndex
      ? {
          ...item,
          assigned: item.assigned.map((id, place) =>
            place === slot ? invigilatorId : id,
          ),
        }
      : item,
  );
  return { plan: { ...plan, duties } };
}

export function finalise(
  plan: InvigilationPlan,
  pool: readonly Invigilator[],
  by: string,
  on: string,
): { plan: InvigilationPlan } | { error: string } {
  if (plan.duties.length === 0) return { error: "There are no rooms in the plan." };
  const problems = planProblems(plan, pool);
  if (problems.length > 0) return { error: problems[0] };
  return { plan: { ...plan, status: "Final", finalisedBy: by, finalisedOn: on } };
}

/* -------------------------------------------- lists ------------------------------------- */

export type DutyRow = {
  serial: number;
  date: string;
  time: string;
  venue: string;
  room: string;
  strength: number | null;
  kind: "Room duty" | "Reserved";
  invigilatorId: string;
  name: string;
  designation: string;
  department: string;
  phone: string;
};

/**
 * The date-wise list in one running order: by date, then sitting, then room, the second
 * invigilator of a room right after the first, and the reserved invigilators last in each
 * sitting. The serial number runs on from the first day to the last.
 */
export function dutyList(
  plan: Pick<InvigilationPlan, "duties" | "reserved">,
  pool: readonly Invigilator[],
): DutyRow[] {
  const people = new Map(pool.map((person) => [person.id, person]));
  const draft: Omit<DutyRow, "serial">[] = [];
  const row = (
    base: Pick<DutyRow, "date" | "time" | "venue" | "room" | "strength" | "kind">,
    id: string,
  ) => {
    const person = people.get(id);
    draft.push({
      ...base,
      invigilatorId: id,
      name: person?.name ?? (id ? id : "Not allotted"),
      designation: person?.designation ?? "",
      department: person?.department ?? "",
      phone: person?.phone ?? "",
    });
  };
  const sessions = new Set<string>();
  [...plan.duties, ...plan.reserved].forEach((item) => sessions.add(sittingKey(item)));
  for (const key of [...sessions].sort()) {
    const [date, time] = key.split("|");
    [...plan.duties]
      .filter((duty) => duty.date === date && duty.time === time)
      .sort(compareSittings)
      .forEach((duty) =>
        duty.assigned.forEach((id) =>
          row(
            {
              date,
              time,
              venue: duty.venue,
              room: duty.room,
              strength: duty.strength,
              kind: "Room duty",
            },
            id,
          ),
        ),
      );
    plan.reserved
      .filter((item) => item.date === date && item.time === time)
      .forEach((item) =>
        row(
          { date, time, venue: "", room: "Reserved", strength: null, kind: "Reserved" },
          item.invigilatorId,
        ),
      );
  }
  return draft.map((item, index) => ({ ...item, serial: index + 1 }));
}

export type LetterLine = {
  date: string;
  time: string;
  hall: string;
  reserved: boolean;
};

export type InvigilatorLetter = {
  invigilator: Invigilator;
  lines: LetterLine[];
};

/** One letter for each person who has at least one duty, with the duties in date order. */
export function lettersFor(
  plan: Pick<InvigilationPlan, "duties" | "reserved">,
  pool: readonly Invigilator[],
): InvigilatorLetter[] {
  const rows = dutyList(plan, pool);
  return pool
    .map((invigilator) => ({
      invigilator,
      lines: rows
        .filter((item) => item.invigilatorId === invigilator.id)
        .map((item) => ({
          date: item.date,
          time: item.time,
          hall:
            item.kind === "Reserved"
              ? "RESERVED"
              : [item.venue, item.room].filter(Boolean).join(" - "),
          reserved: item.kind === "Reserved",
        })),
    }))
    .filter((item) => item.lines.length > 0);
}

/** How many duties (room and reserved) each person has, for the fairness summary. */
export function dutyCounts(plan: Pick<InvigilationPlan, "duties" | "reserved">) {
  const counts = new Map<string, { room: number; reserved: number }>();
  const bump = (id: string, field: "room" | "reserved") => {
    if (!id) return;
    const entry = counts.get(id) ?? { room: 0, reserved: 0 };
    entry[field] += 1;
    counts.set(id, entry);
  };
  plan.duties.forEach((duty) => duty.assigned.forEach((id) => bump(id, "room")));
  plan.reserved.forEach((item) => bump(item.invigilatorId, "reserved"));
  return counts;
}

/* ---------------------------------------- sittings from the exams ----------------------- */

type TicketLike = { batchId: string; semester: number; centreId: string; roomId: string };
type TimetableLike = { batchId: string; semester: number; date: string; time: string };
type CentreLike = { id: string; name: string; rooms: { id: string; name: string }[] };

/** Rooms of the course-work examination with the scholars seated in them, for each sitting. */
export function courseWorkSittings(
  timetable: readonly TimetableLike[],
  tickets: readonly TicketLike[],
  centres: readonly CentreLike[],
): Sitting[] {
  const result = new Map<string, Sitting>();
  const groups = new Map<string, Set<string>>();
  for (const entry of timetable) {
    if (!entry.date) continue;
    const key = `${entry.date}|${entry.time}`;
    const batches = groups.get(key) ?? new Set<string>();
    batches.add(`${entry.batchId}|${entry.semester}`);
    groups.set(key, batches);
  }
  for (const [key, batches] of groups) {
    const [date, time] = key.split("|");
    for (const ticket of tickets) {
      if (!ticket.roomId || !batches.has(`${ticket.batchId}|${ticket.semester}`))
        continue;
      const centre = centres.find((item) => item.id === ticket.centreId);
      const room = centre?.rooms.find((item) => item.id === ticket.roomId);
      if (!centre || !room) continue;
      const mark = `${key}|${centre.id}|${room.id}`;
      const current = result.get(mark);
      if (current) current.strength += 1;
      else
        result.set(mark, {
          date,
          time,
          venue: centre.name,
          room: room.name,
          strength: 1,
        });
    }
  }
  return [...result.values()];
}

type CaseLike = {
  shortlisted: boolean;
  hallTicketNo: string;
  examCampusId: string;
  examRoom: string;
  attendance?: string;
};
type ScheduleLike = {
  date: string;
  examTime: string;
  campuses: { id: string; name: string }[];
};

/** Rooms of the entrance test with the candidates seated in them (absentees excluded). */
export function entranceSittings(
  schedule: ScheduleLike,
  cases: readonly CaseLike[],
): Sitting[] {
  if (!schedule.date) return [];
  const result = new Map<string, Sitting>();
  for (const row of cases) {
    if (!row.shortlisted || !row.hallTicketNo || !row.examRoom) continue;
    if (row.attendance === "Absent") continue;
    const campus = schedule.campuses.find((item) => item.id === row.examCampusId);
    if (!campus) continue;
    const mark = `${campus.id}|${row.examRoom}`;
    const current = result.get(mark);
    if (current) current.strength += 1;
    else {
      result.set(mark, {
        date: schedule.date,
        time: schedule.examTime,
        venue: campus.name,
        room: row.examRoom,
        strength: 1,
      });
    }
  }
  return [...result.values()];
}

/** "07-04-2026" style date and a plain time label for letters and lists. */
export function shortDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : iso;
}
