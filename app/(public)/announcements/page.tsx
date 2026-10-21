import type { Metadata } from "next";

import { NewsBoard } from "@/components/home/NewsBoard";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Announcements",
  description: `News and events from the ${university.researchOffice} at ${university.name}. Ph.D. admissions open in January and July.`,
  alternates: { canonical: "/announcements" },
};

export default function AnnouncementsPage() {
  const copy = pageHeroes.announcements;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <NewsBoard />
    </>
  );
}
