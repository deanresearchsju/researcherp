import type { Metadata } from "next";
import { Suspense } from "react";

import { AdmissionDesk } from "@/components/portal/AdmissionDesk";
import { loadStoredApplications } from "@/lib/records";
import { loadVacancies, officeVacancies } from "@/lib/vacancies";

export const metadata: Metadata = {
  title: "Selection",
  robots: { index: false, follow: false },
};

async function Desk() {
  const [applications, vacancies] = await Promise.all([
    loadStoredApplications(),
    loadVacancies(),
  ]);
  return (
    <AdmissionDesk
      applications={applications.records.filter((row) => row.kind === "phd")}
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
