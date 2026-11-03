import type { Metadata } from "next";
import { Suspense } from "react";

import { FacultyResearchOffice } from "@/components/portal/FacultyResearchScreen";

export const metadata: Metadata = {
  title: "Project proposals",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FacultyResearchOffice kind="proposal" />
    </Suspense>
  );
}
