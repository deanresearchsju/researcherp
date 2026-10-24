import { admittedRegistration } from "@/lib/admission";
import { batchById } from "@/lib/batches";
import { recordAudit } from "@/lib/audit";
import { readPreviewSession } from "@/lib/auth";
import { storageKeys } from "@/lib/constants";
import { clientToday } from "@/lib/dates";
import {
  currentDoctoral,
  publishResults,
  type CourseRegistration,
  type DoctoralState,
} from "@/lib/doctoral";
import { saveJsonBlob } from "@/lib/json-lock";
import { sameId } from "@/lib/office";
import { officeViewWriteBlock } from "@/lib/office-view";
import { toJson } from "@/lib/records";
import {
  currentAllotments,
  registrationCompare,
  registrationOf,
  scholarBySignIn,
} from "@/lib/register";
import { createSupabase } from "@/lib/supabase/client";
import type { Role } from "@/types";

/* ------------------------------------------------------------------------------------------
 * Course-work examinations. The campuses where scholars write, the timetable, hall tickets,
 * seating, attendance, the marks of each paper and the passing board's decision are kept in
 * one office record. Marks are entered by the Controller of Examinations (COE), verified and
 * frozen by the COE verifier, approved by the passing board and published by the
 * administrator; a frozen mark can not be changed.
 * ---------------------------------------------------------------------------------------- */

export const examMigrationHint =
  "Open the Supabase SQL editor and run supabase/migrations/20261024200000_course_work_exams.sql. Until then, exam records stay in this browser.";

export type ExamRoom = { id: string; name: string; capacity: number };

export type ExamCentre = {
  id: string;
  name: string;
  address: string;
  rooms: ExamRoom[];
};

export type GradeBand = { min: number; grade: string };

export type TimetableEntry = {
  id: string;
  batchId: string;
  semester: number;
  subjectId: string;
  date: string;
  time: string;
};

export type ExamSettings = {
  centres: ExamCentre[];
  timetable: TimetableEntry[];
  maxMarks: number;
  passMark: number;
  grades: GradeBand[];
  instructions: string[];
};

export const defaultGrades: GradeBand[] = [
  { min: 90, grade: "O" },
  { min: 80, grade: "A+" },
  { min: 70, grade: "A" },
  { min: 60, grade: "B+" },
  { min: 55, grade: "B" },
  { min: 50, grade: "C" },
];

export const defaultInstructions = [
  "Bring this hall ticket and an original photo identity card. Candidates without both will not be admitted.",
  "Report at the examination centre 30 minutes before the paper begins.",
  "Mobile phones, smart watches, notes and any electronic device are not allowed in the hall.",
  "Sign the attendance sheet in the presence of the invigilator.",
  "Any malpractice leads to disqualification and further action as per University rules.",
];

export const defaultExamSettings: ExamSettings = {
  centres: [],
  timetable: [],
  maxMarks: 100,
  passMark: 50,
  grades: defaultGrades,
  instructions: defaultInstructions,
};

export type ExamTicket = {
  id: string;
  scholarIdentifier: string;
  scholarName: string;
  registration: string;
  department: string;
  batchId: string;
  semester: number;
  centreId: string;
  ticketNo: string;
  issuedOn: string;
  registrationIds: string[];
  roomId: string;
  seat: string;
};

export type AttendanceMark = "Present" | "Absent";

export type SheetStatus = "Entry" | "Sent" | "Frozen" | "Returned";

export type SubjectSheet = {
  subjectId: string;
  /** Marks by registration id; null until entered. */
  marks: Record<string, number | null>;
  /** The marks-entry sign-ins that entered marks on this paper. */
  enteredBy: string[];
  status: SheetStatus;
  /** Goes up each time the passing board sends the paper back to the COE. */
  revision: number;
  sentOn: string;
  sentBy: string;
  frozenOn: string;
  frozenBy: string;
};

export type FileStatus = "Open" | "Submitted" | "Approved" | "Published";

export type FileLogEntry = { on: string; by: string; action: string; note: string };

export type ExamResultFile = {
  id: string;
  batchId: string;
  semester: number;
  sessionMonth: string;
  sessionYear: string;
  sheets: SubjectSheet[];
  status: FileStatus;
  submittedOn: string;
  submittedBy: string;
  /** The passing board's approval, or the day it asked for changes. */
  boardOn: string;
  boardRef: string;
  /** True once the board has asked for changes; the resubmitted file is then the final one. */
  afterBoard: boolean;
  boardNote: string;
  publishedOn: string;
  publishedBy: string;
  log: FileLogEntry[];
};

export type ExamState = {
  settings: ExamSettings;
  tickets: ExamTicket[];
  attendance: Record<string, AttendanceMark>;
  files: ExamResultFile[];
  updatedAt: string | null;
  detail: string | null;
};

type Stored = Omit<ExamState, "updatedAt" | "detail">;

const emptyStored = (): Stored => ({
  settings: { ...defaultExamSettings },
  tickets: [],
  attendance: {},
  files: [],
});

/* ---------------------------------- reading the record ---------------------------------- */

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function whole(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseSheetStatus(value: string): SheetStatus {
  return value === "Sent" || value === "Frozen" || value === "Returned" ? value : "Entry";
}

function parseFileStatus(value: string): FileStatus {
  return value === "Submitted" || value === "Approved" || value === "Published"
    ? value
    : "Open";
}

export function parseExam(value: unknown): Stored {
  const row = object(value);
  const settings = object(row.settings);
  const grades = rows(settings.grades)
    .map((item) => ({ min: whole(item.min, 0), grade: text(item.grade).trim() }))
    .filter((item) => item.grade);
  const instructions = Array.isArray(settings.instructions)
    ? settings.instructions.filter((item): item is string => typeof item === "string")
    : defaultInstructions;
  return {
    settings: {
      centres: rows(settings.centres).flatMap((centre) => {
        const id = text(centre.id);
        if (!id) return [];
        return [
          {
            id,
            name: text(centre.name),
            address: text(centre.address),
            rooms: rows(centre.rooms).flatMap((room) => {
              const roomId = text(room.id);
              return roomId
                ? [{ id: roomId, name: text(room.name), capacity: whole(room.capacity, 0) }]
                : [];
            }),
          },
        ];
      }),
      timetable: rows(settings.timetable).flatMap((entry) => {
        const id = text(entry.id);
        if (!id) return [];
        return [
          {
            id,
            batchId: text(entry.batchId),
            semester: whole(entry.semester, 1),
            subjectId: text(entry.subjectId),
            date: text(entry.date),
            time: text(entry.time),
          },
        ];
      }),
      maxMarks: whole(settings.maxMarks, 100) || 100,
      passMark: whole(settings.passMark, 50),
      grades: grades.length > 0 ? grades : defaultGrades,
      instructions,
    },
    tickets: rows(row.tickets).flatMap((ticket) => {
      const id = text(ticket.id);
      if (!id) return [];
      return [
        {
          id,
          scholarIdentifier: text(ticket.scholarIdentifier),
          scholarName: text(ticket.scholarName),
          registration: text(ticket.registration),
          department: text(ticket.department),
          batchId: text(ticket.batchId),
          semester: whole(ticket.semester, 1),
          centreId: text(ticket.centreId),
          ticketNo: text(ticket.ticketNo),
          issuedOn: text(ticket.issuedOn),
          registrationIds: Array.isArray(ticket.registrationIds)
            ? ticket.registrationIds.filter((item): item is string => typeof item === "string")
            : [],
          roomId: text(ticket.roomId),
          seat: text(ticket.seat),
        },
      ];
    }),
    attendance: Object.fromEntries(
      Object.entries(object(row.attendance)).flatMap(([key, mark]) =>
        mark === "Present" || mark === "Absent" ? [[key, mark] as const] : [],
      ),
    ),
    files: rows(row.files).flatMap((file) => {
      const id = text(file.id);
      if (!id) return [];
      return [
        {
          id,
          batchId: text(file.batchId),
          semester: whole(file.semester, 1),
          sessionMonth: text(file.sessionMonth),
          sessionYear: text(file.sessionYear),
          sheets: rows(file.sheets).map((sheet) => ({
            subjectId: text(sheet.subjectId),
            marks: Object.fromEntries(
              Object.entries(object(sheet.marks)).map(([key, mark]) => [
                key,
                typeof mark === "number" && Number.isFinite(mark) ? mark : null,
              ]),
            ),
            enteredBy: Array.isArray(sheet.enteredBy)
              ? sheet.enteredBy.filter((item): item is string => typeof item === "string")
              : [],
            status: parseSheetStatus(text(sheet.status)),
            revision: whole(sheet.revision, 1),
            sentOn: text(sheet.sentOn),
            sentBy: text(sheet.sentBy),
            frozenOn: text(sheet.frozenOn),
            frozenBy: text(sheet.frozenBy),
          })),
          status: parseFileStatus(text(file.status)),
          submittedOn: text(file.submittedOn),
          submittedBy: text(file.submittedBy),
          boardOn: text(file.boardOn),
          boardRef: text(file.boardRef),
          afterBoard: file.afterBoard === true,
          boardNote: text(file.boardNote),
          publishedOn: text(file.publishedOn),
          publishedBy: text(file.publishedBy),
          log: rows(file.log).map((entry) => ({
            on: text(entry.on),
            by: text(entry.by),
            action: text(entry.action),
            note: text(entry.note),
          })),
        },
      ];
    }),
  };
}

/* ------------------------------------------- store -------------------------------------- */

let memory: ExamState | null = null;
let loading = false;
let stamp: string | null = null;
const listeners = new Set<() => void>();

function publish(next: ExamState) {
  memory = next;
  listeners.forEach((listener) => listener());
}

function readBrowser(): Stored {
  try {
    const saved = window.localStorage.getItem(storageKeys.exam);
    return saved ? parseExam(JSON.parse(saved)) : emptyStored();
  } catch {
    return emptyStored();
  }
}

async function loadExam(): Promise<ExamState> {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) return { ...browser, updatedAt: null, detail: null };
  const { data, error } = await supabase
    .from("exam_office")
    .select("payload, updated_at")
    .eq("id", "office")
    .maybeSingle();
  if (error) return { ...browser, updatedAt: null, detail: examMigrationHint };
  if (!data?.payload) return { ...browser, updatedAt: null, detail: null };
  stamp = data.updated_at ?? null;
  return { ...parseExam(data.payload), updatedAt: stamp, detail: null };
}

export function currentExam() {
  return memory;
}

export function subscribeExam(onChange: () => void) {
  listeners.add(onChange);
  if (!memory && !loading) {
    loading = true;
    void loadExam().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

export async function ensureExam() {
  if (memory) return memory;
  const value = await loadExam();
  publish(value);
  return value;
}

function draft(): Stored {
  const current = memory ?? { ...emptyStored(), updatedAt: null, detail: null };
  return structuredClone({
    settings: current.settings,
    tickets: current.tickets,
    attendance: current.attendance,
    files: current.files,
  });
}

async function saveExam(next: Stored) {
  const blocked = officeViewWriteBlock();
  if (blocked) return blocked;
  const supabase = createSupabase();
  if (supabase && memory && !memory.detail) {
    const saved = await saveJsonBlob("exam_office", "office", toJson(next), stamp);
    if (saved.ok) {
      stamp = saved.updatedAt;
      publish({ ...next, updatedAt: stamp, detail: null });
      return { ok: true as const };
    }
    if (saved.conflict) {
      return { ok: false as const, message: saved.message, conflict: true as const };
    }
  }
  try {
    window.localStorage.setItem(storageKeys.exam, JSON.stringify(next));
  } catch {
    return {
      ok: false as const,
      message: "This browser cannot store the exam records. Run the SQL migration first.",
    };
  }
  publish({ ...next, updatedAt: stamp, detail: memory?.detail ?? examMigrationHint });
  return { ok: true as const };
}

type Outcome = { ok: true } | { ok: false; message: string };

/**
 * Applies a change to the latest record and saves it. When somebody else saved meanwhile (the
 * marks of another entry sign-in, say), the latest record is read again and the change is
 * applied to it, so people working together never lose each other's work. The change returns
 * a message when it can not be made.
 */
async function commit(
  change: (state: Stored, live: ExamState) => string | null,
): Promise<Outcome> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = draft();
    const live = memory ?? { ...emptyStored(), updatedAt: null, detail: null };
    const problem = change(state, live);
    if (problem) return { ok: false, message: problem };
    const saved = await saveExam(state);
    if (saved.ok) return { ok: true };
    if (!("conflict" in saved && saved.conflict)) return { ok: false, message: saved.message };
    publish(await loadExam());
  }
  return { ok: false, message: "The exam records are busy. Try again in a moment." };
}

/* ------------------------------------ who may do what ----------------------------------- */

function actor() {
  const session = readPreviewSession();
  return {
    role: (session?.role ?? null) as Role | null,
    name: session ? session.name.trim() || session.identifier : "",
  };
}

function roleProblem(allowed: readonly Role[], message: string) {
  const { role } = actor();
  return role && allowed.includes(role) ? null : message;
}

const officeMessage = "Only the research office can do this.";

function officeProblem() {
  return roleProblem(["admin", "staff"], officeMessage);
}

function viewProblem() {
  return officeViewWriteBlock()?.message ?? null;
}

/* ------------------------------------------ marks --------------------------------------- */

export function gradeFor(settings: ExamSettings, marks: number) {
  const bands = [...settings.grades].sort((left, right) => right.min - left.min);
  return marks >= settings.passMark
    ? (bands.find((band) => marks >= band.min)?.grade ?? bands[bands.length - 1]?.grade ?? "P")
    : "RA";
}

export function outcomeFor(
  settings: ExamSettings,
  marks: number | null,
  absent: boolean,
): "Pass" | "RA" | "AAA" {
  if (absent) return "AAA";
  return marks !== null && marks >= settings.passMark ? "Pass" : "RA";
}

/* --------------------------------------- what is on offer ------------------------------- */

/** Papers whose fee Accounts approved and that still wait for a result. */
export function examRegistrations(
  doctoral: Pick<DoctoralState, "registrations" | "results">,
  batchId: string,
  semester: number,
) {
  return doctoral.registrations.filter(
    (row) =>
      row.batchId === batchId &&
      row.semester === semester &&
      row.paymentStatus === "Approved" &&
      !doctoral.results.some((result) => result.registrationId === row.id),
  );
}

/** The name of a course-work batch, as the course-work records name it. */
export function examBatchName(batchId: string) {
  return (
    currentDoctoral()?.batches.find((batch) => batch.id === batchId)?.name ??
    batchById(batchId)?.name ??
    ""
  );
}

export function centreOf(settings: ExamSettings, id: string) {
  return settings.centres.find((centre) => centre.id === id) ?? null;
}

export function roomOf(centre: ExamCentre | null, id: string) {
  return centre?.rooms.find((room) => room.id === id) ?? null;
}

export function ticketFor(
  state: Pick<ExamState, "tickets">,
  identifier: string,
  batchId: string,
  semester: number,
) {
  return (
    state.tickets.find(
      (ticket) =>
        sameId(ticket.scholarIdentifier, identifier) &&
        ticket.batchId === batchId &&
        ticket.semester === semester,
    ) ?? null
  );
}

export function ticketsOfScholar(state: Pick<ExamState, "tickets">, identifier: string) {
  return state.tickets
    .filter((ticket) => sameId(ticket.scholarIdentifier, identifier))
    .sort((left, right) => right.issuedOn.localeCompare(left.issuedOn));
}

export function fileFor(state: Pick<ExamState, "files">, batchId: string, semester: number) {
  return (
    state.files.find((file) => file.batchId === batchId && file.semester === semester) ?? null
  );
}

export function sheetOf(file: ExamResultFile | null, subjectId: string) {
  return file?.sheets.find((sheet) => sheet.subjectId === subjectId) ?? null;
}

/** Registration number if there is one, else the application number. */
function registrationLabel(identifier: string) {
  const scholar = scholarBySignIn(identifier);
  if (scholar) {
    return (
      registrationOf(scholar, currentAllotments()) || scholar.applicationNumber || identifier
    );
  }
  return admittedRegistration(identifier) || identifier;
}

function departmentOf(identifier: string) {
  return scholarBySignIn(identifier)?.department ?? "";
}

/* ----------------------------------------- settings ------------------------------------- */

export async function saveExamSettings(next: ExamSettings): Promise<Outcome> {
  const blocked = viewProblem() ?? officeProblem();
  if (blocked) return { ok: false, message: blocked };
  if (next.maxMarks < 1) return { ok: false, message: "Enter the maximum marks." };
  if (next.passMark < 0 || next.passMark > next.maxMarks) {
    return { ok: false, message: "The pass mark must be within the maximum marks." };
  }
  const names = next.centres.map((centre) => centre.name.trim().toLowerCase());
  if (names.some((name) => !name)) {
    return { ok: false, message: "Every campus needs a name." };
  }
  if (new Set(names).size !== names.length) {
    return { ok: false, message: "A campus name is repeated." };
  }
  return commit((state) => {
    state.settings = {
      ...next,
      centres: next.centres.map((centre) => ({
        ...centre,
        name: centre.name.trim(),
        address: centre.address.trim(),
        rooms: centre.rooms.filter((room) => room.name.trim() && room.capacity > 0),
      })),
    };
    return null;
  });
}

/* --------------------------------------- hall tickets ----------------------------------- */

function ticketPrefix(settings: ExamSettings, batchId: string, semester: number) {
  const first = settings.timetable
    .filter((entry) => entry.batchId === batchId && entry.semester === semester && entry.date)
    .map((entry) => entry.date)
    .sort()[0];
  const date = first || clientToday();
  return `CW${date.slice(2, 4)}${date.slice(5, 7)}`;
}

/**
 * Issues the hall ticket: one for each scholar whose course-work fee Accounts approved and who
 * chose a campus. Papers registered later are added to the scholar's ticket.
 */
export async function generateExamTickets(batchId: string, semester: number) {
  const blocked = viewProblem() ?? officeProblem();
  if (blocked) return { ok: false as const, message: blocked };
  const doctoral = currentDoctoral();
  if (!doctoral) return { ok: false as const, message: "The course-work records are loading." };
  const papers = examRegistrations(doctoral, batchId, semester);
  const withCentre = papers.filter((paper) => paper.examCentreId);
  if (withCentre.length === 0) {
    return {
      ok: false as const,
      message:
        papers.length === 0
          ? "No registration of this semester has an approved fee payment yet."
          : "None of the paid registrations has an exam campus.",
    };
  }
  let issued = 0;
  let added = 0;
  const saved = await commit((state) => {
    issued = 0;
    added = 0;
    const prefix = ticketPrefix(state.settings, batchId, semester);
    let serial = state.tickets
      .filter((ticket) => ticket.ticketNo.startsWith(prefix))
      .reduce(
        (max, ticket) => Math.max(max, Number(ticket.ticketNo.slice(prefix.length)) || 0),
        0,
      );
    const scholars = [
      ...new Set(withCentre.map((paper) => paper.scholarIdentifier.toLowerCase())),
    ];
    const today = clientToday();
    for (const key of scholars) {
      const own = withCentre.filter((paper) => paper.scholarIdentifier.toLowerCase() === key);
      const ids = own.map((paper) => paper.id);
      const existing = state.tickets.find(
        (ticket) =>
          ticket.scholarIdentifier.toLowerCase() === key &&
          ticket.batchId === batchId &&
          ticket.semester === semester,
      );
      if (existing) {
        const fresh = ids.filter((id) => !existing.registrationIds.includes(id));
        if (fresh.length > 0) {
          existing.registrationIds.push(...fresh);
          added += 1;
        }
        continue;
      }
      serial += 1;
      state.tickets.push({
        id: crypto.randomUUID(),
        scholarIdentifier: own[0].scholarIdentifier,
        scholarName: own[0].scholarName,
        registration: registrationLabel(own[0].scholarIdentifier),
        department: departmentOf(own[0].scholarIdentifier),
        batchId,
        semester,
        centreId: own[0].examCentreId,
        ticketNo: `${prefix}${String(serial).padStart(3, "0")}`,
        issuedOn: today,
        registrationIds: ids,
        roomId: "",
        seat: "",
      });
      issued += 1;
    }
    return null;
  });
  if (!saved.ok) return saved;
  await recordAudit({
    action: "exam:hall-tickets",
    subject: `${batchId}:${semester}`,
    detail: `${issued} hall ticket(s) issued, ${added} updated`,
  });
  return { ok: true as const, issued, added };
}

/** Moves a scholar's ticket to another campus (before seating) when the scholar asks. */
export async function setTicketCentre(ticketId: string, centreId: string): Promise<Outcome> {
  const blocked = viewProblem() ?? officeProblem();
  if (blocked) return { ok: false, message: blocked };
  return commit((state) => {
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) return "That ticket was not found.";
    ticket.centreId = centreId;
    ticket.roomId = "";
    ticket.seat = "";
    return null;
  });
}

/* ------------------------------------------ seating ------------------------------------- */

/**
 * Seats the scholars of one campus room by room in registration-number order. Seat numbers
 * start at 1 in each room.
 */
export async function arrangeExamSeating(batchId: string, semester: number, centreId: string) {
  const blocked = viewProblem() ?? officeProblem();
  if (blocked) return { ok: false as const, message: blocked };
  let seated = 0;
  const saved = await commit((state) => {
    const centre = centreOf(state.settings, centreId);
    if (!centre || centre.rooms.length === 0) {
      return "Add rooms and seats to this campus under Exam setup.";
    }
    const tickets = state.tickets
      .filter(
        (ticket) =>
          ticket.batchId === batchId &&
          ticket.semester === semester &&
          ticket.centreId === centreId,
      )
      .sort(
        (left, right) =>
          registrationCompare(left.registration, right.registration) ||
          left.scholarName.localeCompare(right.scholarName),
      );
    const capacity = centre.rooms.reduce((sum, room) => sum + room.capacity, 0);
    if (tickets.length > capacity) {
      return `${tickets.length} scholars need seats at ${centre.name} but the rooms hold ${capacity}. Add rooms or seats under Exam setup.`;
    }
    let index = 0;
    for (const room of centre.rooms) {
      for (let seat = 1; seat <= room.capacity && index < tickets.length; seat += 1) {
        tickets[index].roomId = room.id;
        tickets[index].seat = String(seat);
        index += 1;
      }
    }
    seated = tickets.length;
    return null;
  });
  return saved.ok ? { ok: true as const, seated } : saved;
}

/* ---------------------------------------- attendance ------------------------------------ */

function sheetLocked(
  state: Pick<ExamState, "files">,
  registration: CourseRegistration | undefined,
) {
  if (!registration) return false;
  const file = fileFor(state, registration.batchId, registration.semester);
  const sheet = sheetOf(file, registration.subjectId);
  return Boolean(
    file?.status === "Published" || sheet?.status === "Frozen" || sheet?.status === "Sent",
  );
}

export async function markExamAttendance(
  entries: readonly { registrationId: string; mark: AttendanceMark | "" }[],
): Promise<Outcome> {
  const blocked =
    viewProblem() ??
    roleProblem(["admin", "staff", "coe"], "Only the research office or the COE can mark attendance.");
  if (blocked) return { ok: false, message: blocked };
  const doctoral = currentDoctoral();
  return commit((state) => {
    for (const entry of entries) {
      const registration = doctoral?.registrations.find((row) => row.id === entry.registrationId);
      if (sheetLocked(state, registration)) {
        return `${registration?.scholarName ?? "A scholar"}: the marks of this paper are already sent for verification or frozen, so attendance can not change.`;
      }
      if (entry.mark) state.attendance[entry.registrationId] = entry.mark;
      else delete state.attendance[entry.registrationId];
    }
    return null;
  });
}

/* --------------------------------------- marks entry ------------------------------------ */

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ensureFile(state: Stored, batchId: string, semester: number) {
  let file = fileFor(state, batchId, semester);
  if (!file) {
    const first = state.settings.timetable
      .filter((entry) => entry.batchId === batchId && entry.semester === semester && entry.date)
      .map((entry) => entry.date)
      .sort()[0];
    const date = first || clientToday();
    file = {
      id: crypto.randomUUID(),
      batchId,
      semester,
      sessionMonth: monthNames[Number(date.slice(5, 7)) - 1] ?? "",
      sessionYear: date.slice(0, 4),
      sheets: [],
      status: "Open",
      submittedOn: "",
      submittedBy: "",
      boardOn: "",
      boardRef: "",
      afterBoard: false,
      boardNote: "",
      publishedOn: "",
      publishedBy: "",
      log: [],
    };
    state.files.push(file);
  }
  return file;
}

function ensureSheet(file: ExamResultFile, subjectId: string) {
  let sheet = sheetOf(file, subjectId);
  if (!sheet) {
    sheet = {
      subjectId,
      marks: {},
      enteredBy: [],
      status: "Entry",
      revision: 1,
      sentOn: "",
      sentBy: "",
      frozenOn: "",
      frozenBy: "",
    };
    file.sheets.push(sheet);
  }
  return sheet;
}

function log(file: ExamResultFile, action: string, note = "") {
  file.log.push({ on: clientToday(), by: actor().name, action, note });
}

/** The scholars who sat (or are to sit) a paper: hall ticket issued, fee approved. */
export function candidatesFor(
  doctoral: Pick<DoctoralState, "registrations" | "results">,
  state: Pick<ExamState, "tickets">,
  batchId: string,
  semester: number,
  subjectId: string,
) {
  return examRegistrations(doctoral, batchId, semester)
    .filter((row) => row.subjectId === subjectId)
    .flatMap((row) => {
      const ticket = state.tickets.find((item) => item.registrationIds.includes(row.id));
      return ticket ? [{ registration: row, ticket }] : [];
    })
    .sort(
      (left, right) =>
        registrationCompare(left.ticket.registration, right.ticket.registration) ||
        left.registration.scholarName.localeCompare(right.registration.scholarName),
    );
}

const entryRole = "Only a marks entry sign-in of the COE can enter marks.";

export async function saveExamMarks(
  batchId: string,
  semester: number,
  subjectId: string,
  entries: readonly { registrationId: string; marks: number | null }[],
): Promise<Outcome> {
  const blocked = viewProblem() ?? roleProblem(["coe"], entryRole);
  if (blocked) return { ok: false, message: blocked };
  return commit((state) => {
    const max = state.settings.maxMarks;
    const file = ensureFile(state, batchId, semester);
    if (file.status === "Published") return "These results are published. They can not be changed.";
    if (file.status === "Submitted" || file.status === "Approved") {
      return "This file is with the research office. Marks can change only if the passing board sends it back.";
    }
    const sheet = ensureSheet(file, subjectId);
    if (sheet.status === "Frozen") return "These marks are frozen. They can not be changed.";
    if (sheet.status === "Sent") {
      return "These marks are with the verifier. Ask the verifier to send them back to change one.";
    }
    for (const entry of entries) {
      if (entry.marks === null) {
        delete sheet.marks[entry.registrationId];
        continue;
      }
      if (
        !Number.isFinite(entry.marks) ||
        entry.marks < 0 ||
        entry.marks > max ||
        Math.round(entry.marks * 2) !== entry.marks * 2
      ) {
        return `Marks must be from 0 to ${max} (in steps of 0.5).`;
      }
      sheet.marks[entry.registrationId] = entry.marks;
    }
    const by = actor().name;
    if (by && !sheet.enteredBy.includes(by)) sheet.enteredBy.push(by);
    return null;
  });
}

/** Registrations of a paper still lacking marks (absentees need none). */
export function missingMarks(
  doctoral: Pick<DoctoralState, "registrations" | "results">,
  state: Pick<ExamState, "tickets" | "attendance" | "files">,
  batchId: string,
  semester: number,
  subjectId: string,
) {
  const sheet = sheetOf(fileFor(state, batchId, semester), subjectId);
  return candidatesFor(doctoral, state, batchId, semester, subjectId).filter(
    ({ registration }) =>
      state.attendance[registration.id] !== "Absent" &&
      (sheet?.marks[registration.id] === undefined || sheet.marks[registration.id] === null),
  );
}

export async function sendMarksForVerification(
  batchId: string,
  semester: number,
  subjectId: string,
): Promise<Outcome> {
  const blocked = viewProblem() ?? roleProblem(["coe"], entryRole);
  if (blocked) return { ok: false, message: blocked };
  const doctoral = currentDoctoral();
  if (!doctoral) return { ok: false, message: "The records are loading." };
  return commit((state) => {
    const open = missingMarks(doctoral, state, batchId, semester, subjectId);
    if (open.length > 0) {
      return `Enter the marks of ${open.length} more scholar(s), or mark them absent, before sending.`;
    }
    const file = ensureFile(state, batchId, semester);
    const sheet = ensureSheet(file, subjectId);
    if (sheet.status !== "Entry" && sheet.status !== "Returned") {
      return "These marks are already sent.";
    }
    sheet.status = "Sent";
    sheet.sentOn = clientToday();
    sheet.sentBy = actor().name;
    log(file, "Marks sent for verification", subjectId);
    return null;
  });
}

/* ------------------------------------ verify and freeze --------------------------------- */

const verifierMessage = "Only the verification sign-in of the COE can do this.";

export async function sendMarksBack(
  batchId: string,
  semester: number,
  subjectId: string,
  note: string,
): Promise<Outcome> {
  const blocked = viewProblem() ?? roleProblem(["coeverify"], verifierMessage);
  if (blocked) return { ok: false, message: blocked };
  if (note.trim().length < 3) return { ok: false, message: "Say what has to be corrected." };
  return commit((state) => {
    const file = fileFor(state, batchId, semester);
    const sheet = sheetOf(file, subjectId);
    if (!file || !sheet || sheet.status !== "Sent") {
      return "Only marks sent for verification can be sent back.";
    }
    sheet.status = "Returned";
    log(file, "Sent back to marks entry", `${subjectId}: ${note.trim()}`);
    return null;
  });
}

export async function freezeMarks(
  batchId: string,
  semester: number,
  subjectId: string,
): Promise<Outcome> {
  const blocked = viewProblem() ?? roleProblem(["coeverify"], verifierMessage);
  if (blocked) return { ok: false, message: blocked };
  const saved = await commit((state) => {
    const file = fileFor(state, batchId, semester);
    const sheet = sheetOf(file, subjectId);
    if (!file || !sheet || sheet.status !== "Sent") {
      return "Only marks sent for verification can be frozen.";
    }
    sheet.status = "Frozen";
    sheet.frozenOn = clientToday();
    sheet.frozenBy = actor().name;
    log(file, "Marks verified and frozen", subjectId);
    return null;
  });
  if (saved.ok) {
    await recordAudit({
      action: "exam:freeze",
      subject: `${batchId}:${semester}:${subjectId}`,
      detail: "Marks frozen",
    });
  }
  return saved;
}

/** True when every paper with registrations has a frozen sheet. */
export function readyToSubmit(
  doctoral: Pick<DoctoralState, "registrations" | "results">,
  state: Pick<ExamState, "tickets" | "files">,
  batchId: string,
  semester: number,
) {
  const file = fileFor(state, batchId, semester);
  const subjects = [
    ...new Set(
      examRegistrations(doctoral, batchId, semester)
        .filter((row) => state.tickets.some((ticket) => ticket.registrationIds.includes(row.id)))
        .map((row) => row.subjectId),
    ),
  ];
  return (
    subjects.length > 0 &&
    subjects.every((subjectId) => sheetOf(file, subjectId)?.status === "Frozen")
  );
}

export async function submitToOffice(batchId: string, semester: number): Promise<Outcome> {
  const blocked = viewProblem() ?? roleProblem(["coeverify"], verifierMessage);
  if (blocked) return { ok: false, message: blocked };
  const doctoral = currentDoctoral();
  if (!doctoral) return { ok: false, message: "The records are loading." };
  return commit((state) => {
    if (!readyToSubmit(doctoral, state, batchId, semester)) {
      return "Freeze the marks of every paper of this semester before submitting.";
    }
    const file = fileFor(state, batchId, semester);
    if (!file || (file.status !== "Open" && file.status !== "Submitted")) {
      return "This file is already with the research office.";
    }
    file.status = "Submitted";
    file.submittedOn = clientToday();
    file.submittedBy = actor().name;
    log(file, file.afterBoard ? "Final result file submitted" : "Submitted to the research office");
    return null;
  });
}

/* ------------------------------- passing board and publication -------------------------- */

export async function recordPassingBoard(
  fileId: string,
  decision: "Approved" | "Changes",
  details: { on: string; reference: string; note: string; subjectIds: string[] },
): Promise<Outcome> {
  const blocked =
    viewProblem() ?? roleProblem(["admin"], "Only an administrator can record the passing board.");
  if (blocked) return { ok: false, message: blocked };
  if (!details.on) return { ok: false, message: "Enter the date of the passing board." };
  if (decision === "Changes" && details.note.trim().length < 3) {
    return { ok: false, message: "Write the passing board's suggestion for the COE." };
  }
  return commit((state) => {
    const file = state.files.find((item) => item.id === fileId);
    if (!file || file.status !== "Submitted") {
      return "Only a submitted file can go to the passing board.";
    }
    file.boardOn = details.on;
    file.boardRef = details.reference.trim();
    file.boardNote = details.note.trim();
    if (decision === "Approved") {
      file.status = "Approved";
      log(
        file,
        "Approved by the passing board",
        `${details.reference.trim()} ${details.note.trim()}`.trim(),
      );
      return null;
    }
    const chosen =
      details.subjectIds.length > 0 ? details.subjectIds : file.sheets.map((s) => s.subjectId);
    for (const sheet of file.sheets) {
      if (!chosen.includes(sheet.subjectId)) continue;
      sheet.status = "Returned";
      sheet.revision += 1;
      sheet.frozenOn = "";
      sheet.frozenBy = "";
    }
    file.status = "Open";
    file.afterBoard = true;
    log(file, "Passing board asked for changes", details.note.trim());
    return null;
  });
}

export async function publishExamResults(fileId: string) {
  const blocked =
    viewProblem() ?? roleProblem(["admin"], "Only an administrator can publish results.");
  if (blocked) return { ok: false as const, message: blocked };
  const doctoral = currentDoctoral();
  const live = memory;
  if (!doctoral || !live) return { ok: false as const, message: "The records are loading." };
  const file = live.files.find((item) => item.id === fileId);
  if (!file) return { ok: false as const, message: "That file was not found." };
  if (file.status === "Published") {
    return { ok: false as const, message: "These results are already published." };
  }
  const final = file.status === "Approved" || (file.status === "Submitted" && file.afterBoard);
  if (!final) {
    return { ok: false as const, message: "Record the passing board's approval before publishing." };
  }
  if (file.sheets.some((sheet) => sheet.status !== "Frozen")) {
    return { ok: false as const, message: "Every paper must be frozen before publishing." };
  }
  const entries = file.sheets.flatMap((sheet) =>
    candidatesFor(doctoral, live, file.batchId, file.semester, sheet.subjectId).map(
      ({ registration }) => {
        const absent = live.attendance[registration.id] === "Absent";
        const marks = absent ? null : (sheet.marks[registration.id] ?? null);
        return {
          registrationId: registration.id,
          outcome: outcomeFor(live.settings, marks, absent),
          marks,
          grade: absent ? "AAA" : marks === null ? "" : gradeFor(live.settings, marks),
        };
      },
    ),
  );
  const today = clientToday();
  const published = await publishResults(entries, file.sessionMonth, file.sessionYear, today);
  if (!published.ok) return published;
  const saved = await commit((state) => {
    const target = state.files.find((item) => item.id === fileId);
    if (!target) return "That file was not found.";
    target.status = "Published";
    target.publishedOn = today;
    target.publishedBy = actor().name;
    log(target, "Results published", `${entries.length} paper result(s)`);
    return null;
  });
  if (saved.ok) {
    await recordAudit({
      action: "exam:publish",
      subject: `${file.batchId}:${file.semester}`,
      detail: `${entries.length} result(s) published`,
    });
    return { ok: true as const, published: entries.length };
  }
  return {
    ok: false as const,
    message: `The results were published, but this file could not be updated (${saved.message}). Refresh the page.`,
  };
}
