"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { scholarRecordMenus } from "@/data/scholar-records";
import { portalIntro } from "@/data/portal";
import { batchOf, scholarBySignIn, scholarsGuidedBy } from "@/lib/register";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import {
  allocationFor,
  currentOffice,
  presentRac,
  sameId,
  subscribeOffice,
  type OfficeRecord,
} from "@/lib/office";
import { ProfileCard } from "@/components/portal/ProfileCard";
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

function MissingDetails({ identifier }: { identifier: string }) {
  const personal = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("personal_details", onChange),
    () => currentScholarRecords("personal_details"),
    () => null,
  );
  const menu = scholarRecordMenus.find((item) => item.kind === "personal_details");
  if (!menu) return null;
  const saved = personal?.records.find((record) =>
    sameId(record.scholarIdentifier, identifier),
  );
  const missing = menu.fields.filter(
    (field) => field.required && !(saved?.payload[field.name] ?? "").trim(),
  );
  if (personal && missing.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-semibold text-primary">Details still to fill</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Complete the personal details that are still blank.
      </p>
      {personal && missing.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm leading-6">
          {missing.map((field) => (
            <li key={field.name}>{field.label}</li>
          ))}
        </ul>
      ) : null}
      <Link
        href={`/scholar/records/${menu.slug}`}
        className="mt-4 inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
      >
        Open personal details
      </Link>
    </section>
  );
}

function ScholarRecordLine({
  identifier,
  allocations,
}: {
  identifier: string;
  allocations: Parameters<typeof allocationFor>[0];
}) {
  const record = scholarBySignIn(identifier);
  if (record) {
    const batch = batchOf(record.batchId);
    return (
      <p className="mt-3 max-w-2xl text-sm leading-6 text-accent">
        {batch ? `${batch.name}. ` : null}
        Guide: {record.guideName || "—"}.{record.title ? ` Title: ${record.title}.` : ""}
        {record.registrationNumber
          ? ` Registration number: ${record.registrationNumber}.`
          : " Registration number is to be allotted."}
      </p>
    );
  }
  const guide = allocationFor(allocations, identifier);
  return (
    <p className="mt-3 text-sm text-accent">
      {guide
        ? `Guide: ${guide.supervisorName}`
        : "A supervisor has not been allotted yet."}
    </p>
  );
}

export function DashboardHome({ role }: { role: Role }) {
  const intro = portalIntro[role];
  const session = usePortalSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
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

  const registerScholars =
    session && role === "supervisor"
      ? scholarsGuidedBy(session.name, session.identifier).filter(
          (scholar) =>
            !allotted.some(
              (item) => item.scholarName.toLowerCase() === scholar.name.toLowerCase(),
            ),
        )
      : [];

  const cards =
    role === "scholar"
      ? [
          {
            label: "Payments",
            value: String(myPayments.length),
            note: `₹${formatInr(money(myPayments))} recorded`,
          },
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
      ? [
          ["/scholar/records/publications", "Add a publication"],
          ["/scholar/records/six-month-report", "Six-month report"],
          ["/scholar/records/payment-history", "Payment history"],
          ["/scholar/rac", "Present RAC"],
        ]
      : role === "supervisor"
        ? [
            ["/supervisor/scholars", "My scholars"],
            ["/supervisor/rac", "RAC proposal"],
            ["/supervisor/reviews", "Scholar requests"],
          ]
        : [
            ["/admin/site", "Home and admissions"],
            ["/admin/news", "News and events"],
            ["/admin/allocations", "Allot a scholar"],
            ["/admin/rac", "RAC decisions"],
            ["/admin/people", "View a person"],
            ["/admin/register", "Scholar register"],
            ["/admin/supervisors", "Supervisor register"],
            ["/admin/records/payment-history", "All payments"],
          ];

  return (
    <div>
      {session &&
      (role === "scholar" || role === "supervisor") &&
      session.role === role ? (
        <ProfileCard role={role} />
      ) : (
        <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-card">
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {intro.title}
            </p>
            <h1 className="mt-2 font-heading text-4xl">{name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80">
              {intro.summary}
            </p>
            {session && session.role === role && role === "scholar" ? (
              <ScholarRecordLine
                identifier={session.identifier}
                allocations={office?.allocations ?? []}
              />
            ) : null}
          </div>
        </section>
      )}
      {session && session.role === role && role === "scholar" ? (
        <MissingDetails identifier={session.identifier} />
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
        {links.map(([href, label]) => (
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
