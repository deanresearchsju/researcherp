import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { TeamList } from "@/components/team/TeamList";
import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";
import { loadTeam, officeTeam } from "@/lib/team";

export const metadata: Metadata = {
  title: "Our Team",
  description: `The ${university.researchOffice} team at ${university.name}.`,
  alternates: { canonical: "/our-team" },
};

async function TeamBoard() {
  const loaded = await loadTeam();
  const members = loaded.source === "empty" ? officeTeam() : loaded.members;
  return <TeamList members={members} />;
}

export default function OurTeamPage() {
  return (
    <>
      <PageHeader eyebrow={university.researchOffice} title="Our Team" />
      <Suspense
        fallback={
          <Container className="py-10">
            <p className="text-sm text-muted-foreground">Loading the team…</p>
          </Container>
        }
      >
        <TeamBoard />
      </Suspense>
    </>
  );
}
