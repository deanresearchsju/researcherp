import {
  BadgeCheck,
  Download,
  FilePen,
  GraduationCap,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/home/Reveal";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { quickAccess } from "@/data/quick-access";
import { sectionCopy } from "@/data/sections";
import type { QuickAccessIcon } from "@/types";

const icons: Record<QuickAccessIcon, LucideIcon> = {
  "file-pen": FilePen,
  "graduation-cap": GraduationCap,
  "user-round": UserRound,
  "badge-check": BadgeCheck,
  search: Search,
  download: Download,
};

export function QuickAccess() {
  const copy = sectionCopy.quickAccess;

  return (
    <section className="bg-white py-8 sm:py-10" aria-labelledby="quick-access-title">
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          id="quick-access-title"
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickAccess.map((item, index) => {
            const Icon = icons[item.icon];
            return (
              <Reveal key={item.id} delay={index * 0.04}>
                <Link
                  href={item.href}
                  className="group flex h-full gap-4 rounded-xl border border-border bg-card p-5 shadow-card hover:border-primary/30"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-primary group-hover:underline">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
