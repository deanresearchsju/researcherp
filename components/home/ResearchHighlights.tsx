import {
  Accessibility,
  BookOpen,
  CalendarRange,
  Check,
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

type HighlightItem = (typeof researchPage.highlights)[number];
type HighlightLine = { lead: string; rest?: string };

function splitOnce(text: string, separator: string) {
  const index = text.indexOf(separator);
  if (index < 1) return null;
  return { lead: text.slice(0, index), rest: text.slice(index + separator.length) };
}

function detailLines(detail: string): HighlightLine[] {
  const involving = splitOnce(detail, ", involving ");
  if (involving) {
    return [{ lead: involving.lead }, { lead: involving.rest }];
  }
  return [{ lead: detail }];
}

function highlightLines(item: HighlightItem): HighlightLine[] {
  if ("points" in item && item.points) {
    return item.points.map((point) => splitOnce(point, ": ") ?? { lead: point });
  }

  const lines: HighlightLine[] = [];
  if ("value" in item && item.value) {
    for (const part of item.value.split(" · ").filter((entry) => entry.length > 0)) {
      lines.push({ lead: part });
    }
  }
  if ("detail" in item && item.detail) {
    lines.push(...detailLines(item.detail));
  }
  return lines;
}

function HighlightBullets({ lines }: { lines: readonly HighlightLine[] }) {
  return (
    <ul className="mt-2.5 space-y-1.5 text-left">
      {lines.map((line) => (
        <li
          key={`${line.lead}-${line.rest ?? ""}`}
          className="flex items-start gap-2 text-xs leading-5"
        >
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
          </span>
          <span>
            <span className="font-semibold text-primary">{line.lead}</span>
            {line.rest ? (
              <span className="text-muted-foreground"> — {line.rest}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ResearchHighlights() {
  const copy = sectionCopy.researchHighlights;

  return (
    <section className="bg-card py-8 sm:py-10" aria-labelledby="research-home-title">
      <Container>
        <SectionHeading
          compact
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="research-home-title"
        />
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {researchPage.highlights.map((item) => {
            const Icon = highlightIcons[item.id] ?? BookOpen;
            return (
              <li
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-border bg-card p-4 pt-5 shadow-card transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-lift"
              >
                <div className="absolute inset-x-0 top-0 flex h-1" aria-hidden="true">
                  <span className="w-10 bg-accent" />
                  <span className="flex-1 bg-gradient-to-r from-primary to-purple-deep" />
                </div>
                <div className="flex items-center justify-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-secondary uppercase">
                    {item.label}
                  </p>
                </div>
                <HighlightBullets lines={highlightLines(item)} />
              </li>
            );
          })}
        </ul>

        <div className="mt-8">
          <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-secondary uppercase">
            {sectionCopy.phdRegulations.eyebrow}
          </p>
          <div className="mt-1.5 h-px w-8 bg-accent" aria-hidden="true" />
          <h3
            id="phd-regulations-title"
            className="mt-2 font-heading text-xl leading-tight font-semibold text-primary sm:text-2xl"
          >
            {sectionCopy.phdRegulations.title}
          </h3>
          <div className="mt-4">
            <RegulationsPanel />
          </div>
        </div>
      </Container>
    </section>
  );
}
