import type { Metadata } from "next";
import { Suspense } from "react";

import { FacultyIncentivesScreen } from "@/components/portal/FacultyIncentivesScreen";

export const metadata: Metadata = {
  title: "Publication incentives",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FacultyIncentivesScreen />
    </Suspense>
  );
}
