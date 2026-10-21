"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import {
  DeskModal,
  FormDialog,
  GateBanner,
  ManageCard,
  PageTitle,
} from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatIsoDate } from "@/lib/dates";
import { currentDoctoral, latestSynopsis, subscribeDoctoral } from "@/lib/doctoral";
import {
  currentOffice,
  sameId,
  scholarsStillGuidedBy,
  subscribeOffice,
} from "@/lib/office";
import { scholarSignInId } from "@/lib/register";
import {
  downloadEvaluatorSheet,
  invitationMailto,
  loadEvaluations,
  nominateEvaluators,
  recordInvitation,
  reopenNominations,
  selectEvaluators,
  type EvaluationLoad,
} from "@/lib/thesis-evaluation";
import {
  activeIndex,
  blankEvaluator,
  evaluatorGroupLabel,
  evaluatorGroups,
  evaluatorsPerGroup,
  groupState,
  panelComplete,
  type EvaluationRecord,
  type Evaluator,
  type EvaluatorGroup,
  type SupervisorEvaluationView,
} from "@/lib/thesis-evaluation-model";
import { usePortalSession } from "@/lib/use-preview-session";

const fields: readonly [keyof Evaluator, string][] = [
  ["name", "Name"],
  ["designation", "Designation"],
  ["institution", "Institution"],
  ["address", "Address"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["specialization", "Specialisation"],
];

function blankNominees(): Record<EvaluatorGroup, Evaluator[]> {
  return {
    indian: Array.from({ length: evaluatorsPerGroup }, blankEvaluator),
    foreign: Array.from({ length: evaluatorsPerGroup }, blankEvaluator),
    local: Array.from({ length: evaluatorsPerGroup }, blankEvaluator),
  };
}

function useEvaluations() {
  const [load, setLoad] = useState<EvaluationLoad | null>(null);
  const refresh = useCallback(async () => {
    setLoad(await loadEvaluations());
  }, []);
  useEffect(() => {
    let live = true;
    void loadEvaluations().then((value) => {
      if (live) setLoad(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return { load, refresh };
}

/* ------------------------------ Supervisor ------------------------------ */

function NominationDialog({
  scholar,
  existing,
  onClose,
  onSaved,
}: {
  scholar: { identifier: string; name: string };
  existing: SupervisorEvaluationView | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [domain, setDomain] = useState(existing?.domain ?? "");
  const [nominees, setNominees] = useState<Record<EvaluatorGroup, Evaluator[]>>(() => {
    const base = blankNominees();
    if (!existing) return base;
    for (const group of evaluatorGroups) {
      existing.nominees[group].forEach((person, index) => {
        if (index < evaluatorsPerGroup) base[group][index] = { ...person };
      });
    }
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(
    group: EvaluatorGroup,
    index: number,
    key: keyof Evaluator,
    value: string,
  ) {
    setNominees((current) => ({
      ...current,
      [group]: current[group].map((person, itemIndex) =>
        itemIndex === index ? { ...person, [key]: value } : person,
      ),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const saved = await nominateEvaluators({
      scholarIdentifier: scholar.identifier,
      scholarName: scholar.name,
      title,
      domain,
      nominees,
    });
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onSaved(
      `Evaluators nominated for ${scholar.name}. The Dean will make the selection.`,
    );
  }

  return (
    <FormDialog
      title={`Nominate thesis evaluators · ${scholar.name}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel={existing ? "Save nominations" : "Send to the Dean"}
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Thesis title" htmlFor="eval-title" required>
          <Input
            id="eval-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        <FormField label="Domain" htmlFor="eval-domain" required>
          <Input
            id="eval-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </FormField>
      </div>
      {evaluatorGroups.map((group) => (
        <section key={group} className="space-y-3">
          <h3 className="text-sm font-bold tracking-[0.12em] text-secondary uppercase">
            {evaluatorGroupLabel[group]} evaluators
          </h3>
          {nominees[group].map((person, index) => (
            <fieldset key={index} className="rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-primary">
                {evaluatorGroupLabel[group]} evaluator {index + 1}
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {fields.map(([key, label]) => (
                  <FormField
                    key={key}
                    label={label}
                    htmlFor={`${group}-${index}-${key}`}
                    required={key === "name" || key === "institution" || key === "email"}
                  >
                    <Input
                      id={`${group}-${index}-${key}`}
                      type={key === "email" ? "email" : "text"}
                      value={person[key]}
                      onChange={(event) => update(group, index, key, event.target.value)}
                    />
                  </FormField>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      ))}
    </FormDialog>
  );
}

function SupervisorView() {
  const session = usePortalSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const { load, refresh } = useEvaluations();
  const [editing, setEditing] = useState<{ identifier: string; name: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!office || !doctoral || !load || !session) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!load.ok) return <GateBanner tone="danger">{load.message}</GateBanner>;
  const records = load.role === "supervisor" ? load.records : [];

  const scholars = [
    ...office.allocations
      .filter((item) => sameId(item.supervisorIdentifier, session.identifier))
      .map((item) => ({ identifier: item.scholarIdentifier, name: item.scholarName })),
    ...scholarsStillGuidedBy(session.name, session.identifier, office.allocations).map(
      (scholar) => ({ identifier: scholarSignInId(scholar), name: scholar.name }),
    ),
  ];

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {scholars.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scholar is with you yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scholars.map((scholar) => {
            const synopsis = latestSynopsis(doctoral, scholar.identifier);
            const accepted = synopsis?.status === "Approved";
            const record =
              records.find((item) =>
                sameId(item.scholarIdentifier, scholar.identifier),
              ) ?? null;
            const status = !accepted
              ? { label: "Synopsis not accepted", tone: "neutral" as const }
              : !record
                ? { label: "Nominate", tone: "closed" as const }
                : record.locked
                  ? { label: "With the Dean", tone: "open" as const }
                  : { label: "Nominated", tone: "pending" as const };
            return (
              <ManageCard
                key={scholar.identifier}
                eyebrow="Scholar"
                title={scholar.name}
                status={status}
                facts={
                  record
                    ? [
                        { label: "Title", value: record.title },
                        {
                          label: "Nominated on",
                          value: formatIsoDate(record.nominatedOn),
                        },
                      ]
                    : [
                        {
                          label: "Nominations",
                          value: accepted
                            ? "Three Indian, three foreign and three local evaluators"
                            : "Open after the Dean accepts the synopsis",
                        },
                      ]
                }
                actionLabel={record ? "Edit nominations" : "Nominate evaluators"}
                onAction={
                  accepted && !record?.locked
                    ? () => {
                        setNotice(null);
                        setEditing(scholar);
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
      {editing ? (
        <NominationDialog
          scholar={editing}
          existing={
            records.find((item) => sameId(item.scholarIdentifier, editing.identifier)) ??
            null
          }
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------- Office -------------------------------- */

function SelectDialog({
  record,
  onClose,
  onSaved,
}: {
  record: EvaluationRecord;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [ranks, setRanks] = useState<Record<EvaluatorGroup, string[]>>(() => {
    const result = {} as Record<EvaluatorGroup, string[]>;
    for (const group of evaluatorGroups) {
      const order = record.selection?.[group].order;
      result[group] = record.nominees[group].map((_, index) =>
        order ? String(order.indexOf(index) + 1) : "",
      );
    }
    return result;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const order = {} as Record<EvaluatorGroup, number[]>;
    for (const group of evaluatorGroups) {
      const count = record.nominees[group].length;
      const values = ranks[group].map(Number);
      if (values.some((value) => !value) || new Set(values).size !== count) {
        setError(
          `Give each ${evaluatorGroupLabel[group].toLowerCase()} evaluator a different order, 1 to ${count}.`,
        );
        return;
      }
      order[group] = values
        .map((rank, index) => ({ rank, index }))
        .sort((left, right) => left.rank - right.rank)
        .map((item) => item.index);
    }
    setBusy(true);
    const saved = await selectEvaluators(record.scholarIdentifier, order);
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onSaved(`Evaluators selected for ${record.scholarName}.`);
  }

  return (
    <FormDialog
      title={`Select evaluators · ${record.scholarName}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Save selection"
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <p className="text-sm">
        <span className="font-semibold text-primary">{record.title}</span> ·{" "}
        {record.domain}
      </p>
      {evaluatorGroups.map((group) => (
        <section key={group} className="space-y-2">
          <h3 className="text-sm font-bold tracking-[0.12em] text-secondary uppercase">
            {evaluatorGroupLabel[group]}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Evaluator</th>
                  <th className="px-3 py-2">Institution</th>
                  <th className="px-3 py-2">Contact</th>
                </tr>
              </thead>
              <tbody>
                {record.nominees[group].map((person, index) => (
                  <tr key={index} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <NativeSelect
                        aria-label={`Order for ${person.name}`}
                        value={ranks[group][index]}
                        onChange={(event) =>
                          setRanks((current) => ({
                            ...current,
                            [group]: current[group].map((value, itemIndex) =>
                              itemIndex === index ? event.target.value : value,
                            ),
                          }))
                        }
                      >
                        <option value="">—</option>
                        {record.nominees[group].map((_, rank) => (
                          <option key={rank} value={String(rank + 1)}>
                            {rank === 0 ? "1 (first choice)" : String(rank + 1)}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-primary">{person.name}</p>
                      <p className="text-muted-foreground">{person.designation}</p>
                    </td>
                    <td className="px-3 py-2">
                      {person.institution}
                      {person.address ? (
                        <p className="text-muted-foreground">{person.address}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {person.email}
                      <br />
                      {person.phone}
                      <br />
                      <span className="text-muted-foreground">
                        {person.specialization}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </FormDialog>
  );
}

function InvitationDialog({
  record,
  onClose,
  onChanged,
}: {
  record: EvaluationRecord;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function mark(
    group: EvaluatorGroup,
    status: "Invited" | "Accepted" | "Declined",
  ) {
    setBusy(true);
    setError(null);
    const saved = await recordInvitation(
      record.scholarIdentifier,
      group,
      status,
      notes[group] ?? "",
    );
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setNotes((current) => ({ ...current, [group]: "" }));
    await onChanged();
  }

  return (
    <DeskModal title={`Invitations · ${record.scholarName}`} onClose={onClose}>
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      <p className="text-sm">
        <span className="font-semibold text-primary">{record.title}</span> ·{" "}
        {record.domain}
      </p>
      {evaluatorGroups.map((group) => {
        const panel = record.selection?.[group];
        if (!panel) return null;
        const current = activeIndex(panel);
        const state = groupState(panel);
        const person = current === null ? null : record.nominees[group][current];
        const invite = current === null ? null : panel.invites[current];
        return (
          <section key={group} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-primary">
                {evaluatorGroupLabel[group]} evaluator
              </h3>
              <Badge
                variant={
                  state === "Accepted"
                    ? "gold"
                    : state === "All declined"
                      ? "maroon"
                      : "purple"
                }
              >
                {state}
              </Badge>
            </div>
            <ol className="space-y-1 text-sm">
              {panel.order.map((index, rank) => {
                const entry = panel.invites[index];
                const nominee = record.nominees[group][index];
                return (
                  <li
                    key={index}
                    className={
                      index === current
                        ? "font-semibold text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {rank + 1}. {nominee?.name} · {nominee?.institution} · {entry?.status}
                    {entry?.invitedOn
                      ? ` · invited ${formatIsoDate(entry.invitedOn)}`
                      : ""}
                    {entry?.respondedOn
                      ? ` · replied ${formatIsoDate(entry.respondedOn)}`
                      : ""}
                    {entry?.note ? ` · ${entry.note}` : ""}
                  </li>
                );
              })}
            </ol>
            {person && invite && invite.status !== "Accepted" ? (
              <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                <p className="text-sm">
                  Now: <span className="font-semibold">{person.name}</span> ·{" "}
                  {person.email}
                </p>
                <Textarea
                  aria-label="Note"
                  placeholder="Note (optional)"
                  value={notes[group] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [group]: event.target.value }))
                  }
                />
                <div className="flex flex-wrap gap-2">
                  {invite.status === "Not contacted" ? (
                    <a
                      href={invitationMailto(record, person)}
                      className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground"
                      onClick={() => void mark(group, "Invited")}
                    >
                      Mail invitation
                    </a>
                  ) : (
                    <>
                      <a
                        href={invitationMailto(record, person)}
                        className="inline-flex h-9 items-center rounded-lg border border-primary/20 px-3 text-xs font-semibold text-primary"
                      >
                        Mail again
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="gold"
                        disabled={busy}
                        onClick={() => void mark(group, "Accepted")}
                      >
                        Accepted
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="maroon"
                        disabled={busy}
                        onClick={() => void mark(group, "Declined")}
                      >
                        Declined · go to next
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
            {state === "All declined" ? (
              <p className="text-sm text-secondary">
                Every nominee declined. Reopen the nominations so the supervisor can name
                new evaluators.
              </p>
            ) : null}
          </section>
        );
      })}
    </DeskModal>
  );
}

function OfficeView() {
  const session = usePortalSession();
  const { load, refresh } = useEvaluations();
  const [selecting, setSelecting] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [guideFilter, setGuideFilter] = useState("");

  if (!load) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!load.ok) return <GateBanner tone="danger">{load.message}</GateBanner>;
  const allRecords = load.role === "office" ? load.records : [];
  const stageOf = (record: EvaluationRecord) =>
    !record.selection
      ? "Awaiting selection"
      : panelComplete(record)
        ? "Panel complete"
        : "Inviting";
  const records = allRecords.filter(
    (record) =>
      filterMatches(stageFilter, stageOf(record)) &&
      filterMatches(guideFilter, record.supervisorName) &&
      textMatches(query, [
        record.scholarName,
        record.title,
        record.domain,
        record.supervisorName,
      ]),
  );
  const currentName = (record: EvaluationRecord, group: EvaluatorGroup) => {
    const panel = record.selection?.[group];
    if (!panel) return "";
    const index = activeIndex(panel);
    return index === null
      ? "All declined"
      : `${record.nominees[group][index]?.name ?? ""} (${groupState(panel)})`;
  };
  const isDean = session?.role === "dean" || session?.role === "admin";
  const find = (key: string | null) =>
    records.find((item) => item.scholarKey === key) ?? null;

  return (
    <div className="space-y-4">
      <GateBanner>
        Confidential. Scholars and supervisors cannot see this page.
      </GateBanner>
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "stage",
            label: "Stage",
            value: stageFilter,
            options: ["Awaiting selection", "Inviting", "Panel complete"].map(
              (value) => ({
                value,
                label: value,
              }),
            ),
            onChange: setStageFilter,
          },
          {
            id: "guide",
            label: "Supervisor",
            value: guideFilter,
            options: [...new Set(allRecords.map((record) => record.supervisorName))]
              .filter(Boolean)
              .sort()
              .map((value) => ({ value, label: value })),
            onChange: setGuideFilter,
          },
        ]}
        shown={records.length}
        total={allRecords.length}
        filename="thesis-evaluators-confidential.csv"
        title="Thesis evaluators (confidential)"
        headers={[
          "Scholar",
          "Supervisor",
          "Title",
          "Domain",
          "Stage",
          "Indian",
          "Foreign",
          "Local",
        ]}
        rows={records.map((record) => [
          record.scholarName,
          record.supervisorName,
          record.title,
          record.domain,
          stageOf(record),
          currentName(record, "indian"),
          currentName(record, "foreign"),
          currentName(record, "local"),
        ])}
      />
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nominations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-4 py-3 font-semibold">Scholar</th>
                <th className="px-4 py-3 font-semibold">Title · Domain</th>
                {evaluatorGroups.map((group) => (
                  <th key={group} className="px-4 py-3 font-semibold">
                    {evaluatorGroupLabel[group]}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const invited =
                  record.selection !== null &&
                  evaluatorGroups.some((group) =>
                    record.selection![group].invites.some(
                      (item) => item.status !== "Not contacted",
                    ),
                  );
                return (
                  <tr
                    key={record.scholarKey}
                    className="border-t border-border align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary">{record.scholarName}</p>
                      <p className="text-muted-foreground">
                        Guide {record.supervisorName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{record.title}</p>
                      <p className="text-muted-foreground">{record.domain}</p>
                    </td>
                    {evaluatorGroups.map((group) => {
                      const panel = record.selection?.[group];
                      if (!panel) {
                        return (
                          <td key={group} className="px-4 py-3 text-muted-foreground">
                            Awaiting selection
                          </td>
                        );
                      }
                      const current = activeIndex(panel);
                      return (
                        <td key={group} className="px-4 py-3">
                          <p className="font-medium">
                            {current === null
                              ? "—"
                              : record.nominees[group][current]?.name}
                          </p>
                          <p className="text-muted-foreground">{groupState(panel)}</p>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2">
                        {isDean && !invited ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setNotice(null);
                              setSelecting(record.scholarKey);
                            }}
                          >
                            {record.selection ? "Change selection" : "Select evaluators"}
                          </Button>
                        ) : null}
                        {record.selection ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={panelComplete(record) ? "outline" : "gold"}
                            onClick={() => {
                              setNotice(null);
                              setInviting(record.scholarKey);
                            }}
                          >
                            Invitations
                          </Button>
                        ) : null}
                        {record.selection ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void downloadEvaluatorSheet(record)}
                          >
                            PDF
                          </Button>
                        ) : null}
                        {record.selection && isDean ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Reopen the nominations for ${record.scholarName}? The selection and invitation log are cleared.`,
                                )
                              ) {
                                return;
                              }
                              void reopenNominations(record.scholarIdentifier).then(
                                async (saved) => {
                                  setNotice(
                                    saved.ok
                                      ? "Nominations reopened for the supervisor."
                                      : saved.message,
                                  );
                                  await refresh();
                                },
                              );
                            }}
                          >
                            Reopen
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {selecting && find(selecting) ? (
        <SelectDialog
          record={find(selecting)!}
          onClose={() => setSelecting(null)}
          onSaved={(message) => {
            setSelecting(null);
            setNotice(message);
            void refresh();
          }}
        />
      ) : null}
      {inviting && find(inviting) ? (
        <InvitationDialog
          record={find(inviting)!}
          onClose={() => setInviting(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

export function EvaluatorScreen({ mode }: { mode: "admin" | "supervisor" }) {
  const ready = useClientReady();
  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <section className="space-y-6">
      <PageTitle kicker="Thesis" title="Thesis evaluators" />
      {mode === "admin" ? <OfficeView /> : <SupervisorView />}
    </section>
  );
}
