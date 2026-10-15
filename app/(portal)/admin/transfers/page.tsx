import type { Metadata } from "next";

import { SupervisorTransferScreen } from "@/components/portal/SupervisorTransferScreen";

export const metadata: Metadata = {
  title: "Supervisor transfer",
  robots: { index: false, follow: false },
};

export default function SupervisorTransferPage() {
  return <SupervisorTransferScreen />;
}
