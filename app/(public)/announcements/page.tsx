import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { announcements } from "@/data/announcements";
import { sectionCopy } from "@/data/sections";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Announcements",
  description: `Notices from the ${university.researchOffice} at ${university.name}.`,
  alternates: { canonical: "/announcements" },
};

export default function AnnouncementsPage() {
  const copy = sectionCopy.announcements;
  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
      <ul className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        {announcements.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="gold">
                <time dateTime={item.isoDate}>{item.date}</time>
              </Badge>
              <Badge>{item.category}</Badge>
            </div>
            <h2 className="mt-3 font-heading text-2xl text-primary">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
