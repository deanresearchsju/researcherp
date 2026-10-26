"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import { PageTitle } from "@/components/portal/Desk";
import { GuideHistory } from "@/components/portal/GuideHistory";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import {
  currentOffice,
  removeAllocation,
  saveAllocation,
  subscribeOffice,
} from "@/lib/office";
import {
  currentPassedOut,
  currentQuotas,
  currentStandings,
  isPassedOut,
  subscribeRegister,
  registerScholarsInOrder,
} from "@/lib/register";
import { recordGuideChange } from "@/lib/guide-history";
import { guideOptions } from "@/lib/supervision";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";

export function AllocationScreen() {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const standings = useSyncExternalStore(
    subscribeRegister,
    currentStandings,
    currentStandings,
  );
  useSyncExternalStore(subscribeRegister, currentPassedOut, currentPassedOut);
  const [scholarId, setScholarId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [guideFilter, setGuideFilter] = useState("");

  if (!office || !users) {
    return <p className="text-sm text-muted-foreground">Loading allotments…</p>;
  }

  const registerScholars = registerScholarsInOrder().map((scholar) => ({
    id: scholar.id,
    identifier:
      scholar.email ||
      scholar.registrationNumber ||
      scholar.applicationNumber ||
      scholar.id,
    name: scholar.name,
  }));
  const allScholars = [
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
  const scholars = allScholars.filter((user) => !isPassedOut(user.identifier, user.name));
  const supervisors = guideOptions(office.allocations, users.users, quotas, standings);
  // Only supervisors who have a vacancy are offered.
  const activeSupervisors = supervisors.filter(
    (user) => user.status === "Active" && (user.vacancy === null || user.vacancy > 0),
  );

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
    const remaining =
      guideOptions(
        currentOffice()?.allocations ?? office?.allocations ?? [],
        users?.users ?? [],
        quotas,
        standings,
      ).find((item) => item.identifier === supervisor.identifier)?.vacancy ?? null;
    setNotice(
      remaining === null
        ? `${scholar.name} is allotted to ${supervisor.name}.`
        : `${scholar.name} is allotted to ${supervisor.name}. Vacancy is now ${remaining}.`,
    );
  }

  return (
    <div>
      <PageTitle kicker="Research office" title="Scholar allotment" />
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
            {activeSupervisors.map((user) => (
              <option key={user.id} value={user.identifier}>
                {user.name}
                {user.subject ? ` · ${user.subject}` : ""}
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
              filterMatches(guideFilter, item.supervisorIdentifier) &&
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
              filterMatches(guideFilter, item.supervisorIdentifier) &&
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
                  filterMatches(guideFilter, item.supervisorIdentifier) &&
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
                    <p className="font-semibold text-primary">
                      <PersonNameLink
                        role="scholar"
                        name={item.scholarName}
                        identifier={item.scholarIdentifier}
                      />
                    </p>
                    <p className="text-muted-foreground">{item.scholarIdentifier}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary">
                      <PersonNameLink
                        role="supervisor"
                        name={item.supervisorName}
                        identifier={item.supervisorIdentifier}
                      />
                    </p>
                    <p className="text-muted-foreground">{item.supervisorIdentifier}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void removeAllocation(item);
                        void recordGuideChange({
                          scholarIdentifier: item.scholarIdentifier,
                          scholarName: item.scholarName,
                          fromName: item.supervisorName,
                          fromIdentifier: item.supervisorIdentifier,
                          toName: "",
                          toIdentifier: "",
                          kind: "Removed",
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <GuideHistory
        version={office.allocations
          .map((item) => item.id + item.supervisorName)
          .join("|")}
      />
    </div>
  );
}
