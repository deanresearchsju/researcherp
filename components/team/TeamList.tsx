import { Mail, Phone, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { TeamMember } from "@/lib/team";
import { cn } from "@/lib/utils";

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function roleBadge(role: string) {
  const parts = role.split(/\s+[—–-]\s+/);
  return (parts[1] ?? parts[0] ?? role).trim();
}

function Portrait({
  name,
  photo,
  featured = false,
}: {
  name: string;
  photo: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-muted p-2 shadow-card",
        featured ? "mx-auto h-40 w-32" : "mx-auto h-44 w-36 shrink-0 sm:mx-0",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-10 bg-muted" aria-hidden="true" />
      {photo ? (
        // Stored team photograph; next/image cannot serve a data URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name}
          className="relative size-full rounded-xl object-cover object-top transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="relative flex size-full items-center justify-center rounded-xl bg-card">
          <UserRound className="size-12 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function ContactLinks({
  member,
  align = "start",
}: {
  member: TeamMember;
  align?: "center" | "start";
}) {
  const label = member.name.trim() || member.role;
  if (!member.email && !member.phone) return null;

  return (
    <div
      className={cn(
        "mt-5 flex flex-wrap gap-2",
        align === "center" ? "justify-center" : "justify-center sm:justify-start",
      )}
    >
      {member.email ? (
        <a
          href={`mailto:${member.email}`}
          aria-label={`Email ${label}`}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "max-w-full min-w-0 overflow-hidden",
          )}
        >
          <Mail />
          <span className="min-w-0 truncate">{member.email}</span>
        </a>
      ) : null}
      {member.phone ? (
        <a
          href={phoneHref(member.phone)}
          aria-label={`Call ${label}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <Phone />
          {member.phone}
        </a>
      ) : null}
    </div>
  );
}

function MemberCard({
  member,
  featured = false,
}: {
  member: TeamMember;
  featured?: boolean;
}) {
  const label = member.name.trim() || member.role;
  const badge = roleBadge(member.role);

  if (featured) {
    return (
      <article className="group relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:px-10">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-gold to-primary"
          aria-hidden="true"
        />
        {badge ? (
          <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.16em] text-primary uppercase">
            {badge}
          </span>
        ) : null}
        <div className="mt-5">
          <Portrait name={label} photo={member.photo} featured />
        </div>
        {member.name ? (
          <h3 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-purple-deep sm:text-3xl">
            {member.name}
          </h3>
        ) : null}
        <p
          className={cn(
            "text-sm font-semibold text-muted-foreground sm:text-base",
            member.name ? "mt-1.5" : "mt-5 font-heading text-2xl text-purple-deep",
          )}
        >
          {member.role}
        </p>
        <ContactLinks member={member} align="center" />
      </article>
    );
  }

  return (
    <article className="group relative h-full overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lift sm:p-6">
      <div
        className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-primary to-gold"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Portrait name={label} photo={member.photo} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          {badge ? (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.14em] text-gold-ink uppercase">
              {badge}
            </span>
          ) : null}
          {member.name ? (
            <h3 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-purple-deep">
              {member.name}
            </h3>
          ) : null}
          <p
            className={cn(
              "text-sm font-semibold leading-5 text-muted-foreground",
              member.name ? "mt-1.5" : "mt-3 font-heading text-2xl text-purple-deep",
            )}
          >
            {member.role}
          </p>
          <ContactLinks member={member} />
        </div>
      </div>
    </article>
  );
}

export function TeamList({ members }: { members: TeamMember[] }) {
  const ordered = [...members].sort((a, b) => a.sortOrder - b.sortOrder);
  const [lead, ...rest] = ordered;

  if (!lead) {
    return (
      <Container className="py-14 sm:py-20">
        <p className="text-sm text-muted-foreground">The team list is empty.</p>
      </Container>
    );
  }

  return (
    <section className="bg-background py-14 sm:py-20">
      <Container className="space-y-6">
        <MemberCard member={lead} featured />
        {rest.length > 0 ? (
          <ul className="grid gap-5 lg:grid-cols-2">
            {rest.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} />
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </section>
  );
}
