import { Clock, Mail, MapPin, Phone, UserRound } from "lucide-react";

import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";
import type { TeamMember } from "@/lib/team";
import { cn } from "@/lib/utils";

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** "Dean - Research and Development" → title "Dean", unit "Research and Development". */
function roleParts(role: string) {
  const [title = role, unit = ""] = role.split(/\s+[—–-]\s+/);
  return { title: title.trim(), unit: unit.trim() };
}

function Portrait({
  name,
  photo,
  className,
}: {
  name: string;
  photo: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden border border-border bg-muted", className)}>
      {photo ? (
        // Stored team photograph; next/image cannot serve a data URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="size-full object-cover object-top" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <UserRound className="size-10 text-muted-foreground/60" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  id,
}: {
  kicker: string;
  title: string;
  id: string;
}) {
  return (
    <div className="border-b-2 border-primary/15 pb-3">
      <p className="text-[0.68rem] font-bold tracking-[0.2em] text-secondary uppercase">
        {kicker}
      </p>
      <h2 id={id} className="mt-1 font-heading text-2xl text-primary sm:text-[1.7rem]">
        {title}
      </h2>
    </div>
  );
}

function ContactRows({ member }: { member: TeamMember }) {
  const rows = [
    member.email
      ? {
          icon: Mail,
          label: "Email",
          value: member.email,
          href: `mailto:${member.email}`,
        }
      : null,
    member.phone
      ? {
          icon: Phone,
          label: "Phone",
          value: member.phone,
          href: phoneHref(member.phone),
        }
      : null,
  ].filter((row) => row !== null);
  if (rows.length === 0) return null;
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="flex items-center gap-2">
          <dt className="flex w-20 shrink-0 items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </dt>
          <dd className="min-w-0">
            <a
              href={href}
              className="break-all text-primary underline-offset-4 hover:underline"
            >
              {value}
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DeanProfile({ member }: { member: TeamMember }) {
  const { title, unit } = roleParts(member.role);
  const name = member.name.trim() || member.role;
  return (
    <section aria-labelledby="dean-office" className="space-y-7">
      <SectionTitle
        id="dean-office"
        kicker={university.researchOffice}
        title="Office of the Dean"
      />
      <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <div className="mx-auto w-44 md:mx-0 md:w-full">
          <Portrait
            name={name}
            photo={member.photo}
            className="aspect-[3/4] shadow-card"
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-secondary uppercase">
            {title}
            {unit ? ` · ${unit}` : ""}
          </p>
          <h3 className="mt-2 font-heading text-3xl text-primary sm:text-4xl">{name}</h3>
          <p className="mt-1 text-base text-foreground">
            {member.role}, {university.researchOffice}, {university.name}
          </p>
          <div className="mt-5 h-px w-16 bg-accent" />
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
            The Dean heads the {university.researchOffice} and oversees Ph.D. admissions,
            recognition of research supervisors, doctoral committees, course work, and the
            evaluation and award of the doctoral degree.
          </p>
          <div className="mt-6 max-w-md border-t border-border pt-4">
            <ContactRows member={member} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StaffEntry({ member }: { member: TeamMember }) {
  const name = member.name.trim() || member.role;
  const { title, unit } = roleParts(member.role);
  return (
    <article className="flex gap-5 border-b border-border py-6">
      <Portrait name={name} photo={member.photo} className="h-32 w-24 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-xl text-primary">{name}</h3>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{title}</p>
        {unit ? <p className="text-sm text-muted-foreground">{unit}</p> : null}
        <div className="mt-3">
          <ContactRows member={member} />
        </div>
      </div>
    </article>
  );
}

function OfficeContact() {
  const items: {
    icon: typeof Mail;
    label: string;
    lines: readonly string[];
    href?: string;
  }[] = [
    { icon: MapPin, label: "Address", lines: university.addressLines },
    {
      icon: Mail,
      label: "Email",
      lines: [university.email],
      href: `mailto:${university.email}`,
    },
    {
      icon: Phone,
      label: "Phone",
      lines: [university.phoneDisplay],
      href: `tel:${university.phone}`,
    },
    { icon: Clock, label: "Office hours", lines: [university.hours] },
  ];
  return (
    <section aria-labelledby="office-contact" className="space-y-6">
      <SectionTitle
        id="office-contact"
        kicker="Get in touch"
        title="Contact the Center for Research"
      />
      <dl className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, lines, href }) => (
          <div key={label} className="bg-card p-5">
            <dt className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              <Icon className="size-4 text-secondary" aria-hidden="true" />
              {label}
            </dt>
            <dd className="mt-2 text-sm leading-6 text-foreground">
              {href ? (
                <a
                  href={href}
                  className="break-all text-primary underline-offset-4 hover:underline"
                >
                  {lines[0]}
                </a>
              ) : (
                lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
    <section className="bg-background py-10 sm:py-14">
      <Container>
        <div className="space-y-14 border border-border bg-card px-5 py-8 shadow-card sm:px-10 sm:py-12">
          <DeanProfile member={lead} />
          {rest.length > 0 ? (
            <section aria-labelledby="research-office" className="space-y-1">
              <SectionTitle
                id="research-office"
                kicker={university.researchOffice}
                title="Research Office"
              />
              <div className="grid gap-x-12 md:grid-cols-2">
                {rest.map((member) => (
                  <StaffEntry key={member.id} member={member} />
                ))}
              </div>
            </section>
          ) : null}
          <OfficeContact />
        </div>
      </Container>
    </section>
  );
}
