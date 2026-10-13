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

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { schools } from "@/data/schools";
import { sectionCopy } from "@/data/sections";
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
  const [activeId, setActiveId] = useState(schools[0]?.id ?? "");
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
      className="py-16 sm:py-24"
      aria-labelledby="schools-title"
    >
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="schools-title"
        />
        <div
          className="mt-8 flex flex-wrap gap-2"
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
                  "rounded-full px-4 py-2 text-sm font-medium",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-foreground hover:bg-muted",
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
          className="mt-4 rounded-xl border border-border bg-card p-6 shadow-card sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
              <ActiveIcon className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-heading text-2xl text-primary">{active.name}</h3>
              {active.summary ? (
                <p className="mt-1 text-sm text-muted-foreground">{active.summary}</p>
              ) : null}
            </div>
          </div>
          {active.areas.length > 0 ? (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {active.areas.map((area) => (
                <li
                  key={area}
                  className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm font-medium text-foreground"
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
