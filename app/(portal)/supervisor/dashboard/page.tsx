import type { Metadata } from "next";

import { DashboardHome } from "@/components/portal/DashboardHome";

export const metadata: Metadata = {
  title: "Supervisor dashboard",
  robots: { index: false, follow: false },
};

export default function SupervisorDashboardPage() {
  return <DashboardHome role="supervisor" />;
}
