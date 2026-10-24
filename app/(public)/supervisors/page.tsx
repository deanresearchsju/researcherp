import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { SupervisorProfiles } from "@/components/supervisors/SupervisorProfiles";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Research supervisors",
  description: `The recognised Ph.D. research supervisors of ${university.name}: their areas of research, biographies and Vidwan profiles.`,
  alternates: { canonical: "/supervisors" },
};

export default function SupervisorsPage() {
  const copy = pageHeroes.supervisors;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <SupervisorProfiles />
    </>
  );
}
