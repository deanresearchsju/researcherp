"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { admissionArchiveCopy } from "@/data/admission";
import { registrationCopy } from "@/data/registration";
import { scholarRecordMenus } from "@/data/scholar-records";
import { guideHiddenCopy, guideReleased } from "@/lib/guide-release";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { personFileCopy } from "@/data/person-file";
import { incompleteApplicationsCopy } from "@/data/incomplete-applications";
import { portalIntro } from "@/data/portal";
import { PersonalDetailsPanel } from "@/components/portal/PersonalDetailsPanel";
import { FeeReminderBanner } from "@/components/portal/FeeReminderBanner";
import { ScholarFeeStatus } from "@/components/portal/ScholarFeeStatus";
import { canOpenMenu, isOfficeRole, resolvedMenus } from "@/lib/access";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { currentAdmission, scholarIsAdmitted, subscribeAdmission } from "@/lib/admission";
import { batchOf, scholarBySignIn } from "@/lib/register";
import {
  downloadAllScholarDetails,
  downloadAllSupervisorDetails,
} from "@/lib/person-file";
import { currentApplications, subscribeApplications } from "@/lib/records";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import {
  allocationFor,
  currentOffice,
  presentRac,
  sameId,
  scholarsStillGuidedBy,
  subscribeOffice,
  type OfficeRecord,
} from "@/lib/office";
import { ProfileCard } from "@/components/portal/ProfileCard";
import {
  ScholarDashboard,
  SupervisorDashboard,
} from "@/components/portal/MemberDashboard";
import { usePortalSession, usePreviewSession } from "@/lib/use-preview-session";
import { formatInr } from "@/lib/utils";
import type { Role } from "@/types";

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 font-sans text-4xl font-semibold text-primary tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </li>
  );
}

function money(records: OfficeRecord[]) {
  return records.reduce((sum, record) => sum + (Number(record.payload.amount) || 0), 0);
}

const reviewKinds = new Set(
  scholarRecordMenus.filter((menu) => menu.needsSupervisor).map((menu) => menu.kind),
);

function ScholarRecordLine({
  identifier,
  allocations,
}: {
  identifier: string;
  allocations: Parameters<typeof allocationFor>[0];
}) {
  const record = scholarBySignIn(identifier);
  const guide = allocationFor(allocations, identifier);
  const payments = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  if (record) {
    const batch = batchOf(record.batchId);
    return (
      <p className="mt-3 max-w-2xl text-sm leading-6 text-accent">
        {batch ? `${batch.name}. ` : null}
        Guide: {guide?.supervisorName || record.guideName || "—"}.
        {record.title ? ` Title: ${record.title}.` : ""}
        {record.registrationNumber
          ? ` Registration number: ${record.registrationNumber}.`
          : " Registration number is to be allotted."}
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm text-accent">
      {guide
        ? guideReleased(identifier, payments?.records ?? [])
          ? `Guide: ${guide.supervisorName}`
          : `Guide: ${guideHiddenCopy}`
        : "A supervisor has not been allotted yet."}
    </p>
  );
}

export function DashboardHome({ role: pageRole }: { role: Role }) {
  const session = usePortalSession();
  const rights = usePreviewSession();
  const canExportScholars = useCanMenuAction("export", "/admin/register");
  const canExportSupervisors = useCanMenuAction("export", "/admin/supervisors");
  const role =
    session && isOfficeRole(pageRole) && isOfficeRole(session.role)
      ? session.role
      : pageRole;
  const intro = portalIntro[role];
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const admitted =
    role !== "scholar" || scholarIsAdmitted(session?.identifier ?? "", admission?.cases);
  const name =
    session && session.role === role
      ? session.name.trim() || session.identifier
      : intro.title;
  const records = office?.records ?? [];
  const mine =
    session && session.role === role
      ? records.filter((record) => sameId(record.scholarIdentifier, session.identifier))
      : [];
  const allotted =
    office && session
      ? office.allocations.filter((item) =>
          sameId(item.supervisorIdentifier, session.identifier),
        )
      : [];
  const waitingForSupervisor = records.filter(
    (record) => reviewKinds.has(record.kind) && record.status === "Submitted",
  );
  const mineWaiting = waitingForSupervisor.filter((record) =>
    allotted.some((item) => sameId(item.scholarIdentifier, record.scholarIdentifier)),
  );
  const waitingForOffice = records.filter(
    (record) =>
      record.status === "Supervisor approved" ||
      (!reviewKinds.has(record.kind) && record.status === "Submitted"),
  );
  const payments = records.filter((record) => record.kind === "payment");
  const myPayments = mine.filter((record) => record.kind === "payment");
  const rac = session && office ? presentRac(office.proposals, session.identifier) : null;
  useSyncExternalStore(subscribeApplications, currentApplications, () => null);

  const registerScholars =
    session && role === "supervisor"
      ? scholarsStillGuidedBy(session.name, session.identifier, office?.allocations ?? [])
      : [];

  const scholarCards = [
    {
      label: "Payments",
      value: String(myPayments.length),
      note: `₹${formatInr(money(myPayments))} recorded`,
    },
    ...(admitted
      ? [
          {
            label: "Publications",
            value: String(mine.filter((record) => record.kind === "publication").length),
            note: "Added on your record",
          },
          {
            label: "Six-month reports",
            value: String(
              mine.filter((record) => record.kind === "six_month_report").length,
            ),
            note: "Progress reports sent",
          },
          {
            label: "RAC",
            value: rac ? "3" : "0",
            note: rac ? "Guide, internal, and external" : "Not constituted yet",
          },
        ]
      : []),
  ];

  const cards =
    role === "scholar"
      ? scholarCards
      : role === "supervisor"
        ? [
            {
              label: "Scholars",
              value: String(allotted.length + registerScholars.length),
              note: "Allotted to you",
            },
            {
              label: "Waiting for you",
              value: String(mineWaiting.length),
              note: "Requests to recommend",
            },
            {
              label: "RAC sent",
              value: String(
                office?.proposals.filter((item) =>
                  session ? sameId(item.supervisorIdentifier, session.identifier) : false,
                ).length ?? 0,
              ),
              note: "Nominations you have made",
            },
            {
              label: "RAC in place",
              value: String(
                allotted.filter((item) =>
                  presentRac(office?.proposals ?? [], item.scholarIdentifier),
                ).length,
              ),
              note: "Scholars with a present RAC",
            },
          ]
        : [
            {
              label: "Scholars",
              value: String(
                users?.users.filter((user) => user.role === "scholar").length ?? "—",
              ),
              note: "Portal accounts",
            },
            {
              label: "Supervisors",
              value: String(
                users?.users.filter((user) => user.role === "supervisor").length ?? "—",
              ),
              note: "Portal accounts",
            },
            {
              label: "Ph.D. applications",
              value: String(office?.phdApplications ?? "—"),
              note: office?.settings.phdOpen
                ? "Applications are open"
                : "Applications are closed",
            },
            {
              label: "Supervisor applications",
              value: String(office?.supervisorApplications ?? "—"),
              note: office?.settings.supervisorOpen
                ? "Recognition is open"
                : "Recognition is closed",
            },
            {
              label: "Allotments",
              value: String(office?.allocations.length ?? "—"),
              note: "Scholars with a guide",
            },
            {
              label: "With the office",
              value: String(waitingForOffice.length),
              note: `${waitingForSupervisor.length} still with a supervisor`,
            },
            {
              label: "Payments",
              value: String(payments.length),
              note: `₹${formatInr(money(payments))} overall`,
            },
            {
              label: "RAC pending",
              value: String(
                office?.proposals.filter((item) => item.status === "Submitted").length ??
                  "—",
              ),
              note: "Nominations to select",
            },
          ];

  const links =
    role === "scholar"
      ? admitted
        ? [
            ["/scholar/fee", "Fee and payments"],
            ["/scholar/rac", "Present RAC"],
            ["/scholar/course-work", "Course work"],
            ["/scholar/records/publications", "Add a publication"],
            ["/scholar/reports", "Six-month report"],
          ]
        : [["/scholar/dashboard#admission", "Admission application"]]
      : role === "supervisor"
        ? [
            ["/supervisor/scholars", "My scholars"],
            ["/supervisor/rac", "RAC proposal"],
            ["/supervisor/reviews", "Scholar requests"],
          ]
        : role === "staff"
          ? [
              ["/admin/vacancies", "Vacancies"],
              ["/admin/incomplete-applications", incompleteApplicationsCopy.menu],
              ["/admin/applications", "Applications"],
              ["/admin/admission", "Selection"],
              ["/admin/registration-numbers", registrationCopy.menu],
            ]
          : role === "dean"
            ? [
                ["/admin/vacancies", "Vacancies"],
                ["/admin/incomplete-applications", incompleteApplicationsCopy.menu],
                ["/admin/applications", "Applications"],
                ["/admin/admission", "Selection"],
                ["/admin/registration-numbers", registrationCopy.menu],
                ["/admin/admission-archive", admissionArchiveCopy.menu],
              ]
            : [
                ["/admin/site", "Application window"],
                ["/admin/vacancies", "Vacancies"],
                ["/admin/incomplete-applications", incompleteApplicationsCopy.menu],
                ["/admin/applications", "Applications"],
                ["/admin/admission", "Selection"],
                ["/admin/registration-numbers", registrationCopy.menu],
                ["/admin/admission-archive", admissionArchiveCopy.menu],
                ["/admin/register", "Scholar register"],
                ["/admin/supervisors", "Supervisor register"],
                ["/admin/transfers", "Transfer a supervisor"],
                ["/admin/rac", "RAC decisions"],
                ["/admin/payments", "Payment approvals"],
                ["/admin/fee", "Fee collection"],
                ["/admin/promotions", "Promote a semester"],
                ["/admin/results", "Course results"],
              ];
  if (session && session.role === role && role === "scholar") {
    return (
      <ScholarDashboard
        identifier={session.identifier}
        name={session.name.trim() || session.identifier}
        admitted={admitted}
      />
    );
  }
  if (session && session.role === role && role === "supervisor") {
    return (
      <SupervisorDashboard
        identifier={session.identifier}
        name={session.name.trim() || session.identifier}
      />
    );
  }

  const shownLinks = isOfficeRole(role)
    ? links.filter(
        (link): link is [string, string] =>
          Boolean(link[0]) && canOpenMenu(link[0] ?? "", role, resolvedMenus(rights)),
      )
    : links;

  return (
    <div>
      {session &&
      (role === "scholar" || role === "supervisor") &&
      session.role === role ? (
        <>
          {role === "scholar" ? (
            <FeeReminderBanner
              identifier={session.identifier}
              name={session.name.trim() || session.identifier}
            />
          ) : null}
          <ProfileCard role={role} />
        </>
      ) : (
        <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-card">
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {intro.title}
            </p>
            <h1 className="mt-2 font-heading text-4xl">{name}</h1>
            {session && session.role === role && role === "scholar" ? (
              <ScholarRecordLine
                identifier={session.identifier}
                allocations={office?.allocations ?? []}
              />
            ) : null}
          </div>
        </section>
      )}
      {session &&
      session.role === role &&
      (role === "scholar" || role === "supervisor") ? (
        <PersonalDetailsPanel
          role={role}
          identifier={session.identifier}
          name={session.name.trim() || session.identifier}
        />
      ) : null}
      {session && session.role === role && role === "scholar" ? (
        <ScholarFeeStatus identifier={session.identifier} />
      ) : null}
      {session && session.role === role && role === "scholar" && !admitted ? (
        <p className="mt-4 text-sm leading-6 text-secondary">
          Course work, requests, and doctoral progress open after the research office
          completes admission.
        </p>
      ) : null}
      {isOfficeRole(role) && (canExportScholars || canExportSupervisors) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canExportScholars ? (
            <button
              type="button"
              className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
              onClick={() => downloadAllScholarDetails()}
            >
              {personFileCopy.downloadAllScholars}
            </button>
          ) : null}
          {canExportSupervisors ? (
            <button
              type="button"
              className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
              onClick={() => downloadAllSupervisorDetails()}
            >
              {personFileCopy.downloadAllSupervisors}
            </button>
          ) : null}
        </div>
      ) : null}
      {office?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{office.detail}</p>
      ) : null}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Stat key={card.label} {...card} />
        ))}
      </ul>
      <ul className="mt-6 flex flex-wrap gap-2">
        {shownLinks.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href ?? "/"}
              className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
