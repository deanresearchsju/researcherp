"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskPage, DeskSection, DeskTabs, FormDialog } from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { officeWriteBlock } from "@/lib/access";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  currentExam,
  gradesProblem,
  saveExamSettings,
  subscribeExam,
  type ExamCentre,
  type ExamSettings,
  type GradeBand,
  type TimetableEntry,
} from "@/lib/exam-office";
import { formatIsoDate } from "@/lib/dates";
import { usePreviewSession } from "@/lib/use-preview-session";

/** The campuses the scholars may choose for the course-work examination (the usual ones). */
const suggestedCampuses = [
  "Tindivanam",
  "Muttom",
  "Panaljur",
  "Sriperumbudur",
  "Aral",
] as const;

const tabs = [
  { id: "campuses", label: "Exam campuses" },
  { id: "timetable", label: "Timetable" },
  { id: "marks", label: "Marks & grades" },
] as const;

function seatsOf(centre: ExamCentre) {
  return centre.rooms.reduce((sum, room) => sum + room.capacity, 0);
}

/**
 * Where, when and how the course-work examination is held: the campuses (with their rooms and
 * seats) that scholars choose at registration, the timetable printed on the hall tickets, and
 * the pass mark and grades the Controller of Examinations' marks are turned into.
 */
export function ExamSetupScreen() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const exam = useSyncExternalStore(subscribeExam, currentExam, () => null);
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [tab, setTab] = useState<string>("campuses");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ExamCentre | "new" | null>(null);

  if (!ready || !exam || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading the exam set-up…</p>;
  }
  const settings = exam.settings;
  const canWrite =
    Boolean(session) && !officeWriteBlock() && session?.role !== "accounts";

  async function save(next: ExamSettings, message: string) {
    setBusy(true);
    const saved = await saveExamSettings(next);
    setBusy(false);
    setNotice(saved.ok ? message : saved.message);
    return saved.ok;
  }

  return (
    <DeskPage kicker="Examination" title="Exam setup">
      {exam.detail ? <p className="text-sm text-secondary">{exam.detail}</p> : null}
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskTabs tabs={[...tabs]} value={tab} onChange={setTab} />

      {tab === "campuses" ? (
        <DeskSection
          title="Campuses where scholars may write"
          action={
            canWrite ? (
              <Button type="button" size="sm" onClick={() => setEditing("new")}>
                <Plus className="mr-1 size-4" aria-hidden="true" />
                Add campus
              </Button>
            ) : null
          }
        >
          <div className="space-y-3 p-4">
            {settings.centres.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No campus added.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {settings.centres.map((centre) => (
                  <li
                    key={centre.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-primary">{centre.name}</h3>
                        {centre.address ? (
                          <p className="text-sm text-muted-foreground">
                            {centre.address}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="gold">{seatsOf(centre)} seats</Badge>
                    </div>
                    <p className="mt-2 text-sm">
                      {centre.rooms.length === 0
                        ? "No room added yet."
                        : centre.rooms
                            .map((room) => `${room.name} (${room.capacity})`)
                            .join(" · ")}
                    </p>
                    {canWrite ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(centre)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="maroon"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remove ${centre.name}? Hall tickets already issued for it keep their campus.`,
                              )
                            ) {
                              return;
                            }
                            void save(
                              {
                                ...settings,
                                centres: settings.centres.filter(
                                  (item) => item.id !== centre.id,
                                ),
                              },
                              `${centre.name} was removed.`,
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DeskSection>
      ) : null}

      {tab === "timetable" ? (
        <TimetablePanel
          settings={settings}
          doctoral={doctoral}
          canWrite={canWrite}
          busy={busy}
          onSave={(timetable) =>
            save({ ...settings, timetable }, "The timetable was saved.")
          }
        />
      ) : null}

      {tab === "marks" ? (
        <MarksPanel
          settings={settings}
          canWrite={canWrite}
          busy={busy}
          onSave={(next) => save(next, "The marks and grades were saved.")}
        />
      ) : null}

      {editing ? (
        <CentreDialog
          centre={editing === "new" ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (centre) => {
            const centres =
              editing === "new"
                ? [...settings.centres, centre]
                : settings.centres.map((item) => (item.id === centre.id ? centre : item));
            const ok = await save({ ...settings, centres }, `${centre.name} was saved.`);
            if (ok) setEditing(null);
          }}
        />
      ) : null}
    </DeskPage>
  );
}

function CentreDialog({
  centre,
  busy,
  onClose,
  onSave,
}: {
  centre: ExamCentre | null;
  busy: boolean;
  onClose: () => void;
  onSave: (centre: ExamCentre) => Promise<void>;
}) {
  const [name, setName] = useState(centre?.name ?? "");
  const [address, setAddress] = useState(centre?.address ?? "");
  const [rooms, setRooms] = useState(
    centre?.rooms.map((room) => ({ ...room, capacity: String(room.capacity) })) ?? [],
  );
  const [error, setError] = useState("");

  return (
    <FormDialog
      title={centre ? `Edit ${centre.name}` : "Add an exam campus"}
      submitLabel="Save campus"
      busy={busy}
      size="lg"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length < 3) {
          setError("Enter the name of the campus.");
          return;
        }
        const cleaned = rooms.filter((room) => room.name.trim());
        if (cleaned.some((room) => !(Number(room.capacity) > 0))) {
          setError("Every room needs the number of seats.");
          return;
        }
        setError("");
        void onSave({
          id: centre?.id ?? crypto.randomUUID(),
          name: name.trim(),
          address: address.trim(),
          rooms: cleaned.map((room) => ({
            id: room.id,
            name: room.name.trim(),
            capacity: Number(room.capacity),
          })),
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Campus</span>
          <Input
            list="exam-campus-names"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            aria-label="Campus name"
          />
          <datalist id="exam-campus-names">
            {suggestedCampuses.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Address (optional)</span>
          <Input
            value={address}
            maxLength={160}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="Address"
          />
        </label>
      </div>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm font-semibold text-primary">Rooms and seats</legend>
        {rooms.map((room, index) => (
          <div key={room.id} className="flex items-center gap-2">
            <Input
              value={room.name}
              placeholder="Room, for example Hall A"
              aria-label={`Room ${index + 1} name`}
              onChange={(event) =>
                setRooms((current) =>
                  current.map((item) =>
                    item.id === room.id ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <Input
              value={room.capacity}
              inputMode="numeric"
              placeholder="Seats"
              className="w-28"
              aria-label={`Room ${index + 1} seats`}
              onChange={(event) =>
                setRooms((current) =>
                  current.map((item) =>
                    item.id === room.id
                      ? { ...item, capacity: event.target.value.replace(/\D/g, "") }
                      : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remove room ${index + 1}`}
              onClick={() =>
                setRooms((current) => current.filter((item) => item.id !== room.id))
              }
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setRooms((current) => [
              ...current,
              { id: crypto.randomUUID(), name: "", capacity: "" },
            ])
          }
        >
          <Plus className="mr-1 size-4" aria-hidden="true" />
          Add a room
        </Button>
      </fieldset>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}

function TimetablePanel({
  settings,
  doctoral,
  canWrite,
  busy,
  onSave,
}: {
  settings: ExamSettings;
  doctoral: NonNullable<ReturnType<typeof currentDoctoral>>;
  canWrite: boolean;
  busy: boolean;
  onSave: (timetable: TimetableEntry[]) => Promise<boolean>;
}) {
  const batches = doctoral.batches;
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [semester, setSemester] = useState(1);
  const subjects = doctoral.subjects.filter(
    (subject) => subject.batchId === batchId && subject.semester === semester,
  );
  const [edits, setEdits] = useState<Record<string, { date: string; time: string }>>({});

  const entryOf = (subjectId: string) =>
    settings.timetable.find(
      (entry) =>
        entry.batchId === batchId &&
        entry.semester === semester &&
        entry.subjectId === subjectId,
    );
  const valueOf = (subjectId: string) =>
    edits[subjectId] ?? {
      date: entryOf(subjectId)?.date ?? "",
      time: entryOf(subjectId)?.time ?? "",
    };

  return (
    <DeskSection title="Timetable printed on the hall tickets">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Batch</span>
            <NativeSelect
              value={batchId}
              onChange={(event) => {
                setBatchId(event.target.value);
                setEdits({});
              }}
              aria-label="Batch"
            >
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Semester</span>
            <NativeSelect
              value={semester}
              onChange={(event) => {
                setSemester(Number(event.target.value));
                setEdits({});
              }}
              aria-label="Semester"
            >
              {[1, 2, 3, 4].map((item) => (
                <option key={item} value={item}>
                  Semester {item}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subject is listed for this batch and semester.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Subject</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => {
                  const value = valueOf(subject.id);
                  return (
                    <tr key={subject.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{subject.code}</td>
                      <td className="px-3 py-2">{subject.name}</td>
                      <td className="px-3 py-2">
                        {canWrite ? (
                          <Input
                            type="date"
                            value={value.date}
                            aria-label={`Date for ${subject.code}`}
                            onChange={(event) =>
                              setEdits((current) => ({
                                ...current,
                                [subject.id]: { ...value, date: event.target.value },
                              }))
                            }
                          />
                        ) : value.date ? (
                          formatIsoDate(value.date)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canWrite ? (
                          <Input
                            value={value.time}
                            placeholder="10:00 AM – 1:00 PM"
                            aria-label={`Time for ${subject.code}`}
                            onChange={(event) =>
                              setEdits((current) => ({
                                ...current,
                                [subject.id]: { ...value, time: event.target.value },
                              }))
                            }
                          />
                        ) : (
                          value.time || "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {canWrite && subjects.length > 0 ? (
          <Button
            type="button"
            variant="gold"
            disabled={busy}
            onClick={() => {
              const others = settings.timetable.filter(
                (entry) =>
                  !(
                    entry.batchId === batchId &&
                    entry.semester === semester &&
                    subjects.some((subject) => subject.id === entry.subjectId)
                  ),
              );
              const mine = subjects.flatMap((subject) => {
                const value = valueOf(subject.id);
                if (!value.date) return [];
                return [
                  {
                    id: entryOf(subject.id)?.id ?? crypto.randomUUID(),
                    batchId,
                    semester,
                    subjectId: subject.id,
                    date: value.date,
                    time: value.time.trim(),
                  },
                ];
              });
              void onSave([...others, ...mine]).then((ok) => {
                if (ok) setEdits({});
              });
            }}
          >
            Save timetable
          </Button>
        ) : null}
      </div>
    </DeskSection>
  );
}

function MarksPanel({
  settings,
  canWrite,
  busy,
  onSave,
}: {
  settings: ExamSettings;
  canWrite: boolean;
  busy: boolean;
  onSave: (next: ExamSettings) => Promise<boolean>;
}) {
  const [maxMarks, setMaxMarks] = useState(String(settings.maxMarks));
  const [passMark, setPassMark] = useState(String(settings.passMark));
  const [grades, setGrades] = useState(
    settings.grades.map((band) => ({
      min: String(band.min),
      max: String(band.max),
      grade: band.grade,
    })),
  );
  const [instructions, setInstructions] = useState(settings.instructions.join("\n"));
  const [error, setError] = useState("");

  return (
    <DeskSection title="Marks, pass mark and grades">
      <div className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Maximum marks</span>
            <Input
              value={maxMarks}
              inputMode="numeric"
              disabled={!canWrite}
              onChange={(event) => setMaxMarks(event.target.value.replace(/\D/g, ""))}
              aria-label="Maximum marks"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-primary">Pass mark</span>
            <Input
              value={passMark}
              inputMode="numeric"
              disabled={!canWrite}
              onChange={(event) => setPassMark(event.target.value.replace(/\D/g, ""))}
              aria-label="Pass mark"
            />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-primary">
            Grades (marks from … to …)
          </legend>
          {grades.map((band, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={band.min}
                inputMode="numeric"
                className="w-24"
                disabled={!canWrite}
                placeholder="From"
                aria-label={`Grade ${index + 1} from marks`}
                onChange={(event) =>
                  setGrades((current) =>
                    current.map((item, at) =>
                      at === index
                        ? { ...item, min: event.target.value.replace(/\D/g, "") }
                        : item,
                    ),
                  )
                }
              />
              <span className="text-sm text-muted-foreground" aria-hidden="true">
                to
              </span>
              <Input
                value={band.max}
                inputMode="numeric"
                className="w-24"
                disabled={!canWrite}
                placeholder="To"
                aria-label={`Grade ${index + 1} to marks`}
                onChange={(event) =>
                  setGrades((current) =>
                    current.map((item, at) =>
                      at === index
                        ? { ...item, max: event.target.value.replace(/\D/g, "") }
                        : item,
                    ),
                  )
                }
              />
              <Input
                value={band.grade}
                className="w-24"
                maxLength={4}
                disabled={!canWrite}
                aria-label={`Grade ${index + 1}`}
                onChange={(event) =>
                  setGrades((current) =>
                    current.map((item, at) =>
                      at === index ? { ...item, grade: event.target.value } : item,
                    ),
                  )
                }
              />
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove grade ${index + 1}`}
                  onClick={() =>
                    setGrades((current) => current.filter((_, at) => at !== index))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setGrades((current) => [...current, { min: "", max: "", grade: "" }])
              }
            >
              Add a grade
            </Button>
          ) : null}
        </fieldset>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">
            Instructions on the hall ticket, one on each line
          </span>
          <textarea
            value={instructions}
            rows={6}
            disabled={!canWrite}
            onChange={(event) => setInstructions(event.target.value)}
            className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-secondary">
            {error}
          </p>
        ) : null}
        {canWrite ? (
          <Button
            type="button"
            variant="gold"
            disabled={busy}
            onClick={() => {
              const bands: GradeBand[] = grades
                .filter((band) => band.grade.trim() || band.min !== "" || band.max !== "")
                .map((band) => ({
                  min: Number(band.min),
                  max: band.max === "" ? Number.NaN : Number(band.max),
                  grade: band.grade.trim(),
                }));
              const problem = bands.some(
                (band) => band.min !== band.min || band.max !== band.max,
              )
                ? "Enter the marks from and to for every grade."
                : gradesProblem(bands, Number(passMark) || 0, Number(maxMarks) || 0);
              if (problem) {
                setError(problem);
                return;
              }
              setError("");
              void onSave({
                ...settings,
                maxMarks: Number(maxMarks) || 0,
                passMark: Number(passMark) || 0,
                grades: bands,
                instructions: instructions
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              });
            }}
          >
            Save marks and grades
          </Button>
        ) : null}
      </div>
    </DeskSection>
  );
}
