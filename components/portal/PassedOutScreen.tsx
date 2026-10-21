"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { DeskTabs, GateBanner, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, sameId, subscribeOffice } from "@/lib/office";
import {
  currentAllotments,
  currentPassedOut,
  restorePassedOut,
  savePassedOut,
  subscribeRegister,
} from "@/lib/register";
import { scholarRows } from "@/lib/supervision";
import { usePreviewSession } from "@/lib/use-preview-session";
import { syncAllottedVacancies } from "@/lib/vacancies";

type ReadyRow = {
  identifier: string;
  name: string;
  supervisorName: string;
  batchName: string;
  vivaOn: string;
};

export function PassedOutScreen() {
  const session = usePreviewSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const passedOut = useSyncExternalStore(
    subscribeRegister,
    currentPassedOut,
    currentPassedOut,
  );
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  const [tab, setTab] = useState<"ready" | "passed">("ready");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [guideFilter, setGuideFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const ready = useMemo<ReadyRow[]>(() => {
    if (!office || !doctoral) return [];
    const active = scholarRows(office.allocations, allotments);
    const passedVivas = doctoral.vivas.filter((item) => item.status === "Passed");
    return passedVivas.flatMap((viva) => {
      const row = active.find(
        (item) =>
          sameId(item.identifier, viva.scholarIdentifier) ||
          item.name.trim().toLowerCase() === viva.scholarName.trim().toLowerCase(),
      );
      if (!row) return [];
      return [
        {
          identifier: row.identifier,
          name: row.name,
          supervisorName: row.currentName,
          batchName: row.batchName,
          vivaOn: viva.scheduledOn,
        },
      ];
    });
    // passedOut changes which scholars are still active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allotments, doctoral, office, passedOut]);

  if (!office || !doctoral)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  const canAct =
    session?.role === "admin" || session?.role === "dean" || session?.role === "staff";
  const readyShown = ready.filter(
    (row) =>
      filterMatches(guideFilter, row.supervisorName) &&
      textMatches(query, [row.name, row.identifier, row.supervisorName, row.batchName]),
  );
  const passedShown = passedOut.filter(
    (row) =>
      filterMatches(guideFilter, row.supervisorName) &&
      filterMatches(yearFilter, row.movedOn.slice(0, 4)) &&
      textMatches(query, [row.name, row.key, row.supervisorName]),
  );

  async function move(rows: readonly ReadyRow[]) {
    if (rows.length === 0) return;
    setBusy(true);
    const saved = await savePassedOut(
      rows.map((row) => ({
        key: row.identifier,
        name: row.name,
        supervisorName: row.supervisorName,
        vivaOn: row.vivaOn,
        movedOn: clientToday(),
        movedBy: session ? session.name.trim() || session.identifier : "",
      })),
    );
    if (saved.ok) {
      await syncAllottedVacancies(
        office?.allocations ?? [],
        rows.map((row) => row.supervisorName),
      );
    }
    setBusy(false);
    setSelected([]);
    setNotice(
      saved.ok
        ? `${rows.length} scholar${rows.length === 1 ? "" : "s"} moved to passed out. Their supervisors' seats are free again.`
        : saved.message,
    );
  }

  async function restore(key: string, name: string, supervisorName: string) {
    if (!window.confirm(`Return ${name} to the active rolls?`)) return;
    setBusy(true);
    const saved = await restorePassedOut(key);
    if (saved.ok)
      await syncAllottedVacancies(office?.allocations ?? [], [supervisorName]);
    setBusy(false);
    setNotice(saved.ok ? `${name} is active again.` : saved.message);
  }

  const guides = [
    ...new Set([...ready, ...passedOut].map((row) => row.supervisorName).filter(Boolean)),
  ].sort();

  return (
    <section className="space-y-6">
      <PageTitle
        kicker="Registers"
        title="Passed-out scholars"
        actions={
          canAct && tab === "ready" ? (
            <Button
              type="button"
              variant="gold"
              disabled={busy || selected.length === 0}
              onClick={() =>
                void move(ready.filter((row) => selected.includes(row.identifier)))
              }
            >
              Move selected to passed out
              {selected.length ? ` (${selected.length})` : ""}
            </Button>
          ) : null
        }
      />
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskTabs
        tabs={[
          { id: "ready", label: `Viva passed · to move (${ready.length})` },
          { id: "passed", label: `Passed out (${passedOut.length})` },
        ]}
        value={tab}
        onChange={(id) => {
          setTab(id as "ready" | "passed");
          setSelected([]);
        }}
      />
      {tab === "ready" ? (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "guide",
                label: "Supervisor",
                value: guideFilter,
                options: guides.map((value) => ({ value, label: value })),
                onChange: setGuideFilter,
              },
            ]}
            shown={readyShown.length}
            total={ready.length}
            filename="viva-passed-scholars.csv"
            title="Scholars who passed the viva"
            headers={["Scholar", "Sign-in", "Batch", "Supervisor", "Viva on"]}
            rows={readyShown.map((row) => [
              row.name,
              row.identifier,
              row.batchName,
              row.supervisorName,
              row.vivaOn,
            ])}
          />
          {ready.length === 0 ? (
            <GateBanner>
              No scholar is waiting. Scholars appear here once their viva is recorded as
              passed.
            </GateBanner>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-muted text-primary">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={
                          readyShown.length > 0 &&
                          readyShown.every((row) => selected.includes(row.identifier))
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? readyShown.map((row) => row.identifier)
                              : [],
                          )
                        }
                      />
                    </th>
                    <th className="px-4 py-3">Scholar</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Supervisor</th>
                    <th className="px-4 py-3">Viva on</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {readyShown.map((row) => (
                    <tr key={row.identifier} className="border-t border-border">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selected.includes(row.identifier)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, row.identifier]
                                : current.filter((item) => item !== row.identifier),
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary">{row.name}</p>
                        <p className="text-muted-foreground">{row.identifier}</p>
                      </td>
                      <td className="px-4 py-3">{row.batchName || "—"}</td>
                      <td className="px-4 py-3">{row.supervisorName || "—"}</td>
                      <td className="px-4 py-3">{formatIsoDate(row.vivaOn)}</td>
                      <td className="px-4 py-3 text-right">
                        {canAct ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void move([row])}
                          >
                            Move to passed out
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "guide",
                label: "Supervisor",
                value: guideFilter,
                options: guides.map((value) => ({ value, label: value })),
                onChange: setGuideFilter,
              },
              {
                id: "year",
                label: "Year",
                value: yearFilter,
                options: [...new Set(passedOut.map((row) => row.movedOn.slice(0, 4)))]
                  .filter(Boolean)
                  .sort()
                  .reverse()
                  .map((value) => ({ value, label: value })),
                onChange: setYearFilter,
              },
            ]}
            shown={passedShown.length}
            total={passedOut.length}
            filename="passed-out-scholars.csv"
            title="Passed-out scholars"
            headers={[
              "Scholar",
              "Sign-in",
              "Supervisor",
              "Viva on",
              "Moved on",
              "Moved by",
            ]}
            rows={passedShown.map((row) => [
              row.name,
              row.key,
              row.supervisorName,
              row.vivaOn,
              row.movedOn,
              row.movedBy,
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-4 py-3">Scholar</th>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Viva on</th>
                  <th className="px-4 py-3">Moved on</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {passedShown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No passed-out scholars yet.
                    </td>
                  </tr>
                ) : (
                  passedShown.map((row) => (
                    <tr key={row.key} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary">{row.name}</p>
                        <p className="text-muted-foreground">{row.key}</p>
                      </td>
                      <td className="px-4 py-3">{row.supervisorName || "—"}</td>
                      <td className="px-4 py-3">{formatIsoDate(row.vivaOn)}</td>
                      <td className="px-4 py-3">
                        {formatIsoDate(row.movedOn)}
                        {row.movedBy ? ` · ${row.movedBy}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {session?.role === "admin" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void restore(row.key, row.name, row.supervisorName)
                            }
                          >
                            Return to active
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
