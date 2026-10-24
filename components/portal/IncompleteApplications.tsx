"use client";

import { filterMatches } from "@/lib/list-filter";

import { useState } from "react";

import { DeskModal, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { incompleteApplicationsCopy as copy } from "@/data/incomplete-applications";
import { toCsv } from "@/lib/csv";
import { downloadCsvAsSheet } from "@/lib/sheet";
import { formatIsoDate } from "@/lib/dates";
import { officeWriteBlock } from "@/lib/access";
import { useCanMenuAction } from "@/lib/use-menu-action";
import {
  loadIncompleteApplications,
  removeIncompleteApplication,
  saveIncompleteFollow,
  type IncompleteApplication,
  type IncompleteLoad,
} from "@/lib/phd-drafts";

const csvHeaders = [
  copy.updated,
  copy.name,
  copy.mobile,
  copy.email,
  copy.school,
  copy.subject,
  copy.mode,
  copy.session,
  copy.year,
  copy.step,
  copy.follow,
  copy.followedOn,
  copy.note,
] as const;

function whenLabel(value: string) {
  const day = value.slice(0, 10);
  const time = value.slice(11, 16);
  const date = formatIsoDate(day);
  return time ? `${date} · ${time}` : date;
}

function csvRows(rows: IncompleteApplication[]) {
  return rows.map((row) => [
    whenLabel(row.updatedAt),
    row.name,
    row.mobile,
    row.email,
    row.school,
    row.subject,
    row.studyMode,
    row.session,
    row.year,
    row.stepLabel,
    row.followedAt ? copy.followed : copy.pending,
    row.followedAt ? whenLabel(row.followedAt) : "",
    row.followNote,
  ]);
}

export function IncompleteApplications({ initial }: { initial: IncompleteLoad }) {
  const [rows, setRows] = useState(initial.rows);
  const [notice, setNotice] = useState<string | null>(initial.detail);
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<IncompleteApplication | null>(null);
  const [note, setNote] = useState("");
  const [followed, setFollowed] = useState(false);
  const writable = !officeWriteBlock();
  const canExport = useCanMenuAction("export");

  const visible = rows.filter((row) => {
    if (!filterMatches(follow, row.followedAt ? "followed" : "pending")) return false;
    return textMatches(query, [
      row.name,
      row.mobile,
      row.email,
      row.school,
      row.subject,
      row.stepLabel,
    ]);
  });

  function openFollow(row: IncompleteApplication) {
    setViewing(row);
    setNote(row.followNote);
    setFollowed(Boolean(row.followedAt));
    setNotice(null);
  }

  async function refresh() {
    const loaded = await loadIncompleteApplications();
    setRows(loaded.rows);
    setNotice(loaded.detail);
    return loaded.rows;
  }

  async function saveFollow() {
    if (!viewing) return;
    setBusy(true);
    const saved = await saveIncompleteFollow(viewing.mobile, note, followed);
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    const next = await refresh();
    const current = next.find((row) => row.mobile === viewing.mobile) ?? null;
    setViewing(current);
    if (current) {
      setNote(current.followNote);
      setFollowed(Boolean(current.followedAt));
    }
    setNotice(copy.saved);
  }

  async function remove(row: IncompleteApplication) {
    if (!window.confirm(`${copy.removeConfirm} ${row.mobile}`)) return;
    setBusy(true);
    const removed = await removeIncompleteApplication(row.mobile);
    setBusy(false);
    if (!removed.ok) {
      setNotice(removed.message);
      return;
    }
    if (viewing?.mobile === row.mobile) setViewing(null);
    setNotice(copy.removed);
    await refresh();
  }

  return (
    <div>
      <PageTitle kicker="Admissions" title={copy.title} />
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "follow",
            label: copy.follow,
            value: follow,
            options: [
              { value: "pending", label: copy.pending },
              { value: "followed", label: copy.followed },
            ],
            onChange: setFollow,
          },
        ]}
        shown={visible.length}
        total={rows.length}
        filename="incomplete-applications-filtered.csv"
        headers={[...csvHeaders]}
        rows={csvRows(visible)}
        downloadLabel={copy.exportFiltered}
      />
      {canExport ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="gold"
            disabled={rows.length === 0}
            onClick={() =>
              void downloadCsvAsSheet(
                "incomplete-applications.csv",
                toCsv(csvHeaders, csvRows(rows)),
              )
            }
          >
            {copy.exportAll}
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice}
        </p>
      ) : null}
      {rows.length === 0 && !notice ? (
        <p className="mt-6 text-sm text-muted-foreground">{copy.empty}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-3 py-3 font-semibold">{copy.updated}</th>
              <th className="px-3 py-3 font-semibold">{copy.name}</th>
              <th className="px-3 py-3 font-semibold">{copy.mobile}</th>
              <th className="px-3 py-3 font-semibold">{copy.email}</th>
              <th className="px-3 py-3 font-semibold">{copy.school}</th>
              <th className="px-3 py-3 font-semibold">{copy.subject}</th>
              <th className="px-3 py-3 font-semibold">{copy.step}</th>
              <th className="px-3 py-3 font-semibold">{copy.follow}</th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.mobile} className="border-t border-border">
                <td className="px-3 py-3 align-top">{whenLabel(row.updatedAt)}</td>
                <td className="px-3 py-3 align-top font-semibold text-primary">
                  {row.name || copy.none}
                </td>
                <td className="px-3 py-3 align-top">
                  <a
                    className="font-semibold text-secondary underline"
                    href={`tel:${row.mobile}`}
                  >
                    {row.mobile}
                  </a>
                </td>
                <td className="px-3 py-3 align-top">
                  {row.email ? (
                    <a className="text-secondary underline" href={`mailto:${row.email}`}>
                      {row.email}
                    </a>
                  ) : (
                    copy.none
                  )}
                </td>
                <td className="px-3 py-3 align-top">{row.school || copy.none}</td>
                <td className="px-3 py-3 align-top">{row.subject || copy.none}</td>
                <td className="px-3 py-3 align-top">{row.stepLabel}</td>
                <td className="px-3 py-3 align-top">
                  {row.followedAt ? copy.followed : copy.pending}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFollow(row)}
                    >
                      {copy.view}
                    </Button>
                    {writable ? (
                      <Button
                        type="button"
                        variant="maroon"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(row)}
                      >
                        {copy.remove}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing ? (
        <DeskModal
          title={`${copy.follow} · ${viewing.mobile}`}
          onClose={() => setViewing(null)}
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.name}
              </dt>
              <dd className="mt-1 font-semibold text-primary">
                {viewing.name || copy.none}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.step}
              </dt>
              <dd className="mt-1">{viewing.stepLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.mobile}
              </dt>
              <dd className="mt-1">
                <a
                  className="font-semibold text-secondary underline"
                  href={`tel:${viewing.mobile}`}
                >
                  {copy.call} {viewing.mobile}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.email}
              </dt>
              <dd className="mt-1">
                {viewing.email ? (
                  <a
                    className="font-semibold text-secondary underline"
                    href={`mailto:${viewing.email}`}
                  >
                    {copy.write} {viewing.email}
                  </a>
                ) : (
                  copy.none
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.school}
              </dt>
              <dd className="mt-1">{viewing.school || copy.none}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.subject}
              </dt>
              <dd className="mt-1">{viewing.subject || copy.none}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.mode}
              </dt>
              <dd className="mt-1">{viewing.studyMode || copy.none}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {copy.updated}
              </dt>
              <dd className="mt-1">{whenLabel(viewing.updatedAt)}</dd>
            </div>
          </dl>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveFollow();
            }}
          >
            <FormField label={copy.note} htmlFor="follow-note">
              <Textarea
                id="follow-note"
                value={note}
                disabled={!writable}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={followed}
                disabled={!writable}
                onChange={(event) => setFollowed(event.target.checked)}
              />
              {copy.markFollowed}
            </label>
            {writable ? (
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? "Saving…" : copy.save}
                </Button>
                <Button
                  type="button"
                  variant="maroon"
                  disabled={busy}
                  onClick={() => void remove(viewing)}
                >
                  {copy.remove}
                </Button>
              </div>
            ) : null}
          </form>
        </DeskModal>
      ) : null}
    </div>
  );
}
