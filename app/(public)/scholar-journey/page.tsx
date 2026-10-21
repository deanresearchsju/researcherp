import type { Metadata } from "next";

import { Milestones } from "@/components/home/Milestones";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Scholar journey",
  description: `Doctoral milestones from the first DC meeting to the thesis at ${university.name}.`,
  alternates: { canonical: "/scholar-journey" },
};

export default function ScholarJourneyPage() {
  const copy = pageHeroes.journey;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <Milestones />
    </>
  );
}
