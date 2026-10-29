import { queryLimits, type QueryAsker } from "@/data/queries";
import { parseQueries, queryProblem, type HelpQuery } from "@/lib/queries";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * The questions are kept as one record of the examination table (id "helpdesk"). The browser
 * cannot read or write that record (see lib/db-policy.ts): they pass only through /api/queries,
 * which shows each person their own questions and the office all of them.
 */
const table = "exam_office" as const;
const rowId = "helpdesk";

type Person = { role: QueryAsker; identifier: string; name: string };

const same = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

export async function loadQueries() {
  const db = createAdminSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from(table)
    .select("payload, updated_at")
    .eq("id", rowId)
    .maybeSingle();
  if (error) return null;
  return { items: parseQueries(data?.payload ?? null), stamp: data?.updated_at ?? null };
}

/** Reads, changes and saves the record; tries again when someone else saved in between. */
async function change(
  apply: (
    items: HelpQuery[],
  ) => { items: HelpQuery[] } | { error: string; status: number },
) {
  const db = createAdminSupabase();
  if (!db)
    return { ok: false as const, message: "The database is not connected.", status: 503 };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await loadQueries();
    if (!current) {
      return {
        ok: false as const,
        message: "The questions could not be read.",
        status: 503,
      };
    }
    const next = apply(current.items);
    if ("error" in next)
      return { ok: false as const, message: next.error, status: next.status };
    const payload = { items: next.items } as unknown as Json;
    if (current.stamp === null) {
      const { error } = await db.from(table).insert({ id: rowId, payload });
      if (!error) return { ok: true as const };
    } else {
      const { data, error } = await db
        .from(table)
        .update({ payload })
        .eq("id", rowId)
        .eq("updated_at", current.stamp)
        .select("id");
      if (!error && data?.length === 1) return { ok: true as const };
      if (error) {
        return {
          ok: false as const,
          message: "The question could not be saved.",
          status: 500,
        };
      }
    }
  }
  return {
    ok: false as const,
    message: "Another change was being saved. Try again.",
    status: 409,
  };
}

export function createQuery(
  person: Person,
  input: { category: string; subject: string; question: string },
) {
  const problem = queryProblem(person.role, input);
  if (problem)
    return Promise.resolve({ ok: false as const, message: problem, status: 400 });
  const query: HelpQuery = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    role: person.role,
    identifier: person.identifier,
    name: person.name,
    category: input.category,
    subject: input.subject.trim(),
    question: input.question.trim(),
    status: "Open",
    messages: [],
    closedAt: "",
    closedBy: "",
  };
  return change((items) => {
    const waiting = items.filter(
      (item) =>
        item.status !== "Closed" &&
        item.role === person.role &&
        same(item.identifier, person.identifier),
    ).length;
    if (waiting >= queryLimits.openMax) {
      return {
        error: `You already have ${queryLimits.openMax} questions waiting. Wait for a reply, or close one, before asking another.`,
        status: 400,
      };
    }
    return { items: [query, ...items] };
  }).then((result) => (result.ok ? { ...result, value: query } : result));
}

/** The administrator or the Dean answers; the question is closed unless they keep it open. */
export function replyToQuery(
  by: { role: "admin" | "dean"; name: string },
  id: string,
  text: string,
  close: boolean,
) {
  const reply = text.trim();
  if (reply.length < 2 || reply.length > queryLimits.replyMax) {
    return Promise.resolve({
      ok: false as const,
      message: `Write the reply in 2 to ${queryLimits.replyMax} characters.`,
      status: 400,
    });
  }
  let found: HelpQuery | null = null;
  return change((items) => {
    const at = items.findIndex((item) => item.id === id);
    if (at < 0) return { error: "That question was not found.", status: 404 };
    if (items[at].status === "Closed") {
      return { error: "That question is closed.", status: 400 };
    }
    const now = new Date().toISOString();
    const updated: HelpQuery = {
      ...items[at],
      status: close ? "Closed" : "Replied",
      messages: [
        ...items[at].messages,
        { at: now, by: by.name, from: "office", text: reply },
      ],
      closedAt: close ? now : "",
      closedBy: close ? by.name : "",
    };
    found = updated;
    return { items: items.map((item, index) => (index === at ? updated : item)) };
  }).then((result) =>
    result.ok ? { ...result, value: found as HelpQuery | null } : result,
  );
}

/** The person who asked adds a message to a question that is not closed (it is open again). */
export function followUpQuery(person: Person, id: string, text: string) {
  const message = text.trim();
  if (message.length < 2 || message.length > queryLimits.replyMax) {
    return Promise.resolve({
      ok: false as const,
      message: `Write the message in 2 to ${queryLimits.replyMax} characters.`,
      status: 400,
    });
  }
  let found: HelpQuery | null = null;
  return change((items) => {
    const at = items.findIndex(
      (item) =>
        item.id === id &&
        item.role === person.role &&
        same(item.identifier, person.identifier),
    );
    if (at < 0) return { error: "That question was not found.", status: 404 };
    if (items[at].status === "Closed") {
      return { error: "That question is closed. Ask a new one.", status: 400 };
    }
    const updated: HelpQuery = {
      ...items[at],
      status: "Open",
      messages: [
        ...items[at].messages,
        {
          at: new Date().toISOString(),
          by: person.name,
          from: person.role,
          text: message,
        },
      ],
    };
    found = updated;
    return { items: items.map((item, index) => (index === at ? updated : item)) };
  }).then((result) =>
    result.ok ? { ...result, value: found as HelpQuery | null } : result,
  );
}

/** The person who asked closes their own question (it was answered, or is no longer needed). */
export function closeOwnQuery(person: Person, id: string) {
  return change((items) => {
    const at = items.findIndex(
      (item) =>
        item.id === id &&
        item.role === person.role &&
        same(item.identifier, person.identifier),
    );
    if (at < 0) return { error: "That question was not found.", status: 404 };
    if (items[at].status === "Closed") return { items };
    const updated: HelpQuery = {
      ...items[at],
      status: "Closed",
      closedAt: new Date().toISOString(),
      closedBy: person.name,
    };
    return { items: items.map((item, index) => (index === at ? updated : item)) };
  });
}

export function queriesOf(items: readonly HelpQuery[], person: Person) {
  return items.filter(
    (item) => item.role === person.role && same(item.identifier, person.identifier),
  );
}
