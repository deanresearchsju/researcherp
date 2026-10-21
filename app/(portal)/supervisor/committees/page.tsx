import type { Metadata } from "next";

import { SupervisorCommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "Doctoral committees",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SupervisorCommitteeScreen />;
}
