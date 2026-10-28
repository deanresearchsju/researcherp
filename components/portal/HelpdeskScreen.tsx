"use client";

import { useState, useSyncExternalStore } from "react";

import { DeskPage, DeskTable } from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { helpdeskCopy } from "@/data/helpdesk";
import { formatIsoDate } from "@/lib/dates";
import {
  helpdeskMigrationHint,
  localHelpdeskMessages,
  mergeHelpdeskMessages,
  serverHelpdeskMessages,
  subscribeHelpdesk,
  type HelpdeskLoad,
} from "@/lib/helpdesk";

function stamp(iso: string) {
  const date = formatIsoDate(iso.slice(0, 10));
  const time = iso.slice(11, 16);
  return time ? `${date} ${time}` : date;
}

export function HelpdeskScreen({ initial }: { initial: HelpdeskLoad }) {
  const local = useSyncExternalStore(
    subscribeHelpdesk,
    localHelpdeskMessages,
    serverHelpdeskMessages,
  );
  const all = mergeHelpdeskMessages(initial.items, local);
  const browserOnly = initial.source !== "database";
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [subject, setSubject] = useState("");
  const monthOf = (iso: string) => iso.slice(0, 7);
  const items = all.filter(
    (row) =>
      filterMatches(month, monthOf(row.createdAt)) &&
      filterMatches(subject, row.subject) &&
      textMatches(query, [row.name, row.phone, row.email, row.subject, row.message]),
  );
  const choices = (values: string[]) =>
    [...new Set(values)]
      .filter(Boolean)
      .sort()
      .map((value) => ({ value, label: value }));

  return (
    <DeskPage kicker={helpdeskCopy.kicker} title={helpdeskCopy.title}>
      {browserOnly ? (
        <p role="status" className="text-sm text-muted-foreground">
          {helpdeskMigrationHint}
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "month",
            label: "Month",
            value: month,
            options: choices(all.map((row) => monthOf(row.createdAt))).reverse(),
            onChange: setMonth,
          },
          {
            id: "subject",
            label: helpdeskCopy.subject,
            value: subject,
            options: choices(all.map((row) => row.subject)),
            onChange: setSubject,
          },
        ]}
        shown={items.length}
        total={all.length}
        filename="helpdesk-messages.csv"
        headers={[
          helpdeskCopy.received,
          helpdeskCopy.name,
          helpdeskCopy.phone,
          helpdeskCopy.email,
          helpdeskCopy.subject,
          helpdeskCopy.message,
        ]}
        rows={items.map((row) => [
          stamp(row.createdAt),
          row.name,
          row.phone,
          row.email,
          row.subject,
          row.message,
        ])}
      />
      <DeskTable
        headers={[
          helpdeskCopy.received,
          helpdeskCopy.name,
          helpdeskCopy.phone,
          helpdeskCopy.email,
          helpdeskCopy.subject,
          helpdeskCopy.message,
        ]}
        empty={items.length === 0}
      >
        {items.map((row) => (
          <tr key={row.id} className="border-t border-border align-top">
            <td className="px-4 py-3 whitespace-nowrap">{stamp(row.createdAt)}</td>
            <td className="px-4 py-3 font-semibold text-primary">{row.name}</td>
            <td className="px-4 py-3 whitespace-nowrap">{row.phone}</td>
            <td className="px-4 py-3">{row.email}</td>
            <td className="px-4 py-3">{row.subject}</td>
            <td className="max-w-sm px-4 py-3 whitespace-pre-wrap">{row.message}</td>
          </tr>
        ))}
      </DeskTable>
    </DeskPage>
  );
}
