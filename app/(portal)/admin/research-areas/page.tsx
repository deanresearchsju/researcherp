import type { Metadata } from "next";

import { ResearchAreaManager } from "@/components/portal/ResearchAreaManager";

export const metadata: Metadata = {
  title: "Research areas",
  robots: { index: false, follow: false },
};

export default function AdminResearchAreasPage() {
  return <ResearchAreaManager />;
}
