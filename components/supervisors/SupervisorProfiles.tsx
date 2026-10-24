"use client";

import { ExternalLink, Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { fetchProfilePhotos, profilePhotoKey } from "@/lib/profile-photo";
import { currentProfiles, subscribeRegister, vidwanLink } from "@/lib/register";

function initialsOf(name: string) {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The research supervisors, one profile to a line: photograph, designation and department, the
 * area of research, a short biography and a link to the Vidwan profile. The research office
 * prepares these under Website, Supervisor profiles.
 */
export function SupervisorProfiles() {
  const profiles = useSyncExternalStore(
    subscribeRegister,
    currentProfiles,
    currentProfiles,
  );
  const [query, setQuery] = useState("");
  const published = profiles
    .filter((item) => item.published)
    .sort((a, b) => a.name.localeCompare(b.name));
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? published.filter((item) =>
        [item.name, item.designation, item.department, item.researchArea]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : published;
  const keys = published.map((item) => item.key).join("|");
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!keys) return;
    let live = true;
    void fetchProfilePhotos("supervisor", keys.split("|")).then((found) => {
      if (live) setPhotos(found);
    });
    return () => {
      live = false;
    };
  }, [keys]);

  if (published.length === 0) {
    return (
      <section className="py-14 sm:py-20" aria-label="Research supervisors">
        <Container>
          <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            The supervisors&apos; profiles will be published here shortly.
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
            <span className="font-semibold text-primary">{published.length}</span>{" "}
            recognised {published.length === 1 ? "supervisor" : "supervisors"}
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
            {shown.map((profile) => {
              const photo = photos.get(profilePhotoKey("supervisor", profile.key));
              const link = vidwanLink(profile.vidwan);
              const role = [profile.designation, profile.department]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={profile.key}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
                >
                  <div className="h-1 bg-gradient-to-r from-primary via-primary to-accent" />
                  <div className="flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
                    <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-44">
                      <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt={profile.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span
                            className="font-heading text-4xl font-semibold text-primary/50"
                            aria-hidden="true"
                          >
                            {initialsOf(profile.name)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-heading text-2xl leading-tight font-semibold text-primary">
                        {profile.name}
                      </h2>
                      {role ? (
                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                          {role}
                        </p>
                      ) : null}
                      {profile.researchArea ? (
                        <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3">
                          <p className="text-[0.7rem] font-bold tracking-[0.16em] text-secondary uppercase">
                            Area of research
                          </p>
                          <p className="mt-1 text-sm leading-6 text-foreground">
                            {profile.researchArea}
                          </p>
                        </div>
                      ) : null}
                      {profile.bio ? (
                        <p className="mt-4 max-w-3xl text-[0.95rem] leading-7 text-foreground/90">
                          {profile.bio}
                        </p>
                      ) : null}
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          Vidwan profile
                          {profile.vidwan.startsWith("http") ? "" : ` · ${profile.vidwan}`}
                          <ExternalLink className="size-4" aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </section>
  );
}
