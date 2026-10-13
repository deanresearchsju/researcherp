"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { researchRegister } from "@/data/research-register";
import {
  currentOffice,
  removeAllocation,
  saveAllocation,
  subscribeOffice,
} from "@/lib/office";
import {
  currentQuotas,
  guideFigures,
  sameGuide,
  subscribeRegister,
} from "@/lib/register";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";

export function AllocationScreen() {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const [scholarId, setScholarId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [guideFilter, setGuideFilter] = useState("");

  if (!office || !users) {
    return <p className="text-sm text-muted-foreground">Loading allotments…</p>;
  }

  const registerScholars = researchRegister.scholars.map((scholar) => ({
    id: scholar.id,
    identifier:
      scholar.email ||
      scholar.registrationNumber ||
      scholar.applicationNumber ||
      scholar.id,
    name: scholar.name,
  }));
  const scholars = [
    ...registerScholars,
    ...users.users
      .filter(
        (user) =>
          user.role === "scholar" &&
          !registerScholars.some(
            (scholar) =>
              scholar.identifier.toLowerCase() === user.identifier.toLowerCase(),
          ),
      )
      .map((user) => ({ id: user.id, identifier: user.identifier, name: user.name })),
  ];
  const idCounts = new Map<string, number>();
  for (const supervisor of researchRegister.supervisors) {
    const identifier = supervisor.supervisorId.trim();
    if (!identifier) continue;
    idCounts.set(identifier, (idCounts.get(identifier) ?? 0) + 1);
  }
  const registerSupervisors = researchRegister.supervisors.map((supervisor) => {
    const identifier = supervisor.supervisorId.trim();
    const unique = identifier.length > 0 && idCounts.get(identifier) === 1;
    return {
      id: `${supervisor.serialNo}-${supervisor.name}`,
      identifier: unique ? identifier : supervisor.name,
      name: supervisor.name,
      vacancy: guideFigures(supervisor, quotas, office.allocations).vacancy,
    };
  });
  const supervisors = [
    ...registerSupervisors,
    ...users.users
      .filter(
        (user) =>
          user.role === "supervisor" &&
          !registerSupervisors.some(
            (supervisor) =>
              supervisor.identifier.toLowerCase() === user.identifier.toLowerCase() ||
              sameGuide(supervisor.name, user.name),
          ),
      )
      .map((user) => ({
        id: user.id,
        identifier: user.identifier,
        name: user.name,
        vacancy: null as number | null,
      })),
  ];

  async function allot() {
    const scholar = scholars.find((user) => user.identifier === scholarId);
    const supervisor = supervisors.find((user) => user.identifier === supervisorId);
    if (!scholar || !supervisor) {
      setNotice("Select a scholar and a supervisor.");
      return;
    }
    const saved = await saveAllocation({
      scholarIdentifier: scholar.identifier,
      scholarName: scholar.name,
      supervisorIdentifier: supervisor.identifier,
      supervisorName: supervisor.name,
    });
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    const guide = researchRegister.supervisors.find(
      (item) =>
        (item.supervisorId.trim() &&
          item.supervisorId.trim() === supervisor.identifier) ||
        sameGuide(item.name, supervisor.name),
    );
    const remaining = guide
      ? guideFigures(guide, quotas, currentOffice()?.allocations ?? office.allocations)
          .vacancy
      : null;
    setNotice(
      remaining === null
        ? `${scholar.name} is allotted to ${supervisor.name}.`
        : `${scholar.name} is allotted to ${supervisor.name}. Vacancy is now ${remaining}.`,
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Research office
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Scholar allotment</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Allot a scholar to one supervisor. Each new allotment reduces that supervisor’s
        vacancy by one. RAC nominations and supervisor approval start after this.
      </p>
      {office.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{office.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2">
        <FormField label="Scholar" htmlFor="allot-scholar">
          <NativeSelect
            id="allot-scholar"
            value={scholarId}
            onChange={(event) => setScholarId(event.target.value)}
          >
            <option value="">Select a scholar</option>
            {scholars.map((user) => (
              <option key={user.id} value={user.identifier}>
                {user.name} · {user.identifier}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Supervisor" htmlFor="allot-supervisor">
          <NativeSelect
            id="allot-supervisor"
            value={supervisorId}
            onChange={(event) => setSupervisorId(event.target.value)}
          >
            <option value="">Select a supervisor</option>
            {supervisors.map((user) => (
              <option key={user.id} value={user.identifier}>
                {user.name}
                {user.vacancy === null ? "" : ` · vacancy ${user.vacancy}`}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="sm:col-span-2">
          <Button type="button" variant="gold" onClick={() => void allot()}>
            Allot
          </Button>
        </div>
      </div>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "guide",
            label: "Supervisor",
            value: guideFilter,
            options: supervisors.map((user) => ({
              value: user.identifier,
              label: user.name,
            })),
            onChange: setGuideFilter,
          },
        ]}
        shown={
          office.allocations.filter(
            (item) =>
              (guideFilter === "" || item.supervisorIdentifier === guideFilter) &&
              textMatches(query, [
                item.scholarName,
                item.scholarIdentifier,
                item.supervisorName,
                item.supervisorIdentifier,
              ]),
          ).length
        }
        total={office.allocations.length}
        filename="allotments.csv"
        headers={[
          "scholar_name",
          "scholar_identifier",
          "supervisor_name",
          "supervisor_identifier",
        ]}
        rows={office.allocations
          .filter(
            (item) =>
              (guideFilter === "" || item.supervisorIdentifier === guideFilter) &&
              textMatches(query, [
                item.scholarName,
                item.scholarIdentifier,
                item.supervisorName,
                item.supervisorIdentifier,
              ]),
          )
          .map((item) => [
            item.scholarName,
            item.scholarIdentifier,
            item.supervisorName,
            item.supervisorIdentifier,
          ])}
      />
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3">Scholar</th>
              <th className="px-3 py-3">Supervisor</th>
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {office.allocations
              .filter(
                (item) =>
                  (guideFilter === "" || item.supervisorIdentifier === guideFilter) &&
                  textMatches(query, [
                    item.scholarName,
                    item.scholarIdentifier,
                    item.supervisorName,
                    item.supervisorIdentifier,
                  ]),
              )
              .map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary">{item.scholarName}</p>
                    <p className="text-muted-foreground">{item.scholarIdentifier}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary">{item.supervisorName}</p>
                    <p className="text-muted-foreground">{item.supervisorIdentifier}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void removeAllocation(item)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
