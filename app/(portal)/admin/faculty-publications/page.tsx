import type { Metadata } from "next";
import { Suspense } from "react";

import { FacultyResearchOffice } from "@/components/portal/FacultyResearchScreen";

export const metadata: Metadata = {
  title: "Faculty publications",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FacultyResearchOffice kind="publication" />
    </Suspense>
  );
}
