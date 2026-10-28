"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskPage, DeskSection, ScholarIdentityHeader } from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  centreOf,
  currentExam,
  examBatchName,
  roomOf,
  subscribeExam,
  ticketsOfScholar,
} from "@/lib/exam-office";
import {
  downloadExamHallTickets,
  ticketPapers,
  ticketPhotos,
} from "@/lib/exam-hall-ticket-pdf";
import { sameId } from "@/lib/office";
import { usePortalSession } from "@/lib/use-preview-session";

/**
 * The scholar's course-work examination hall ticket. It appears once Accounts has approved the
 * course-work fee and the research office has issued the ticket; until then the scholar is told
 * what is still pending.
 */
export function ScholarExamTicket() {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!ready || !doctoral || !exam) {
    return <p className="text-sm text-muted-foreground">Loading your hall ticket…</p>;
  }
  const identifier = session?.identifier ?? "";
  const tickets = ticketsOfScholar(exam, identifier);
  const settings = exam.settings;
  const mine = doctoral.registrations.filter((row) =>
    sameId(row.scholarIdentifier, identifier),
  );
  const waiting = mine.filter(
    (row) =>
      !doctoral.results.some((result) => result.registrationId === row.id) &&
      !tickets.some((ticket) => ticket.registrationIds.includes(row.id)),
  );

  async function download(ticketId: string) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    setBusy(true);
    try {
      const photos = await ticketPhotos([ticket]);
      await downloadExamHallTickets(
        [
          {
            ticket,
            papers: ticketPapers(ticket, settings),
            photo: photos.get(ticket.id) ?? null,
          },
        ],
        settings,
        `hall-ticket-${ticket.ticketNo}.pdf`,
      );
    } catch {
      setNotice("Your hall ticket could not be prepared. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const reason = (status: string, hasCentre: boolean) =>
    status === "Returned"
      ? "Your fee receipt was returned by Accounts. Register again with a correct receipt."
      : status !== "Approved"
        ? "Waiting for Accounts to approve your course-work fee."
        : hasCentre
          ? "Your fee is approved. The research office will issue your hall ticket."
          : "Your fee is approved but no campus was chosen. Write to the research office.";

  return (
    <DeskPage kicker="Course work" title="Hall ticket">
      <ScholarIdentityHeader identifier={identifier} />
      {notice ? <p className="text-sm text-secondary">{notice}</p> : null}

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hall ticket issued yet.
        </p>
      ) : (
        tickets.map((ticket) => {
          const centre = centreOf(settings, ticket.centreId);
          const room = roomOf(centre, ticket.roomId);
          const papers = ticketPapers(ticket, settings);
          return (
            <DeskSection
              key={ticket.id}
              title={`Semester ${ticket.semester} · ${examBatchName(ticket.batchId)}`}
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="gold"
                  data-readonly-allow
                  disabled={busy}
                  onClick={() => void download(ticket.id)}
                >
                  Download hall ticket
                </Button>
              }
            >
              <div className="space-y-4 p-4 text-sm">
                <dl className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Hall ticket No.</dt>
                    <dd className="font-mono font-semibold text-primary">
                      {ticket.ticketNo}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Campus</dt>
                    <dd className="font-medium">{centre?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Room</dt>
                    <dd className="font-medium">{room?.name ?? "Shown at the campus"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Seat</dt>
                    <dd className="font-medium">
                      {ticket.seat || "Shown at the campus"}
                    </dd>
                  </div>
                </dl>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[32rem] border-collapse text-left">
                    <thead className="bg-muted text-primary">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Code</th>
                        <th className="px-3 py-2 font-semibold">Subject</th>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {papers.map((paper) => (
                        <tr key={paper.code} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{paper.code}</td>
                          <td className="px-3 py-2">{paper.name}</td>
                          <td className="px-3 py-2">
                            {paper.date ? formatIsoDate(paper.date) : "To be announced"}
                          </td>
                          <td className="px-3 py-2">{paper.time || "To be announced"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </DeskSection>
          );
        })
      )}

      {waiting.length > 0 ? (
        <DeskSection title="Papers without a hall ticket yet">
          <ul className="space-y-2 p-4 text-sm">
            {waiting.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-primary">
                  {row.code}
                </span>
                <span>{row.name}</span>
                <Badge variant="outline">Semester {row.semester}</Badge>
                <span className="text-muted-foreground">
                  {reason(
                    row.paymentStatus,
                    Boolean(row.examCentreId) || settings.centres.length === 0,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DeskSection>
      ) : null}
    </DeskPage>
  );
}
