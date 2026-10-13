import { Container } from "@/components/ui/container";
import type { TeamMember } from "@/lib/team";

export function TeamList({ members }: { members: TeamMember[] }) {
  return (
    <Container className="py-10">
      <ol className="grid gap-4 sm:grid-cols-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <p className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
              {String(member.sortOrder).padStart(2, "0")}
            </p>
            {member.name ? (
              <h2 className="mt-3 font-heading text-2xl text-primary">{member.name}</h2>
            ) : null}
            <p
              className={
                member.name
                  ? "mt-1 text-sm font-medium text-foreground"
                  : "mt-3 font-heading text-2xl text-primary"
              }
            >
              {member.role}
            </p>
          </li>
        ))}
      </ol>
    </Container>
  );
}
