"use client";

import { useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { currentDoctoral, promoteBulk, subscribeDoctoral } from "@/lib/doctoral";
import { planPromotion } from "@/lib/promotion";
import { useScholarReports } from "@/lib/use-report-sources";

/**
 * Promotion of every batch, done before the Reporting step opens so that the fresh batch
 * starts in semester 1. Scholars who have not cleared their course work or paid the fee stay
 * in the same semester (the office can promote one anyway). From semester 2 onwards promotion
 * is done manually under Promote a semester.
 */
export function PromotionPanel({
  promotedOn,
  onPromoted,
}: {
  promotedOn: string;
  onPromoted: () => Promise<unknown>;
}) {
  const data = useScholarReports();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [anyway, setAnyway] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (promotedOn) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <Badge variant="gold">Batches promoted · {formatIsoDate(promotedOn)}</Badge>
        <span className="text-muted-foreground">
          The fresh batch starts in semester 1. From semester 2 onwards, promote under
          Promote a semester.
        </span>
      </div>
    );
  }
  if (!data.ready || !doctoral) {
    return (
      <p className="text-sm text-muted-foreground">Loading the scholars to promote…</p>
    );
  }

  const lines = planPromotion(data.reports, doctoral);
  const holdsOf = (identifier: string) => anyway.includes(identifier);
  const moving = lines.filter(
    (line) => line.holds.length === 0 || holdsOf(line.identifier),
  );
  const held = lines.filter((line) => line.holds.length > 0 && !holdsOf(line.identifier));
  const optional = lines.filter((line) => line.holds.length > 0);

  async function promote() {
    setBusy(true);
    setNotice(null);
    if (moving.length > 0) {
      const saved = await promoteBulk(
        moving.map((line) => ({
          identifier: line.identifier,
          name: line.name,
          batchId: line.batchId,
          to: line.to,
        })),
      );
      if (!saved.ok) {
        setBusy(false);
        setNotice(saved.message);
        return;
      }
    }
    await onPromoted();
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-primary">
          Promote all batches before Reporting opens
        </h3>
        <Badge variant="maroon">Not done yet</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Every scholar moves up one semester so that the fresh batch starts in semester 1.
        A scholar stays in the same semester while any of these holds: course work not
        cleared (in semesters 1 and 2), a six-month report not approved, the Research
        Advisory Committee not constituted, the first Doctoral Committee meeting not done,
        a supervisor exit pending (or the scholar on the passed-out list), or the annual
        fee pending. Tick <strong>Promote anyway</strong> to move one of them up, for
        example to exempt the fee in a particular case.
      </p>
      {notice ? (
        <p role="alert" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <p className="text-sm font-medium text-primary">
        {moving.length} scholar(s) will move up · {held.length} will stay in the same
        semester
      </p>
      {optional.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-2 font-semibold">Scholar</th>
                <th className="px-3 py-2 font-semibold">Batch · semester</th>
                <th className="px-3 py-2 font-semibold">Stays because</th>
                <th className="px-3 py-2 font-semibold">Promote anyway</th>
              </tr>
            </thead>
            <tbody>
              {optional.map((line) => (
                <tr key={line.identifier} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-primary">{line.name}</td>
                  <td className="px-3 py-2">
                    {line.batchName || "—"} · Semester {line.from}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {line.holds.join("; ")}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={holdsOf(line.identifier)}
                      aria-label={`Promote ${line.name} anyway`}
                      onChange={(event) =>
                        setAnyway((current) =>
                          event.target.checked
                            ? [...current, line.identifier]
                            : current.filter((item) => item !== line.identifier),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Button type="button" variant="gold" disabled={busy} onClick={() => void promote()}>
        {busy
          ? "Promoting…"
          : moving.length > 0
            ? `Promote ${moving.length} scholar(s)`
            : "No scholar to promote · continue"}
      </Button>
    </div>
  );
}
