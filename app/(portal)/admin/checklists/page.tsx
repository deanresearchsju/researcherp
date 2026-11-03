import type { Metadata } from "next";
import { Suspense } from "react";

import { ChecklistsScreen } from "@/components/portal/ChecklistsScreen";

export const metadata: Metadata = {
  title: "Checklists",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChecklistsScreen />
    </Suspense>
  );
}
