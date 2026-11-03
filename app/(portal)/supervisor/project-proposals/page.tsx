import type { Metadata } from "next";

import { FacultyResearchMine } from "@/components/portal/FacultyResearchScreen";

export const metadata: Metadata = {
  title: "Project proposals",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FacultyResearchMine kind="proposal" />;
}
