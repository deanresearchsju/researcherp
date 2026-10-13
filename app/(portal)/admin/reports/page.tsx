import type { Metadata } from "next";

import { SixMonthScreen } from "@/components/portal/SixMonthScreen";

export const metadata: Metadata = {
  title: "Six-month report",
  robots: { index: false, follow: false },
};

export default function AdminReportsPage() {
  return <SixMonthScreen mode="admin" />;
}
