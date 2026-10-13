import type { Metadata } from "next";

import { DashboardHome } from "@/components/portal/DashboardHome";

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return <DashboardHome role="admin" />;
}
