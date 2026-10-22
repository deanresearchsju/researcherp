import type { Metadata } from "next";

import { ApplicantAlert } from "@/components/forms/scholar/ApplicantAlert";
import { ClientGate } from "@/components/forms/ClientGate";
import { ScholarApplication } from "@/components/forms/scholar/ScholarApplication";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/container";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "PhD Application",
  description: `Apply for the Ph.D. at ${university.name}.`,
  alternates: { canonical: "/apply" },
};

export default function ApplyPage() {
  const copy = pageHeroes.apply;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <Container className="py-8 sm:py-10">
        <ApplicantAlert className="mb-6" />
        <ClientGate>
          <ScholarApplication />
        </ClientGate>
      </Container>
    </>
  );
}
