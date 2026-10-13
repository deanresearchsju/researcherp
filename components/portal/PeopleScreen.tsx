"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { scholarRecordMenus } from "@/data/scholar-records";
import { formatIsoDate } from "@/lib/dates";
import {
  allocationFor,
  currentOffice,
  presentRac,
  sameId,
  subscribeOffice,
} from "@/lib/office";
import { currentPortalUsers, subscribePortalUsers, type PortalUser } from "@/lib/users";

export function PeopleScreen() {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(subscribePortalUsers, currentPortalUsers, () => null);
  const [person, setPerson] = useState<PortalUser | null>(null);

  if (!office || !users) {
    return <p className="text-sm text-muted-foreground">Loading people…</p>;
  }

  const scholars = users.users.filter((user) => user.role === "scholar");
  const supervisors = users.users.filter((user) => user.role === "supervisor");

  function recordsFor(identifier: string) {
    return office?.records.filter((record) => sameId(record.scholarIdentifier, identifier)) ?? [];
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Research office
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">People</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Open one scholar or supervisor and read the menus on their record. This view is for the office only.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {[
          ["Scholars", scholars],
          ["Supervisors", supervisors],
        ].map(([title, list]) => (
          <section key={String(title)}>
            <h2 className="font-semibold text-primary">{String(title)}</h2>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {(list as PortalUser[]).map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <div>
                    <p className="font-semibold text-primary">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.identifier}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPerson(user)}>
                    View
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {person ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="font-heading text-2xl text-primary">{person.name}</h2>
          <p className="text-sm text-muted-foreground">
            {person.role} · {person.identifier}
          </p>
          {person.role === "scholar" ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm">
                Guide:{" "}
                {allocationFor(office.allocations, person.identifier)?.supervisorName ??
                  "Not allotted"}
              </p>
              <PresentLine identifier={person.identifier} />
              {scholarRecordMenus.map((menu) => {
                const rows = recordsFor(person.identifier).filter((record) => record.kind === menu.kind);
                return (
                  <div key={menu.kind}>
                    <h3 className="font-semibold text-primary">{menu.label}</h3>
                    {rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No records.</p>
                    ) : (
                      rows.map((record) => (
                        <div key={record.id} className="mt-2 text-sm">
                          <Badge variant={record.status === "Approved" ? "gold" : "purple"}>
                            {record.status}
                          </Badge>
                          <span className="ml-2 text-muted-foreground">
                            {record.createdAt ? formatIsoDate(record.createdAt.slice(0, 10)) : ""}
                          </span>
                          {menu.fields.map((field) => (
                            <p key={field.name}>
                              {field.label}: {record.payload[field.name] || "—"}
                            </p>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <SupervisorFile identifier={person.identifier} name={person.name} />
          )}
        </section>
      ) : null}
    </div>
  );
}

function PresentLine({ identifier }: { identifier: string }) {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const present = office ? presentRac(office.proposals, identifier) : null;
  if (!present) return <p className="text-sm">RAC: not constituted.</p>;
  return (
    <p className="text-sm">
      RAC: {present.guide} (guide), {present.internal.name} (internal), {present.external.name}{" "}
      (external)
    </p>
  );
}

function SupervisorFile({ identifier, name }: { identifier: string; name: string }) {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  if (!office) return null;
  const scholars = office.allocations.filter((item) => sameId(item.supervisorIdentifier, identifier));
  const proposals = office.proposals.filter((item) => sameId(item.supervisorIdentifier, identifier));
  return (
    <div className="mt-4 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-primary">Allotted scholars</h3>
        {scholars.length === 0 ? (
          <p className="text-muted-foreground">None.</p>
        ) : (
          scholars.map((item) => (
            <p key={item.id}>
              {item.scholarName} · {item.scholarIdentifier}
            </p>
          ))
        )}
      </div>
      <div>
        <h3 className="font-semibold text-primary">RAC nominations by {name}</h3>
        {proposals.length === 0 ? (
          <p className="text-muted-foreground">None.</p>
        ) : (
          proposals.map((item) => (
            <div key={item.id} className="mt-2">
              <p className="font-semibold">
                {item.scholarName} · {item.kind} · {item.status}
              </p>
              {item.nominees.map((nominee) => (
                <p key={nominee.key}>
                  {nominee.side}: {nominee.name}, {nominee.designation}, {nominee.institution},{" "}
                  {nominee.email}
                  {item.selectedInternal === nominee.key || item.selectedExternal === nominee.key
                    ? " · selected"
                    : ""}
                </p>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
