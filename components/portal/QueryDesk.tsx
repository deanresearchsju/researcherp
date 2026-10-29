"use client";

import { useCallback, useEffect, useState } from "react";

import { DeskPage, FormDialog } from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { queryCategories, queryCopy, queryLimits, type QueryAsker } from "@/data/queries";
import { formatIsoDate } from "@/lib/dates";
import { queryProblem, type HelpQuery } from "@/lib/queries";

export function stampOf(iso: string) {
  if (!iso) return "";
  const time = iso.slice(11, 16);
  return `${formatIsoDate(iso.slice(0, 10))}${time ? ` ${time}` : ""}`;
}

export function QueryStatus({ status }: { status: HelpQuery["status"] }) {
  return (
    <Badge
      variant={status === "Closed" ? "outline" : status === "Replied" ? "gold" : "maroon"}
    >
      {status === "Closed"
        ? queryCopy.closed
        : status === "Replied"
          ? queryCopy.replied
          : queryCopy.waiting}
    </Badge>
  );
}

/** The question and everything said about it, oldest first. */
export function QueryThread({ query }: { query: HelpQuery }) {
  const lines = [
    { at: query.createdAt, by: query.name, office: false, text: query.question },
    ...query.messages.map((message) => ({
      at: message.at,
      by: message.by,
      office: message.from === "office",
      text: message.text,
    })),
  ];
  return (
    <ul className="space-y-2">
      {lines.map((line, index) => (
        <li
          key={`${line.at}-${index}`}
          className={
            line.office
              ? "rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
              : "rounded-xl border border-border bg-muted/30 px-4 py-3"
          }
        >
          <p className="text-xs font-semibold text-primary">
            {line.office ? `Research office · ${line.by}` : line.by}
            <span className="ml-2 font-normal text-muted-foreground">
              {stampOf(line.at)}
            </span>
          </p>
          <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{line.text}</p>
        </li>
      ))}
    </ul>
  );
}

async function send(body: Record<string, unknown>) {
  try {
    const response = await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
    } | null;
    if (response.ok && data?.ok) return { ok: true as const };
    return {
      ok: false as const,
      message: data?.message ?? "The request failed. Try again.",
    };
  } catch {
    return { ok: false as const, message: "The request failed. Check the connection." };
  }
}

function AskDialog({
  role,
  onClose,
  onDone,
}: {
  role: QueryAsker;
  onClose: () => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = queryProblem(role, { category, subject, question });
    if (problem) return setError(problem);
    setBusy(true);
    const saved = await send({ action: "create", category, subject, question });
    setBusy(false);
    if (!saved.ok) return setError(saved.message);
    onDone();
  }

  return (
    <FormDialog
      title={queryCopy.ask}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={queryCopy.send}
      size="lg"
    >
      <div className="grid gap-4">
        <FormField label={queryCopy.category} htmlFor="query-category" required>
          <NativeSelect
            id="query-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Choose…</option>
            {queryCategories[role].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={queryCopy.subject} htmlFor="query-subject" required>
          <Input
            id="query-subject"
            value={subject}
            maxLength={queryLimits.subjectMax}
            onChange={(event) => setSubject(event.target.value)}
          />
        </FormField>
        <FormField
          label={queryCopy.question}
          htmlFor="query-question"
          required
          hint={queryCopy.questionHint}
        >
          <Textarea
            id="query-question"
            rows={6}
            value={question}
            maxLength={queryLimits.questionMax}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </FormField>
        {error ? (
          <p role="alert" className="text-sm text-secondary">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

function FollowUp({
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
  async function add() {
    if (text.trim().length < 2) return onError("Write the message first.");
    setBusy(true);
    const saved = await send({ action: "followup", id: query.id, text });
    setBusy(false);
    if (!saved.ok) return onError(saved.message);
    setText("");
    onDone();
  }
  async function close() {
    setBusy(true);
    const saved = await send({ action: "close", id: query.id });
    setBusy(false);
    if (!saved.ok) return onError(saved.message);
    onDone();
  }
  return (
    <div className="mt-3 grid gap-2">
      <Textarea
        rows={2}
        value={text}
        maxLength={queryLimits.replyMax}
        placeholder={queryCopy.followUp}
        aria-label={queryCopy.followUp}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void add()}>
          {queryCopy.followUp}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void close()}
        >
          {queryCopy.closeIt}
        </Button>
      </div>
    </div>
  );
}

/** A scholar's or supervisor's own questions to the research office, and the replies. */
export function QueryDesk({ role }: { role: QueryAsker }) {
  const [queries, setQueries] = useState<HelpQuery[] | null>(null);
  const [failed, setFailed] = useState("");
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState("");

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
    // Reads this person's questions once the page is shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <DeskPage
      kicker={queryCopy.kicker}
      title={queryCopy.title}
      actions={
        <Button
          type="button"
          variant="gold"
          onClick={() => {
            setNotice("");
            setAsking(true);
          }}
        >
          {queryCopy.ask}
        </Button>
      }
    >
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {queryCopy.intro}
      </p>
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-secondary">
          {failed}
        </p>
      ) : null}
      {queries === null && !failed ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {queries && queries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {queryCopy.none}
        </p>
      ) : null}
      <div className="space-y-4">
        {(queries ?? []).map((query) => (
          <article
            key={query.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-primary">{query.subject}</h2>
                <p className="text-xs text-muted-foreground">
                  {query.category} · {stampOf(query.createdAt)}
                </p>
              </div>
              <QueryStatus status={query.status} />
            </header>
            <div className="mt-3">
              <QueryThread query={query} />
            </div>
            {query.status !== "Closed" ? (
              <FollowUp
                query={query}
                onDone={() => void load()}
                onError={(message) => setNotice(message)}
              />
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Closed {stampOf(query.closedAt)}
                {query.closedBy ? ` by ${query.closedBy}` : ""}.
              </p>
            )}
          </article>
        ))}
      </div>
      {asking ? (
        <AskDialog
          role={role}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            setNotice(queryCopy.sent);
            void load();
          }}
        />
      ) : null}
    </DeskPage>
  );
}
