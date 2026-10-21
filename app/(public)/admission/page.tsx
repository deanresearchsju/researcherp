import type { Metadata } from "next";

import { AdmissionOverview } from "@/components/home/AdmissionOverview";
import { Checklist } from "@/components/home/Checklist";
import { FAQ } from "@/components/home/FAQ";
import { ProgrammeDuration } from "@/components/home/ProgrammeDuration";
import { PhdApplyCta } from "@/components/home/PhdApplyCta";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admission",
  description: `Apply for the Ph.D. at ${university.name}. Two admission sessions each year: January and July.`,
  alternates: { canonical: "/admission" },
};

export default function AdmissionPage() {
  const copy = pageHeroes.admission;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary}>
        <PhdApplyCta />
      </PageHeader>
      <AdmissionOverview />
      <ProgrammeDuration />
      <Checklist />
      <FAQ />
    </>
  );
}
