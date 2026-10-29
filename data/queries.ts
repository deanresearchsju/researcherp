/**
 * Questions asked inside the ERP. A scholar or supervisor chooses what the question is about,
 * writes it, and it goes to the administrator and the Dean, who reply; the question is then
 * closed. This replaces the public Contact page.
 */
export type QueryAsker = "scholar" | "supervisor";

export const queryCategories: Record<QueryAsker, readonly string[]> = {
  scholar: [
    "Admission and registration number",
    "Course work, hall ticket and results",
    "Fees and payments",
    "Doctoral committee and RAC",
    "Synopsis, thesis and viva",
    "Change of supervisor, mode of study or title",
    "Documents, letters and certificates",
    "A problem with the ERP (sign-in, upload, a page that does not open)",
    "Anything else",
  ],
  supervisor: [
    "My scholars and allotment",
    "RAC and doctoral committees",
    "Thesis evaluators",
    "Scholar requests and approvals",
    "Colloquium",
    "My details and profile",
    "Documents and letters",
    "A problem with the ERP (sign-in, upload, a page that does not open)",
    "Anything else",
  ],
};

export const queryLimits = {
  subjectMin: 5,
  subjectMax: 120,
  questionMin: 15,
  questionMax: 2000,
  replyMax: 2000,
  /** Questions a person may have waiting for a reply at one time. */
  openMax: 5,
} as const;

export const queryCopy = {
  menu: "Helpdesk",
  title: "Helpdesk",
  kicker: "Ask the research office",
  intro:
    "Ask a question here instead of writing to the office. It goes to the administrator and the Dean, who reply on this page. Once it is answered the question is closed; ask again if you need more.",
  ask: "Ask a question",
  category: "What is it about?",
  subject: "Subject (a few words)",
  question: "Your question",
  questionHint: "Give the details the office needs: names, numbers, dates.",
  send: "Send to the office",
  none: "You have not asked anything yet.",
  waiting: "Waiting for a reply",
  replied: "Replied",
  closed: "Closed",
  followUp: "Add a message",
  closeIt: "Close this question",
  sent: "Your question has gone to the administrator and the Dean. You will see the reply here.",
  adminTitle: "Helpdesk",
  adminKicker: "Questions from scholars and supervisors",
  replyLabel: "Your reply",
  replyAndClose: "Reply and close the question",
  replyKeepOpen: "Reply and keep it open",
  websiteNote:
    "Messages sent from the website before the Contact page was closed. They have no reply here: answer them by e-mail.",
} as const;
