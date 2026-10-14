import type { Metadata } from "next";
import { Suspense } from "react";

import { Container } from "@/components/ui/container";
import { VacancyList } from "@/components/vacancies/VacancyList";
import { university } from "@/lib/constants";
import { loadResearchAreas } from "@/lib/research-areas";
import { loadVacancies, officeVacancies } from "@/lib/vacancies";

export const metadata: Metadata = {
  title: "Supervisors",
  description: `Research supervisors, vacancy positions, and recognition at ${university.name}.`,
  alternates: { canonical: "/supervisors" },
};

async function VacancyBoard() {
  const loaded = await loadVacancies();
  const areas = await loadResearchAreas();
  const rows = loaded.source === "empty" ? officeVacancies() : loaded.rows;
  return <VacancyList rows={rows} schools={areas.schools} />;
}

export default function SupervisorsPage() {
  return (
    <Suspense
      fallback={
        <Container className="pb-16">
          <p className="text-sm text-muted-foreground">Loading the vacancy list…</p>
        </Container>
      }
    >
      <VacancyBoard />
    </Suspense>
  );
}
