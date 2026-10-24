import type { AdmissionCase, ExamCampus } from "@/lib/admission";

/**
 * Seating arrangement for the entrance test, by the usual procedure:
 * - candidates of a venue are taken in hall ticket order and fill the rooms in the order the
 *   rooms are listed, each room to its stated number of seats;
 * - inside a room, candidates of the same subject are not seated side by side, so seats are
 *   numbered by alternating between subjects (switch this off to keep hall ticket order);
 * - a venue without enough seats is reported, and nobody is left unseated silently.
 */

export type SeatAssignment = {
  applicationId: string;
  campusId: string;
  room: string;
  seat: number;
};

export type RoomPlan = {
  campusId: string;
  campusName: string;
  room: string;
  capacity: number;
  seated: number;
  firstTicket: string;
  lastTicket: string;
};

export type SeatingPlan = {
  assignments: SeatAssignment[];
  rooms: RoomPlan[];
  /** Candidates with no seat: the venue has no rooms or too few seats. */
  unseated: { campusName: string; count: number; reason: string }[];
};

function byTicket(left: AdmissionCase, right: AdmissionCase) {
  return (
    (left.hallTicketNo || "~").localeCompare(right.hallTicketNo || "~") ||
    left.name.localeCompare(right.name)
  );
}

/** Orders one room's candidates so that neighbours are of different subjects where possible. */
export function mixSubjects(rows: readonly AdmissionCase[]) {
  const groups = new Map<string, AdmissionCase[]>();
  for (const row of rows) {
    const key = row.department.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const queues = [...groups.values()];
  const result: AdmissionCase[] = [];
  let previous = "";
  while (result.length < rows.length) {
    const open = queues
      .map((queue, index) => ({ queue, index }))
      .filter((item) => item.queue.length > 0);
    // Take from the subject with the most candidates left, other than the previous seat's.
    const choice =
      open
        .filter((item) => item.queue[0].department.trim().toLowerCase() !== previous)
        .sort((a, b) => b.queue.length - a.queue.length || a.index - b.index)[0] ??
      open.sort((a, b) => b.queue.length - a.queue.length)[0];
    const row = choice.queue.shift();
    if (!row) break;
    result.push(row);
    previous = row.department.trim().toLowerCase();
  }
  return result;
}

export function arrangeSeating(
  cases: readonly AdmissionCase[],
  campuses: readonly ExamCampus[],
  options: { mix: boolean },
): SeatingPlan {
  const assignments: SeatAssignment[] = [];
  const rooms: RoomPlan[] = [];
  const unseated: SeatingPlan["unseated"] = [];
  for (const campus of campuses) {
    const candidates = cases
      .filter(
        (row) =>
          row.shortlisted &&
          row.hallTicketNo &&
          row.examCampusId === campus.id &&
          row.attendance !== "Absent",
      )
      .sort(byTicket);
    if (candidates.length === 0) continue;
    if (campus.rooms.length === 0) {
      unseated.push({
        campusName: campus.name,
        count: candidates.length,
        reason: "No rooms are listed for this venue.",
      });
      continue;
    }
    let next = 0;
    for (const room of campus.rooms) {
      const chunk = candidates.slice(next, next + room.capacity);
      next += chunk.length;
      if (chunk.length === 0) continue;
      const seatOrder = options.mix ? mixSubjects(chunk) : chunk;
      seatOrder.forEach((row, index) =>
        assignments.push({
          applicationId: row.applicationId,
          campusId: campus.id,
          room: room.name,
          seat: index + 1,
        }),
      );
      rooms.push({
        campusId: campus.id,
        campusName: campus.name,
        room: room.name,
        capacity: room.capacity,
        seated: chunk.length,
        firstTicket: chunk[0].hallTicketNo,
        lastTicket: chunk[chunk.length - 1].hallTicketNo,
      });
    }
    if (next < candidates.length) {
      unseated.push({
        campusName: campus.name,
        count: candidates.length - next,
        reason: "The rooms do not have enough seats.",
      });
    }
  }
  return { assignments, rooms, unseated };
}

export function seatLabel(row: Pick<AdmissionCase, "examRoom" | "examSeat">) {
  if (!row.examRoom && !row.examSeat) return "";
  return [row.examRoom, row.examSeat ? `Seat ${row.examSeat}` : ""]
    .filter(Boolean)
    .join(" · ");
}
