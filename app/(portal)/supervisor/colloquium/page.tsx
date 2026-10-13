import type { Metadata } from "next";

import { ColloquiumScreen } from "@/components/portal/ColloquiumScreen";

export const metadata: Metadata = {
  title: "Colloquium",
  robots: { index: false, follow: false },
};

export default function SupervisorColloquiumPage() {
  return <ColloquiumScreen mode="supervisor" />;
}
