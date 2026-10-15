import {
  Accessibility,
  BookOpen,
  CalendarRange,
  GraduationCap,
  HeartPulse,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import { RegulationsPanel } from "@/components/home/RegulationsPanel";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { researchPage } from "@/data/research-home";
import { sectionCopy } from "@/data/sections";

const highlightIcons: Record<string, LucideIcon> = {
  duration: CalendarRange,
  "course-work": BookOpen,
  "re-registration": RefreshCw,
  "additional-extension": Accessibility,
  maternity: HeartPulse,
  teaching: GraduationCap,
};

export function ResearchHighlights() {
  const copy = sectionCopy.researchHighlights;

  return (
    <section className="bg-card py-12 sm:py-16" aria-labelledby="research-home-title">
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="research-home-title"
        />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {researchPage.highlights.map((item) => {
            const Icon = highlightIcons[item.id] ?? BookOpen;
            return (
              <li
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 pt-7 shadow-card transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-lift"
              >
                <div className="absolute inset-x-0 top-0 flex h-1.5" aria-hidden="true">
                  <span className="w-14 bg-accent" />
                  <span className="flex-1 bg-gradient-to-r from-primary to-purple-deep" />
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
                  {item.label}
                </p>
                {"value" in item && item.value ? (
                  <p className="mt-2 font-heading text-xl leading-snug text-primary sm:text-2xl">
                    {item.value}
                  </p>
                ) : null}
                {"detail" in item && item.detail ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
                {"points" in item && item.points ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {item.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                        <span className="font-semibold text-primary">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-14">
          <p className="text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
            {sectionCopy.phdRegulations.eyebrow}
          </p>
          <div className="mt-3 h-px w-12 bg-accent" aria-hidden="true" />
          <h3
            id="phd-regulations-title"
            className="mt-4 font-heading text-2xl leading-tight font-semibold text-primary sm:text-3xl"
          >
            {sectionCopy.phdRegulations.title}
          </h3>
          <div className="mt-6">
            <RegulationsPanel />
          </div>
        </div>
      </Container>
    </section>
  );
}
