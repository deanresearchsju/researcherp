import { queryCategories, queryLimits, type QueryAsker } from "@/data/queries";

export type QueryStatus = "Open" | "Replied" | "Closed";

export type QueryMessage = {
  at: string;
  by: string;
  /** "office" for the administrator or the Dean, otherwise the role of the person who asked. */
  from: "office" | QueryAsker;
  text: string;
};

export type HelpQuery = {
  id: string;
  createdAt: string;
  role: QueryAsker;
  identifier: string;
  name: string;
  category: string;
  subject: string;
  question: string;
  /** Open: waiting for the office. Replied: answered, still open. Closed: finished. */
  status: QueryStatus;
  messages: QueryMessage[];
  closedAt: string;
  closedBy: string;
};

export function isAsker(role: string): role is QueryAsker {
  return role === "scholar" || role === "supervisor";
}

/** Why a new question cannot be sent; null when it can. */
export function queryProblem(
  role: QueryAsker,
  input: { category: string; subject: string; question: string },
) {
  if (!queryCategories[role].includes(input.category)) return "Choose what it is about.";
  const subject = input.subject.trim();
  if (
    subject.length < queryLimits.subjectMin ||
    subject.length > queryLimits.subjectMax
  ) {
    return `Write the subject in ${queryLimits.subjectMin} to ${queryLimits.subjectMax} characters.`;
  }
  const question = input.question.trim();
  if (question.length < queryLimits.questionMin) {
    return `Write your question in at least ${queryLimits.questionMin} characters, with the details the office needs.`;
  }
  if (question.length > queryLimits.questionMax) {
    return `Keep the question within ${queryLimits.questionMax} characters.`;
  }
  return null;
}

/** What a stored record is, read defensively: the row is shared JSON. */
export function parseQueries(value: unknown): HelpQuery[] {
  const list =
    value &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown }).items)
      ? ((value as { items: unknown[] }).items as unknown[])
      : [];
  const text = (item: unknown) => (typeof item === "string" ? item : "");
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const role = row.role === "supervisor" ? "supervisor" : "scholar";
    const status: QueryStatus =
      row.status === "Closed" ? "Closed" : row.status === "Replied" ? "Replied" : "Open";
    if (!text(row.id)) return [];
    const messages = Array.isArray(row.messages)
      ? row.messages.flatMap((message): QueryMessage[] => {
          if (!message || typeof message !== "object") return [];
          const item = message as Record<string, unknown>;
          return [
            {
              at: text(item.at),
              by: text(item.by),
              from:
                item.from === "office"
                  ? "office"
                  : item.from === "supervisor"
                    ? "supervisor"
                    : "scholar",
              text: text(item.text),
            },
          ];
        })
      : [];
    return [
      {
        id: text(row.id),
        createdAt: text(row.createdAt),
        role,
        identifier: text(row.identifier),
        name: text(row.name),
        category: text(row.category),
        subject: text(row.subject),
        question: text(row.question),
        status,
        messages,
        closedAt: text(row.closedAt),
        closedBy: text(row.closedBy),
      },
    ];
  });
}
