"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { SupervisorCard } from "@/components/supervisors/SupervisorCard";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import type { PublicSupervisor } from "@/lib/public-supervisors";

/**
 * The research supervisors, one profile to a line. The profiles arrive already rendered on the
 * server, so search engines read the full text; this part only adds the search box.
 */
export function SupervisorProfiles({ profiles }: { profiles: PublicSupervisor[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? profiles.filter((item) =>
        [item.name, item.designation, item.department, item.researchArea]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : profiles;

  if (profiles.length === 0) {
    return (
      <section className="py-14 sm:py-20" aria-label="Research supervisors">
        <Container>
          <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            The profiles of our supervisors will be published here shortly.
          </p>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-10 sm:py-16" aria-label="Research supervisors">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{profiles.length}</span>{" "}
            recognised {profiles.length === 1 ? "supervisor" : "supervisors"}
            {needle ? ` · ${shown.length} shown` : ""}
          </p>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Search by name, department or area of research</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, department or area"
              className="pl-9"
            />
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No supervisor matches your search.
          </p>
        ) : (
          <ul className="mt-8 space-y-6">
            {shown.map((profile, index) => (
              <li key={profile.slug}>
                <SupervisorCard profile={profile} first={index < 2} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
