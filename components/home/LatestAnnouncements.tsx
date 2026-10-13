import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { announcements } from "@/data/announcements";
import { homeCopy } from "@/data/home";
import { sectionCopy } from "@/data/sections";

export function LatestAnnouncements() {
  const copy = sectionCopy.announcements;
  return (
    <section
      className="bg-white py-8 sm:py-10"
      aria-labelledby="latest-announcements-title"
    >
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title="Latest announcements"
          id="latest-announcements-title"
        />
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {announcements.slice(0, 3).map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-primary">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </div>
              <Badge variant="gold">
                <time dateTime={item.isoDate}>{item.date}</time>
              </Badge>
            </li>
          ))}
        </ul>
        <Link
          href="/announcements"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          {homeCopy.announcementsLink}
        </Link>
      </Container>
    </section>
  );
}
