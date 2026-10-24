import type { Metadata } from "next";

import { FeeSettingsScreen } from "@/components/portal/FeeSettingsScreen";

export const metadata: Metadata = {
  title: "Fee settings",
  robots: { index: false, follow: false },
};

export default function FeeSettingsPage() {
  return <FeeSettingsScreen />;
}
