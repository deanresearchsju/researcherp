"use client";

import { ChevronDown, PencilLine, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { PersonalDetailsPanel } from "@/components/portal/PersonalDetailsPanel";
import { ProfileCard } from "@/components/portal/ProfileCard";
import { SupervisorRegisterEditor } from "@/components/portal/RegisterEditors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { researchRegister, type ResearchSupervisor } from "@/data/research-register";
import { committeeSummary, submissionSummary } from "@/lib/approval-flow";
import { formatIsoDate } from "@/lib/dates";
import { attendanceKey, colloquiumMarked } from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import {
  currentProfiles,
  currentQuotas,
  currentStandings,
  sameGuide,
  subscribeRegister,
  supervisorListingActive,
} from "@/lib/register";
import { useScholarReports } from "@/lib/use-report-sources";
import { usePreviewSession } from "@/lib/use-preview-session";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "personal", label: "Personal details" },
  { id: "scholars", label: "Scholars" },
  { id: "rac", label: "RAC" },
  { id: "approvals", label: "Recommendations" },
  { id: "colloquium", label: "Colloquium attendance" },
  { id: "profile", label: "Public profile" },
] as const;
type TabId = (typeof tabs)[number]["id"];

const signInId = (supervisor: ResearchSupervisor) =>
  supervisor.email.trim() || supervisor.supervisorId.trim() || supervisor.name;

function Table({
  headers,
  rows,
  empty,
}: {
  headers: readonly string[];
  rows: readonly (readonly (string | number)[])[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted text-primary">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-border align-top">
                {row.map((cell, at) => (
                  <td key={at} className="px-3 py-2">
                    {String(cell) || "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const when = (iso: string) => (iso ? formatIsoDate(iso.slice(0, 10)) : "");

/**
 * Supervisor information: type a supervisor's name, e-mail or ID, pick the supervisor from the
 * list, and read what the supervisor sees in the portal, one topic at a time (personal details,
 * scholars, RAC, recommendations, colloquium, public profile). The research office corrects the
 * details from the first tab.
 */
export function SupervisorInformationViewer() {
  const session = usePreviewSession();
  const data = useScholarReports();
  const standings = useSyncExternalStore(subscribeRegister, currentStandings, currentStandings);
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const profiles = useSyncExternalStore(subscribeRegister, currentProfiles, currentProfiles);
  const asked = useSearchParams().get("supervisor") ?? "";
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(asked);
  const [tab, setTab] = useState<TabId>("personal");
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ResearchSupervisor | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const office = Boolean(session && ["admin", "staff", "dean"].includes(session.role));
  const canEdit = session?.role === "admin" || session?.role === "staff";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const candidates = useMemo(
    () =>
      researchRegister.supervisors.map((supervisor) => ({
        supervisor,
        identifier: signInId(supervisor),
        active: supervisorListingActive(supervisor, standings),
      })),
    [standings],
  );

  if (!data.ready) {
    return <p className="text-sm text-muted-foreground">Loading supervisors…</p>;
  }

  const needle = text.trim().toLowerCase();
  const matches =
    needle.length < 2
      ? []
      : candidates
          .filter((item) =>
            [
              item.supervisor.name,
              item.supervisor.email,
              item.supervisor.supervisorId,
              item.supervisor.department,
              item.supervisor.campus,
            ]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          )
          .slice(0, 40);
  const chosen = candidates.find((item) => sameId(item.identifier, picked)) ?? null;
  const supervisor = chosen?.supervisor ?? null;
  const identifier = chosen?.identifier ?? "";
  const doctoral = data.sources.doctoral;
  const guided = supervisor
    ? data.reports.filter((report) => sameGuide(report.guideName, supervisor.name))
    : [];
  const byGuide = <T extends { supervisorName: string }>(list: readonly T[]) =>
    supervisor ? list.filter((item) => sameGuide(item.supervisorName, supervisor.name)) : [];
  const quota = supervisor
    ? quotas.find((item) => sameGuide(item.name, supervisor.name))
    : undefined;
  const profile = supervisor
    ? profiles.find((item) =>
        [supervisor.email, supervisor.supervisorId, supervisor.name].some(
          (key) => key.trim() && item.key === key.trim().toLowerCase(),
        ),
      )
    : undefined;

  function choose(next: (typeof candidates)[number]) {
    setPicked(next.identifier);
    setText(next.supervisor.name);
    setOpen(false);
    setTab("personal");
    setNotice(null);
  }

  return (
    <section className="space-y-4">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Supervisor register
        </p>
        <h1 className="mt-1 font-heading text-3xl text-primary">Supervisor information</h1>
      </header>

      <div ref={box} className="relative">
        <label className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <span className="text-sm font-semibold text-primary">Supervisor name</span>
          <span className="relative min-w-[16rem] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={text}
              placeholder="Type a name, e-mail or supervisor ID"
              aria-label="Supervisor name"
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setText(event.target.value);
                setOpen(true);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background pr-9 pl-9 text-sm outline-none focus:border-primary"
            />
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </label>
        {open && needle.length >= 2 ? (
          <div
            role="listbox"
            aria-label="Matching supervisors"
            className="absolute right-0 left-0 z-40 mt-1 max-h-96 overflow-auto rounded-xl border border-border bg-card shadow-lift"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-muted text-primary">
                <tr>
                  {["Supervisor", "Supervisor ID", "Designation", "Department", "Campus", "Scholars", "Status"].map(
                    (header) => (
                      <th key={header} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                      No supervisor matches “{text.trim()}”.
                    </td>
                  </tr>
                ) : (
                  matches.map((item) => (
                    <tr
                      key={item.identifier}
                      role="option"
                      aria-selected={sameId(item.identifier, picked)}
                      tabIndex={0}
                      className="cursor-pointer border-t border-border hover:bg-muted"
                      onClick={() => choose(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") choose(item);
                      }}
                    >
                      <td className="px-3 py-2 font-medium text-primary">{item.supervisor.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.supervisor.supervisorId || "—"}</td>
                      <td className="px-3 py-2">{item.supervisor.designation || "—"}</td>
                      <td className="px-3 py-2">{item.supervisor.department || "—"}</td>
                      <td className="px-3 py-2">{item.supervisor.campus || "—"}</td>
                      <td className="px-3 py-2">{item.supervisor.currentScholars}</td>
                      <td className="px-3 py-2 font-semibold">{item.active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}

      {!supervisor ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
          Type at least two letters of a supervisor&apos;s name, e-mail or ID, then choose the
          supervisor from the list to see what the supervisor sees in the portal.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Supervisor information" className="space-y-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                data-readonly-allow=""
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => setTab(item.id)}
                className={cn(
                  "block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                  tab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-primary hover:bg-primary/10",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
              <div>
                <p className="text-lg font-semibold text-primary">{supervisor.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    supervisor.supervisorId,
                    supervisor.designation,
                    supervisor.department,
                    supervisor.campus,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {session?.role === "admin" ? (
                  <Link
                    href={`/admin/audit?person=${encodeURIComponent(identifier)}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline"
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    Audit trail
                  </Link>
                ) : null}
                <Badge variant={chosen?.active ? "gold" : "outline"}>
                  {chosen?.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>

            {tab === "personal" ? (
              <div className="space-y-4">
                {office && canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={() => {
                      setNotice(null);
                      setEditing(supervisor);
                    }}
                  >
                    <PencilLine className="size-4" aria-hidden="true" />
                    Correct details
                  </Button>
                ) : null}
                <Table
                  headers={["Detail", "Value"]}
                  rows={[
                    ["Name", supervisor.name],
                    ["Supervisor ID", supervisor.supervisorId],
                    ["Designation", supervisor.designation],
                    ["Department", supervisor.department],
                    ["Campus", supervisor.campus],
                    ["Phone", supervisor.phone],
                    ["E-mail", supervisor.email],
                    ["Area of research", profile?.researchArea || supervisor.researchArea],
                    ["Quota", quota ? quota.quota : supervisor.quota],
                    ["Scholars now", guided.length || supervisor.currentScholars],
                    ["On the vacancy list", supervisor.onVacancyList ? "Yes" : "No"],
                  ]}
                  empty=""
                />
                <ProfileCard role="supervisor" identifier={identifier} name={supervisor.name} />
                <PersonalDetailsPanel
                  role="supervisor"
                  identifier={identifier}
                  name={supervisor.name}
                />
              </div>
            ) : null}

            {tab === "scholars" ? (
              <Table
                headers={["Scholar", "Registration No.", "Batch", "Department", "Mode", "Stage", "Fee balance (₹)"]}
                rows={guided.map((report) => [
                  report.name,
                  report.registration,
                  report.batchName,
                  report.department,
                  report.mode,
                  report.stage,
                  report.feeBalance,
                ])}
                empty="No scholar is allotted to this supervisor."
              />
            ) : null}

            {tab === "rac" ? (
              <Table
                headers={["Scholar", "Kind", "Status", "Decided on"]}
                rows={byGuide(data.sources.proposals).map((item) => [
                  item.scholarName,
                  item.kind === "constitution" ? "Constitution" : "Reconstitution",
                  item.status === "Submitted"
                    ? "With the Dean"
                    : item.status === "With VC"
                      ? "With the Vice Chancellor"
                      : item.status,
                  when(item.vcOn || item.decidedOn),
                ])}
                empty="No RAC is nominated by this supervisor."
              />
            ) : null}

            {tab === "approvals" ? (
              <Table
                headers={["Scholar", "Document", "Supervisor's step", "On", "Now"]}
                rows={[
                  ...byGuide(doctoral.committees).map((item) => [
                    item.scholarName,
                    `${item.kind} doctoral committee report`,
                    item.supervisorStatus || "Waiting",
                    when(item.supervisorAt || item.supervisorOn),
                    committeeSummary(item).label,
                  ]),
                  ...byGuide(doctoral.synopses).map((item) => [
                    item.scholarName,
                    "Synopsis",
                    item.supervisorStatus || "Waiting",
                    when(item.supervisorAt || item.supervisorOn),
                    submissionSummary(item).label,
                  ]),
                  ...byGuide(doctoral.theses).map((item) => [
                    item.scholarName,
                    "Thesis",
                    item.supervisorStatus || "Waiting",
                    when(item.supervisorAt || item.supervisorOn),
                    submissionSummary(item).label,
                  ]),
                ]}
                empty="No committee report, synopsis or thesis has come to this supervisor."
              />
            ) : null}

            {tab === "colloquium" ? (
              <Table
                headers={["Event", "Date", "Venue", "Attendance"]}
                rows={doctoral.colloquia
                  .filter((event) =>
                    event.supervisors.some((person) => sameId(person.identifier, identifier)),
                  )
                  .map((event) => [
                    event.name,
                    when(event.date),
                    event.venue,
                    colloquiumMarked(event)
                      ? event.attendance[attendanceKey("supervisor", identifier)] === "Present"
                        ? "Present"
                        : "Absent"
                      : "Not marked yet",
                  ])}
                empty="The supervisor is not invited to a colloquium yet."
              />
            ) : null}

            {tab === "profile" ? (
              <div className="space-y-3">
                <Table
                  headers={["Public profile", ""]}
                  rows={[
                    ["Shown on the public Supervisors page", profile?.published ? "Yes" : "No"],
                    ["Vidwan ID", profile?.vidwan ?? ""],
                    ["Area of research", profile?.researchArea ?? ""],
                    ["Biography", profile?.bio ?? ""],
                    ["Last updated", profile ? `${when(profile.updatedOn)} by ${profile.updatedBy}` : ""],
                  ]}
                  empty=""
                />
                {office ? (
                  <Link
                    href="/admin/supervisor-profiles"
                    className="text-sm font-semibold text-secondary hover:underline"
                  >
                    Edit the public profile under Supervisor profiles
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
      {editing ? (
        <SupervisorRegisterEditor
          key={editing.serialNo}
          supervisor={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      ) : null}
    </section>
  );
}
