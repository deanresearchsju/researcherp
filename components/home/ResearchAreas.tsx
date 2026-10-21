"use client";

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
import { useState } from "react";
import { useSyncExternalStore } from "react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { sectionCopy } from "@/data/sections";
import { currentResearchAreas, subscribeResearchAreas } from "@/lib/research-areas";
import { cn } from "@/lib/utils";
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

export function ResearchAreas() {
  const schools = useSyncExternalStore(
    subscribeResearchAreas,
    currentResearchAreas,
    currentResearchAreas,
  );
  const [activeId, setActiveId] = useState("");
  const active = schools.find((school) => school.id === activeId) ?? schools[0];
  const copy = sectionCopy.schools;
  const ActiveIcon = active ? icons[active.icon] : Cpu;

  function move(direction: 1 | -1) {
    const index = schools.findIndex((school) => school.id === activeId);
    const next = schools[(index + direction + schools.length) % schools.length];
    if (next) setActiveId(next.id);
  }

  if (!active) return null;

  return (
    <section
      id="research-areas"
      className="scroll-mt-24 py-6 sm:py-8"
      aria-labelledby="schools-title"
    >
      <Container>
        <SectionHeading
          compact
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="schools-title"
        />
        <div
          className="mt-4 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Research schools"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") move(1);
            if (event.key === "ArrowLeft") move(-1);
          }}
        >
          {schools.map((school) => {
            const selected = school.id === active.id;
            return (
              <button
                key={school.id}
                type="button"
                role="tab"
                id={`tab-${school.id}`}
                aria-selected={selected}
                aria-controls={`panel-${school.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(school.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {school.name}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="mt-3 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
              <ActiveIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-heading text-lg leading-snug text-primary">
                {active.name}
              </h3>
              {active.summary ? (
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {active.summary}
                </p>
              ) : null}
            </div>
          </div>
          {active.areas.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {active.areas.map((area) => (
                <li
                  key={area}
                  className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs font-medium leading-5 text-foreground"
                >
                  {area}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
