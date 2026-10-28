"use client";

import { useSyncExternalStore } from "react";

import { scholarRecordMenus } from "@/data/scholar-records";
import { personFileCopy } from "@/data/person-file";
import { portalIntro } from "@/data/portal";
import { PersonalDetailsPanel } from "@/components/portal/PersonalDetailsPanel";
import { FeeReminderBanner } from "@/components/portal/FeeReminderBanner";
import { ScholarFeeStatus } from "@/components/portal/ScholarFeeStatus";
import { isOfficeRole } from "@/lib/access";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { currentAdmission, scholarIsAdmitted, subscribeAdmission } from "@/lib/admission";
import { downloadAllScholarDetails } from "@/lib/person-file";
import { currentApplications, subscribeApplications } from "@/lib/records";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { currentOffice, subscribeOffice, type OfficeRecord } from "@/lib/office";
import { ProfileCard } from "@/components/portal/ProfileCard";
import { WelcomeBanner } from "@/components/portal/WelcomeBanner";
import {
  ScholarDashboard,
  SupervisorDashboard,
} from "@/components/portal/MemberDashboard";
import { usePortalSession } from "@/lib/use-preview-session";
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

export function DashboardHome({ role: pageRole }: { role: Role }) {
  const session = usePortalSession();
  const canExportScholars = useCanMenuAction("export", "/admin/register");
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
  const waitingForSupervisor = records.filter(
    (record) => reviewKinds.has(record.kind) && record.status === "Submitted",
  );
  const waitingForOffice = records.filter(
    (record) =>
      record.status === "Supervisor approved" ||
      (!reviewKinds.has(record.kind) && record.status === "Submitted"),
  );
  const payments = records.filter((record) => record.kind === "payment");
  useSyncExternalStore(subscribeApplications, currentApplications, () => null);

  // Count cards are for the administrator and the Dean only; everyone else sees the greeting and their work.
  const cards =
    role === "admin" || role === "dean"
      ? [
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
              office?.proposals.filter(
                (item) => item.status === "Submitted" || item.status === "With VC",
              ).length ?? "—",
            ),
            note: "Nominations to select",
          },
        ]
      : [];

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
        <WelcomeBanner
          name={session && session.role === role ? name : ""}
          roleLabel={intro.title}
          summary={intro.summary}
        />
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
      {isOfficeRole(role) && canExportScholars ? (
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
        </div>
      ) : null}
      {office?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{office.detail}</p>
      ) : null}
      {cards.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map((card) => (
            <Stat key={card.label} {...card} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
