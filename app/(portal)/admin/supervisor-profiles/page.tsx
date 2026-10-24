import type { Metadata } from "next";

import { SupervisorProfilesScreen } from "@/components/portal/SupervisorProfilesScreen";

export const metadata: Metadata = {
  title: "Supervisor profiles",
  robots: { index: false, follow: false },
};

export default function SupervisorProfilesPage() {
  return <SupervisorProfilesScreen />;
}
