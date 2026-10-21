import type { Metadata } from "next";

import { SupervisorExitScreen } from "@/components/portal/SupervisorExitScreen";

export const metadata: Metadata = {
  title: "Supervisor exit",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SupervisorExitScreen />;
}
