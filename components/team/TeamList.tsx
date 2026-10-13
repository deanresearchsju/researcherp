import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/team";

function MemberCard({
  member,
  featured = false,
}: {
  member: TeamMember;
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex gap-4 rounded-xl border border-border bg-card p-6 shadow-card",
        featured && "mx-auto w-full max-w-md flex-col items-center text-center",
      )}
    >
      {member.photo ? (
        <div className="aspect-[7/9] w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {/* Stored team photograph; next/image cannot serve a data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={member.photo} alt="" className="size-full object-contain" />
        </div>
      ) : null}
      <div>
        {member.name ? (
          <h2 className="font-heading text-2xl text-primary">{member.name}</h2>
        ) : null}
        <p
          className={
            member.name
              ? "mt-1 text-sm font-medium text-foreground"
              : "font-heading text-2xl text-primary"
          }
        >
          {member.role}
        </p>
        {member.email ? (
          <a
            className="mt-3 block text-sm text-primary hover:underline"
            href={`mailto:${member.email}`}
          >
            {member.email}
          </a>
        ) : null}
        {member.phone ? (
          <a
            className="mt-1 block text-sm text-primary hover:underline"
            href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
          >
            {member.phone}
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function TeamList({ members }: { members: TeamMember[] }) {
  const ordered = [...members].sort((a, b) => a.sortOrder - b.sortOrder);
  const [lead, ...rest] = ordered;

  if (!lead) {
    return (
      <Container className="py-10">
        <p className="text-sm text-muted-foreground">The team list is empty.</p>
      </Container>
    );
  }

  return (
    <Container className="space-y-8 py-10">
      <MemberCard member={lead} featured />
      {rest.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rest.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      ) : null}
    </Container>
  );
}
