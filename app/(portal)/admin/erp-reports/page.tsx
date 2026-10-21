import type { Metadata } from "next";

import { ReportsScreen } from "@/components/portal/ReportsScreen";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ReportsScreen />;
}
