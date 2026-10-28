"use client";

import { useState } from "react";

import { AccountsFeeScreen, type FeeKind } from "@/components/portal/AccountsFeeScreen";
import { DeskTabs } from "@/components/portal/Desk";

const tabs: readonly { id: FeeKind; label: string }[] = [
  { id: "registration", label: "Registration fee" },
  { id: "course-work", label: "Course-work fee" },
  { id: "annual", label: "Annual fee" },
  { id: "synopsis", label: "Synopsis fee" },
  { id: "thesis", label: "Thesis fee" },
];

/**
 * Fee approvals for the office: the same receipt page Accounts uses, so every payment is opened,
 * checked and approved, or returned with a written reason, in one place.
 */
export function PaymentDesk() {
  const [kind, setKind] = useState<FeeKind>("registration");
  return (
    <div className="space-y-4">
      <DeskTabs
        tabs={[...tabs]}
        value={kind}
        onChange={(value) => setKind(value as FeeKind)}
      />
      <AccountsFeeScreen key={kind} kind={kind} />
    </div>
  );
}
