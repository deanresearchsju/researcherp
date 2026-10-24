"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { MarkButtons, markSummary, type Mark } from "@/components/portal/AttendanceControls";
import { DeskPage, DeskSection, DeskTabs } from "@/components/portal/Desk";
import { ListSheet, PrintFrame } from "@/components/portal/ExamPrint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { officeWriteBlock } from "@/lib/access";
import { formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  arrangeExamSeating,
  candidatesFor,
  centreOf,
  currentExam,
  examRegistrations,
  generateExamTickets,
  markExamAttendance,
  roomOf,
  setTicketCentre,
  subscribeExam,
  type ExamTicket,
} from "@/lib/exam-office";
import {
  downloadExamHallTickets,
  ticketPapers,
  ticketPhotos,
} from "@/lib/exam-hall-ticket-pdf";
import { usePreviewSession } from "@/lib/use-preview-session";

const tabs = [
  { id: "tickets", label: "Hall tickets" },
  { id: "seating", label: "Seating plan" },
  { id: "attendance", label: "Attendance" },
] as const;

type Printing =
  | { kind: "seating"; centreId: string }
  | { kind: "attendance"; centreId: string; subjectId: string };

/**
 * The course-work examination for the research office: hall tickets (issued only after the
 * fee is approved by Accounts), the seating plan and the attendance sheets, for one batch and
 * semester at a time.
 */
export function ExamTicketsScreen() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const [batchId, setBatchId] = useState("");
  const [semester, setSemester] = useState(1);
  const [tab, setTab] = useState<string>("tickets");
  const [centreId, setCentreId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<Printing | null>(null);

  const batches = doctoral?.batches ?? [];
  const activeBatch = batchId || batches[0]?.id || "";
  const canWrite =
    Boolean(session) && !officeWriteBlock() && session?.role !== "accounts";

  const tickets = useMemo(
    () =>
      (exam?.tickets ?? []).filter(
        (ticket) => ticket.batchId === activeBatch && ticket.semester === semester,
      ),
    [exam, activeBatch, semester],
  );

  if (!ready || !doctoral || !exam) {
    return <p className="text-sm text-muted-foreground">Loading the examination…</p>;
  }
  const settings = exam.settings;
  const centres = settings.centres;
  const activeCentre = centreId || centres[0]?.id || "";
  const paid = examRegistrations(doctoral, activeBatch, semester);
  const everything = doctoral.registrations.filter(
    (row) => row.batchId === activeBatch && row.semester === semester,
  );
  const awaiting = everything.filter((row) => row.paymentStatus === "Pending");
  const returned = everything.filter((row) => row.paymentStatus === "Returned");
  const noCentre = paid.filter((row) => !row.examCentreId);
  const ticketed = new Set(tickets.flatMap((ticket) => ticket.registrationIds));
  const subjects = [
    ...new Map(
      paid
        .filter((row) => ticketed.has(row.id))
        .map((row) => [row.subjectId, `${row.code} ${row.name}`] as const),
    ).entries(),
  ];
  const activeSubject = subjectId || subjects[0]?.[0] || "";

  const papersOf = (ticket: ExamTicket) =>
    ticket.registrationIds
      .map((id) => doctoral.registrations.find((row) => row.id === id)?.code ?? "")
      .filter(Boolean)
      .join(", ");

  async function run<T extends { ok: boolean }>(task: Promise<T>, done: (value: T) => string) {
    setBusy(true);
    const result = await task;
    setBusy(false);
    setNotice(
      result.ok
        ? done(result)
        : ((result as unknown as { message?: string }).message ?? "That could not be done."),
    );
  }

  async function download(list: readonly ExamTicket[]) {
    if (list.length === 0) return;
    setBusy(true);
    try {
      const photos = await ticketPhotos(list);
      await downloadExamHallTickets(
        list.map((ticket) => ({
          ticket,
          papers: ticketPapers(ticket, settings),
          photo: photos.get(ticket.id) ?? null,
        })),
        settings,
        list.length === 1
          ? `hall-ticket-${list[0].ticketNo}.pdf`
          : `course-work-hall-tickets-s${semester}.pdf`,
      );
    } catch {
      setNotice("The hall tickets could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (printing) {
    const centre = centreOf(settings, printing.centreId);
    const batchName = batches.find((batch) => batch.id === activeBatch)?.name ?? "";
    const ofCentre = tickets
      .filter((ticket) => ticket.centreId === printing.centreId)
      .sort(
        (left, right) =>
          (left.roomId || "~").localeCompare(right.roomId || "~") ||
          Number(left.seat || 9999) - Number(right.seat || 9999),
      );
    const roomsToPrint = [
      ...(centre?.rooms ?? []).map((room) => ({ id: room.id, name: room.name })),
      { id: "", name: "Seat not allotted" },
    ];
    if (printing.kind === "seating") {
      return (
        <PrintFrame onBack={() => setPrinting(null)} printLabel="Print seating plan">
          {roomsToPrint.map((room) => {
            const list = ofCentre.filter((ticket) => ticket.roomId === room.id);
            if (list.length === 0) return null;
            return (
              <ListSheet
                key={room.id || "none"}
                title="Course Work Examination · Seating plan"
                details={[
                  `Batch: ${batchName}`,
                  `Semester: ${semester}`,
                  `Campus: ${centre?.name ?? "—"}`,
                  `Room: ${room.name}`,
                  `Scholars: ${list.length}`,
                ]}
                headers={["Seat", "Hall ticket No.", "Registration No.", "Name", "Papers"]}
                widths={["w-16", "w-32", "w-36", "", "w-32"]}
                bold={[0, 3]}
                rows={list.map((ticket) => [
                  ticket.seat || "—",
                  ticket.ticketNo,
                  ticket.registration,
                  ticket.scholarName,
                  papersOf(ticket),
                ])}
                signatures={["Exam Superintendent"]}
                perPage={20}
              />
            );
          })}
        </PrintFrame>
      );
    }
    const subject = doctoral.subjects.find((item) => item.id === printing.subjectId);
    const slot = settings.timetable.find(
      (entry) =>
        entry.batchId === activeBatch &&
        entry.semester === semester &&
        entry.subjectId === printing.subjectId,
    );
    const candidates = candidatesFor(doctoral, exam, activeBatch, semester, printing.subjectId)
      .filter(({ ticket }) => ticket.centreId === printing.centreId)
      .sort(
        (left, right) =>
          (left.ticket.roomId || "~").localeCompare(right.ticket.roomId || "~") ||
          Number(left.ticket.seat || 9999) - Number(right.ticket.seat || 9999),
      );
    return (
      <PrintFrame onBack={() => setPrinting(null)} printLabel="Print attendance sheets">
        {roomsToPrint.map((room) => {
          const list = candidates.filter(({ ticket }) => ticket.roomId === room.id);
          if (list.length === 0) return null;
          return (
            <ListSheet
              key={room.id || "none"}
              title="Course Work Examination · Attendance sheet"
              details={[
                `Batch: ${batchName}`,
                `Semester: ${semester}`,
                `Campus: ${centre?.name ?? "—"}`,
                `Room: ${room.name}`,
                `Paper: ${subject ? `${subject.code} ${subject.name}` : "—"}`,
                `Date: ${slot?.date ? formatIsoDate(slot.date) : "—"}`,
                `Time: ${slot?.time || "—"}`,
              ]}
              headers={["Seat", "Hall ticket No.", "Registration No.", "Name", "Signature"]}
              widths={["w-14", "w-28", "w-32", "", "w-44"]}
              bold={[3]}
              tall
              rows={list.map(({ ticket }) => [
                ticket.seat || "—",
                ticket.ticketNo,
                ticket.registration,
                ticket.scholarName,
                "",
              ])}
              signatures={["Invigilator", "Exam Superintendent"]}
              perPage={14}
            />
          );
        })}
      </PrintFrame>
    );
  }

  const seatingRows = tickets
    .filter((ticket) => ticket.centreId === activeCentre)
    .sort(
      (left, right) =>
        (left.roomId || "~").localeCompare(right.roomId || "~") ||
        Number(left.seat || 9999) - Number(right.seat || 9999),
    );
  const attendanceRows = candidatesFor(doctoral, exam, activeBatch, semester, activeSubject)
    .filter(({ ticket }) => ticket.centreId === activeCentre)
    .sort(
      (left, right) =>
        (left.ticket.roomId || "~").localeCompare(right.ticket.roomId || "~") ||
        Number(left.ticket.seat || 9999) - Number(right.ticket.seat || 9999),
    );

  return (
    <DeskPage kicker="Course work" title="Hall tickets & seating">
      {exam.detail ? <p className="text-sm text-secondary">{exam.detail}</p> : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Batch</span>
          <NativeSelect
            value={activeBatch}
            onChange={(event) => setBatchId(event.target.value)}
            aria-label="Batch"
          >
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Semester</span>
          <NativeSelect
            value={semester}
            onChange={(event) => setSemester(Number(event.target.value))}
            aria-label="Semester"
          >
            {[1, 2, 3, 4].map((item) => (
              <option key={item} value={item}>
                Semester {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        {tab !== "tickets" ? (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Campus</span>
            <NativeSelect
              value={activeCentre}
              onChange={(event) => setCentreId(event.target.value)}
              aria-label="Campus"
            >
              {centres.length === 0 ? <option value="">No campus set up</option> : null}
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        {tab === "attendance" ? (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Paper</span>
            <NativeSelect
              value={activeSubject}
              onChange={(event) => setSubjectId(event.target.value)}
              aria-label="Paper"
            >
              {subjects.length === 0 ? <option value="">No paper yet</option> : null}
              {subjects.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
      </div>

      <DeskTabs tabs={[...tabs]} value={tab} onChange={setTab} />

      {tab === "tickets" ? (
        <DeskSection
          title="Hall tickets"
          action={
            <div className="flex flex-wrap gap-2">
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(generateExamTickets(activeBatch, semester), (result) => {
                      const done = result as { issued?: number; added?: number };
                      return `${done.issued ?? 0} hall ticket(s) issued${
                        done.added ? `, ${done.added} updated with new papers` : ""
                      }.`;
                    })
                  }
                >
                  Issue hall tickets
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-readonly-allow
                disabled={busy || tickets.length === 0}
                onClick={() => void download(tickets)}
              >
                Download all ({tickets.length})
              </Button>
            </div>
          }
        >
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="gold">{paid.length} paper(s) paid</Badge>
              <Badge variant="outline">{tickets.length} ticket(s) issued</Badge>
              <Badge variant="purple">{awaiting.length} awaiting Accounts</Badge>
              {returned.length > 0 ? (
                <Badge variant="maroon">{returned.length} returned by Accounts</Badge>
              ) : null}
              {noCentre.length > 0 ? (
                <Badge variant="maroon">{noCentre.length} paid without a campus</Badge>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                <thead className="bg-muted text-primary">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Hall ticket No.</th>
                    <th className="px-3 py-2 font-semibold">Scholar</th>
                    <th className="px-3 py-2 font-semibold">Registration No.</th>
                    <th className="px-3 py-2 font-semibold">Campus</th>
                    <th className="px-3 py-2 font-semibold">Papers</th>
                    <th className="px-3 py-2 font-semibold">Room · seat</th>
                    <th className="px-3 py-2 font-semibold">
                      <span className="sr-only">Download</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                        No hall ticket is issued for this batch and semester yet.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => {
                      const centre = centreOf(settings, ticket.centreId);
                      const room = roomOf(centre, ticket.roomId);
                      return (
                        <tr key={ticket.id} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs font-semibold">
                            {ticket.ticketNo}
                          </td>
                          <td className="px-3 py-2 font-medium text-primary">
                            {ticket.scholarName}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{ticket.registration}</td>
                          <td className="px-3 py-2">
                            {canWrite && centres.length > 0 ? (
                              <NativeSelect
                                value={ticket.centreId}
                                aria-label={`Campus for ${ticket.scholarName}`}
                                onChange={(event) =>
                                  void run(
                                    setTicketCentre(ticket.id, event.target.value),
                                    () => "Campus changed. Arrange the seating again.",
                                  )
                                }
                              >
                                {centres.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </NativeSelect>
                            ) : (
                              (centre?.name ?? "—")
                            )}
                          </td>
                          <td className="px-3 py-2">{papersOf(ticket)}</td>
                          <td className="px-3 py-2">
                            {room ? `${room.name} · ${ticket.seat}` : "Not seated yet"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-readonly-allow
                              disabled={busy}
                              onClick={() => void download([ticket])}
                            >
                              Download
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DeskSection>
      ) : null}

      {tab === "seating" ? (
        <DeskSection
          title="Seating plan"
          action={
            <div className="flex flex-wrap gap-2">
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !activeCentre}
                  onClick={() =>
                    void run(
                      arrangeExamSeating(activeBatch, semester, activeCentre),
                      (result) => `${(result as { seated?: number }).seated ?? 0} scholar(s) seated.`,
                    )
                  }
                >
                  Arrange seating
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-readonly-allow
                disabled={seatingRows.length === 0}
                onClick={() => setPrinting({ kind: "seating", centreId: activeCentre })}
              >
                Print seating plan
              </Button>
            </div>
          }
        >
          <div className="space-y-3 p-4">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="bg-muted text-primary">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Room</th>
                    <th className="px-3 py-2 font-semibold">Seat</th>
                    <th className="px-3 py-2 font-semibold">Hall ticket No.</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Papers</th>
                  </tr>
                </thead>
                <tbody>
                  {seatingRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-muted-foreground" colSpan={5}>
                        No hall ticket is issued for this campus yet.
                      </td>
                    </tr>
                  ) : (
                    seatingRows.map((ticket) => (
                      <tr key={ticket.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          {roomOf(centreOf(settings, ticket.centreId), ticket.roomId)?.name ??
                            "Not seated yet"}
                        </td>
                        <td className="px-3 py-2 font-semibold">{ticket.seat || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{ticket.ticketNo}</td>
                        <td className="px-3 py-2 font-medium text-primary">
                          {ticket.scholarName}
                        </td>
                        <td className="px-3 py-2">{papersOf(ticket)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DeskSection>
      ) : null}

      {tab === "attendance" ? (
        <DeskSection
          title="Attendance"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-readonly-allow
              disabled={attendanceRows.length === 0}
              onClick={() =>
                setPrinting({ kind: "attendance", centreId: activeCentre, subjectId: activeSubject })
              }
            >
              Print attendance sheets
            </Button>
          }
        >
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {canWrite ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || attendanceRows.length === 0}
                    onClick={() =>
                      void run(
                        markExamAttendance(
                          attendanceRows.map(({ registration }) => ({
                            registrationId: registration.id,
                            mark: "Present" as const,
                          })),
                        ),
                        () => "Everyone on this list is marked present.",
                      )
                    }
                  >
                    All present
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || attendanceRows.length === 0}
                    onClick={() =>
                      void run(
                        markExamAttendance(
                          attendanceRows.map(({ registration }) => ({
                            registrationId: registration.id,
                            mark: "" as const,
                          })),
                        ),
                        () => "Attendance cleared for this list.",
                      )
                    }
                  >
                    Clear all
                  </Button>
                </>
              ) : null}
              <span className="ml-auto text-sm text-muted-foreground">
                {markSummary(
                  attendanceRows.map(({ registration }) => exam.attendance[registration.id] ?? ""),
                )}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="bg-muted text-primary">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Room · seat</th>
                    <th className="px-3 py-2 font-semibold">Hall ticket No.</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-muted-foreground" colSpan={4}>
                        No scholar with a hall ticket for this paper at this campus.
                      </td>
                    </tr>
                  ) : (
                    attendanceRows.map(({ registration, ticket }) => (
                      <tr key={registration.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          {roomOf(centreOf(settings, ticket.centreId), ticket.roomId)?.name ??
                            "—"}{" "}
                          · {ticket.seat || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{ticket.ticketNo}</td>
                        <td className="px-3 py-2 font-medium text-primary">
                          {registration.scholarName}
                        </td>
                        <td className="px-3 py-2">
                          <MarkButtons
                            name={registration.scholarName}
                            value={(exam.attendance[registration.id] ?? "") as Mark}
                            disabled={!canWrite || busy}
                            onChange={(next) =>
                              void run(
                                markExamAttendance([
                                  { registrationId: registration.id, mark: next },
                                ]),
                                () => "Attendance saved.",
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DeskSection>
      ) : null}
    </DeskPage>
  );
}
