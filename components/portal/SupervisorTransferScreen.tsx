"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { officeActionCopy } from "@/data/office-actions";
import { researchRegister } from "@/data/research-register";
import { currentOffice, saveAllocation, sameId, subscribeOffice } from "@/lib/office";
import {
  batchOf,
  currentAllotments,
  currentQuotas,
  guideFigures,
  registrationOf,
  sameGuide,
  scholarSignInId,
  subscribeRegister,
  supervisorForGuide,
} from "@/lib/register";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";

const copy = officeActionCopy.transfer;

const transferSchema = z.object({
  toSupervisor: z.string().min(1, "Select the new supervisor."),
  scholarIds: z.array(z.string()).min(1, "Select at least one scholar."),
});

type TransferValues = z.infer<typeof transferSchema>;

type GuideOption = {
  id: string;
  identifier: string;
  name: string;
  vacancy: number | null;
};

type ScholarRow = {
  identifier: string;
  name: string;
  batchName: string;
  registration: string;
  currentName: string;
  currentIdentifier: string;
};

export function SupervisorTransferScreen() {
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  const [fromSupervisor, setFromSupervisor] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { toSupervisor: "", scholarIds: [] },
  });
  const selectedIds = useWatch({ control: form.control, name: "scholarIds" }) ?? [];
  const toSupervisor = useWatch({ control: form.control, name: "toSupervisor" }) ?? "";

  const supervisors = useMemo<GuideOption[]>(() => {
    if (!office || !users) return [];
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
    return [
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
  }, [office, quotas, users]);

  const rows = useMemo<ScholarRow[]>(() => {
    if (!office || !users) return [];
    const allocations = office.allocations;
    const registerRows = researchRegister.scholars.map((scholar) => {
      const identifier = scholarSignInId(scholar);
      const allocation =
        allocations.find((item) => sameId(item.scholarIdentifier, identifier)) ??
        allocations.find(
          (item) =>
            item.scholarName.trim().toLowerCase() === scholar.name.trim().toLowerCase(),
        );
      const guide = supervisorForGuide(scholar.guideName);
      const currentName =
        allocation?.supervisorName.trim() ||
        guide?.name.trim() ||
        scholar.guideName.trim();
      const currentIdentifier =
        allocation?.supervisorIdentifier.trim() ||
        guide?.supervisorId.trim() ||
        scholar.guideName.trim();
      return {
        identifier,
        name: scholar.name,
        batchName: batchOf(scholar.batchId)?.name ?? "",
        registration:
          registrationOf(scholar, allotments) || scholar.applicationNumber || identifier,
        currentName: currentName || "—",
        currentIdentifier,
      };
    });
    const extra = allocations
      .filter(
        (item) =>
          !registerRows.some((row) => sameId(row.identifier, item.scholarIdentifier)),
      )
      .map((item) => ({
        identifier: item.scholarIdentifier,
        name: item.scholarName,
        batchName: "",
        registration: item.scholarIdentifier,
        currentName: item.supervisorName,
        currentIdentifier: item.supervisorIdentifier,
      }));
    return [...registerRows, ...extra];
  }, [allotments, office, users]);

  if (!office || !users) {
    return <p className="text-sm text-muted-foreground">Loading transfers…</p>;
  }

  const listed = rows.filter((row) => {
    const fromMatch =
      fromSupervisor === "" ||
      sameId(row.currentIdentifier, fromSupervisor) ||
      sameGuide(row.currentName, fromSupervisor);
    return (
      fromMatch &&
      textMatches(query, [row.name, row.identifier, row.registration, row.currentName])
    );
  });

  function toggleScholar(identifier: string) {
    const next = selectedIds.includes(identifier)
      ? selectedIds.filter((item) => item !== identifier)
      : [...selectedIds, identifier];
    form.setValue("scholarIds", next, { shouldValidate: true });
  }

  function toggleAll() {
    const ids = listed.map((row) => row.identifier);
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    form.setValue("scholarIds", allOn ? [] : ids, { shouldValidate: true });
  }

  async function onSubmit(values: TransferValues) {
    const supervisor = supervisors.find(
      (item) => item.identifier === values.toSupervisor,
    );
    const chosen = rows.filter((row) => values.scholarIds.includes(row.identifier));
    if (!supervisor || chosen.length === 0) {
      setNotice("Select scholars and the new supervisor.");
      return;
    }
    const moving = chosen.filter(
      (row) =>
        !sameId(row.currentIdentifier, supervisor.identifier) &&
        !sameGuide(row.currentName, supervisor.name),
    );
    if (moving.length === 0) {
      setNotice("Those scholars are already with that supervisor.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const moved: string[] = [];
    for (const scholar of moving) {
      const saved = await saveAllocation({
        scholarIdentifier: scholar.identifier,
        scholarName: scholar.name,
        supervisorIdentifier: supervisor.identifier,
        supervisorName: supervisor.name,
      });
      if (!saved.ok) {
        setBusy(false);
        setNotice(
          moved.length
            ? `${moved.join(", ")} transferred. ${saved.message}`
            : saved.message,
        );
        return;
      }
      moved.push(scholar.name);
    }
    setBusy(false);
    form.setValue("scholarIds", []);
    setNotice(
      moved.length === 1
        ? `${moved[0]} is now with ${supervisor.name}.`
        : `${moved.length} scholars are now with ${supervisor.name}.`,
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        {copy.kicker}
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">{copy.title}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
        {copy.detail}
      </p>
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <form
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <FormField label={copy.fromLabel} htmlFor="transfer-from">
          <NativeSelect
            id="transfer-from"
            value={fromSupervisor}
            onChange={(event) => {
              setFromSupervisor(event.target.value);
              form.setValue("scholarIds", []);
            }}
          >
            <option value="">All supervisors</option>
            {supervisors.map((item) => (
              <option key={item.id} value={item.identifier}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label={copy.toLabel}
          htmlFor="transfer-to"
          required
          error={form.formState.errors.toSupervisor?.message}
        >
          <NativeSelect
            id="transfer-to"
            value={toSupervisor}
            onChange={(event) =>
              form.setValue("toSupervisor", event.target.value, { shouldValidate: true })
            }
          >
            <option value="">Select the new supervisor</option>
            {supervisors.map((item) => (
              <option key={item.id} value={item.identifier}>
                {item.name}
                {item.vacancy === null ? "" : ` · vacancy ${item.vacancy}`}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="sm:col-span-2">
          <Button type="submit" variant="gold" disabled={busy}>
            {copy.submit}
          </Button>
          {form.formState.errors.scholarIds?.message ? (
            <p className="mt-2 text-sm text-secondary">
              {form.formState.errors.scholarIds.message}
            </p>
          ) : null}
        </div>
      </form>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={listed.length}
        total={rows.length}
        filename="supervisor-transfers.csv"
        headers={["scholar_name", "identifier", "batch", "present_supervisor"]}
        rows={listed.map((row) => [
          row.name,
          row.identifier,
          row.batchName,
          row.currentName,
        ])}
      />
      {listed.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        listed.length > 0 &&
                        listed.every((row) => selectedIds.includes(row.identifier))
                      }
                      onChange={toggleAll}
                    />
                    <span className="sr-only">Select all</span>
                  </label>
                </th>
                <th className="px-3 py-3">Scholar</th>
                <th className="px-3 py-3">Batch</th>
                <th className="px-3 py-3">Present supervisor</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((row) => (
                <tr key={row.identifier} className="border-t border-border">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.identifier)}
                      onChange={() => toggleScholar(row.identifier)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-primary">
                      <PersonNameLink
                        role="scholar"
                        name={row.name}
                        identifier={row.identifier}
                      />
                    </p>
                    <p className="text-muted-foreground">{row.registration}</p>
                  </td>
                  <td className="px-3 py-3">{row.batchName || "—"}</td>
                  <td className="px-3 py-3">
                    {row.currentName && row.currentName !== "—" ? (
                      <PersonNameLink
                        role="supervisor"
                        name={row.currentName}
                        identifier={row.currentIdentifier || row.currentName}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
