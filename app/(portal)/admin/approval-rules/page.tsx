import type { Metadata } from "next";

import { ApprovalRulesScreen } from "@/components/portal/ApprovalRulesScreen";

export const metadata: Metadata = {
  title: "Approval rules",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ApprovalRulesScreen />;
}
