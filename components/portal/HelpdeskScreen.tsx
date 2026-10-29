"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { DeskPage, DeskTable, DeskTabs } from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { QueryStatus, QueryThread, stampOf } from "@/components/portal/QueryDesk";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { helpdeskCopy } from "@/data/helpdesk";
import { queryCopy, queryLimits } from "@/data/queries";
import {
  localHelpdeskMessages,
  mergeHelpdeskMessages,
  serverHelpdeskMessages,
  subscribeHelpdesk,
  type HelpdeskLoad,
} from "@/lib/helpdesk";
import type { HelpQuery } from "@/lib/queries";
import { usePreviewSession } from "@/lib/use-preview-session";

type Tab = "open" | "closed" | "website";

function Reply({
  query,
  onDone,
  onError,
}: {
  query: HelpQuery;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(close: boolean) {
    if (text.trim().length < 2) return onError("Write the reply first.");
    setBusy(true);
    try {
      const response = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", id: query.id, text, close }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        onError(data?.message ?? "The reply could not be saved.");
      } else {
        setText("");
        onDone();
      }
    } catch {
      onError("The reply could not be saved. Check the connection.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 grid gap-2">
      <Textarea
        rows={3}
        value={text}
        maxLength={queryLimits.replyMax}
        aria-label={queryCopy.replyLabel}
        placeholder={queryCopy.replyLabel}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void send(true)}>
          {queryCopy.replyAndClose}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void send(false)}
        >
          {queryCopy.replyKeepOpen}
        </Button>
      </div>
    </div>
  );
}

function Queries({ tab }: { tab: "open" | "closed" }) {
  const session = usePreviewSession();
  const canReply = session?.role === "admin" || session?.role === "dean";
  const [queries, setQueries] = useState<HelpQuery[] | null>(null);
  const [failed, setFailed] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/queries", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        queries?: HelpQuery[];
        message?: string;
      } | null;
      if (response.ok && data?.ok && data.queries) {
        setQueries(data.queries);
        setFailed("");
      } else setFailed(data?.message ?? "The questions could not be loaded.");
    } catch {
      setFailed("The questions could not be loaded. Check the connection.");
    }
  }, []);

  useEffect(() => {
    // Reads the questions once the page is shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const wanted = (queries ?? [])
    .filter((item) =>
      tab === "closed" ? item.status === "Closed" : item.status !== "Closed",
    )
    .sort((left, right) =>
      tab === "closed"
        ? right.closedAt.localeCompare(left.closedAt)
        : left.createdAt.localeCompare(right.createdAt),
    );
  const shown = wanted.filter(
    (item) =>
      filterMatches(category, item.category) &&
      textMatches(query, [
        item.name,
        item.identifier,
        item.subject,
        item.question,
        item.category,
        item.role,
      ]),
  );
  const categories = [...new Set(wanted.map((item) => item.category))]
    .sort()
    .map((value) => ({ value, label: value }));

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl text-primary">
        {tab === "closed" ? "Closed questions" : "Open questions"}
      </h2>
      {!canReply ? (
        <p className="text-sm text-muted-foreground">
          The administrator and the Dean reply to the questions; you can read them here.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-secondary">
          {failed}
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "category",
            label: queryCopy.category,
            value: category,
            options: categories,
            onChange: setCategory,
          },
        ]}
        shown={shown.length}
        total={wanted.length}
        filename={tab === "closed" ? "helpdesk-closed.csv" : "helpdesk-open.csv"}
        headers={["Asked", "From", "Role", "About", "Subject", "Status"]}
        rows={shown.map((item) => [
          stampOf(item.createdAt),
          item.name,
          item.role,
          item.category,
          item.subject,
          item.status,
        ])}
      />
      {queries === null && !failed ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {queries && shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {tab === "closed" ? "No closed questions." : "No question is waiting."}
        </p>
      ) : null}
      {shown.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-primary">{item.subject}</h2>
              <p className="text-xs text-muted-foreground">
                {item.name} ({item.role}, {item.identifier}) · {item.category} ·{" "}
                {stampOf(item.createdAt)}
              </p>
            </div>
            <QueryStatus status={item.status} />
          </header>
          <div className="mt-3">
            <QueryThread query={item} />
          </div>
          {item.status !== "Closed" && canReply ? (
            <Reply
              query={item}
              onDone={() => {
                setNotice("Reply sent.");
                void load();
              }}
              onError={setNotice}
            />
          ) : null}
          {item.status === "Closed" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Closed {stampOf(item.closedAt)}
              {item.closedBy ? ` by ${item.closedBy}` : ""}.
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function stamp(iso: string) {
  return stampOf(iso);
}

/** Messages that came in through the public Contact page before it was closed. */
function WebsiteMessages({ initial }: { initial: HelpdeskLoad }) {
  const local = useSyncExternalStore(
    subscribeHelpdesk,
    localHelpdeskMessages,
    serverHelpdeskMessages,
  );
  const all = mergeHelpdeskMessages(initial.items, local);
  const [query, setQuery] = useState("");
  const items = all.filter((row) =>
    textMatches(query, [row.name, row.phone, row.email, row.subject, row.message]),
  );
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl text-primary">Website messages</h2>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {queryCopy.websiteNote}
      </p>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={items.length}
        total={all.length}
        filename="website-messages.csv"
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
    </div>
  );
}

export function HelpdeskScreen({ initial }: { initial: HelpdeskLoad }) {
  const [tab, setTab] = useState<Tab>("open");
  return (
    <DeskPage kicker={queryCopy.adminKicker} title={queryCopy.adminTitle}>
      <DeskTabs
        tabs={[
          { id: "open", label: "Open questions" },
          { id: "closed", label: "Closed questions" },
          { id: "website", label: "Website messages" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      {tab === "website" ? (
        <WebsiteMessages initial={initial} />
      ) : (
        <Queries key={tab} tab={tab} />
      )}
    </DeskPage>
  );
}
