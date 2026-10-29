"use client";

import { CalendarDays, Clock, MapPin, MonitorSmartphone } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskModal, DeskTabs, FormDialog, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { colloquiumSittings } from "@/data/doctoral";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  attendanceKey,
  colloquiumMarked,
  colloquiumModes,
  currentDoctoral,
  markColloquiumAttendance,
  saveColloquiumEvent,
  subscribeDoctoral,
  type Colloquium,
  type ColloquiumEventInput,
  type ColloquiumMark,
} from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import { sameGuide } from "@/lib/register";
import {
  batchNames,
  colloquiumRule,
  colloquiumRuleText,
  supervisorColloquium,
  type ScholarReport,
} from "@/lib/scholar-report";
import type { GuideOption } from "@/lib/supervision";
import { useScholarReports } from "@/lib/use-report-sources";
import { usePortalSession } from "@/lib/use-preview-session";
import { cn } from "@/lib/utils";
import {
  MarkButtons,
  markSummary,
  type Mark,
} from "@/components/portal/AttendanceControls";

type Tab = "events" | "scholars" | "supervisors" | "batches";

function eventState(item: Colloquium, today: string) {
  if (colloquiumMarked(item)) return { label: "Completed", tone: "gold" as const };
  if (item.date && item.date > today)
    return { label: "Upcoming", tone: "purple" as const };
  return { label: "Attendance pending", tone: "maroon" as const };
}

function counts(item: Colloquium, role: "scholar" | "supervisor") {
  const people = role === "scholar" ? item.scholars : item.supervisors;
  const marks = people.map(
    (person) => item.attendance[attendanceKey(role, person.identifier)],
  );
  return {
    present: marks.filter((mark) => mark === "Present").length,
    absent: marks.filter((mark) => mark === "Absent").length,
    total: people.length,
  };
}

function RuleBanner({ blink = false }: { blink?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 size-2.5 shrink-0 rounded-full bg-secondary",
          blink && "notice-blink",
        )}
      />
      <p className={cn("font-semibold", blink && "notice-blink")}>{colloquiumRuleText}</p>
    </div>
  );
}

function EventFacts({ item }: { item: Colloquium }) {
  const facts: [ReactNode, string][] = [
    [
      <CalendarDays key="d" className="size-3.5" />,
      item.date ? formatIsoDate(item.date) : "Date to be announced",
    ],
    [<Clock key="t" className="size-3.5" />, item.time || "—"],
    [<MapPin key="v" className="size-3.5" />, item.venue || "Venue to be announced"],
    [<MonitorSmartphone key="m" className="size-3.5" />, item.mode],
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {facts.map(([icon, text], index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {icon}
          {text}
        </span>
      ))}
    </div>
  );
}

export function ColloquiumScreen({ mode }: { mode: "admin" | "scholar" | "supervisor" }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const data = useScholarReports();

  if (!ready || !doctoral || !data.ready) {
    return <p className="text-sm text-muted-foreground">Loading colloquia…</p>;
  }
  if (mode === "admin") {
    return (
      <OfficeColloquium
        colloquia={doctoral.colloquia}
        reports={data.reports}
        guides={data.guides}
      />
    );
  }
  if (mode === "scholar") {
    return (
      <ScholarColloquium
        colloquia={doctoral.colloquia}
        report={
          data.reports.find(
            (row) => session && sameId(row.identifier, session.identifier),
          ) ?? null
        }
        identifier={session?.identifier ?? ""}
      />
    );
  }
  return (
    <SupervisorColloquium
      colloquia={doctoral.colloquia}
      reports={data.reports}
      guides={data.guides}
      identifier={session?.identifier ?? ""}
      name={session?.name ?? ""}
    />
  );
}

/* ---------------- scholar ---------------- */

function ScholarColloquium({
  colloquia,
  report,
  identifier,
}: {
  colloquia: readonly Colloquium[];
  report: ScholarReport | null;
  identifier: string;
}) {
  const today = clientToday();
  const mine = colloquia.filter((item) =>
    item.scholars.some((person) => sameId(person.identifier, identifier)),
  );
  const standing = report?.colloquium;
  const key = attendanceKey("scholar", identifier);
  return (
    <section className="space-y-5">
      <PageTitle kicker="Doctoral progress" title="Colloquium" />
      <RuleBanner blink />
      {standing ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-[0.65rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Your attendance · {report.mode}
          </p>
          <p className="mt-1 text-3xl font-semibold text-primary">
            {standing.attended}
            <span className="text-base font-medium text-muted-foreground"> attended</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Absent {standing.absent} · Upcoming {standing.upcoming}
            {standing.earlier > 0 ? ` · ${standing.earlier} recorded before the ERP` : ""}
          </p>
        </div>
      ) : null}
      <ul className="space-y-3">
        {mine.map((item) => {
          const mark = item.attendance[key];
          return (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-primary">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.sitting} {item.year} sitting
                  </p>
                </div>
                {colloquiumMarked(item) && mark ? (
                  <Badge variant={mark === "Present" ? "gold" : "maroon"}>{mark}</Badge>
                ) : (
                  <Badge variant={eventState(item, today).tone}>
                    {eventState(item, today).label}
                  </Badge>
                )}
              </div>
              <EventFacts item={item} />
              {item.details ? <p className="mt-2 text-sm">{item.details}</p> : null}
            </li>
          );
        })}
      </ul>
      {mine.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No colloquium has been scheduled for you yet.
        </p>
      ) : null}
    </section>
  );
}

/* ---------------- supervisor ---------------- */

function guideFor(guides: readonly GuideOption[], identifier: string, name: string) {
  return (
    guides.find(
      (guide) =>
        guide.keys.some((key) => key.trim() && sameId(key, identifier)) ||
        (name && sameGuide(guide.name, name)),
    ) ?? null
  );
}

function scholarsOf(
  reports: readonly ScholarReport[],
  keys: readonly string[],
  name: string,
) {
  return reports.filter(
    (row) =>
      keys.some((key) => key.trim() && sameId(row.guideIdentifier, key)) ||
      (name && sameGuide(row.guideName, name)),
  );
}

function SupervisorColloquium({
  colloquia,
  reports,
  guides,
  identifier,
  name,
}: {
  colloquia: readonly Colloquium[];
  reports: readonly ScholarReport[];
  guides: readonly GuideOption[];
  identifier: string;
  name: string;
}) {
  const today = clientToday();
  const guide = guideFor(guides, identifier, name);
  const keys = guide ? [...guide.keys, identifier] : [identifier];
  const guideName = guide?.name ?? name;
  const own = supervisorColloquium(colloquia, keys);
  const scholars = scholarsOf(reports, keys, guideName);
  const invited = colloquia.filter((item) =>
    item.supervisors.some((person) =>
      keys.some((key) => key.trim() && sameId(person.identifier, key)),
    ),
  );
  return (
    <section className="space-y-5">
      <PageTitle kicker="Supervision" title="Colloquium" />
      <RuleBanner />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Your attendance", `${own.present} of ${own.present + own.absent}`],
          ["Your scholars", String(scholars.length)],
          [
            "Colloquia attended by your scholars",
            String(scholars.reduce((sum, row) => sum + row.colloquium.attended, 0)),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>
      <h2 className="font-semibold text-primary">Your scholars</h2>
      <ScholarAttendanceTable
        rows={scholars}
        colloquia={colloquia}
        filename="my-scholars-colloquium.csv"
      />
      <h2 className="font-semibold text-primary">Colloquia</h2>
      <ul className="space-y-3">
        {invited.map((item) => {
          const person = item.supervisors.find((entry) =>
            keys.some((key) => key.trim() && sameId(entry.identifier, key)),
          );
          const mark = person
            ? item.attendance[attendanceKey("supervisor", person.identifier)]
            : undefined;
          return (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-primary">{item.name}</p>
                {colloquiumMarked(item) && mark ? (
                  <Badge variant={mark === "Present" ? "gold" : "maroon"}>
                    You: {mark}
                  </Badge>
                ) : (
                  <Badge variant={eventState(item, today).tone}>
                    {eventState(item, today).label}
                  </Badge>
                )}
              </div>
              <EventFacts item={item} />
            </li>
          );
        })}
      </ul>
      {invited.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No colloquium has been scheduled yet.
        </p>
      ) : null}
    </section>
  );
}

/* ---------------- shared scholar table ---------------- */

function ScholarAttendanceTable({
  rows,
  colloquia,
  filename,
  extraFilters = true,
}: {
  rows: readonly ScholarReport[];
  colloquia: readonly Colloquium[];
  filename: string;
  extraFilters?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("");
  const [guide, setGuide] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [department, setDepartment] = useState("");
  const [campus, setCampus] = useState("");
  const held = colloquia.filter(colloquiumMarked);
  const visible = rows.filter(
    (row) =>
      textMatches(query, [row.name, row.registration, row.guideName, row.subject]) &&
      filterMatches(batch, row.batchName) &&
      filterMatches(guide, row.guideName) &&
      filterMatches(modeFilter, row.mode) &&
      filterMatches(department, row.department) &&
      filterMatches(campus, row.campus),
  );
  const option = (values: readonly string[]) =>
    [...new Set(values.filter(Boolean))].map((value) => ({ value, label: value }));
  return (
    <div className="space-y-3">
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "batch",
            label: "Batch",
            value: batch,
            options: option(
              batchNames().filter((name) => rows.some((row) => row.batchName === name)),
            ),
            onChange: setBatch,
          },
          ...(extraFilters
            ? [
                {
                  id: "guide",
                  label: "Supervisor",
                  value: guide,
                  options: option(rows.map((row) => row.guideName).sort()),
                  onChange: setGuide,
                },
              ]
            : []),
          {
            id: "department",
            label: "Department",
            value: department,
            options: option(rows.map((row) => row.department).sort()),
            onChange: setDepartment,
          },
          {
            id: "campus",
            label: "Campus",
            value: campus,
            options: option(rows.map((row) => row.campus).sort()),
            onChange: setCampus,
          },
          {
            id: "mode",
            label: "Mode",
            value: modeFilter,
            options: option(["Full time", "Part time"]),
            onChange: setModeFilter,
          },
        ]}
        shown={visible.length}
        total={rows.length}
        filename={filename}
        title="Colloquium attendance · scholar-wise"
        headers={[
          "Scholar",
          "Registration No.",
          "Batch",
          "Department",
          "Campus",
          "Mode",
          "Supervisor",
          "Attended",
          "Absent",
          ...held.map((item) => item.name),
        ]}
        rows={visible.map((row) => [
          row.name,
          row.registration,
          row.batchName,
          row.department,
          row.campus,
          row.mode,
          row.guideName,
          String(row.colloquium.attended),
          String(row.colloquium.absent),
          ...held.map((item) => {
            const invited = item.scholars.some((person) =>
              sameId(person.identifier, row.identifier),
            );
            if (!invited) return "—";
            return item.attendance[attendanceKey("scholar", row.identifier)] === "Present"
              ? "P"
              : "A";
          }),
        ])}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              {[
                "Scholar",
                "Batch",
                "Department · campus",
                "Mode",
                "Supervisor",
                "Attended",
                "Absent",
              ].map(
                (header) => (
                  <th key={header} className="px-3 py-2.5 font-semibold">
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                  No scholar matches.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.identifier} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="font-medium text-primary">{row.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.registration}
                    </p>
                  </td>
                  <td className="px-3 py-2">{row.batchName || "—"}</td>
                  <td className="px-3 py-2">
                    {[row.department, row.campus].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2">{row.mode}</td>
                  <td className="px-3 py-2">{row.guideName || "—"}</td>
                  <td className="px-3 py-2 font-semibold">{row.colloquium.attended}</td>
                  <td className="px-3 py-2">{row.colloquium.absent}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- office ---------------- */

type EventDraft = Omit<ColloquiumEventInput, "scholars" | "supervisors"> & {
  batches: string[];
};

function OfficeColloquium({
  colloquia,
  reports,
  guides,
}: {
  colloquia: readonly Colloquium[];
  reports: readonly ScholarReport[];
  guides: readonly GuideOption[];
}) {
  const today = clientToday();
  const [tab, setTab] = useState<Tab>("events");
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Colloquium | "new" | null>(null);
  const [marking, setMarking] = useState<Colloquium | null>(null);
  const [viewing, setViewing] = useState<Colloquium | null>(null);
  const [query, setQuery] = useState("");
  const [sittingFilter, setSittingFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const events = colloquia
    .filter(
      (item) =>
        filterMatches(sittingFilter, item.sitting) &&
        filterMatches(yearFilter, item.year) &&
        textMatches(query, [item.name, item.venue, item.sitting, item.year]),
    )
    .slice()
    .sort((left, right) =>
      (right.date || right.issuedOn).localeCompare(left.date || left.issuedOn),
    );

  const supervisorRows = (() => {
    const names = [
      ...new Set(reports.map((row) => row.guideName).filter(Boolean)),
    ].sort();
    return names.map((name) => {
      const guide = guides.find((item) => sameGuide(item.name, name));
      const keys = guide ? guide.keys : [name];
      const own = supervisorColloquium(colloquia, [
        ...keys,
        ...reports
          .filter((row) => row.guideName === name)
          .map((row) => row.guideIdentifier),
      ]);
      const scholars = reports.filter((row) => row.guideName === name);
      return {
        name,
        subject: guide?.subject ?? "",
        own,
        scholars: scholars.length,
        names: scholars
          .map((row) => `${row.name} (${row.colloquium.attended})`)
          .join("; "),
      };
    });
  })();

  const batchRows = batchNames()
    .map((name) => {
      const rows = reports.filter((row) => row.batchName === name);
      return {
        name,
        scholars: rows.length,
        fullTime: rows.filter((row) => row.mode === "Full time").length,
        partTime: rows.filter((row) => row.mode === "Part time").length,
        average: rows.length
          ? (
              rows.reduce((sum, row) => sum + row.colloquium.attended, 0) / rows.length
            ).toFixed(1)
          : "0",
      };
    })
    .filter((row) => row.scholars > 0);

  return (
    <section className="space-y-5">
      <PageTitle
        kicker="Doctoral progress"
        title="Colloquium"
        actions={
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              setNotice(null);
              setEditing("new");
            }}
          >
            Create colloquium
          </Button>
        }
      />
      <RuleBanner />
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}
      <DeskTabs
        tabs={[
          { id: "events", label: `Events (${colloquia.length})` },
          { id: "scholars", label: "Scholar-wise" },
          { id: "supervisors", label: "Supervisor-wise" },
          { id: "batches", label: "Batch-wise" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === "events" ? (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "sitting",
                label: "Sitting",
                value: sittingFilter,
                options: colloquiumSittings.map((item) => ({ value: item, label: item })),
                onChange: setSittingFilter,
              },
              {
                id: "year",
                label: "Year",
                value: yearFilter,
                options: [...new Set(colloquia.map((item) => item.year))]
                  .filter(Boolean)
                  .sort()
                  .map((year) => ({ value: year, label: year })),
                onChange: setYearFilter,
              },
            ]}
            shown={events.length}
            total={colloquia.length}
            filename="colloquia.csv"
            title="Colloquium events"
            headers={[
              "Colloquium",
              "Sitting",
              "Date",
              "Time",
              "Venue",
              "Mode",
              "Scholars",
              "Present",
              "Absent",
              "Supervisors present",
              "Status",
            ]}
            rows={events.map((item) => {
              const scholars = counts(item, "scholar");
              const supervisors = counts(item, "supervisor");
              return [
                item.name,
                `${item.sitting} ${item.year}`,
                item.date ? formatIsoDate(item.date) : "",
                item.time,
                item.venue,
                item.mode,
                String(scholars.total),
                String(scholars.present),
                String(scholars.absent),
                `${supervisors.present} of ${supervisors.total}`,
                eventState(item, today).label,
              ];
            })}
          />
          <ul className="grid gap-3 lg:grid-cols-2">
            {events.map((item) => {
              const state = eventState(item, today);
              const scholars = counts(item, "scholar");
              const supervisors = counts(item, "supervisor");
              const canMark = !item.date || item.date <= today;
              return (
                <li
                  key={item.id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
                        {item.sitting} {item.year} sitting
                      </p>
                      <p className="mt-1 font-semibold text-primary">{item.name}</p>
                    </div>
                    <Badge variant={state.tone}>{state.label}</Badge>
                  </div>
                  <EventFacts item={item} />
                  <p className="mt-3 text-sm">
                    Scholars {scholars.total}
                    {colloquiumMarked(item)
                      ? ` · Present ${scholars.present} · Absent ${scholars.absent} · Supervisors ${supervisors.present}/${supervisors.total}`
                      : ` · Supervisors ${supervisors.total}`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={colloquiumMarked(item) ? "outline" : "gold"}
                      disabled={!canMark}
                      onClick={() => setMarking(item)}
                    >
                      {colloquiumMarked(item) ? "Correct attendance" : "Mark attendance"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-readonly-allow
                      onClick={() => setViewing(item)}
                    >
                      Attendance list
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(item)}
                    >
                      Edit details
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No colloquium is recorded yet.
            </p>
          ) : null}
        </>
      ) : null}

      {tab === "scholars" ? (
        <ScholarAttendanceTable
          rows={reports}
          colloquia={colloquia}
          filename="colloquium-scholar-wise.csv"
        />
      ) : null}

      {tab === "supervisors" ? (
        <SimpleReport
          title="Colloquium attendance · supervisor-wise"
          filename="colloquium-supervisor-wise.csv"
          headers={[
            "Supervisor",
            "Subject",
            "Own attendance",
            "Scholars",
            "Scholars (attended)",
          ]}
          rows={supervisorRows.map((row) => [
            row.name,
            row.subject,
            `${row.own.present} of ${row.own.present + row.own.absent}`,
            String(row.scholars),
            row.names,
          ])}
          shownColumns={5}
        />
      ) : null}

      {tab === "batches" ? (
        <SimpleReport
          title="Colloquium attendance · batch-wise"
          filename="colloquium-batch-wise.csv"
          headers={["Batch", "Scholars", "Full time", "Part time", "Average attended"]}
          rows={batchRows.map((row) => [
            row.name,
            String(row.scholars),
            String(row.fullTime),
            String(row.partTime),
            row.average,
          ])}
        />
      ) : null}

      {editing ? (
        <EventDialog
          event={editing === "new" ? null : editing}
          reports={reports}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setNotice(message);
            setEditing(null);
          }}
        />
      ) : null}
      {marking ? (
        <AttendanceDialog
          event={marking}
          onClose={() => setMarking(null)}
          onSaved={(message) => {
            setNotice(message);
            setMarking(null);
          }}
        />
      ) : null}
      {viewing ? (
        <DeskModal
          title={`Attendance · ${viewing.name}`}
          size="lg"
          onClose={() => setViewing(null)}
        >
          <SimpleReport
            title={`Colloquium attendance · ${viewing.name}${viewing.date ? ` · ${formatIsoDate(viewing.date)}` : ""}`}
            filename={`colloquium-${viewing.year}-${viewing.sitting}.csv`}
            headers={["Role", "Name", "Attendance"]}
            rows={[
              ...viewing.scholars.map((person) => [
                "Scholar",
                person.name,
                viewing.attendance[attendanceKey("scholar", person.identifier)] ??
                  "Not marked",
              ]),
              ...viewing.supervisors.map((person) => [
                "Supervisor",
                person.name,
                viewing.attendance[attendanceKey("supervisor", person.identifier)] ??
                  "Not marked",
              ]),
            ]}
          />
        </DeskModal>
      ) : null}
    </section>
  );
}

/** A searchable, exportable table for summary rows. */
export function SimpleReport({
  title,
  filename,
  headers,
  rows,
  shownColumns,
}: {
  title: string;
  filename: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Columns shown on screen; the export always has every column. */
  shownColumns?: number;
}) {
  const [query, setQuery] = useState("");
  const visible = rows.filter((row) => textMatches(query, row));
  const columns = shownColumns ?? headers.length;
  return (
    <div className="space-y-3">
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={visible.length}
        total={rows.length}
        filename={filename}
        title={title}
        headers={headers}
        rows={visible}
      />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              {headers.slice(0, columns).map((header) => (
                <th key={header} className="px-3 py-2.5 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns} className="px-3 py-4 text-muted-foreground">
                  Nothing to show.
                </td>
              </tr>
            ) : (
              visible.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {row.slice(0, columns).map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-3 py-2",
                        cellIndex === 0 && "font-medium text-primary",
                      )}
                    >
                      {cell || "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventDialog({
  event,
  reports,
  onClose,
  onSaved,
}: {
  event: Colloquium | null;
  reports: readonly ScholarReport[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const batches = batchNames().filter((name) =>
    reports.some((row) => row.batchName === name),
  );
  const [draft, setDraft] = useState<EventDraft>({
    name: event?.name ?? "",
    sitting: event?.sitting ?? "May",
    year: event?.year ?? clientToday().slice(0, 4),
    date: event?.date ?? "",
    time: event?.time ?? "10:00",
    venue: event?.venue ?? "",
    mode: event?.mode ?? "Offline",
    details: event?.details ?? "",
    batches,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const marked = event ? colloquiumMarked(event) : false;
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const invited = reports.filter(
    (row) =>
      draft.batches.includes(row.batchName) ||
      (!row.batchName && draft.batches.length === batches.length),
  );

  return (
    <FormDialog
      title={event ? `Edit · ${event.name}` : "Create colloquium"}
      submitLabel={event ? "Save details" : "Create & notify scholars"}
      busy={busy}
      size="lg"
      onClose={onClose}
      onSubmit={(submit) => {
        submit.preventDefault();
        if (draft.name.trim().length < 3)
          return setError("Enter the name or theme of the colloquium.");
        if (!/^20\d{2}$/.test(draft.year))
          return setError("Enter the year, such as 2026.");
        if (!draft.date) return setError("Choose the date of the colloquium.");
        if (draft.venue.trim().length < 2)
          return setError("Enter the venue or the meeting link.");
        if (!marked && invited.length === 0)
          return setError("Choose at least one batch.");
        const scholars = invited.map((row) => ({
          identifier: row.identifier,
          name: row.name,
        }));
        const supervisors = [
          ...new Map(
            invited
              .filter((row) => row.guideName)
              .map((row) => [
                row.guideName.toLowerCase(),
                { identifier: row.guideIdentifier || row.guideName, name: row.guideName },
              ]),
          ).values(),
        ];
        setBusy(true);
        void saveColloquiumEvent(
          {
            name: draft.name.trim(),
            sitting: draft.sitting,
            year: draft.year,
            date: draft.date,
            time: draft.time,
            venue: draft.venue.trim(),
            mode: draft.mode,
            details: draft.details.trim(),
            scholars,
            supervisors,
          },
          event?.id,
        ).then((saved) => {
          setBusy(false);
          if (!saved.ok) return setError(saved.message);
          onSaved(
            event
              ? "Colloquium details saved."
              : `Colloquium created for ${scholars.length} scholars and ${supervisors.length} supervisors. It now shows in their portal.`,
          );
        });
      }}
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="grid gap-1 sm:col-span-2">
          <span className="font-semibold text-primary">Name / theme</span>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Sitting</span>
          <NativeSelect
            value={draft.sitting}
            onChange={(e) => set("sitting", e.target.value as EventDraft["sitting"])}
          >
            {colloquiumSittings.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Year</span>
          <Input
            inputMode="numeric"
            maxLength={4}
            value={draft.year}
            onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Date</span>
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Time</span>
          <Input
            type="time"
            value={draft.time}
            onChange={(e) => set("time", e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Venue / link</span>
          <Input value={draft.venue} onChange={(e) => set("venue", e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold text-primary">Mode</span>
          <NativeSelect
            value={draft.mode}
            onChange={(e) => set("mode", e.target.value as EventDraft["mode"])}
          >
            {colloquiumModes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 sm:col-span-2">
          <span className="font-semibold text-primary">Details (speaker, agenda)</span>
          <textarea
            rows={3}
            value={draft.details}
            onChange={(e) => set("details", e.target.value)}
            className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          />
        </label>
        {!marked ? (
          <fieldset className="space-y-2 rounded-xl border border-border p-3 sm:col-span-2">
            <legend className="px-1 font-semibold text-primary">Invite batches</legend>
            <div className="flex flex-wrap gap-3">
              {batches.map((name) => (
                <label key={name} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={draft.batches.includes(name)}
                    onChange={() =>
                      set(
                        "batches",
                        draft.batches.includes(name)
                          ? draft.batches.filter((item) => item !== name)
                          : [...draft.batches, name],
                      )
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {invited.length} scholars and their supervisors will be invited.
            </p>
          </fieldset>
        ) : null}
        {error ? <p className="text-secondary sm:col-span-2">{error}</p> : null}
      </div>
    </FormDialog>
  );
}

function AttendanceDialog({
  event,
  onClose,
  onSaved,
}: {
  event: Colloquium;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const people = [
    ...event.scholars.map((person) => ({ role: "scholar" as const, person })),
    ...event.supervisors.map((person) => ({ role: "supervisor" as const, person })),
  ];
  // A first sitting starts with everyone present, to be corrected; a saved one is shown as saved.
  const saved = Object.keys(event.attendance).length > 0;
  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      people.map(({ role, person }) => {
        const key = attendanceKey(role, person.identifier);
        return [key, event.attendance[key] ?? (saved ? "" : "Present")];
      }),
    ),
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setAll = (value: Mark) =>
    setMarks((current) =>
      Object.fromEntries(Object.keys(current).map((key) => [key, value])),
    );

  const group = (role: "scholar" | "supervisor", list: Colloquium["scholars"]) => {
    const shown = list.filter((person) =>
      textMatches(query, [person.name, person.identifier]),
    );
    return (
      <fieldset className="space-y-2">
        <legend className="font-semibold text-primary">
          {role === "scholar" ? "Scholars" : "Supervisors"} ·{" "}
          {
            list.filter(
              (person) => marks[attendanceKey(role, person.identifier)] === "Present",
            ).length
          }{" "}
          present
        </legend>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {shown.map((person) => {
            const key = attendanceKey(role, person.identifier);
            return (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="font-medium text-primary">{person.name}</span>
                <MarkButtons
                  name={person.name}
                  value={marks[key] ?? ""}
                  onChange={(next) =>
                    setMarks((current) => ({ ...current, [key]: next }))
                  }
                />
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  };

  return (
    <FormDialog
      title={`Attendance · ${event.name}`}
      submitLabel="Save attendance"
      busy={busy}
      size="lg"
      onClose={onClose}
      onSubmit={(submit) => {
        submit.preventDefault();
        const attendance: Record<string, ColloquiumMark> = {};
        for (const { role, person } of people) {
          const key = attendanceKey(role, person.identifier);
          const mark = marks[key];
          if (mark !== "Present" && mark !== "Absent") {
            setError("Mark everyone present or absent before saving.");
            return;
          }
          attendance[key] = mark;
        }
        setError("");
        setBusy(true);
        void markColloquiumAttendance(event.id, attendance).then((result) => {
          setBusy(false);
          if (!result.ok) return setError(result.message);
          const absent = Object.values(attendance).filter(
            (mark) => mark === "Absent",
          ).length;
          onSaved(
            `Attendance saved: ${Object.keys(attendance).length - absent} present, ${absent} absent.`,
          );
        });
      }}
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search a name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAll("Present")}
          >
            All present
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAll("")}>
            Clear all
          </Button>
          <span className="ml-auto text-muted-foreground">
            {markSummary(Object.values(marks))}
          </span>
        </div>
        {group("scholar", event.scholars)}
        {event.supervisors.length > 0 ? group("supervisor", event.supervisors) : null}
        {error ? <p className="text-secondary">{error}</p> : null}
      </div>
    </FormDialog>
  );
}

export { colloquiumRule };
