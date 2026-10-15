export const feeStatuses = ["Pending", "Approved", "Returned"] as const;

export type FeeStatus = (typeof feeStatuses)[number];

export const paymentKinds = [
  { id: "application", label: "Application fee" },
  { id: "course-work", label: "Course-work fee" },
  { id: "annual", label: "Annual research fee" },
] as const;

export type PaymentKindId = (typeof paymentKinds)[number]["id"];

export const paymentCopy = {
  title: "Payment approvals",
  kicker: "Office",
  detail:
    "Approve the application fee, course-work fee, and annual research fee. Approved payments show as Approved on the scholar portal.",
  approve: "Approve",
  return: "Return",
  empty: "No payment is waiting in this list.",
  scholarTitle: "Fee payments",
  scholarDetail:
    "The research office marks each fee Approved after the receipt is verified.",
} as const;
