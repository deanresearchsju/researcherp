import type { Metadata } from "next";

import { VivaScreen } from "@/components/portal/LifecycleScreens";

export const metadata: Metadata = {
  title: "Viva",
  robots: { index: false, follow: false },
};

export default function AdminVivaPage() {
  return <VivaScreen mode="admin" />;
}
