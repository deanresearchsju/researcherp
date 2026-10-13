"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Portrait } from "@/components/portal/Portrait";
import { currentOffice, presentRac, sameId, subscribeOffice } from "@/lib/office";
import {
  batchOf,
  currentAllotments,
  registrationOf,
  scholarsGuidedBy,
  subscribeRegister,
} from "@/lib/register";
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
  const guided = scholarsGuidedBy(session.name, session.identifier).filter(
    (scholar) =>
      !allotted.some((item) => item.scholarName.toLowerCase() === scholar.name.toLowerCase()),
  );
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Supervisor
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">My scholars</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Scholars the research office has allotted to you, and the present RAC only.
      </p>
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
                  <h2 className="font-semibold text-primary">{scholar.scholarName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {scholar.scholarIdentifier}
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
                <h2 className="font-semibold text-primary">{scholar.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {registration || scholar.fileNumber || scholar.applicationNumber || "—"}
                  {batch ? ` · ${batch.name}` : ""}
                  {scholar.department ? ` · ${scholar.department}` : ""}
                </p>
                <p className="mt-2 text-sm">{scholar.title || "Title is not on the register yet."}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
