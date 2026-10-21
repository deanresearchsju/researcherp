"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { DeskTabs, FormDialog, GateBanner, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentOffice, saveAllocation, subscribeOffice } from "@/lib/office";
import {
  currentAllotments,
  currentExits,
  currentPassedOut,
  currentQuotas,
  currentStandings,
  removeSupervisorExit,
  sameGuide,
  saveStandingByKeys,
  saveSupervisorExit,
  subscribeRegister,
  type SupervisorExit,
} from "@/lib/register";
import {
  guideOptions,
  scholarRows,
  scholarsWith,
  transferTargets,
  type GuideOption,
  type ScholarRow,
} from "@/lib/supervision";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { usePreviewSession } from "@/lib/use-preview-session";
import { closeSupervisorVacancy, syncAllottedVacancies } from "@/lib/vacancies";

const reasons = ["Resignation", "Retirement", "Other"] as const;

function guideForExit(guides: readonly GuideOption[], exit: SupervisorExit) {
  return (
    guides.find(
      (guide) =>
        guide.keys.some((key) => key.trim().toLowerCase() === exit.key.toLowerCase()) ||
        sameGuide(guide.name, exit.name),
    ) ?? null
  );
}

function StartExitDialog({
  guides,
  onClose,
  onDone,
}: {
  guides: readonly GuideOption[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [guideId, setGuideId] = useState("");
  const [reason, setReason] = useState<(typeof reasons)[number]>("Resignation");
  const [lastDay, setLastDay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = guides.filter((guide) => guide.status === "Active");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guide = active.find((item) => item.id === guideId);
    if (!guide) {
      setError("Select the supervisor.");
      return;
    }
    if (!lastDay) {
      setError("Enter the last working day.");
      return;
    }
    setBusy(true);
    const saved = await saveSupervisorExit({
      key: guide.keys[0] ?? guide.name,
      name: guide.name,
      reason,
      lastDay,
      startedOn: clientToday(),
      completedOn: "",
    });
    if (saved.ok) await closeSupervisorVacancy(guide.name, false);
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onDone(`${guide.name} is marked as leaving. Transfer the scholars next.`);
  }

  return (
    <FormDialog
      title="Supervisor leaving"
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Start"
      size="sm"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <FormField label="Supervisor" htmlFor="exit-guide" required>
        <NativeSelect
          id="exit-guide"
          value={guideId}
          onChange={(event) => setGuideId(event.target.value)}
        >
          <option value="">Select</option>
          {active.map((guide) => (
            <option key={guide.id} value={guide.id}>
              {guide.name}
              {guide.subject ? ` · ${guide.subject}` : ""}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Reason" htmlFor="exit-reason" required>
        <NativeSelect
          id="exit-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as (typeof reasons)[number])}
        >
          {reasons.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Last working day" htmlFor="exit-last" required>
        <Input
          id="exit-last"
          type="date"
          value={lastDay}
          onChange={(event) => setLastDay(event.target.value)}
        />
      </FormField>
    </FormDialog>
  );
}

function LeavingCard({
  exit,
  guide,
  guides,
  scholars,
  onNotice,
}: {
  exit: SupervisorExit;
  guide: GuideOption | null;
  guides: readonly GuideOption[];
  scholars: readonly ScholarRow[];
  onNotice: (message: string) => void;
}) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const leaving: GuideOption = guide ?? {
    id: exit.key,
    identifier: exit.key,
    name: exit.name,
    subject: "",
    designation: "",
    keys: [exit.key, exit.name],
    vacancy: 0,
    status: "Leaving",
  };

  function targetsFor(row: ScholarRow) {
    return transferTargets(guides, leaving, row.subject);
  }

  function chosenFor(row: ScholarRow) {
    return choice[row.identifier] ?? targetsFor(row)[0]?.guide.identifier ?? "";
  }

  async function move(rowsToMove: readonly ScholarRow[]) {
    setBusy(true);
    let moved = 0;
    for (const row of rowsToMove) {
      const target = guides.find((item) => item.identifier === chosenFor(row));
      if (!target) {
        setBusy(false);
        onNotice(`Choose a supervisor for ${row.name}.`);
        return;
      }
      const saved = await saveAllocation({
        scholarIdentifier: row.identifier,
        scholarName: row.name,
        supervisorIdentifier: target.identifier,
        supervisorName: target.name,
      });
      if (!saved.ok) {
        setBusy(false);
        onNotice(moved ? `${moved} moved. ${saved.message}` : saved.message);
        return;
      }
      moved += 1;
    }
    setBusy(false);
    onNotice(`${moved} scholar${moved === 1 ? "" : "s"} transferred from ${exit.name}.`);
  }

  async function complete() {
    if (scholars.length > 0) {
      onNotice(
        "Transfer every scholar before moving the supervisor to past supervisors.",
      );
      return;
    }
    setBusy(true);
    const saved = await saveSupervisorExit({ ...exit, completedOn: clientToday() });
    if (saved.ok) {
      await saveStandingByKeys(leaving.keys, false, "Resigned");
      await closeSupervisorVacancy(exit.name, true);
    }
    setBusy(false);
    onNotice(saved.ok ? `${exit.name} is moved to past supervisors.` : saved.message);
  }

  async function cancel() {
    if (
      !window.confirm(`Cancel the exit for ${exit.name}? They stay an active supervisor.`)
    ) {
      return;
    }
    setBusy(true);
    const saved = await removeSupervisorExit(exit.key);
    if (saved.ok) {
      await syncAllottedVacancies(currentOffice()?.allocations ?? [], [exit.name]);
    }
    setBusy(false);
    onNotice(saved.ok ? `${exit.name} stays active.` : saved.message);
  }

  return (
    <article className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
            {exit.reason} · last day {formatIsoDate(exit.lastDay)}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-primary">{exit.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[leaving.designation, leaving.subject].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Badge variant={scholars.length ? "maroon" : "gold"}>
          {scholars.length
            ? `${scholars.length} scholar${scholars.length === 1 ? "" : "s"} to transfer`
            : "All transferred"}
        </Badge>
      </div>

      {scholars.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-2">Scholar</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Transfer to</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {scholars.map((row) => {
                const targets = targetsFor(row);
                return (
                  <tr key={row.identifier} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-primary">{row.name}</p>
                      <p className="text-muted-foreground">{row.registration}</p>
                    </td>
                    <td className="px-3 py-2">{row.subject || "—"}</td>
                    <td className="px-3 py-2">
                      <NativeSelect
                        aria-label={`New supervisor for ${row.name}`}
                        value={chosenFor(row)}
                        onChange={(event) =>
                          setChoice((current) => ({
                            ...current,
                            [row.identifier]: event.target.value,
                          }))
                        }
                      >
                        {targets.length === 0 ? (
                          <option value="">No supervisor with a vacancy</option>
                        ) : null}
                        {targets.map(({ guide: target, match }) => (
                          <option key={target.id} value={target.identifier}>
                            {match ? "★ " : ""}
                            {target.name}
                            {target.subject ? ` · ${target.subject}` : ""}
                            {target.vacancy === null
                              ? ""
                              : ` · vacancy ${target.vacancy}`}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || targets.length === 0}
                        onClick={() => void move([row])}
                      >
                        Transfer
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            ★ same subject. Only active supervisors with a free seat are offered.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void cancel()}
        >
          Cancel exit
        </Button>
        {scholars.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void move(scholars)}
          >
            Transfer all as chosen
          </Button>
        ) : null}
        <Button
          type="button"
          variant="gold"
          size="sm"
          disabled={busy || scholars.length > 0}
          onClick={() => void complete()}
        >
          Move to past supervisors
        </Button>
      </div>
    </article>
  );
}

export function SupervisorExitScreen() {
  const session = usePreviewSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const standings = useSyncExternalStore(
    subscribeRegister,
    currentStandings,
    currentStandings,
  );
  const exits = useSyncExternalStore(subscribeRegister, currentExits, currentExits);
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  useSyncExternalStore(subscribeRegister, currentPassedOut, currentPassedOut);
  const [tab, setTab] = useState<"leaving" | "past">("leaving");
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  const guides = useMemo(
    () =>
      office && users
        ? guideOptions(office.allocations, users.users, quotas, standings)
        : [],
    // exits change each guide's status, so they belong in the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [office, quotas, standings, users, exits],
  );
  const rows = useMemo(
    () => (office ? scholarRows(office.allocations, allotments) : []),
    [allotments, office],
  );

  if (!office || !users) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const open = exits.filter((item) => !item.completedOn);
  const past = exits
    .filter((item) => item.completedOn)
    .filter(
      (item) =>
        filterMatches(reasonFilter, item.reason) &&
        textMatches(query, [item.name, item.reason]),
    );
  const canAct =
    session?.role === "admin" || session?.role === "dean" || session?.role === "staff";

  return (
    <section className="space-y-6">
      <PageTitle
        kicker="Supervision"
        title="Supervisor exit"
        actions={
          canAct ? (
            <Button
              type="button"
              variant="gold"
              onClick={() => {
                setNotice(null);
                setStarting(true);
              }}
            >
              Supervisor leaving
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
          { id: "leaving", label: `Leaving (${open.length})` },
          { id: "past", label: `Past supervisors (${exits.length - open.length})` },
        ]}
        value={tab}
        onChange={(id) => setTab(id as "leaving" | "past")}
      />
      {tab === "leaving" ? (
        open.length === 0 ? (
          <GateBanner>No supervisor is leaving at present.</GateBanner>
        ) : (
          <div className="space-y-4">
            {open.map((exit) => {
              const guide = guideForExit(guides, exit);
              const theirs = guide
                ? scholarsWith(rows, guide)
                : rows.filter((row) => sameGuide(row.currentName, exit.name));
              return (
                <LeavingCard
                  key={exit.key}
                  exit={exit}
                  guide={guide}
                  guides={guides}
                  scholars={theirs}
                  onNotice={setNotice}
                />
              );
            })}
          </div>
        )
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "reason",
                label: "Reason",
                value: reasonFilter,
                options: reasons.map((item) => ({ value: item, label: item })),
                onChange: setReasonFilter,
              },
            ]}
            shown={past.length}
            total={exits.length - open.length}
            filename="past-supervisors.csv"
            title="Past supervisors"
            headers={[
              "Supervisor",
              "Reason",
              "Last working day",
              "Exit started",
              "Moved to past",
            ]}
            rows={past.map((item) => [
              item.name,
              item.reason,
              formatIsoDate(item.lastDay),
              formatIsoDate(item.startedOn),
              formatIsoDate(item.completedOn),
            ])}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Last working day</th>
                  <th className="px-4 py-3">Moved to past</th>
                </tr>
              </thead>
              <tbody>
                {past.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No past supervisors yet.
                    </td>
                  </tr>
                ) : (
                  past.map((item) => (
                    <tr key={item.key} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold text-primary">
                        {item.name}
                      </td>
                      <td className="px-4 py-3">{item.reason}</td>
                      <td className="px-4 py-3">{formatIsoDate(item.lastDay)}</td>
                      <td className="px-4 py-3">{formatIsoDate(item.completedOn)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {starting ? (
        <StartExitDialog
          guides={guides}
          onClose={() => setStarting(false)}
          onDone={(message) => {
            setStarting(false);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
