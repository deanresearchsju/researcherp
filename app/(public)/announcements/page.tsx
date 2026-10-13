import type { Metadata } from "next";

import { NewsBoard } from "@/components/home/NewsBoard";
import { PageHeader } from "@/components/layout/PageHeader";
import { sectionCopy } from "@/data/sections";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "News & Announcements",
  description: `News and events from the ${university.researchOffice} at ${university.name}.`,
  alternates: { canonical: "/announcements" },
};

export default function AnnouncementsPage() {
  const copy = sectionCopy.announcements;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <NewsBoard />
    </>
  );
}
