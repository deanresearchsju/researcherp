import type { Metadata } from "next";
import { Suspense } from "react";

import { SupervisorRegister } from "@/components/portal/SupervisorRegister";
import { loadStoredApplications } from "@/lib/records";

export const metadata: Metadata = {
  title: "Supervisor register",
  robots: { index: false, follow: false },
};

async function Register() {
  const loaded = await loadStoredApplications();
  const applications = loaded.records.filter((row) => row.kind === "supervisor");
  return <SupervisorRegister applications={applications} />;
}

export default function SupervisorRegisterPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading supervisors…</p>}
    >
      <Register />
    </Suspense>
  );
}
