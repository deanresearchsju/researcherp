import type { Metadata } from "next";
import { Suspense } from "react";

import { AdmissionDesk } from "@/components/portal/AdmissionDesk";
import { loadVacancies, officeVacancies } from "@/lib/vacancies";

export const metadata: Metadata = {
  title: "Selection",
  robots: { index: false, follow: false },
};

async function Desk() {
  // Only the small vacancy list is fetched here. The applications (which carry their uploaded
  // files) are read by the desk in the browser, so the page does not wait for them or carry
  // them twice.
  const vacancies = await loadVacancies();
  return (
    <AdmissionDesk
      applications={[]}
      vacancies={vacancies.rows.length > 0 ? vacancies.rows : officeVacancies()}
    />
  );
}

export default function AdminAdmissionPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading selection…</p>}
    >
      <Desk />
    </Suspense>
  );
}
