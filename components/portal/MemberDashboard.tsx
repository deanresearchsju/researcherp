"use client";

import {
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileBadge2,
  FileText,
  IndianRupee,
  type LucideIcon,
  MessagesSquare,
  NotebookPen,
  Presentation,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { FeeReminderBanner } from "@/components/portal/FeeReminderBanner";
import { PersonalDetailsPanel } from "@/components/portal/PersonalDetailsPanel";
import { ProfileCard } from "@/components/portal/ProfileCard";
import { ScholarAdmission } from "@/components/portal/ScholarAdmission";
import { Badge } from "@/components/ui/badge";
import { scholarRecordMenus } from "@/data/scholar-records";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, sameId, subscribeOffice } from "@/lib/office";
import { sameGuide } from "@/lib/register";
import { alertsOf, type ScholarReport } from "@/lib/scholar-report";
import { useScholarReports } from "@/lib/use-report-sources";
import { cn } from "@/lib/utils";

type Milestone = { label: string; detail: string; done: boolean };

const done = (value: string) =>
  value.startsWith("Approved") || value.startsWith("Completed");

function milestonesOf(report: ScholarReport): Milestone[] {
  return [
    { label: "Admission", detail: report.batchName || "Admitted", done: true },
    {
      label: "Course work",
      detail: `${report.coursePassed} of ${Math.max(report.coursePapers, 4)} papers passed`,
      done: report.coursePassed >= 4 && report.courseArrears === 0,
    },
    { label: "First DC", detail: report.firstDc, done: done(report.firstDc) },
    { label: "RAC", detail: report.rac, done: report.rac === "Constituted" },
    {
      label: "Ph.D. confirmation",
      detail: report.confirmation,
      done: done(report.confirmation),
    },
    {
      label: "Six-month reports",
      detail: `${report.sixMonthApproved} of ${report.sixMonthDue} due approved`,
      done: report.sixMonthDue > 0 && report.sixMonthApproved >= report.sixMonthDue,
    },
    {
      label: "Colloquium",
      detail: `${report.colloquium.attended} of minimum ${report.colloquium.required}`,
      done: report.colloquium.met,
    },
    { label: "Third DC", detail: report.thirdDc, done: done(report.thirdDc) },
    { label: "Synopsis", detail: report.synopsis, done: report.synopsis === "Approved" },
    { label: "Thesis", detail: report.thesis, done: report.thesis === "Approved" },
    { label: "Viva", detail: report.viva, done: report.viva.startsWith("Passed") },
  ];
}

function Tile({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-3xl font-semibold tabular-nums",
          tone === "good"
            ? "text-primary"
            : tone === "warn"
              ? "text-secondary"
              : "text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </li>
  );
}

function Actions({ items }: { items: readonly [string, string, LucideIcon][] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold tracking-[0.12em] text-muted-foreground uppercase">
        Quick actions
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(([href, label, Icon]) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-sm font-semibold text-primary shadow-card transition hover:border-primary/40 hover:shadow-lift"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Journey({ report }: { report: ScholarReport }) {
  const steps = milestonesOf(report);
  const current = steps.findIndex((step) => !step.done);
  const completed = steps.filter((step) => step.done).length;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Ph.D. journey
          </h2>
          <p className="mt-1 text-lg font-semibold text-primary">{report.stage}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {completed} of {steps.length} milestones
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          return (
            <li
              key={step.label}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5",
                step.done && "border-accent/40 bg-accent/10",
                isCurrent && "border-primary bg-primary/5 ring-1 ring-primary/30",
                !step.done && !isCurrent && "border-border",
              )}
            >
              {step.done ? (
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    isCurrent ? "text-primary" : "text-muted-foreground/50",
                  )}
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">
                  {step.label}
                  {isCurrent ? (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-primary-foreground uppercase">
                      Now
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ScholarDashboard({
  identifier,
  name,
  admitted,
}: {
  identifier: string;
  name: string;
  admitted: boolean;
}) {
  const data = useScholarReports();
  const report = data.ready
    ? (data.reports.find((row) => sameId(row.identifier, identifier)) ?? null)
    : null;
  const alerts = report ? alertsOf(report) : [];

  return (
    <div className="space-y-6">
      <FeeReminderBanner identifier={identifier} name={name} />
      <ProfileCard role="scholar" />
      <ScholarAdmission embedded />
      {!admitted ? (
        <section className="rounded-2xl border border-secondary/30 bg-secondary/5 p-5">
          <p className="font-semibold text-secondary">Admission in progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Course work, requests and doctoral progress open after the research office
            completes your admission.
          </p>
        </section>
      ) : null}
      {report ? (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Semester"
              value={report.semester ? String(report.semester) : "—"}
              note={report.mode}
            />
            <Tile
              label="Six-month reports"
              value={`${report.sixMonthApproved}/${report.sixMonthDue}`}
              note="Approved of those due"
              tone={report.sixMonthApproved < report.sixMonthDue ? "warn" : "good"}
            />
            <Tile
              label="Colloquium"
              value={`${report.colloquium.attended}/${report.colloquium.required}`}
              note={`Minimum ${report.colloquium.required} of ${report.colloquium.total}`}
              tone={report.colloquium.status === "At risk" ? "warn" : "good"}
            />
            <Tile
              label="Course work"
              value={`${Math.min(report.coursePassed, 4)}/4`}
              note={
                report.courseArrears > 0
                  ? `${report.courseArrears} arrear paper(s) to clear`
                  : "Papers passed"
              }
              tone={report.courseArrears > 0 ? "warn" : "good"}
            />
          </ul>
          {alerts.length > 0 ? (
            <section
              role="alert"
              className="rounded-2xl border-2 border-secondary/50 bg-secondary/10 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-secondary">
                <span
                  className="notice-blink size-2.5 rounded-full bg-secondary"
                  aria-hidden="true"
                />
                <span className="notice-blink">Needs your attention</span>
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {alerts.map((alert) => (
                  <li key={alert} className="notice-blink">
                    <Badge variant="maroon">{alert}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Journey report={report} />
        </>
      ) : null}
      {admitted ? (
        <Actions
          items={[
            ["/scholar/course-work", "Course work", BookOpen],
            ["/scholar/reports", "Six-month report", NotebookPen],
            ["/scholar/colloquium", "Colloquium", Presentation],
            ["/scholar/records/publications", "Publications", FileText],
            ["/scholar/fee", "Fee", IndianRupee],
            ["/scholar/rac", "RAC members", ShieldCheck],
            ["/scholar/records/title-change", "Title change", ScrollText],
            ["/scholar/approved", "Approved documents", FileBadge2],
          ]}
        />
      ) : null}
      <PersonalDetailsPanel role="scholar" identifier={identifier} name={name} />
    </div>
  );
}

const reviewKinds = new Set(
  scholarRecordMenus.filter((menu) => menu.needsSupervisor).map((menu) => menu.kind),
);

export function SupervisorDashboard({
  identifier,
  name,
}: {
  identifier: string;
  name: string;
}) {
  const data = useScholarReports();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const guide = data.ready
    ? data.guides.find(
        (item) =>
          item.keys.some((key) => key.trim() && sameId(key, identifier)) ||
          sameGuide(item.name, name),
      )
    : undefined;
  const keys = [identifier, ...(guide?.keys ?? [])];
  const guideName = guide?.name ?? name;
  const mine = data.ready
    ? data.reports.filter(
        (row) =>
          keys.some((key) => key.trim() && sameId(row.guideIdentifier, key)) ||
          sameGuide(row.guideName, guideName),
      )
    : [];
  const mineIds = mine.map((row) => row.identifier);
  const isMine = (id: string) => mineIds.some((item) => sameId(item, id));
  const requests = (office?.records ?? []).filter(
    (record) =>
      reviewKinds.has(record.kind) &&
      record.status === "Submitted" &&
      isMine(record.scholarIdentifier),
  ).length;
  const committees = (doctoral?.committees ?? []).filter(
    (item) =>
      item.status === "Submitted" &&
      !item.supervisorStatus &&
      !item.officeEntry &&
      isMine(item.scholarIdentifier),
  ).length;
  const withAlerts = mine.filter((row) => alertsOf(row).length > 0).length;

  return (
    <div className="space-y-6">
      <ProfileCard role="supervisor" />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="My scholars" value={String(mine.length)} note="Currently guided" />
        <Tile
          label="Requests to recommend"
          value={String(requests)}
          note="Waiting for you"
          tone={requests > 0 ? "warn" : "good"}
        />
        <Tile
          label="Committee reports"
          value={String(committees)}
          note="Waiting for your recommendation"
          tone={committees > 0 ? "warn" : "good"}
        />
        <Tile
          label="Scholars with alerts"
          value={String(withAlerts)}
          note="Reports, colloquium, fee or RAC"
          tone={withAlerts > 0 ? "warn" : "good"}
        />
      </ul>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="font-semibold text-primary">My scholars</h2>
          <Link
            href="/supervisor/scholars"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead className="bg-muted/60 text-primary">
              <tr>
                {[
                  "Scholar",
                  "Batch",
                  "Stage",
                  "Six-month",
                  "Colloquium",
                  "Attention",
                ].map((header) => (
                  <th key={header} className="px-4 py-2.5 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data.ready ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : mine.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-muted-foreground">
                    No scholar is allotted to you yet.
                  </td>
                </tr>
              ) : (
                mine.map((row) => {
                  const alerts = alertsOf(row);
                  return (
                    <tr key={row.identifier} className="border-t border-border align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.registration} · {row.mode}
                        </p>
                      </td>
                      <td className="px-4 py-3">{row.batchName || "—"}</td>
                      <td className="px-4 py-3">{row.stage}</td>
                      <td className="px-4 py-3">
                        {row.sixMonthApproved}/{row.sixMonthDue}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            row.colloquium.status === "Met"
                              ? "gold"
                              : row.colloquium.status === "At risk"
                                ? "maroon"
                                : "purple"
                          }
                        >
                          {row.colloquium.attended}/{row.colloquium.required} ·{" "}
                          {row.colloquium.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {alerts.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            All in order
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-xs text-secondary">
                            {alerts.map((alert) => (
                              <li key={alert}>{alert}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Actions
        items={[
          ["/supervisor/scholars", "My scholars", Users],
          ["/supervisor/reviews", "Scholar requests", MessagesSquare],
          ["/supervisor/committees", "Doctoral committees", ClipboardCheck],
          ["/supervisor/rac", "RAC proposal", ShieldCheck],
          ["/supervisor/evaluators", "Thesis evaluators", UserCheck],
          ["/supervisor/colloquium", "Colloquium", Presentation],
          ["/supervisor/approved", "Approved documents", FileBadge2],
        ]}
      />
      <PersonalDetailsPanel role="supervisor" identifier={identifier} name={name} />
    </div>
  );
}
