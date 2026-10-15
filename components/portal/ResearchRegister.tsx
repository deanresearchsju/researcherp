"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { examCopy, registrationCsvHeaders } from "@/data/exams";
import { researchRegister, type ResearchScholar } from "@/data/research-register";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { downloadCsv, field, toCsv } from "@/lib/csv";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { scholarWideDownloadRow, scholarWideHeaders } from "@/lib/person-file";
import {
  allotRegistration,
  allotRegistrations,
  batchOf,
  currentAllotments,
  currentQuotas,
  currentRegister,
  registerMigrationHint,
  registrationOf,
  scholarSignInId,
  subscribeRegister,
  supervisorForGuide,
} from "@/lib/register";
import { currentApplications, subscribeApplications } from "@/lib/records";

const allotSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(8, "Enter the full registration number.")
    .max(20, "Registration number is too long."),
});

type AllotValues = z.infer<typeof allotSchema>;

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

function options(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
}

export function ResearchRegister() {
  const ready = useClientReady();
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
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  useSyncExternalStore(subscribeOffice, currentOffice, currentOffice);
  const applications = useSyncExternalStore(
    subscribeApplications,
    currentApplications,
    () => null,
  );
  const [query, setQuery] = useState("");
  const [batchId, setBatchId] = useState("");
  const [department, setDepartment] = useState("");
  const [guide, setGuide] = useState("");
  const [researchArea, setResearchArea] = useState("");
  const [allotId, setAllotId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shownAllotments = ready ? allotments : [];
  const shownQuotas = ready ? quotas : [];
  const scholarRows = researchRegister.scholars.filter(
    (scholar) =>
      (batchId === "" || scholar.batchId === batchId) &&
      (department === "" || scholar.department === department) &&
      (guide === "" || scholar.guideName === guide) &&
      (researchArea === "" ||
        supervisorForGuide(scholar.guideName)?.researchArea === researchArea) &&
      textMatches(query, [
        scholar.name,
        scholar.department,
        scholar.title,
        scholar.email,
        scholar.guideName,
        scholar.applicationNumber,
        scholar.fileNumber,
        supervisorForGuide(scholar.guideName)?.researchArea ?? "",
        registrationOf(scholar, shownAllotments),
      ]),
  );
  const storedApplications = applications ?? [];
  const scholarFileRows = scholarRows.map((scholar) =>
    scholarWideDownloadRow(scholar, storedApplications),
  );
  const allScholarRows = [...researchRegister.scholars]
    .sort(
      (left, right) =>
        left.guideName.localeCompare(right.guideName) || left.serialNo - right.serialNo,
    )
    .map((scholar) => scholarWideDownloadRow(scholar, storedApplications));
  const allotScholar =
    researchRegister.scholars.find((scholar) => scholar.id === allotId) ?? null;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Scholar register</h1>
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

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {researchRegister.batches.map((batch) => {
          const count = researchRegister.scholars.filter(
            (scholar) => scholar.batchId === batch.id,
          ).length;
          return (
            <li
              key={batch.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
                Batch {batch.order}
              </p>
              <h2 className="mt-1 font-semibold text-primary">{batch.name}</h2>
              <p className="mt-2 font-sans text-3xl font-semibold text-primary tabular-nums">
                {count}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{batch.note}</p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-heading text-2xl text-primary">Downloads</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            downloadCsv(
              "all-scholars.csv",
              toCsv(
                scholarWideHeaders(),
                researchRegister.scholars.map((scholar) =>
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
      </div>

      <h2 className="mt-10 font-heading text-2xl text-primary">
        {examCopy.registrationTitle}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        {examCopy.registrationDetail}
      </p>
      <SpreadsheetBar
        filename="registration-numbers-template.csv"
        headers={registrationCsvHeaders}
        rows={researchRegister.scholars.map((scholar) => [
          scholar.id,
          scholar.name,
          scholar.applicationNumber,
          scholar.fileNumber,
          scholar.email,
          registrationOf(scholar, shownAllotments),
          "",
        ])}
        canUpload
        busy={false}
        onUpload={(records) => {
          void allotRegistrations(
            records.map((record) => ({
              scholarId: field(record, ["scholar_id", "id"]),
              applicationNumber: field(record, ["application_number", "application no."]),
              fileNumber: field(record, ["file_number", "file no."]),
              email: field(record, ["email", "mail"]),
              registrationNumber: field(record, [
                "registration_number",
                "registration number",
                "register no.",
              ]),
            })),
          ).then((saved) => setNotice(saved.message));
        }}
        onError={setNotice}
      />

      <h2 className="mt-10 font-heading text-2xl text-primary">Scholars</h2>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "batch",
            label: "Batch",
            value: batchId,
            options: researchRegister.batches.map((batch) => ({
              value: batch.id,
              label: batch.name,
            })),
            onChange: setBatchId,
          },
          {
            id: "department",
            label: "Department",
            value: department,
            options: options(
              researchRegister.scholars.map((scholar) => scholar.department),
            ),
            onChange: setDepartment,
          },
          {
            id: "guide",
            label: "Guide",
            value: guide,
            options: options(
              researchRegister.scholars.map((scholar) => scholar.guideName),
            ),
            onChange: setGuide,
          },
          {
            id: "area",
            label: "Research area",
            value: researchArea,
            options: options(
              researchRegister.supervisors.map((supervisor) => supervisor.researchArea),
            ),
            onChange: setResearchArea,
          },
        ]}
        shown={scholarRows.length}
        total={researchRegister.scholars.length}
        filename="scholars-filtered.csv"
        downloadLabel="Download filtered scholars"
        headers={scholarWideHeaders()}
        rows={scholarFileRows}
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
        <table className="w-full min-w-[88rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              {[
                "S. No.",
                "Registration number",
                "File number",
                "Application number",
                "Name",
                "Department",
                "Batch",
                "Phone",
                "Mail",
                "Title",
                "Category",
                "Working institution",
                "Guide",
                "Area of research",
                "1st DC",
                "2nd DC",
                "Confirmation",
                "Colloquium 1",
                "Colloquium 2",
                "Synopsis",
                "Thesis",
                "Viva",
                "Action",
              ].map((heading) => (
                <th key={heading} className="px-3 py-3 font-semibold whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scholarRows.map((scholar) => {
              const batch = batchOf(scholar.batchId);
              const registration = registrationOf(scholar, shownAllotments);
              return (
                <tr key={scholar.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">{scholar.serialNo}</td>
                  <td className="px-3 py-3 font-medium text-primary">
                    {registration || "To be allotted"}
                  </td>
                  <td className="px-3 py-3">{blank(scholar.fileNumber)}</td>
                  <td className="px-3 py-3">{blank(scholar.applicationNumber)}</td>
                  <td className="px-3 py-3">
                    <PersonNameLink
                      role="scholar"
                      name={scholar.name}
                      identifier={scholarSignInId(scholar)}
                    />
                  </td>
                  <td className="px-3 py-3">{blank(scholar.department)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{batch?.name ?? "—"}</td>
                  <td className="px-3 py-3">{blank(scholar.phone)}</td>
                  <td className="px-3 py-3">{blank(scholar.email)}</td>
                  <td className="px-3 py-3 min-w-64">{blank(scholar.title)}</td>
                  <td className="px-3 py-3">{blank(scholar.category)}</td>
                  <td className="px-3 py-3">{blank(scholar.institution)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {blank(scholar.guideName)}
                  </td>
                  <td className="px-3 py-3">
                    {blank(supervisorForGuide(scholar.guideName)?.researchArea ?? "")}
                  </td>
                  <td className="px-3 py-3">{blank(scholar.firstDc)}</td>
                  <td className="px-3 py-3">{blank(scholar.secondDc)}</td>
                  <td className="px-3 py-3">{blank(scholar.confirmation)}</td>
                  <td className="px-3 py-3">{blank(scholar.colloquium1)}</td>
                  <td className="px-3 py-3">{blank(scholar.colloquium2)}</td>
                  <td className="px-3 py-3">{blank(scholar.synopsis)}</td>
                  <td className="px-3 py-3">{blank(scholar.thesis)}</td>
                  <td className="px-3 py-3">{blank(scholar.viva)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadCsv(
                            `scholar-${fileSlug(scholar.name)}.csv`,
                            toCsv(scholarWideHeaders(), [
                              scholarWideDownloadRow(scholar, storedApplications),
                            ]),
                          )
                        }
                      >
                        Download
                      </Button>
                      {batch?.needsRegistrationNumber ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setAllotId(scholar.id)}
                        >
                          Allot
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
    </div>
  );
}

function AllotForm({
  scholar,
  allotments,
  onDone,
  onCancel,
}: {
  scholar: ResearchScholar;
  allotments: readonly { scholarId: string; registrationNumber: string }[];
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
    <form
      className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <h2 className="font-semibold text-primary sm:col-span-2">
        Allot registration number — {scholar.name}
      </h2>
      <FormField
        label="Registration number"
        htmlFor="registrationNumber"
        required
        error={form.formState.errors.registrationNumber?.message}
      >
        <Input id="registrationNumber" {...form.register("registrationNumber")} />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-secondary sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="gold" disabled={busy}>
          Save number
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
