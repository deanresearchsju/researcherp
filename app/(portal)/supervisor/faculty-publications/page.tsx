import type { Metadata } from "next";

import { FacultyResearchMine } from "@/components/portal/FacultyResearchScreen";

export const metadata: Metadata = {
  title: "Faculty publications",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FacultyResearchMine kind="publication" />;
}
