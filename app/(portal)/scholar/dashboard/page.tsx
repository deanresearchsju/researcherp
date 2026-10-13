import type { Metadata } from "next";

import { DashboardHome } from "@/components/portal/DashboardHome";

export const metadata: Metadata = {
  title: "Scholar dashboard",
  robots: { index: false, follow: false },
};

export default function ScholarDashboardPage() {
  return <DashboardHome role="scholar" />;
}
