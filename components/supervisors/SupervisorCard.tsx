import { ExternalLink } from "lucide-react";

import type { PublicSupervisor } from "@/lib/public-supervisors";

function initialsOf(name: string) {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** One supervisor's profile: photograph, name with the Vidwan link, role, area and biography. */
export function SupervisorCard({
  profile,
  first = false,
}: {
  profile: PublicSupervisor;
  first?: boolean;
}) {
  const role = [profile.designation, profile.department].filter(Boolean).join(" · ");
  const school = profile.school;
  return (
    <article
      id={profile.slug}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="h-1 bg-gradient-to-r from-primary via-primary to-accent" />
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
        <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-44">
          <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl border border-border bg-muted">
            {profile.hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/supervisors/photo/${profile.slug}`}
                alt={`${profile.name}${profile.designation ? `, ${profile.designation}` : ""}`}
                width={176}
                height={235}
                loading={first ? "eager" : "lazy"}
                decoding="async"
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="font-heading text-2xl leading-tight font-semibold text-primary">
              {profile.name}
            </h2>
            {profile.vidwanUrl ? (
              <a
                href={profile.vidwanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Vidwan{profile.vidwanId ? ` · ${profile.vidwanId}` : ""}
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">
                  profile of {profile.name} (opens in a new tab)
                </span>
              </a>
            ) : null}
          </div>
          {role ? (
            <p className="mt-1 text-sm font-medium text-muted-foreground">{role}</p>
          ) : null}
          {school ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">School:</span> {school}
            </p>
          ) : null}
          {profile.researchArea ? (
            <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3">
              <p className="text-[0.7rem] font-bold tracking-[0.16em] text-secondary uppercase">
                Area of research
              </p>
              <p className="mt-1 text-justify text-sm leading-6 text-foreground">
                {profile.researchArea}
              </p>
            </div>
          ) : null}
          {profile.bio ? (
            <p className="mt-4 text-justify text-[0.95rem] leading-7 text-foreground/90 hyphens-auto">
              {profile.bio}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
