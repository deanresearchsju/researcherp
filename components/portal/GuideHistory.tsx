"use client";

import { useEffect, useState } from "react";

import { DeskSection } from "@/components/portal/Desk";
import { Input } from "@/components/ui/input";
import { formatMoment } from "@/lib/approval-flow";
import { loadGuideHistory, type GuideChange } from "@/lib/guide-history";
import { usePortalSession } from "@/lib/use-preview-session";

/**
 * Every allotment, change and transfer of a scholar's guide, newest first. Only the
 * administrator and the Dean see it; the supervisor and the scholar do not.
 */
export function GuideHistory({ version }: { version: string }) {
  const session = usePortalSession();
  const allowed = session?.role === "admin" || session?.role === "dean";
  const [changes, setChanges] = useState<GuideChange[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    void loadGuideHistory().then((found) => {
      if (live) setChanges(found);
    });
    return () => {
      live = false;
    };
  }, [allowed, version]);

  if (!allowed) return null;
  const needle = query.trim().toLowerCase();
  const shown = (changes ?? []).filter(
    (item) =>
      !needle ||
      [item.scholarName, item.scholarIdentifier, item.fromName, item.toName, item.by]
        .join(" ")
        .toLowerCase()
        .includes(needle),
  );

  return (
    <div className="mt-8">
      <DeskSection title="Guide history">
        <div className="space-y-3 p-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search scholar or supervisor"
            aria-label="Search the guide history"
            className="max-w-sm"
          />
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date and time</th>
                  <th className="px-3 py-2 font-semibold">Scholar</th>
                  <th className="px-3 py-2 font-semibold">Change</th>
                  <th className="px-3 py-2 font-semibold">From</th>
                  <th className="px-3 py-2 font-semibold">To</th>
                  <th className="px-3 py-2 font-semibold">Done by</th>
                </tr>
              </thead>
              <tbody>
                {changes === null ? (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                      No change of guide recorded yet.
                    </td>
                  </tr>
                ) : (
                  shown.map((item) => (
                    <tr key={item.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatMoment(item.on)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-primary">{item.scholarName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.scholarIdentifier}
                        </p>
                      </td>
                      <td className="px-3 py-2">{item.kind}</td>
                      <td className="px-3 py-2">{item.fromName || "—"}</td>
                      <td className="px-3 py-2">{item.toName || "—"}</td>
                      <td className="px-3 py-2">{item.by || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DeskSection>
    </div>
  );
}
