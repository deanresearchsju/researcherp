"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import {
  DeskPage,
  DeskSection,
  DeskTable,
  DeskTabs,
  FormDialog,
} from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { currentAdmission, subscribeAdmission } from "@/lib/admission";
import { officeWriteBlock } from "@/lib/access";
import { downloadCsvAsSheet } from "@/lib/sheet";
import { openSpreadsheet } from "@/lib/spreadsheet";
import { toCsv } from "@/lib/csv";
import { currentExam, subscribeExam } from "@/lib/exam-office";
import {
  addInvigilators,
  autoAllot,
  currentInvigilation,
  finalisePlan,
  removeInvigilator,
  replaceInvigilators,
  reopenPlan,
  saveInvigilator,
  savePlanSettings,
  setReserved,
  setSlot,
  subscribeInvigilation,
} from "@/lib/invigilation";
import {
  consolidatedList,
  courseWorkSittings,
  dutyCounts,
  dutyList,
  entranceSittings,
  invigilatorsFromTable,
  invigilatorsFromText,
  lettersFor,
  planProblems,
  scopeLabel,
  shortDate,
  sittingKey,
  type Chief,
  type InvigilationScope,
  type Invigilator,
} from "@/lib/invigilation-core";
import { downloadChiefOrders, downloadInvigilatorLetters } from "@/lib/invigilation-pdf";
import { clientToday } from "@/lib/dates";
import { downloadTablePdf } from "@/lib/table-pdf";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { usePreviewSession } from "@/lib/use-preview-session";
import { inputRules, typed } from "@/lib/input-rules";

const tabs = [
  { id: "plan", label: "Duty plan" },
  { id: "pool", label: "Invigilators" },
  { id: "list", label: "Date-wise list" },
  { id: "consolidated", label: "Consolidated list" },
  { id: "letters", label: "Letters" },
] as const;

const emptyPerson: Invigilator = {
  id: "",
  name: "",
  designation: "",
  department: "",
  phone: "",
  unavailable: [],
};

function timeText(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

/**
 * Invigilation duty for the entrance test or the course-work examination: the invigilators,
 * the plan (one or two for each room, some on reserved duty), the individual letters after the
 * plan is final, and the date-wise list in one running order.
 */
export function InvigilationDesk({ scope }: { scope: InvigilationScope }) {
  const ready = useClientReady();
  const session = usePreviewSession();
  const store = useSyncExternalStore(
    subscribeInvigilation,
    currentInvigilation,
    () => null,
  );
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const canExport = useCanMenuAction("export");
  const [tab, setTab] = useState<string>("plan");
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{
    person: Invigilator;
    replacing: string | null;
  } | null>(null);
  const [pasting, setPasting] = useState(false);

  const plan = store?.plans[scope] ?? null;
  const pool = useMemo(() => store?.pool ?? [], [store]);

  const sittings = useMemo(() => {
    if (scope === "course-work") {
      return exam
        ? courseWorkSittings(exam.settings.timetable, exam.tickets, exam.settings.centres)
        : [];
    }
    if (!admission) return [];
    return entranceSittings(admission.progress.entrance, admission.cases);
  }, [scope, exam, admission]);

  if (!ready || !store || !plan || !exam || !admission) {
    return (
      <p className="text-sm text-muted-foreground">Loading the invigilation records…</p>
    );
  }

  const final = plan.status === "Final";
  const canWrite =
    !officeWriteBlock() && (session?.role === "admin" || session?.role === "staff");
  const editable = canWrite && !final;
  const problems = planProblems(plan, pool);
  const rows = dutyList(plan, pool);
  const letters = lettersFor(plan, pool);
  const counts = dutyCounts(plan);
  const nameOf = (id: string) => pool.find((item) => item.id === id)?.name ?? "";
  const title = scopeLabel[scope];

  async function run<T extends { ok: boolean }>(
    work: () => Promise<T & ({ ok: true } | { ok: false; message: string })>,
    done: string,
  ) {
    setBusy(true);
    const result = await work();
    setBusy(false);
    setNotice(result.ok ? done : (result as { message: string }).message);
    return result;
  }

  async function allot() {
    setBusy(true);
    const result = await autoAllot(scope, sittings);
    setBusy(false);
    setWarnings(result.shortages);
    setNotice(
      result.ok
        ? "Invigilators allotted. Check the plan, change any place, then finalise."
        : result.message,
    );
  }

  const exportHeaders = [
    "S. No.",
    "Date",
    "Session",
    "Venue",
    "Room",
    "Candidates",
    "Duty",
    "ID",
    "Name",
    "Designation",
    "Department",
    "Mobile",
  ];
  const exportRows = rows.map((row) => [
    String(row.serial),
    shortDate(row.date),
    timeText(row.time),
    row.venue,
    row.room,
    row.strength === null ? "" : String(row.strength),
    row.kind,
    row.invigilatorId,
    row.name,
    row.designation,
    row.department,
    row.phone,
  ]);
  const days = [...new Set(rows.map((row) => row.date))];
  const consolidated = consolidatedList(plan, pool);
  const consolidatedHeaders = [
    "S. No.",
    "ID",
    "Name",
    "Designation",
    "Department",
    "Mobile",
    "Room duties",
    "Reserved",
    "Total",
    "Duties (date, session, hall)",
  ];
  const consolidatedRows = consolidated.map((row) => [
    String(row.serial),
    row.invigilatorId,
    row.name,
    row.designation,
    row.department,
    row.phone,
    String(row.roomDuties),
    String(row.reservedDuties),
    String(row.total),
    row.duties,
  ]);

  return (
    <DeskPage
      kicker={scope === "entrance" ? "Selection" : "Examination"}
      title={`Invigilation duty · ${title}`}
    >
      {store.detail ? <p className="text-sm text-secondary">{store.detail}</p> : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {warnings.map((line) => (
        <p key={line} className="text-sm text-destructive">
          {line}
        </p>
      ))}
      <DeskTabs tabs={[...tabs]} value={tab} onChange={setTab} />

      {tab === "pool" ? (
        <DeskSection
          title={`Invigilators (${pool.length})`}
          action={
            canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPasting(true)}
                >
                  Upload the list
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditing({ person: emptyPerson, replacing: null })}
                >
                  <Plus className="mr-1 size-4" aria-hidden="true" />
                  Add invigilator
                </Button>
              </div>
            ) : null
          }
        >
          <DeskTable
            headers={[
              "ID",
              "Name",
              "Designation",
              "Department",
              "Mobile",
              "Not available on",
              "",
            ]}
            empty={pool.length === 0}
          >
            {pool.map((person) => (
              <tr key={person.id} className="border-t border-border">
                <td className="px-4 py-2">{person.id}</td>
                <td className="px-4 py-2 font-medium">{person.name}</td>
                <td className="px-4 py-2">{person.designation || "—"}</td>
                <td className="px-4 py-2">{person.department || "—"}</td>
                <td className="px-4 py-2">{person.phone || "—"}</td>
                <td className="px-4 py-2">
                  {person.unavailable.length > 0
                    ? person.unavailable.map(shortDate).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  {canWrite ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ person, replacing: person.id })}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Remove ${person.name}`}
                        onClick={() =>
                          void run(
                            () => removeInvigilator(person.id),
                            `${person.name} removed.`,
                          )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}

      {tab === "plan" ? (
        <>
          <DeskSection
            title="Rules for this plan"
            action={<Badge variant={final ? "gold" : "outline"}>{plan.status}</Badge>}
          >
            <PlanSettings
              key={`${plan.twoFrom}-${plan.reservedPerSitting}-${plan.examination}-${JSON.stringify(plan.chiefs)}-${plan.status}`}
              plan={plan}
              editable={editable}
              busy={busy}
              onSave={(values) =>
                void run(() => savePlanSettings(scope, values), "Rules saved.")
              }
            />
          </DeskSection>

          <DeskSection
            title={`Rooms and invigilators (${plan.duties.length} room duties, ${plan.reserved.length} reserved)`}
            action={
              <div className="flex flex-wrap gap-2">
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void allot()}
                  >
                    {plan.duties.length > 0 ? "Allot again" : "Allot invigilators"}
                  </Button>
                ) : null}
                {editable && plan.duties.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    disabled={busy}
                    onClick={() => void run(() => finalisePlan(scope), "Plan finalised.")}
                  >
                    Finalise plan
                  </Button>
                ) : null}
                {canWrite && final && session?.role === "admin" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run(() => reopenPlan(scope), "Plan reopened.")}
                  >
                    Reopen plan
                  </Button>
                ) : null}
              </div>
            }
          >
            <p className="px-4 pt-3 text-sm text-muted-foreground">
              {sittings.length === 0
                ? scope === "entrance"
                  ? "No rooms with seated candidates. Set the entrance date and time and arrange the seating under Selection, Entrance first."
                  : "No rooms with seated scholars. Add the timetable and issue the hall tickets with seating first."
                : `${sittings.length} room(s) with candidates found in the seating.`}
              {final
                ? ` Final on ${shortDate(plan.finalisedOn)} by ${plan.finalisedBy}.`
                : ""}
            </p>
            {problems.length > 0 && plan.duties.length > 0 ? (
              <ul className="list-disc px-8 pt-2 text-sm text-destructive">
                {problems.slice(0, 5).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <DeskTable
              headers={[
                "Date",
                "Session",
                "Venue",
                "Room",
                "Candidates",
                "Invigilator(s)",
              ]}
              empty={plan.duties.length === 0}
            >
              {plan.duties.map((duty, dutyIndex) => (
                <tr
                  key={`${sittingKey(duty)}|${duty.venue}|${duty.room}`}
                  className="border-t"
                >
                  <td className="px-4 py-2">{shortDate(duty.date)}</td>
                  <td className="px-4 py-2">{timeText(duty.time)}</td>
                  <td className="px-4 py-2">{duty.venue}</td>
                  <td className="px-4 py-2 font-medium">{duty.room}</td>
                  <td className="px-4 py-2">
                    {duty.strength}
                    {duty.slots === 2 ? (
                      <Badge className="ml-2">2 invigilators</Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div className="space-y-1">
                      {duty.assigned.map((id, slot) => (
                        <PersonSelect
                          key={slot}
                          label={`${duty.room} invigilator ${slot + 1}`}
                          value={id}
                          pool={pool}
                          disabled={!editable || busy}
                          onChange={(value) =>
                            void run(
                              () => setSlot(scope, dutyIndex, slot, value),
                              "Invigilator changed.",
                            )
                          }
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </DeskTable>
          </DeskSection>

          {plan.reserved.length > 0 ? (
            <DeskSection title="Reserved duty">
              <DeskTable headers={["Date", "Session", "Reserved invigilators"]}>
                {[...new Set(plan.reserved.map((item) => sittingKey(item)))]
                  .sort()
                  .map((key) => {
                    const [date, time] = key.split("|");
                    const mine = plan.reserved.filter(
                      (item) => item.date === date && item.time === time,
                    );
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="px-4 py-2">{shortDate(date)}</td>
                        <td className="px-4 py-2">{timeText(time)}</td>
                        <td className="px-4 py-2">
                          <div className="space-y-1">
                            {mine.map((item, index) => (
                              <PersonSelect
                                key={`${item.invigilatorId}-${index}`}
                                label="Reserved invigilator"
                                value={item.invigilatorId}
                                pool={pool}
                                allowEmpty
                                disabled={!editable || busy}
                                onChange={(value) =>
                                  void run(
                                    () => setReserved(scope, date, time, index, value),
                                    "Reserved duty changed.",
                                  )
                                }
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </DeskTable>
            </DeskSection>
          ) : null}

          {counts.size > 0 ? (
            <DeskSection title="Duties per invigilator" tone="muted">
              <DeskTable headers={["Invigilator", "Room duties", "Reserved", "Total"]}>
                {[...counts.entries()]
                  .sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])))
                  .map(([id, count]) => (
                    <tr key={id} className="border-t border-border">
                      <td className="px-4 py-2">{nameOf(id) || id}</td>
                      <td className="px-4 py-2">{count.room}</td>
                      <td className="px-4 py-2">{count.reserved}</td>
                      <td className="px-4 py-2 font-medium">
                        {count.room + count.reserved}
                      </td>
                    </tr>
                  ))}
              </DeskTable>
            </DeskSection>
          ) : null}
        </>
      ) : null}

      {tab === "list" ? (
        <DeskSection
          title={`Date-wise invigilators list (${rows.length} entries${days.length ? `, ${days.length} day(s)` : ""})`}
          action={
            canExport && rows.length > 0 ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsvAsSheet(
                      `invigilators-${scope}`,
                      toCsv(exportHeaders, exportRows),
                    )
                  }
                >
                  Export Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void downloadTablePdf({
                      title: `Invigilators list · ${title}`,
                      criteria: [
                        `Status: ${plan.status}`,
                        `Chief Superintendent: ${plan.chiefSuperintendent || "—"}`,
                        `Two invigilators from ${plan.twoFrom} candidates; reserved per sitting: ${plan.reservedPerSitting}`,
                      ],
                      headers: exportHeaders,
                      rows: exportRows,
                      filename: `invigilators-${scope}`,
                    })
                  }
                >
                  Export PDF
                </Button>
              </div>
            ) : null
          }
        >
          <DeskTable headers={exportHeaders} empty={rows.length === 0}>
            {rows.map((row, index) => (
              <tr
                key={row.serial}
                className={
                  index > 0 && rows[index - 1].date !== row.date
                    ? "border-t-2 border-primary/40"
                    : "border-t border-border"
                }
              >
                {exportRows[index].map((cell, column) => (
                  <td key={column} className="px-4 py-2">
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}

      {tab === "consolidated" ? (
        <DeskSection
          title={`Consolidated list of invigilators (${consolidated.length})`}
          action={
            canExport && consolidated.length > 0 ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsvAsSheet(
                      `invigilators-consolidated-${scope}`,
                      toCsv(consolidatedHeaders, consolidatedRows),
                    )
                  }
                >
                  Export Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void downloadTablePdf({
                      title: `Consolidated invigilators list · ${title}`,
                      criteria: [
                        `Status: ${plan.status}`,
                        `Chief Superintendent: ${plan.chiefSuperintendent || "—"}`,
                      ],
                      headers: consolidatedHeaders,
                      rows: consolidatedRows,
                      filename: `invigilators-consolidated-${scope}`,
                    })
                  }
                >
                  Export PDF
                </Button>
              </div>
            ) : null
          }
        >
          <DeskTable headers={consolidatedHeaders} empty={consolidated.length === 0}>
            {consolidatedRows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {row.map((cell, column) => (
                  <td key={column} className="px-4 py-2">
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}

      {tab === "letters" ? (
        <DeskSection
          title={`Invigilation letters (${letters.length})`}
          action={
            final && canExport && letters.length > 0 ? (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  void downloadInvigilatorLetters(
                    plan,
                    letters,
                    `invigilation-letters-${scope}`,
                  )
                }
              >
                Download all letters (one PDF)
              </Button>
            ) : null
          }
        >
          {!final ? (
            <p className="p-4 text-sm text-muted-foreground">
              Letters are issued after the plan is finalised. Finalise it under Duty plan.
            </p>
          ) : (
            <DeskTable
              headers={["ID", "Name", "Duties", "Letter"]}
              empty={letters.length === 0}
            >
              {letters.map((letter) => (
                <tr key={letter.invigilator.id} className="border-t border-border">
                  <td className="px-4 py-2">{letter.invigilator.id}</td>
                  <td className="px-4 py-2 font-medium">{letter.invigilator.name}</td>
                  <td className="px-4 py-2">
                    {letter.lines
                      .map(
                        (line) =>
                          `${shortDate(line.date)} ${timeText(line.time)} ${line.hall}`,
                      )
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-2">
                    {canExport ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void downloadInvigilatorLetters(
                            plan,
                            [letter],
                            `invigilation-${letter.invigilator.id}`,
                          )
                        }
                      >
                        Download letter
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </DeskTable>
          )}
        </DeskSection>
      ) : null}

      {tab === "letters" ? (
        <DeskSection
          title={`Order for the Chief Superintendent (${plan.chiefs.length})`}
          action={
            canExport && plan.chiefs.length > 0 && plan.duties.length > 0 ? (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  void downloadChiefOrders(
                    plan,
                    `chief-superintendent-order-${scope}`,
                    plan.finalisedOn || clientToday(),
                  )
                }
              >
                Download order{plan.chiefs.length > 1 ? "s" : ""} (PDF)
              </Button>
            ) : null
          }
        >
          {plan.chiefs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Name the Chief Superintendent (one or two) under Duty plan, Rules for this
              plan.
            </p>
          ) : (
            <DeskTable headers={["Chief Superintendent", "Designation", "Department"]}>
              {plan.chiefs.map((chief) => (
                <tr key={chief.name} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{chief.name}</td>
                  <td className="px-4 py-2">{chief.designation || "—"}</td>
                  <td className="px-4 py-2">{chief.department || "—"}</td>
                </tr>
              ))}
            </DeskTable>
          )}
          {plan.chiefs.length > 0 && plan.duties.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              The order lists the dates and venues of the plan: allot the invigilators
              first.
            </p>
          ) : null}
        </DeskSection>
      ) : null}

      {editing ? (
        <PersonDialog
          state={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(person) =>
            void run(
              () => saveInvigilator(person, editing.replacing),
              "Invigilator saved.",
            ).then((result) => {
              if (result.ok) setEditing(null);
            })
          }
        />
      ) : null}
      {pasting ? (
        <ListDialog
          busy={busy}
          hasList={pool.length > 0}
          onClose={() => setPasting(false)}
          onReplace={(people) =>
            void replaceInvigilators(people).then((result) => {
              setNotice(
                result.ok
                  ? `The list is replaced by ${people.length} invigilator(s). Allot the duties again.`
                  : (result as { message: string }).message,
              );
              if (result.ok) setPasting(false);
            })
          }
          onAdd={(people) =>
            void addInvigilators(people).then((result) => {
              setNotice(
                result.ok
                  ? `${result.added} invigilator(s) added.`
                  : (result as { message: string }).message,
              );
              if (result.ok) setPasting(false);
            })
          }
        />
      ) : null}
    </DeskPage>
  );
}

function PersonSelect({
  label,
  value,
  pool,
  disabled,
  allowEmpty = true,
  onChange,
}: {
  label: string;
  value: string;
  pool: readonly Invigilator[];
  disabled: boolean;
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      className="h-9 min-w-56"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty || !value ? <option value="">— Not allotted —</option> : null}
      {pool.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name} ({person.id})
        </option>
      ))}
    </NativeSelect>
  );
}

function PlanSettings({
  plan,
  editable,
  busy,
  onSave,
}: {
  plan: {
    twoFrom: number;
    reservedPerSitting: number;
    examination: string;
    chiefs: Chief[];
  };
  editable: boolean;
  busy: boolean;
  onSave: (values: {
    twoFrom: number;
    reservedPerSitting: number;
    examination: string;
    chiefs: Chief[];
  }) => void;
}) {
  const [twoFrom, setTwoFrom] = useState(String(plan.twoFrom));
  const [reserved, setReserved] = useState(String(plan.reservedPerSitting));
  const [examination, setExamination] = useState(plan.examination);
  const blank: Chief = { name: "", designation: "", department: "" };
  const [chiefs, setChiefs] = useState<Chief[]>([
    plan.chiefs[0] ?? blank,
    plan.chiefs[1] ?? blank,
  ]);
  const setChief = (index: number, field: keyof Chief, value: string) =>
    setChiefs((current) =>
      current.map((item, at) => (at === index ? { ...item, [field]: value } : item)),
    );
  return (
    <form
      className="grid gap-3 p-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          twoFrom: Number(twoFrom),
          reservedPerSitting: Number(reserved),
          examination: examination.trim(),
          chiefs: chiefs.filter((item) => item.name.trim()),
        });
      }}
    >
      <label className="space-y-1 text-sm font-medium">
        Two invigilators for a room of at least (candidates)
        <Input {...typed(inputRules.integer, twoFrom, setTwoFrom)} disabled={!editable} />
      </label>
      <label className="space-y-1 text-sm font-medium">
        Invigilators on reserved duty in each sitting
        <Input
          {...typed(inputRules.integer, reserved, setReserved)}
          disabled={!editable}
        />
      </label>
      <label className="space-y-1 text-sm font-medium md:col-span-2">
        Heading of the letters and orders
        <Input
          value={examination}
          placeholder="Semester Examination - April 2026"
          disabled={!editable}
          onChange={(event) => setExamination(event.target.value)}
        />
      </label>
      {chiefs.map((chief, index) => (
        <fieldset
          key={index}
          className="space-y-2 rounded-xl border border-border p-3 md:col-span-2"
        >
          <legend className="px-1 text-sm font-semibold text-primary">
            Chief Superintendent {index + 1}
            {index === 1 ? " (optional)" : ""}
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-sm font-medium">
              Name
              <Input
                {...typed(inputRules.names, chief.name, (value) =>
                  setChief(index, "name", value),
                )}
                disabled={!editable}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Designation
              <Input
                {...typed(inputRules.letters, chief.designation, (value) =>
                  setChief(index, "designation", value),
                )}
                disabled={!editable}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Department
              <Input
                {...typed(inputRules.letters, chief.department, (value) =>
                  setChief(index, "department", value),
                )}
                disabled={!editable}
              />
            </label>
          </div>
        </fieldset>
      ))}
      {editable ? (
        <div className="md:col-span-2">
          <Button type="submit" size="sm" disabled={busy}>
            Save rules
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function PersonDialog({
  state,
  busy,
  onClose,
  onSave,
}: {
  state: { person: Invigilator; replacing: string | null };
  busy: boolean;
  onClose: () => void;
  onSave: (person: Invigilator) => void;
}) {
  const [person, setPerson] = useState(state.person);
  const [day, setDay] = useState("");
  const set = (field: keyof Invigilator, value: string) =>
    setPerson((current) => ({ ...current, [field]: value }));
  return (
    <FormDialog
      title={state.replacing ? "Edit invigilator" : "Add invigilator"}
      onClose={onClose}
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(person);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          ID
          <Input value={person.id} onChange={(event) => set("id", event.target.value)} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Name
          <Input
            {...typed(inputRules.names, person.name, (value) => set("name", value))}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Designation
          <Input
            value={person.designation}
            onChange={(event) => set("designation", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Department
          <Input
            value={person.department}
            onChange={(event) => set("department", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Mobile
          <Input
            {...typed(inputRules.phone, person.phone, (value) => set("phone", value))}
          />
        </label>
        <div className="space-y-1 text-sm font-medium">
          <label htmlFor="not-available">Not available on</label>
          <div className="flex gap-2">
            <Input
              id="not-available"
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!day || person.unavailable.includes(day)) return;
                setPerson((current) => ({
                  ...current,
                  unavailable: [...current.unavailable, day].sort(),
                }));
                setDay("");
              }}
            >
              Add
            </Button>
          </div>
          <p className="text-xs font-normal text-muted-foreground">
            {person.unavailable.length > 0 ? (
              <>
                {person.unavailable.map(shortDate).join(", ")} ·{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    setPerson((current) => ({ ...current, unavailable: [] }))
                  }
                >
                  clear
                </button>
              </>
            ) : (
              "No date blocked."
            )}
          </p>
        </div>
      </div>
    </FormDialog>
  );
}

/**
 * The name list of a session: an Excel or CSV file (first row = headings: ID, Name, Designation,
 * Department, Mobile), or text pasted from Excel. It either replaces the list (a new session)
 * or is added to it.
 */
function ListDialog({
  busy,
  hasList,
  onClose,
  onAdd,
  onReplace,
}: {
  busy: boolean;
  hasList: boolean;
  onClose: () => void;
  onAdd: (people: Invigilator[]) => void;
  onReplace: (people: Invigilator[]) => void;
}) {
  const [text, setText] = useState("");
  const [fromFile, setFromFile] = useState<{
    people: Invigilator[];
    skipped: number;
    name: string;
  } | null>(null);
  const [mode, setMode] = useState<"replace" | "add">(hasList ? "replace" : "add");
  const [error, setError] = useState("");
  const pasted = invigilatorsFromText(text);
  const read = fromFile ?? { ...pasted, name: "" };

  async function choose(file: File | undefined) {
    setError("");
    setFromFile(null);
    if (!file) return;
    try {
      const book = await openSpreadsheet(file);
      const table = await book.read(book.sheets[0] ?? "");
      const result = invigilatorsFromTable(table);
      if (result.missingName) {
        setError(
          "The first row needs a heading called Name (and ID, Designation, Department, Mobile).",
        );
        return;
      }
      setFromFile({ people: result.people, skipped: result.skipped, name: file.name });
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "That file could not be read.",
      );
    }
  }

  return (
    <FormDialog
      title="Upload the invigilators list"
      onClose={onClose}
      busy={busy}
      submitLabel={
        mode === "replace"
          ? `Replace with ${read.people.length}`
          : `Add ${read.people.length}`
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (read.people.length === 0)
          return setError("There is no invigilator to save yet.");
        if (mode === "replace") onReplace(read.people);
        else onAdd(read.people);
      }}
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1 font-medium">
          Excel or CSV file
          <input
            type="file"
            accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary"
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <span className="block text-xs font-normal text-muted-foreground">
            First row: ID, Name, Designation, Department, Mobile. Only Name is required;
            an ID is made if the sheet has none.
          </span>
        </label>
        <label className="block space-y-1 font-medium">
          Or paste from Excel (one person on each line, comma or tab apart)
          <textarea
            className="h-32 w-full rounded-xl border border-input bg-card p-3 text-sm font-normal"
            value={text}
            disabled={Boolean(fromFile)}
            onChange={(event) => setText(event.target.value)}
            aria-label="Invigilators list"
          />
        </label>
        {hasList ? (
          <fieldset className="space-y-1">
            <legend className="font-medium">This list is for</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="mt-1"
              />
              <span>
                A new session: replace the present list. The duty plans start again; the
                rules, heading and Chief Superintendent stay.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                checked={mode === "add"}
                onChange={() => setMode("add")}
                className="mt-1"
              />
              <span>
                The same session: add these to the present list (IDs already there are
                skipped).
              </span>
            </label>
          </fieldset>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {read.people.length} invigilator(s) read{read.name ? ` from ${read.name}` : ""}
          {read.skipped > 0
            ? `; ${read.skipped} row(s) skipped (no name or a repeated ID)`
            : ""}
          .
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
