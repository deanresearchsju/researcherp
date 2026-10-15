"use client";

import { useState, useSyncExternalStore } from "react";

import { DeskPage } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { registrationCsvHeaders } from "@/data/exams";
import { registrationCopy } from "@/data/registration";
import { researchRegister } from "@/data/research-register";
import { adminActionBlock, officeWriteBlock } from "@/lib/access";
import { field } from "@/lib/csv";
import {
  allotRegistration,
  allotRegistrations,
  batchOf,
  currentAllotments,
  currentRegister,
  registerMigrationHint,
  registrationIsSaved,
  registrationOf,
  subscribeRegister,
} from "@/lib/register";
import { usePreviewSession } from "@/lib/use-preview-session";

const firstOpenBatch =
  researchRegister.batches.find((batch) => batch.needsRegistrationNumber)?.id ??
  researchRegister.batches[0]?.id ??
  "";

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
  const [batchId, setBatchId] = useState(firstOpenBatch);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canWrite = Boolean(session) && !officeWriteBlock();
  const canEditSaved = Boolean(session) && !adminActionBlock();
  const batch = batchOf(batchId);
  const scholars = researchRegister.scholars.filter(
    (scholar) => scholar.batchId === batchId,
  );
  const visible = scholars.filter((scholar) =>
    textMatches(query, [
      scholar.name,
      scholar.applicationNumber,
      scholar.fileNumber,
      scholar.email,
      scholar.department,
      registrationOf(scholar, allotments),
    ]),
  );

  async function saveBatch() {
    if (!canWrite) {
      setNotice(officeWriteBlock()?.message ?? registrationCopy.adminOnly);
      return;
    }
    const rows = visible.flatMap((scholar) => {
      const saved = registrationIsSaved(scholar, allotments);
      const open = !saved || Boolean(editing[scholar.id]);
      if (!open) return [];
      const number = (drafts[scholar.id] ?? registrationOf(scholar, allotments)).trim();
      if (!number) return [];
      return [
        {
          scholarId: scholar.id,
          applicationNumber: scholar.applicationNumber,
          fileNumber: scholar.fileNumber,
          email: scholar.email,
          registrationNumber: number,
        },
      ];
    });
    if (rows.length === 0) {
      setNotice(registrationCopy.needNumber);
      return;
    }
    setBusy(true);
    const result = await allotRegistrations(rows);
    setBusy(false);
    setNotice(result.message);
    if (result.ok) {
      setDrafts({});
      setEditing({});
    }
  }

  async function saveOne(scholarId: string) {
    const scholar = researchRegister.scholars.find((item) => item.id === scholarId);
    if (!scholar) return;
    const number = (drafts[scholar.id] ?? registrationOf(scholar, allotments)).trim();
    setBusy(true);
    const saved = await allotRegistration(scholar.id, number);
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      delete next[scholar.id];
      return next;
    });
    setEditing((current) => {
      const next = { ...current };
      delete next[scholar.id];
      return next;
    });
    setNotice(registrationCopy.saved);
  }

  return (
    <DeskPage kicker={registrationCopy.kicker} title={registrationCopy.title}>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {registrationCopy.detail}
      </p>
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
            setBatchId(event.target.value);
            setDrafts({});
            setEditing({});
            setQuery("");
          }}
          aria-label={registrationCopy.batch}
        >
          {researchRegister.batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      {batch ? (
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{batch.note}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{registrationCopy.empty}</p>
      )}

      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {registrationCopy.csvHint}
      </p>
      <SpreadsheetBar
        filename={`registration-numbers-${batchId || "batch"}.csv`}
        headers={registrationCsvHeaders}
        rows={scholars.map((scholar) => [
          scholar.id,
          scholar.name,
          scholar.applicationNumber,
          scholar.fileNumber,
          scholar.email,
          registrationOf(scholar, allotments),
          "",
        ])}
        canUpload={canWrite}
        busy={busy}
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

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={visible.length}
        total={scholars.length}
        filename="registration-numbers-batch.csv"
        downloadLabel="Download this batch"
        headers={[
          "name",
          "application_number",
          "file_number",
          "department",
          "registration_number",
        ]}
        rows={visible.map((scholar) => [
          scholar.name,
          scholar.applicationNumber,
          scholar.fileNumber,
          scholar.department,
          registrationOf(scholar, allotments),
        ])}
      />

      {canWrite ? (
        <Button
          type="button"
          variant="gold"
          disabled={busy}
          onClick={() => void saveBatch()}
        >
          {registrationCopy.save}
        </Button>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3 font-semibold">Name</th>
              <th className="px-3 py-3 font-semibold">Application No.</th>
              <th className="px-3 py-3 font-semibold">Department</th>
              <th className="px-3 py-3 font-semibold">Registration number</th>
              <th className="px-3 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                  {scholars.length === 0 ? registrationCopy.empty : registrationCopy.none}
                </td>
              </tr>
            ) : (
              visible.map((scholar) => {
                const savedNumber = registrationOf(scholar, allotments);
                const locked = registrationIsSaved(scholar, allotments);
                const open = canWrite && (!locked || Boolean(editing[scholar.id]));
                return (
                  <tr key={scholar.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-primary">{scholar.name}</td>
                    <td className="px-3 py-2">{scholar.applicationNumber || "—"}</td>
                    <td className="px-3 py-2">{scholar.department || "—"}</td>
                    <td className="px-3 py-2">
                      {open ? (
                        <Input
                          value={drafts[scholar.id] ?? savedNumber}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [scholar.id]: event.target.value,
                            }))
                          }
                          aria-label={`Registration number for ${scholar.name}`}
                          maxLength={20}
                        />
                      ) : (
                        <span>
                          {savedNumber || "—"}
                          {locked ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {registrationCopy.locked}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {open ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void saveOne(scholar.id)}
                          >
                            {registrationCopy.saveOne}
                          </Button>
                        ) : null}
                        {locked && canEditSaved && !editing[scholar.id] ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditing((current) => ({
                                ...current,
                                [scholar.id]: true,
                              }))
                            }
                          >
                            {registrationCopy.edit}
                          </Button>
                        ) : null}
                        {editing[scholar.id] ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing((current) => {
                                const next = { ...current };
                                delete next[scholar.id];
                                return next;
                              });
                              setDrafts((current) => {
                                const next = { ...current };
                                delete next[scholar.id];
                                return next;
                              });
                            }}
                          >
                            {registrationCopy.cancelEdit}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </DeskPage>
  );
}
