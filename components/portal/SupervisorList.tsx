"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supervisorOfficeCopy } from "@/data/application-review";
import type { ResearchSupervisor } from "@/data/research-register";
import { keyAreasOf } from "@/lib/department-areas";
import { currentResearchAreas, subscribeResearchAreas } from "@/lib/research-areas";
import { schoolOfDepartment } from "@/lib/schools";
import { standingKind } from "@/lib/portal-access";
import {
  guideFigures,
  supervisorKeys,
  supervisorListingActive,
  type SupervisorStanding,
} from "@/lib/register";

type Quotas = Parameters<typeof guideFigures>[1];
type Allocations = Parameters<typeof guideFigures>[2];

function initialsOf(name: string) {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words text-foreground">
        {value === "" ? "—" : value}
      </dd>
    </div>
  );
}

/**
 * The supervisor register as a clean list: who the supervisor is, the department, the key
 * research areas, how full the guiding load is and the status, with the actions on the right.
 * Contact details and the allotment figures open under each row.
 */
export function SupervisorList({
  supervisors,
  inactiveTab,
  quotas,
  allocations,
  standings,
  busy,
  canEditRow,
  onView,
  onEdit,
  onMarkInactive,
  onRestore,
}: {
  supervisors: readonly ResearchSupervisor[];
  inactiveTab: boolean;
  quotas: Quotas;
  allocations: Allocations;
  standings: readonly SupervisorStanding[];
  busy: boolean;
  canEditRow: (supervisor: ResearchSupervisor) => boolean;
  onView: (supervisor: ResearchSupervisor) => void;
  onEdit: (supervisor: ResearchSupervisor) => void;
  onMarkInactive: (supervisor: ResearchSupervisor) => void;
  onRestore: (supervisor: ResearchSupervisor) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const schoolCatalogue = useSyncExternalStore(
    subscribeResearchAreas,
    currentResearchAreas,
    currentResearchAreas,
  );

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table
        suppressHydrationWarning
        className="w-full min-w-[60rem] border-collapse text-left text-sm"
      >
        <thead className="bg-muted text-primary">
          <tr>
            {[
              "Supervisor",
              "Department",
              "Area of research",
              "Guiding",
              "Status",
              "",
            ].map((heading, index) => (
              <th
                key={`${heading}-${index}`}
                suppressHydrationWarning
                className="px-4 py-3 font-semibold whitespace-nowrap"
              >
                {heading || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {supervisors.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                {inactiveTab
                  ? supervisorOfficeCopy.emptyInactive
                  : supervisorOfficeCopy.emptyActive}
              </td>
            </tr>
          ) : null}
          {supervisors.map((supervisor) => {
            const rowKey = `${supervisor.serialNo}-${supervisor.name}`;
            const figures = guideFigures(supervisor, quotas, allocations);
            const keys = supervisorKeys(supervisor);
            const active = supervisorListingActive(supervisor, standings);
            const areas = keyAreasOf(supervisor.researchArea);
            const share =
              figures.quota > 0
                ? Math.min(
                    100,
                    Math.round((figures.currentScholars / figures.quota) * 100),
                  )
                : 0;
            const expanded = open === rowKey;
            return (
              <Fragment key={rowKey}>
                <tr className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                        aria-hidden="true"
                      >
                        {initialsOf(supervisor.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{supervisor.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {supervisor.designation.trim() || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{supervisor.department.trim() || "—"}</p>
                    {schoolOfDepartment(supervisor.department, schoolCatalogue) ? (
                      <p className="text-xs text-muted-foreground">
                        {schoolOfDepartment(supervisor.department, schoolCatalogue)}
                      </p>
                    ) : null}
                    {supervisor.campus.trim() ? (
                      <p className="text-xs text-muted-foreground">
                        {supervisor.campus.trim()}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[18rem] px-4 py-3">
                    {areas.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5" title={areas.join(", ")}>
                        {areas.slice(0, 3).map((area) => (
                          <li
                            key={area}
                            className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs leading-5"
                          >
                            {area}
                          </li>
                        ))}
                        {areas.length > 3 ? (
                          <li className="px-1 py-0.5 text-xs font-semibold text-secondary">
                            +{areas.length - 3} more
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm tabular-nums">
                      <span className="font-semibold text-primary">
                        {figures.currentScholars}
                      </span>{" "}
                      of {figures.quota} scholars
                    </p>
                    <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <div className="mt-1.5">
                      {figures.vacancy > 0 ? (
                        <Badge variant="gold">Vacancy {figures.vacancy}</Badge>
                      ) : (
                        <Badge variant="maroon">No vacancy</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {inactiveTab ? (
                      <Badge variant="maroon">{standingKind(keys, standings)}</Badge>
                    ) : active ? (
                      <Badge variant="gold">Active</Badge>
                    ) : (
                      <Badge variant="maroon">Not active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onView(supervisor)}
                      >
                        View
                      </Button>
                      {canEditRow(supervisor) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit(supervisor)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {inactiveTab ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onRestore(supervisor)}
                        >
                          {supervisorOfficeCopy.restore}
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onMarkInactive(supervisor)}
                          >
                            {supervisorOfficeCopy.markInactive}
                          </Button>
                          <Button asChild size="sm" variant="maroon">
                            <Link href="/admin/supervisor-exit">
                              {supervisorOfficeCopy.markResigned}
                            </Link>
                          </Button>
                        </>
                      )}
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-primary hover:bg-muted"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} details of ${supervisor.name}`}
                        onClick={() => setOpen(expanded ? null : rowKey)}
                      >
                        {expanded ? (
                          <ChevronDown className="size-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="bg-muted/40">
                    <td className="px-4 py-4" colSpan={6}>
                      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                        <Detail label="Serial No." value={supervisor.serialNo || ""} />
                        <Detail
                          label="Supervisor ID"
                          value={supervisor.supervisorId.trim()}
                        />
                        <Detail
                          label="Name of the school"
                          value={schoolOfDepartment(
                            supervisor.department,
                            schoolCatalogue,
                          )}
                        />
                        <Detail label="Phone" value={supervisor.phone.trim()} />
                        <Detail label="Mail ID" value={supervisor.email.trim()} />
                        <Detail label="Quota" value={figures.quota} />
                        <Detail label="Guiding now" value={figures.currentScholars} />
                        <Detail label="Vacancy" value={figures.vacancy} />
                        <Detail label="Balance" value={figures.balance} />
                        <Detail
                          label="July 2026 allotment"
                          value={supervisor.june2026Allotment}
                        />
                        <div className="sm:col-span-3 lg:col-span-4">
                          <dt className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            Area of research
                          </dt>
                          <dd className="mt-0.5 text-sm text-foreground">
                            {supervisor.researchArea.trim() || "—"}
                          </dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
