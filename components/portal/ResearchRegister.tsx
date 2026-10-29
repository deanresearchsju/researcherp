"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Columns3 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { DeskModal, FormDialog, PageTitle } from "@/components/portal/Desk";
import { useClientReady } from "@/components/forms/ClientGate";
import { ApplicationViewer } from "@/components/portal/ApplicationViewer";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { OfficeEntryDialog } from "@/components/portal/RacScreen";
import { ScholarRegisterEditor } from "@/components/portal/RegisterEditors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { applicationReviewCopy } from "@/data/application-review";
import { researchRegister, type ResearchScholar } from "@/data/research-register";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, subscribeOffice } from "@/lib/office";
import {
  matchPhdApplication,
  scholarWideDownloadRow,
  scholarWideHeaders,
} from "@/lib/person-file";
import {
  currentApplications,
  isStoredApplication,
  subscribeApplications,
  updateApplicationDetails,
  type StoredApplication,
} from "@/lib/records";
import {
  allotRegistration,
  currentAllotments,
  currentQuotas,
  currentRegister,
  registerMigrationHint,
  registrationCompare,
  registrationIsSaved,
  registrationOf,
  scholarSignInId,
  subscribeRegister,
  supervisorForGuide,
  type RegistrationAllotment,
} from "@/lib/register";
import {
  defaultExportIds,
  exportPresets,
  registerColumns,
  registerContext,
  registerGroups,
  tableColumnIds,
  type RegisterContext,
} from "@/lib/register-columns";
import { usePreviewSession } from "@/lib/use-preview-session";
import { currentAdmission, subscribeAdmission } from "@/lib/admission";
import { allBatches, intakeCasesOf, isRegisterBatch } from "@/lib/batches";
import { university } from "@/lib/constants";
import { cn } from "@/lib/utils";

const allotSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(8, "Enter the full registration number.")
    .max(20, "Registration number is too long."),
});

type AllotValues = z.infer<typeof allotSchema>;

const exportKey = "sju-register-export-columns";

function blank(value: string) {
  return value.trim() || "—";
}

function fileSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "scholar";
}

function scholarApplicationFile(
  scholar: ResearchScholar,
  applications: readonly StoredApplication[],
): StoredApplication {
  const found = matchPhdApplication(scholarSignInId(scholar), scholar.name, applications);
  if (found) return found;
  return {
    id: `register:${scholar.id}`,
    kind: "phd",
    applicationNo: scholar.applicationNumber || scholar.fileNumber || scholar.id,
    applicantName: scholar.name,
    email: scholar.email,
    dateOfBirth: "",
    studyMode: scholar.category || null,
    status: "Selected",
    createdAt: "",
    payload: {
      fullName: scholar.name,
      email: scholar.email,
      mobile: scholar.phone,
      programme: scholar.department,
      researchArea: scholar.title,
    },
  };
}

const exportEvent = "sju-register-export-change";

function subscribeExportIds(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(exportEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(exportEvent, onChange);
  };
}

function savedExportText() {
  try {
    return window.localStorage.getItem(exportKey);
  } catch {
    return null;
  }
}

function parseExportIds(text: string | null) {
  try {
    const saved: unknown = JSON.parse(text ?? "null");
    if (Array.isArray(saved)) {
      const known = new Set(registerColumns.map((column) => column.id));
      const ids = saved.filter(
        (id): id is string => typeof id === "string" && known.has(id),
      );
      if (ids.length > 0) return ids;
    }
  } catch {
    // Fall back to the standard name list.
  }
  return [...defaultExportIds];
}

export function ResearchRegister() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const canExport = useCanMenuAction("export");
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  const stored = useSyncExternalStore(
    subscribeRegister,
    currentRegister,
    currentRegister,
  );
  // Quotas feed the supervisor figures shown in this register.
  useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  useSyncExternalStore(subscribeOffice, currentOffice, currentOffice);
  const applications = useSyncExternalStore(
    subscribeApplications,
    currentApplications,
    () => null,
  );
  // Milestone columns are filled from each scholar's ERP records.
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [allotId, setAllotId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [racId, setRacId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const savedText = useSyncExternalStore(subscribeExportIds, savedExportText, () => null);
  const exportIds = useMemo(() => parseExportIds(savedText), [savedText]);
  const [viewing, setViewing] = useState<{
    application: StoredApplication;
    personId: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const shownAllotments = useMemo(() => (ready ? allotments : []), [ready, allotments]);

  function saveExportIds(ids: string[]) {
    try {
      window.localStorage.setItem(exportKey, JSON.stringify(ids));
      window.dispatchEvent(new Event(exportEvent));
    } catch {
      setNotice("Your choice could not be remembered in this browser.");
    }
  }

  // Scholars admitted through Selection whose documents are verified belong to their intake's
  // batch, beside the scholars already on the register.
  const everyScholar = useMemo(() => {
    const intakeScholars: ResearchScholar[] = allBatches()
      .filter((batch) => !isRegisterBatch(batch.id))
      .flatMap((batch) =>
        intakeCasesOf(admission, batch.id).map((row, index) => ({
          id: `intake:${row.applicationNo}`,
          serialNo: researchRegister.scholars.length + index + 1,
          registrationNumber: row.registrationNo,
          fileNumber: "",
          applicationNumber: row.applicationNo,
          name: row.name,
          department: row.department,
          batchId: batch.id,
          phone: "",
          email: row.email,
          title: "",
          category: row.studyMode,
          institution: university.name,
          guideName: row.guideName,
          firstDc: "",
          secondDc: "",
          confirmation: "",
          colloquium1: "",
          colloquium2: "",
          synopsis: "",
          thesis: "",
          viva: "",
        })),
      );
    return [...researchRegister.scholars, ...intakeScholars].sort(
      (left, right) =>
        registrationCompare(
          registrationOf(left, shownAllotments) || left.applicationNumber,
          registrationOf(right, shownAllotments) || right.applicationNumber,
        ) || left.name.localeCompare(right.name),
    );
  }, [admission, shownAllotments]);

  const entries = useMemo(
    () =>
      everyScholar.map((scholar) => ({
        scholar,
        context: registerContext(scholar, shownAllotments, doctoral),
      })),
    [everyScholar, shownAllotments, doctoral],
  );

  const filterColumns = registerColumns.filter((column) => column.filterValue);
  const filters = filterColumns.map((column) => {
    const values = [
      ...new Set(
        entries.map((entry) => column.filterValue?.(entry.context) ?? "").filter(Boolean),
      ),
    ];
    const ordered =
      column.id === "batch"
        ? allBatches()
            .map((batch) => batch.name)
            .filter((name) => values.includes(name))
        : values.sort((left, right) => left.localeCompare(right));
    return {
      id: column.id,
      label: column.label,
      value: chosen[column.id] ?? "",
      options: ordered.map((value) => ({ value, label: value })),
      onChange: (value: string) =>
        setChosen((current) => ({ ...current, [column.id]: value })),
    };
  });

  const rows = entries.filter(
    (entry) =>
      filterColumns.every((column) =>
        filterMatches(chosen[column.id] ?? "", column.filterValue?.(entry.context) ?? ""),
      ) &&
      textMatches(
        query,
        registerColumns.map((column) => column.value(entry.context)),
      ),
  );

  const storedApplications = applications ?? [];
  const exportColumns = registerColumns.filter((column) => exportIds.includes(column.id));
  const allScholarRows = [...everyScholar]
    .sort(
      (left, right) =>
        left.guideName.localeCompare(right.guideName) || left.serialNo - right.serialNo,
    )
    .map((scholar) => scholarWideDownloadRow(scholar, storedApplications));
  const allotScholar =
    researchRegister.scholars.find((scholar) => scholar.id === allotId) ?? null;
  const editScholar =
    researchRegister.scholars.find((scholar) => scholar.id === editId) ?? null;
  const opened = entries.find((entry) => entry.scholar.id === openId) ?? null;
  const canAllotRole = session?.role === "admin" || session?.role === "staff";
  // The research office enters the RAC members of a scholar here (one internal, one external and,
  // if required, a co-guide; no publication details).
  const canEnterRac =
    session?.role === "admin" || session?.role === "staff" || session?.role === "dean";
  const racScholar =
    researchRegister.scholars.find((scholar) => scholar.id === racId) ?? null;
  const racGuide = racScholar ? supervisorForGuide(racScholar.guideName) : null;
  const racChoice = racScholar
    ? [
        {
          identifier: scholarSignInId(racScholar),
          name: racScholar.name,
          supervisorIdentifier:
            racGuide?.email.trim() ||
            racGuide?.supervisorId.trim() ||
            racScholar.guideName,
          supervisorName: racScholar.guideName,
        },
      ]
    : [];
  const tableColumns = tableColumnIds.map((id) =>
    registerColumns.find((column) => column.id === id)!,
  );

  async function saveViewedApplication(next: {
    applicantName: string;
    email: string;
    payload: StoredApplication["payload"];
  }) {
    if (!viewing || !isStoredApplication(viewing.application.id)) return;
    setSaving(true);
    const saved = await updateApplicationDetails(
      viewing.application.kind,
      viewing.application.id,
      next,
    );
    setSaving(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setViewing({
      ...viewing,
      application: {
        ...viewing.application,
        applicantName: next.applicantName,
        email: next.email,
        payload: next.payload,
      },
    });
    setNotice(applicationReviewCopy.saved);
  }

  function toggleBatch(name: string) {
    setChosen((current) => ({
      ...current,
      batch: current.batch === name ? "" : name,
    }));
  }

  return (
    <div>
      <PageTitle kicker="Administration" title="Scholar register" />
      {stored?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">
          {stored.detail} {registerMigrationHint}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {allBatches().map((batch) => {
          const count = entries.filter(
            (entry) => entry.scholar.batchId === batch.id,
          ).length;
          const on = chosen.batch === batch.name;
          return (
            <li key={batch.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggleBatch(batch.name)}
                className={cn(
                  "w-full rounded-xl border bg-card p-3 text-left shadow-card transition hover:border-primary/50",
                  on ? "border-primary ring-2 ring-primary/20" : "border-border",
                )}
              >
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-secondary uppercase">
                  Batch {batch.order}
                </p>
                <p className="mt-0.5 font-semibold text-primary">{batch.name}</p>
                <p className="font-sans text-2xl font-semibold text-primary tabular-nums">
                  {count}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={filters}
        shown={rows.length}
        total={entries.length}
        filename="scholar-register.csv"
        title="Scholar register"
        headers={exportColumns.map((column) => column.label)}
        rows={rows.map((entry) =>
          exportColumns.map((column) => column.value(entry.context)),
        )}
        extra={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setColumnsOpen(true)}
          >
            <Columns3 className="size-4" aria-hidden="true" />
            Information to export ({exportColumns.length})
          </Button>
        }
      />

      {allotScholar ? (
        <AllotForm
          key={allotScholar.id}
          scholar={allotScholar}
          allotments={shownAllotments}
          onDone={(message) => {
            setNotice(message);
            setAllotId(null);
          }}
          onCancel={() => setAllotId(null)}
        />
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              {tableColumns.map((column) => (
                <th key={column.id} className="px-3 py-3 font-semibold whitespace-nowrap">
                  {column.label}
                </th>
              ))}
              <th className="px-3 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-muted-foreground"
                  colSpan={tableColumns.length + 1}
                >
                  No scholar matches.
                </td>
              </tr>
            ) : (
              rows.map(({ scholar, context }) => (
                <tr key={scholar.id} className="border-t border-border align-top">
                  {tableColumns.map((column) => {
                    const value = column.value(context);
                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "px-3 py-3",
                          column.id === "name" && "font-medium text-primary",
                          column.id === "registration" && "font-mono text-xs",
                        )}
                      >
                        {column.id === "registration" && !value ? (
                          <span className="font-sans text-muted-foreground">
                            To be allotted
                          </span>
                        ) : column.id === "stage" ? (
                          <Badge variant={value === "Admitted" ? "outline" : "gold"}>
                            {value}
                          </Badge>
                        ) : (
                          blank(value)
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-readonly-allow
                      onClick={() => setOpenId(scholar.id)}
                    >
                      Details
                    </Button>
                    {canEnterRac ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-2"
                        disabled={!scholar.guideName.trim()}
                        title={
                          scholar.guideName.trim()
                            ? "Enter the RAC members of this scholar"
                            : "Allot a guide first"
                        }
                        onClick={() => {
                          setNotice(null);
                          setRacId(scholar.id);
                        }}
                      >
                        RAC members
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canExport ? (
        <section className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-primary">Full application files:</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                "all-scholars.csv",
                toCsv(
                  scholarWideHeaders(),
                  everyScholar.map((scholar) =>
                    scholarWideDownloadRow(scholar, storedApplications),
                  ),
                ),
              )
            }
          >
            All scholar details
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                "supervisor-wise-scholars.csv",
                toCsv(scholarWideHeaders(), allScholarRows),
              )
            }
          >
            Supervisor-wise scholars
          </Button>
        </section>
      ) : null}

      {opened ? (
        <DetailsDialog
          entry={opened}
          canExport={canExport}
          canAllot={canAllotRole && !opened.scholar.id.startsWith("intake:")}
          numberSaved={registrationIsSaved(opened.scholar, shownAllotments)}
          onClose={() => setOpenId(null)}
          onViewApplication={() => {
            setViewing({
              application: scholarApplicationFile(opened.scholar, storedApplications),
              personId: scholarSignInId(opened.scholar),
            });
            setOpenId(null);
          }}
          onDownload={() =>
            downloadCsv(
              `scholar-${fileSlug(opened.scholar.name)}.csv`,
              toCsv(scholarWideHeaders(), [
                scholarWideDownloadRow(opened.scholar, storedApplications),
              ]),
            )
          }
          onEdit={() => {
            setNotice(null);
            setEditId(opened.scholar.id);
            setOpenId(null);
          }}
          onAllot={() => {
            setAllotId(opened.scholar.id);
            setOpenId(null);
          }}
        />
      ) : null}

      {columnsOpen ? (
        <ExportColumnsDialog
          chosen={exportIds}
          onChange={saveExportIds}
          onClose={() => setColumnsOpen(false)}
        />
      ) : null}

      {racScholar ? (
        <OfficeEntryDialog
          key={racScholar.id}
          scholars={racChoice}
          initialScholar={racChoice[0]?.identifier ?? ""}
          defaultRecorded
          canRecord={session?.role === "admin" || session?.role === "staff"}
          onClose={() => setRacId(null)}
          onDone={(message) => {
            setNotice(message);
            setRacId(null);
          }}
        />
      ) : null}
      {editScholar ? (
        <ScholarRegisterEditor
          key={editScholar.id}
          scholar={editScholar}
          onClose={() => setEditId(null)}
          onDone={(message) => {
            setEditId(null);
            setNotice(message);
          }}
        />
      ) : null}
      {viewing ? (
        <ApplicationViewer
          application={viewing.application}
          personId={viewing.personId}
          editable
          saving={saving}
          onClose={() => setViewing(null)}
          onSave={(next) => void saveViewedApplication(next)}
        />
      ) : null}
    </div>
  );
}

function DetailsDialog({
  entry,
  canExport,
  canAllot,
  numberSaved,
  onClose,
  onViewApplication,
  onDownload,
  onEdit,
  onAllot,
}: {
  entry: { scholar: ResearchScholar; context: RegisterContext };
  canExport: boolean;
  canAllot: boolean;
  numberSaved: boolean;
  onClose: () => void;
  onViewApplication: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onAllot: () => void;
}) {
  return (
    <DeskModal title={entry.scholar.name} size="lg" onClose={onClose}>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onViewApplication}>
            {applicationReviewCopy.view}
          </Button>
          {canExport ? (
            <Button type="button" size="sm" variant="outline" onClick={onDownload}>
              Download
            </Button>
          ) : null}
          {canAllot ? (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canAllot && !numberSaved ? (
            <Button type="button" size="sm" variant="outline" onClick={onAllot}>
              Allot number
            </Button>
          ) : null}
        </div>
        {registerGroups.map((group) => (
          <section key={group}>
            <h3 className="text-[0.7rem] font-bold tracking-[0.16em] text-secondary uppercase">
              {group}
            </h3>
            <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {registerColumns
                .filter((column) => column.group === group)
                .map((column) => (
                  <div key={column.id} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{column.label}</dt>
                    <dd className="font-medium break-words text-foreground">
                      {blank(column.value(entry.context))}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>
    </DeskModal>
  );
}

function ExportColumnsDialog({
  chosen,
  onChange,
  onClose,
}: {
  chosen: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const toggle = (id: string) =>
    onChange(
      registerColumns
        .map((column) => column.id)
        .filter((item) => (item === id ? !chosen.includes(id) : chosen.includes(item))),
    );
  return (
    <DeskModal title="Information to export" size="lg" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Tick what each downloaded Excel and PDF list should carry. The scholars in it
          are the ones shown after the filters, and every item marked &quot;also a
          filter&quot; can be used as a filter. Your choice is remembered.
        </p>
        <div className="flex flex-wrap gap-2">
          {exportPresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange([...preset.ids])}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        {registerGroups.map((group) => (
          <fieldset key={group}>
            <legend className="text-[0.7rem] font-bold tracking-[0.16em] text-secondary uppercase">
              {group}
            </legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {registerColumns
                .filter((column) => column.group === group)
                .map((column) => (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={chosen.includes(column.id)}
                      onChange={() => toggle(column.id)}
                    />
                    <span>{column.label}</span>
                    {column.filterValue ? (
                      <span className="ml-auto text-[0.65rem] text-muted-foreground">
                        also a filter
                      </span>
                    ) : null}
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
        <p className="text-muted-foreground">{chosen.length} item(s) chosen.</p>
      </div>
    </DeskModal>
  );
}

function AllotForm({
  scholar,
  allotments,
  onDone,
  onCancel,
}: {
  scholar: ResearchScholar;
  allotments: readonly RegistrationAllotment[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AllotValues>({
    resolver: zodResolver(allotSchema),
    defaultValues: { registrationNumber: registrationOf(scholar, allotments) },
  });

  async function onSubmit(values: AllotValues) {
    const number = values.registrationNumber.trim();
    const taken = researchRegister.scholars.some(
      (item) =>
        item.id !== scholar.id &&
        registrationOf(item, allotments).toLowerCase() === number.toLowerCase(),
    );
    if (taken) {
      setError("That registration number is already allotted.");
      return;
    }
    setBusy(true);
    setError(null);
    const saved = await allotRegistration(scholar.id, number);
    setBusy(false);
    if (!saved.ok) {
      setError(
        "message" in saved
          ? saved.message
          : "The registration number could not be saved.",
      );
      return;
    }
    onDone(`Allotted ${number} to ${scholar.name}.`);
  }

  return (
    <FormDialog
      title={`Allot registration number · ${scholar.name}`}
      onClose={onCancel}
      onSubmit={form.handleSubmit(onSubmit)}
      busy={busy}
      submitLabel="Save number"
      size="sm"
    >
      <FormField
        label="Registration number"
        htmlFor="registrationNumber"
        required
        error={form.formState.errors.registrationNumber?.message}
      >
        <Input id="registrationNumber" {...form.register("registrationNumber")} />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}
