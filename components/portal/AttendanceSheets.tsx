"use client";

import { Plus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { DeskPage, FormDialog } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { Sheet, SheetHeading, pagesOf } from "@/components/portal/AdmissionPrint";
import { MarkButtons } from "@/components/portal/AttendanceControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { researchRegister } from "@/data/research-register";
import { officeWriteBlock } from "@/lib/access";
import { currentAdmission, subscribeAdmission } from "@/lib/admission";
import { allBatches, intakeCasesOf } from "@/lib/batches";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { currentOffice, subscribeOffice } from "@/lib/office";
import {
  currentAllotments,
  currentAttendance,
  isPassedOut,
  registrationOf,
  removeAttendanceSheet,
  saveAttendanceSheet,
  scholarSignInId,
  subscribeRegister,
  type AttendanceEntry,
  type AttendanceSheet,
  type SheetMark,
  registrationCompare,
} from "@/lib/register";
import { downloadSheet } from "@/lib/sheet";
import { usePreviewSession } from "@/lib/use-preview-session";

const countOf = (sheet: AttendanceSheet, mark: SheetMark) =>
  sheet.entries.filter((entry) => entry.mark === mark).length;

/**
 * Attendance sheets for programmes and events, taken batch-wise: the event name, the date and
 * the scholars of the batch. A sheet can be printed blank for signatures, or marked here and
 * printed or downloaded afterwards.
 */
export function AttendanceSheets() {
  const session = usePreviewSession();
  const sheets = useSyncExternalStore(
    subscribeRegister,
    currentAttendance,
    currentAttendance,
  );
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const batches = allBatches().sort((left, right) => right.order - left.order);

  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("");
  const profile = useScholarProfiles();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [taking, setTaking] = useState<AttendanceSheet | null>(null);
  const [printing, setPrinting] = useState<{
    sheet: AttendanceSheet;
    withMarks: boolean;
  } | null>(null);

  const canWrite = Boolean(session) && !officeWriteBlock();
  const isAdmin = session?.role === "admin";

  /** The scholars of a batch: the register, and the intakes admitted through Selection. */
  function rosterFor(batchId: string): AttendanceEntry[] {
    const fromRegister = researchRegister.scholars
      .filter((scholar) => scholar.batchId === batchId)
      .filter((scholar) => !isPassedOut(scholarSignInId(scholar), scholar.name))
      .map((scholar) => ({
        key: scholarSignInId(scholar).toLowerCase(),
        name: scholar.name,
        reference: registrationOf(scholar, allotments) || scholar.applicationNumber,
        department: scholar.department,
        mark: "" as SheetMark,
      }));
    const fromIntake = intakeCasesOf(admission, batchId).map((row) => ({
      key: (row.email || row.applicationNo).toLowerCase(),
      name: row.name,
      reference: row.registrationNo || row.applicationNo,
      department: row.department,
      mark: "" as SheetMark,
    }));
    return [...fromRegister, ...fromIntake].sort(
      (a, b) =>
        registrationCompare(a.reference, b.reference) || a.name.localeCompare(b.name),
    );
  }

  const listed = sheets
    .filter(
      (sheet) =>
        (!batch || sheet.batchId === batch) &&
        textMatches(query, [sheet.event, sheet.batchName, sheet.venue, sheet.date]),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.event.localeCompare(b.event));

  async function save(sheet: AttendanceSheet, message: string) {
    setBusy(true);
    const result = await saveAttendanceSheet(sheet);
    setBusy(false);
    setNotice(result.ok ? message : result.message);
    return result.ok;
  }

  function sheetHeaders(withMarks: boolean) {
    return [
      "S. No.",
      "Name",
      "Registration / Application No.",
      "Department",
      "Campus",
      "Guide",
      "Mode",
      withMarks ? "Attendance" : "Signature",
    ];
  }

  function sheetRows(sheet: AttendanceSheet, withMarks: boolean) {
    return sheet.entries.map((entry, index) => [
      String(index + 1),
      entry.name,
      entry.reference,
      entry.department,
      // The department is the one on the sheet; campus, guide and mode come from the profile.
      ...profile.cells(entry.key).slice(1),
      withMarks ? entry.mark || "Not marked" : "",
    ]);
  }

  if (printing) {
    const { sheet, withMarks } = printing;
    const pages = pagesOf(
      sheet.entries.map((entry, index) => ({ entry, serial: index + 1 })),
      22,
    );
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setPrinting(null)}>
            Back to attendance sheets
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <div className="overflow-x-auto">
          <article className="print-root mx-auto flex w-[210mm] min-w-[210mm] flex-col print:w-full print:min-w-0">
            {pages.map((page, pageIndex) => (
              <Sheet key={pageIndex}>
                <SheetHeading
                  title={`${sheet.event} · Attendance sheet`}
                  lines={[
                    `Batch: ${sheet.batchName} · Date: ${formatIsoDate(sheet.date)}${sheet.venue ? ` · Venue: ${sheet.venue}` : ""}`,
                    withMarks
                      ? `Present ${countOf(sheet, "Present")} · Absent ${countOf(sheet, "Absent")} · Not marked ${countOf(sheet, "")}`
                      : `Scholars: ${sheet.entries.length}`,
                  ]}
                />
                <table className="mt-2 w-full border-collapse border border-foreground/30 text-sm">
                  <thead className="bg-muted/60">
                    <tr className="text-center">
                      <th className="border border-foreground/30 px-2 py-1.5">S. No.</th>
                      <th className="border border-foreground/30 px-2 py-1.5">Name</th>
                      <th className="border border-foreground/30 px-2 py-1.5">
                        Registration / Application No.
                      </th>
                      <th className="border border-foreground/30 px-2 py-1.5">
                        Department
                      </th>
                      <th className="w-44 border border-foreground/30 px-2 py-1.5">
                        {withMarks ? "Attendance" : "Signature"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.map(({ entry, serial }) => (
                      <tr key={entry.key}>
                        <td className="border border-foreground/30 px-2 py-2.5">
                          {serial}
                        </td>
                        <td className="border border-foreground/30 px-2 py-2.5 font-semibold">
                          {entry.name}
                        </td>
                        <td className="border border-foreground/30 px-2 py-2.5 font-mono text-xs">
                          {entry.reference || "—"}
                        </td>
                        <td className="border border-foreground/30 px-2 py-2.5">
                          {entry.department || "—"}
                        </td>
                        <td className="border border-foreground/30 px-2 py-2.5">
                          {withMarks ? entry.mark || "Not marked" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pageIndex === pages.length - 1 ? (
                  <div className="mt-auto flex justify-between pt-16 text-xs">
                    <span className="border-t border-foreground/50 px-6 pt-1">
                      Coordinator
                    </span>
                    <span className="border-t border-foreground/50 px-6 pt-1">
                      Dean, Research and Development
                    </span>
                  </div>
                ) : null}
              </Sheet>
            ))}
          </article>
        </div>
      </div>
    );
  }

  return (
    <DeskPage
      kicker="Scholar records"
      title="Attendance sheets"
      actions={
        canWrite ? (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="mr-1 size-4" aria-hidden="true" />
            New attendance sheet
          </Button>
        ) : null
      }
    >
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Make a sheet for a programme or event: name it, give the date and choose the
        batch. Print it blank for the scholars to sign, or take the attendance here and
        print or download the marked sheet.
      </p>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "batch",
            label: "Batch",
            value: batch,
            options: batches.map((item) => ({ value: item.id, label: item.name })),
            onChange: setBatch,
          },
        ]}
        shown={listed.length}
        total={sheets.length}
        filename="attendance-sheets.csv"
        headers={["date", "event", "batch", "venue", "scholars", "present", "absent"]}
        rows={listed.map((sheet) => [
          sheet.date,
          sheet.event,
          sheet.batchName,
          sheet.venue,
          String(sheet.entries.length),
          String(countOf(sheet, "Present")),
          String(countOf(sheet, "Absent")),
        ])}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Event</th>
              <th className="px-3 py-3 font-semibold">Batch</th>
              <th className="px-3 py-3 font-semibold">Venue</th>
              <th className="px-3 py-3 font-semibold">Attendance</th>
              <th className="px-3 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listed.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                  {sheets.length === 0
                    ? "No attendance sheet has been made yet."
                    : "No attendance sheet matches."}
                </td>
              </tr>
            ) : (
              listed.map((sheet) => (
                <tr key={sheet.id} className="border-t border-border align-top">
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatIsoDate(sheet.date)}
                  </td>
                  <td className="px-3 py-3 font-medium text-primary">{sheet.event}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{sheet.batchName}</td>
                  <td className="px-3 py-3">{sheet.venue || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="gold">Present {countOf(sheet, "Present")}</Badge>
                      <Badge variant="outline">Absent {countOf(sheet, "Absent")}</Badge>
                      {countOf(sheet, "") > 0 ? (
                        <Badge variant="outline">Not marked {countOf(sheet, "")}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canWrite ? (
                        <Button type="button" size="sm" onClick={() => setTaking(sheet)}>
                          Take attendance
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-readonly-allow
                        onClick={() => setPrinting({ sheet, withMarks: false })}
                      >
                        Blank sheet
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-readonly-allow
                        onClick={() => setPrinting({ sheet, withMarks: true })}
                      >
                        Marked sheet
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-readonly-allow
                        onClick={() =>
                          void downloadSheet(
                            `attendance-${sheet.event.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${sheet.date}.xlsx`,
                            sheetHeaders(true),
                            sheetRows(sheet, true),
                          )
                        }
                      >
                        Excel
                      </Button>
                      {isAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="maroon"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete the attendance sheet "${sheet.event}" of ${sheet.batchName}? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            void removeAttendanceSheet(sheet.id).then((result) =>
                              setNotice(
                                result.ok ? "The sheet was deleted." : result.message,
                              ),
                            );
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? (
        <NewSheetDialog
          batches={batches.map((item) => ({ id: item.id, name: item.name }))}
          rosterSize={(batchId) => rosterFor(batchId).length}
          busy={busy}
          onClose={() => setCreating(false)}
          onCreate={async (values) => {
            const entries = rosterFor(values.batchId);
            const ok = await save(
              {
                id: crypto.randomUUID(),
                ...values,
                batchName: batches.find((item) => item.id === values.batchId)?.name ?? "",
                entries,
                createdOn: "",
                createdBy: "",
                updatedOn: "",
                updatedBy: "",
              },
              `The attendance sheet was made with ${entries.length} scholar(s).`,
            );
            if (ok) setCreating(false);
          }}
        />
      ) : null}

      {taking ? (
        <TakeDialog
          key={taking.id}
          sheet={taking}
          busy={busy}
          missing={rosterFor(taking.batchId).filter(
            (entry) => !taking.entries.some((item) => item.key === entry.key),
          )}
          onClose={() => setTaking(null)}
          onSave={async (entries) => {
            const ok = await save({ ...taking, entries }, "The attendance was saved.");
            if (ok) setTaking(null);
          }}
        />
      ) : null}
    </DeskPage>
  );
}

function NewSheetDialog({
  batches,
  rosterSize,
  busy,
  onClose,
  onCreate,
}: {
  batches: { id: string; name: string }[];
  rosterSize: (batchId: string) => number;
  busy: boolean;
  onClose: () => void;
  onCreate: (values: {
    event: string;
    date: string;
    batchId: string;
    venue: string;
  }) => Promise<void>;
}) {
  const [event, setEvent] = useState("");
  const [date, setDate] = useState(clientToday());
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [venue, setVenue] = useState("");
  const [error, setError] = useState("");

  return (
    <FormDialog
      title="New attendance sheet"
      submitLabel="Make the sheet"
      busy={busy}
      onClose={onClose}
      onSubmit={(submitted) => {
        submitted.preventDefault();
        if (event.trim().length < 3) {
          setError("Enter the name of the programme or event.");
          return;
        }
        if (!date) {
          setError("Choose the date.");
          return;
        }
        if (!batchId) {
          setError("Choose the batch.");
          return;
        }
        setError("");
        void onCreate({ event, date, batchId, venue });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-primary">Programme / event name</span>
          <Input
            value={event}
            maxLength={120}
            onChange={(entered) => setEvent(entered.target.value)}
            aria-label="Programme or event name"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Date</span>
          <Input
            type="date"
            value={date}
            onChange={(entered) => setDate(entered.target.value)}
            aria-label="Date of the event"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Batch</span>
          <NativeSelect
            value={batchId}
            onChange={(entered) => setBatchId(entered.target.value)}
            aria-label="Batch"
          >
            {batches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-primary">Venue (optional)</span>
          <Input
            value={venue}
            maxLength={120}
            onChange={(entered) => setVenue(entered.target.value)}
            aria-label="Venue"
          />
        </label>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {batchId ? `${rosterSize(batchId)} scholar(s) are in this batch.` : ""}
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}

function TakeDialog({
  sheet,
  missing,
  busy,
  onClose,
  onSave,
}: {
  sheet: AttendanceSheet;
  missing: AttendanceEntry[];
  busy: boolean;
  onClose: () => void;
  onSave: (entries: AttendanceEntry[]) => Promise<void>;
}) {
  const [entries, setEntries] = useState(sheet.entries);
  const [query, setQuery] = useState("");
  const shown = entries.filter((entry) =>
    textMatches(query, [entry.name, entry.reference, entry.department]),
  );
  const setMark = (key: string, value: SheetMark) =>
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, mark: value } : entry)),
    );
  const count = (value: SheetMark) =>
    entries.filter((entry) => entry.mark === value).length;
  const extra = missing.filter(
    (entry) => !entries.some((item) => item.key === entry.key),
  );

  return (
    <FormDialog
      title={`${sheet.event} · ${sheet.batchName} · ${formatIsoDate(sheet.date)}`}
      submitLabel="Save attendance"
      size="lg"
      busy={busy}
      onClose={onClose}
      onSubmit={(submitted) => {
        submitted.preventDefault();
        void onSave(entries);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(entered) => setQuery(entered.target.value)}
          placeholder="Search the scholars"
          aria-label="Search the scholars"
          className="max-w-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setEntries((current) =>
              current.map((entry) => ({ ...entry, mark: "Present" })),
            )
          }
        >
          All present
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setEntries((current) => current.map((entry) => ({ ...entry, mark: "" })))
          }
        >
          Clear all
        </Button>
        {extra.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEntries((current) => [...current, ...extra])}
          >
            Add {extra.length} new scholar(s) of the batch
          </Button>
        ) : null}
        <span className="ml-auto text-sm text-muted-foreground">
          Present {count("Present")} · Absent {count("Absent")} · Not marked {count("")}
        </span>
      </div>
      <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-muted text-primary">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Registration / Application No.</th>
              <th className="px-3 py-2 font-semibold">Department</th>
              <th className="px-3 py-2 font-semibold">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                  {entries.length === 0
                    ? "No scholar is in this batch yet."
                    : "No scholar matches."}
                </td>
              </tr>
            ) : (
              shown.map((entry) => (
                <tr key={entry.key} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-primary">{entry.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.reference || "—"}
                  </td>
                  <td className="px-3 py-2">{entry.department || "—"}</td>
                  <td className="px-3 py-2">
                    <MarkButtons
                      name={entry.name}
                      value={entry.mark}
                      onChange={(next) => setMark(entry.key, next)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </FormDialog>
  );
}
