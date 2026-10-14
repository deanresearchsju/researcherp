import type { Metadata } from "next";

import { AdmissionOverview } from "@/components/home/AdmissionOverview";
import { Checklist } from "@/components/home/Checklist";
import { FAQ } from "@/components/home/FAQ";
import { ProgrammeDuration } from "@/components/home/ProgrammeDuration";
import { PhdApplyCta } from "@/components/home/PhdApplyCta";
import { Container } from "@/components/ui/container";
import { admissionSessionsCopy, university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admission",
  description: `Apply for the Ph.D. at ${university.name}. Two admission sessions each year: January and July.`,
  alternates: { canonical: "/admission" },
};

export default function AdmissionPage() {
  return (
    <>
      <section className="border-b border-border bg-white">
        <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
              Admissions
            </p>
            <h1 className="mt-3 font-heading text-4xl text-primary">Ph.D. admission</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              {admissionSessionsCopy.sentence} Keep the documents below ready, then start
              the online application.
            </p>
          </div>
          <PhdApplyCta />
        </Container>
      </section>
      <AdmissionOverview />
      <ProgrammeDuration />
      <Checklist />
      <FAQ />
    </>
  );
}
