import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { TeamList } from "@/components/team/TeamList";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";
import { publicTeam } from "@/lib/public-team";

export const metadata: Metadata = {
  title: "Our Team",
  description: `The ${university.researchOffice} team at ${university.name}.`,
  alternates: { canonical: "/our-team" },
};

export default async function OurTeamPage() {
  const copy = pageHeroes.team;
  const members = await publicTeam();
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <TeamList members={members} />
    </>
  );
}
