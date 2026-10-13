import type { Metadata } from "next";

import { ResearchAreas } from "@/components/home/ResearchAreas";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Research areas",
  description: `Research schools for the Ph.D. at ${university.name}.`,
  alternates: { canonical: "/research-areas" },
};

export default function ResearchAreasPage() {
  return <ResearchAreas />;
}
