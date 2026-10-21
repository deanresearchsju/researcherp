import type { Metadata } from "next";

import { ClientGate } from "@/components/forms/ClientGate";
import { SupervisorApplication } from "@/components/forms/supervisor/SupervisorApplication";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/container";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Supervisor recognition",
  description: `Apply for recognition as a research supervisor at ${university.name}.`,
  alternates: { canonical: "/supervisor-recognition/apply" },
};

export default function SupervisorApplyPage() {
  const copy = pageHeroes.supervisorApply;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <Container className="py-8 sm:py-10">
        <ClientGate>
          <SupervisorApplication />
        </ClientGate>
      </Container>
    </>
  );
}
