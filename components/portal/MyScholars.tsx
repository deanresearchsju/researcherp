"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { Portrait } from "@/components/portal/Portrait";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  currentOffice,
  presentRac,
  sameId,
  scholarsStillGuidedBy,
  subscribeOffice,
} from "@/lib/office";
import {
  batchOf,
  currentAllotments,
  registrationOf,
  scholarSignInId,
  subscribeRegister,
} from "@/lib/register";
import { scholarSemesterLabel } from "@/lib/scholar-identity";
import { currentPortraits, portraitFor, subscribePortraits } from "@/lib/portraits";
import { usePortalSession } from "@/lib/use-preview-session";

export function MyScholars() {
  const session = usePortalSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const portraits = useSyncExternalStore(
    subscribePortraits,
    currentPortraits,
    () => null,
  );
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  if (!office) return <p className="text-sm text-muted-foreground">Loading scholars…</p>;
  if (!session || session.role !== "supervisor") {
    return (
      <p className="text-sm">
        <Link
          href="/login/supervisor"
          className="font-semibold text-primary hover:underline"
        >
          Sign in as a supervisor
        </Link>
        .
      </p>
    );
  }
  const allotted = office.allocations.filter((item) =>
    sameId(item.supervisorIdentifier, session.identifier),
  );
  const guided = scholarsStillGuidedBy(
    session.name,
    session.identifier,
    office.allocations,
  );
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Supervisor
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">My scholars</h1>
      {allotted.length === 0 && guided.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No scholar is allotted to you yet.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {allotted.map((scholar) => {
            const present = presentRac(office.proposals, scholar.scholarIdentifier);
            return (
              <li
                key={scholar.id}
                className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <Portrait
                  src={portraitFor(
                    portraits,
                    scholar.scholarIdentifier,
                    scholar.scholarName,
                  )}
                  name={scholar.scholarName}
                />
                <div>
                  <h2 className="font-semibold text-primary">
                    <PersonNameLink
                      role="scholar"
                      name={scholar.scholarName}
                      identifier={scholar.scholarIdentifier}
                    />
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {scholar.scholarIdentifier}
                  </p>
                  <p className="mt-2 text-sm">
                    Semester: {scholarSemesterLabel(scholar.scholarIdentifier)}
                  </p>
                  <p className="mt-2 text-sm">
                    {present
                      ? `RAC: ${present.guide}, ${present.internal.name}, ${present.external.name}`
                      : "RAC not constituted yet."}
                  </p>
                </div>
              </li>
            );
          })}
          {guided.map((scholar) => {
            const batch = batchOf(scholar.batchId);
            const registration = registrationOf(scholar, allotments);
            return (
              <li
                key={scholar.id}
                className="rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <h2 className="font-semibold text-primary">
                  <PersonNameLink
                    role="scholar"
                    name={scholar.name}
                    identifier={scholarSignInId(scholar)}
                  />
                </h2>
                <p className="text-sm text-muted-foreground">
                  {registration || scholar.fileNumber || scholar.applicationNumber || "—"}
                  {batch ? ` · ${batch.name}` : ""}
                  {scholar.department ? ` · ${scholar.department}` : ""}
                </p>
                <p className="mt-2 text-sm">
                  Semester: {scholarSemesterLabel(scholarSignInId(scholar))}
                </p>
                <p className="mt-2 text-sm">
                  {scholar.title || "Title is not on the register yet."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
