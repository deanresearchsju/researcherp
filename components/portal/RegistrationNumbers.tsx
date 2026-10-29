"use client";

import { useState, useSyncExternalStore } from "react";

import { DeskPage } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { registrationCsvHeaders } from "@/data/exams";
import { registrationCopy } from "@/data/registration";
import { officeWriteBlock } from "@/lib/access";
import { field } from "@/lib/csv";
import {
  allotRegistrations,
  currentAllotments,
  currentRegister,
  registerMigrationHint,
  registrationOf,
  scholarSignInId,
  subscribeRegister,
  registerScholarsInOrder,
  registrationCompare,
} from "@/lib/register";
import {
  allotIntakeRegistrations,
  currentAdmission,
  subscribeAdmission,
} from "@/lib/admission";
import { currentDoctoral, enrollmentFor, subscribeDoctoral } from "@/lib/doctoral";
import { allBatches, intakeCasesOf, isRegisterBatch } from "@/lib/batches";
import { formatIsoDate } from "@/lib/dates";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { guideCampus } from "@/lib/registration-format";
import { usePreviewSession } from "@/lib/use-preview-session";

/** One scholar of a batch, whether on the register or admitted through Selection. */
type Line = {
  key: string;
  name: string;
  applicationNo: string;
  email: string;
  department: string;
  studyMode: string;
  guideName: string;
  guideCampus: string;
  number: string;
  on: string;
  by: string;
};

/**
 * Registration numbers are recorded once and are permanent. A scholar leaves the "To allot"
 * list as soon as the number is recorded; every recorded number stays in "Recorded numbers"
 * with the day it was recorded, and each recording is also kept in the audit trail.
 */
export function RegistrationNumbers() {
  const session = usePreviewSession();
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
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const batches = allBatches();

  function linesFor(id: string): Line[] {
    if (isRegisterBatch(id)) {
      return registerScholarsInOrder()
        .filter((scholar) => scholar.batchId === id)
        .map((scholar) => {
          const allotment = allotments.find((item) => item.scholarId === scholar.id);
          return {
            key: scholar.id,
            name: scholar.name,
            applicationNo: scholar.applicationNumber,
            email: scholar.email,
            department: scholar.department,
            studyMode:
              (doctoral
                ? enrollmentFor(doctoral, scholarSignInId(scholar))?.studyMode
                : "") || scholar.category,
            guideName: scholar.guideName,
            guideCampus: guideCampus(scholar.guideName),
            number: registrationOf(scholar, allotments).trim(),
            on: allotment?.allottedOn ?? "",
            by: allotment?.allottedBy ?? "",
          };
        });
    }
    return [...intakeCasesOf(admission, id)]
      .sort((a, b) =>
        registrationCompare(
          a.registrationNo || a.applicationNo,
          b.registrationNo || b.applicationNo,
        ),
      )
      .map((row) => ({
        key: row.applicationNo,
        name: row.name,
        applicationNo: row.applicationNo,
        email: row.email,
        department: row.department,
        studyMode: row.studyMode,
        guideName: row.guideName,
        guideCampus: guideCampus(row.guideName),
        number: row.registrationNo.trim(),
        on: row.registrationOn,
        by: "",
      }));
  }

  const [chosen, setChosen] = useState("");
  const [tab, setTab] = useState<"pending" | "records">("pending");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [guideFilter, setGuideFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pendingIn = (id: string) => linesFor(id).filter((line) => !line.number).length;
  const batchId =
    chosen || batches.find((item) => pendingIn(item.id) > 0)?.id || batches[0]?.id || "";
  const batch = batches.find((item) => item.id === batchId) ?? null;
  const newIntake = !isRegisterBatch(batchId);
  const canWrite = Boolean(session) && !officeWriteBlock();
  const lines = linesFor(batchId);
  const pending = lines.filter((line) => !line.number);
  const recorded = lines.filter((line) => line.number);
  const showing = tab === "pending" && pending.length > 0 ? "pending" : "records";
  const matches = (line: Line) =>
    textMatches(query, [
      line.name,
      line.applicationNo,
      line.email,
      line.department,
      line.studyMode,
      line.number,
    ]);
  const inScope = (line: Line) =>
    filterMatches(departmentFilter, line.department) &&
    filterMatches(campusFilter, line.guideCampus) &&
    filterMatches(guideFilter, line.guideName) &&
    filterMatches(modeFilter, line.studyMode);
  const visible = (showing === "pending" ? pending : recorded)
    .filter(inScope)
    .filter(matches);
  const choices = (pick: (line: Line) => string) =>
    [...new Set(lines.map(pick).filter(Boolean))]
      .sort()
      .map((value) => ({ value, label: value }));

  async function record(
    entries: readonly {
      key: string;
      applicationNo: string;
      email: string;
      number: string;
    }[],
  ) {
    if (!canWrite) {
      setNotice(officeWriteBlock()?.message ?? registrationCopy.adminOnly);
      return;
    }
    if (entries.length === 0) {
      setNotice(registrationCopy.needNumber);
      return;
    }
    setBusy(true);
    const result = newIntake
      ? await allotIntakeRegistrations(
          entries.map((item) => ({
            applicationNo: item.applicationNo,
            registrationNumber: item.number,
          })),
        )
      : await allotRegistrations(
          entries.map((item) => ({
            scholarId: item.key,
            applicationNumber: item.applicationNo,
            fileNumber: "",
            email: item.email,
            registrationNumber: item.number,
          })),
        );
    setBusy(false);
    setNotice(result.message);
    if (result.ok) setDrafts({});
  }

  function saveBatch() {
    void record(
      pending.flatMap((line) => {
        const number = (drafts[line.key] ?? "").trim();
        return number ? [{ ...line, number }] : [];
      }),
    );
  }

  return (
    <DeskPage kicker={registrationCopy.kicker} title={registrationCopy.title}>
      {stored?.detail ? (
        <p className="text-sm leading-6 text-secondary">
          {stored.detail} {registerMigrationHint}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <label className="grid max-w-sm gap-1 text-sm">
        <span className="font-semibold text-primary">{registrationCopy.batch}</span>
        <NativeSelect
          value={batchId}
          onChange={(event) => {
            setChosen(event.target.value);
            setTab("pending");
            setDrafts({});
            setQuery("");
          }}
          aria-label={registrationCopy.batch}
        >
          {batches.map((item) => {
            const waiting = pendingIn(item.id);
            const total = linesFor(item.id).length;
            return (
              <option key={item.id} value={item.id}>
                {item.name}
                {total > 0 && waiting === 0 ? ` · ${registrationCopy.completed}` : ""}
              </option>
            );
          })}
        </NativeSelect>
      </label>
      {batch ? (
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{batch.note}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{registrationCopy.empty}</p>
      )}
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {registrationCopy.permanent}
      </p>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {newIntake ? registrationCopy.noIntake : registrationCopy.empty}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group">
            <Button
              type="button"
              size="sm"
              variant={showing === "pending" ? "default" : "outline"}
              aria-pressed={showing === "pending"}
              disabled={pending.length === 0}
              onClick={() => setTab("pending")}
            >
              To allot ({pending.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={showing === "records" ? "default" : "outline"}
              aria-pressed={showing === "records"}
              onClick={() => setTab("records")}
            >
              Recorded numbers ({recorded.length})
            </Button>
            {pending.length === 0 ? (
              <Badge variant="gold">{registrationCopy.none}</Badge>
            ) : null}
          </div>

          {showing === "pending" ? (
            <>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {registrationCopy.csvHint}
              </p>
              <SpreadsheetBar
                filename={`registration-numbers-${batchId || "batch"}.csv`}
                headers={registrationCsvHeaders}
                rows={pending.map((line) => [
                  line.key,
                  line.name,
                  line.applicationNo,
                  line.guideName,
                  line.guideCampus,
                  line.email,
                  "",
                  "",
                ])}
                canUpload={canWrite}
                busy={busy}
                onUpload={(records) =>
                  void record(
                    records.map((item) => ({
                      key: field(item, ["scholar_id", "id"]),
                      applicationNo: field(item, [
                        "application_number",
                        "application no.",
                      ]),
                      email: field(item, ["email", "mail"]),
                      number: field(item, [
                        "registration_number",
                        "registration number",
                        "register no.",
                      ]),
                    })),
                  )
                }
                onError={setNotice}
              />
            </>
          ) : null}

          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "department",
                label: "Department",
                value: departmentFilter,
                options: choices((line) => line.department),
                onChange: setDepartmentFilter,
              },
              {
                id: "campus",
                label: "Campus",
                value: campusFilter,
                options: choices((line) => line.guideCampus),
                onChange: setCampusFilter,
              },
              {
                id: "guide",
                label: "Guide",
                value: guideFilter,
                options: choices((line) => line.guideName),
                onChange: setGuideFilter,
              },
              {
                id: "mode",
                label: "Mode",
                value: modeFilter,
                options: choices((line) => line.studyMode),
                onChange: setModeFilter,
              },
            ]}
            shown={visible.length}
            total={showing === "pending" ? pending.length : recorded.length}
            filename={`registration-numbers-${batchId || "batch"}.csv`}
            downloadLabel="Download this batch"
            headers={[
              "name",
              "department",
              "mode_of_study",
              "guide_name",
              "guide_campus",
              "registration_number",
            ]}
            rows={(showing === "pending" ? pending : lines)
              .filter(inScope)
              .filter(matches)
              .map((line) => [
                line.name,
                line.department,
                line.studyMode,
                line.guideName,
                line.guideCampus,
                line.number,
              ])}
          />

          {showing === "pending" && canWrite ? (
            <Button
              type="button"
              variant="gold"
              disabled={busy || Object.values(drafts).every((value) => !value.trim())}
              onClick={saveBatch}
            >
              {registrationCopy.save}
            </Button>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Mode of study</th>
                  <th className="px-3 py-3 font-semibold">Guide name</th>
                  <th className="px-3 py-3 font-semibold">Guide campus</th>
                  <th className="px-3 py-3 font-semibold">Registration number</th>
                  {showing === "records" ? (
                    <th className="px-3 py-3 font-semibold">Recorded on</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                      {registrationCopy.nothingShown}
                    </td>
                  </tr>
                ) : (
                  visible.map((line) => (
                    <tr key={line.key} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-primary">{line.name}</td>
                      <td className="px-3 py-2">{line.department || "—"}</td>
                      <td className="px-3 py-2">{line.studyMode || "—"}</td>
                      <td className="px-3 py-2">{line.guideName || "—"}</td>
                      <td className="px-3 py-2">{line.guideCampus || "—"}</td>
                      <td className="px-3 py-2">
                        {showing === "pending" ? (
                          canWrite ? (
                            <Input
                              value={drafts[line.key] ?? ""}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [line.key]: event.target.value,
                                }))
                              }
                              aria-label={`Registration number for ${line.name}`}
                              maxLength={20}
                            />
                          ) : (
                            "—"
                          )
                        ) : (
                          <span className="font-mono">{line.number}</span>
                        )}
                      </td>
                      {showing === "records" ? (
                        <td className="px-3 py-2 text-muted-foreground">
                          {line.on ? formatIsoDate(line.on) : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DeskPage>
  );
}
