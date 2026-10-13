import {
  Briefcase,
  Building2,
  Cpu,
  FlaskConical,
  HeartPulse,
  Scale,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { homeCopy } from "@/data/home";
import { schools } from "@/data/schools";
import { sectionCopy } from "@/data/sections";
import type { SchoolIcon } from "@/types";

const icons: Record<SchoolIcon, LucideIcon> = {
  cpu: Cpu,
  flask: FlaskConical,
  briefcase: Briefcase,
  building: Building2,
  sprout: Sprout,
  scale: Scale,
  "heart-pulse": HeartPulse,
};

export function SchoolsPreview() {
  const copy = sectionCopy.schools;
  return (
    <section className="py-8 sm:py-10" aria-labelledby="schools-preview-title">
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="schools-preview-title"
        />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {schools.map((school) => {
            const Icon = icons[school.icon];
            return (
              <li key={school.id}>
                <Link
                  href="/research-areas"
                  className="flex h-full items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card hover:border-primary/30"
                >
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold text-primary">
                    {school.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/research-areas"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          {homeCopy.schoolsLink}
        </Link>
      </Container>
    </section>
  );
}
