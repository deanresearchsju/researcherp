"use client";

import {
  Briefcase,
  ChevronDown,
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
import { areasForDepartment, type DepartmentAreas } from "@/lib/department-areas";
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

/** "School of Engineering and Technology" is shown as "Engineering and Technology". */
function shortName(name: string) {
  return name.replace(/^school of\s+/i, "");
}

export function ResearchAreas({
  supervisorAreas = [],
}: {
  /** The departments and key research areas taken from the supervisors' profiles. */
  supervisorAreas?: DepartmentAreas[];
}) {
  const schools = useSyncExternalStore(
    subscribeResearchAreas,
    currentResearchAreas,
    currentResearchAreas,
  );
  const [activeId, setActiveId] = useState("");
  const [openArea, setOpenArea] = useState<string | null>(null);
  const active = schools.find((school) => school.id === activeId) ?? schools[0];
  const copy = sectionCopy.schools;
  const ActiveIcon = active ? icons[active.icon] : Cpu;
  // A school with no departments, or only one named like the school itself (Management, Law),
  // shows all its key areas together under the school's name.
  const onlyOwnName =
    active?.areas.length === 1 &&
    active.areas[0].trim().toLowerCase() === shortName(active.name).trim().toLowerCase();
  const schoolAreas = active
    ? areasForDepartment(shortName(active.name), supervisorAreas)
    : [];

  function move(direction: 1 | -1) {
    const index = schools.findIndex((school) => school.id === activeId);
    const next = schools[(index + direction + schools.length) % schools.length];
    if (next) {
      setActiveId(next.id);
      setOpenArea(null);
    }
  }

  if (!active) return null;

  return (
    <section
      id="research-areas"
      className="scroll-mt-24 py-6 sm:py-8"
      aria-labelledby="schools-title"
    >
      <Container>
        <SectionHeading compact title={copy.title} id="schools-title" />
        <div
          className="mt-4 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Research areas"
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
                onClick={() => {
                  setActiveId(school.id);
                  setOpenArea(null);
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {shortName(school.name)}
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
                {shortName(active.name)}
              </h3>
              {active.summary ? (
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {active.summary}
                </p>
              ) : null}
            </div>
          </div>
          {(active.areas.length === 0 || onlyOwnName) && schoolAreas.length > 0 ? (
            <ul
              className="mt-3 flex flex-wrap gap-1.5"
              aria-label={`Key areas in ${shortName(active.name)}`}
            >
              {schoolAreas.map((keyArea) => (
                <li
                  key={keyArea}
                  className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs leading-5 text-foreground"
                >
                  {keyArea}
                </li>
              ))}
            </ul>
          ) : null}
          {active.areas.length > 0 && !onlyOwnName ? (
            <ul className="mt-3 space-y-2">
              {active.areas.map((area) => {
                const keyAreas = areasForDepartment(area, supervisorAreas);
                const isOpen = openArea === area;
                const panelId = `areas-${active.id}-${area.replace(/[^a-z0-9]+/gi, "-")}`;
                return (
                  <li
                    key={area}
                    className="overflow-hidden rounded-lg border border-border bg-muted/60"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenArea(isOpen ? null : area)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted"
                    >
                      <span className="text-sm font-semibold leading-5 text-primary">
                        {area}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-primary transition-transform",
                          isOpen && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen ? (
                      <div
                        id={panelId}
                        className="border-t border-border bg-card px-3 py-3"
                      >
                        {keyAreas.length > 0 ? (
                          <ul
                            className="flex flex-wrap gap-1.5"
                            aria-label={`Key areas in ${area}`}
                          >
                            {keyAreas.map((keyArea) => (
                              <li
                                key={keyArea}
                                className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs leading-5 text-foreground"
                              >
                                {keyArea}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            The key areas of this department will be listed soon.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
