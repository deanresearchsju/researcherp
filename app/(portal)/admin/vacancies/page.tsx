import type { Metadata } from "next";
import { Suspense } from "react";

import { VacancyManager } from "@/components/portal/VacancyManager";
import { loadVacancies } from "@/lib/vacancies";

export const metadata: Metadata = {
  title: "Supervisor vacancies",
  robots: { index: false, follow: false },
};

async function VacancyEditor() {
  const initial = await loadVacancies();
  return <VacancyManager initial={initial} />;
}

export default function AdminVacanciesPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading vacancies…</p>}
    >
      <VacancyEditor />
    </Suspense>
  );
}
