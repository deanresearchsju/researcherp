import type { Metadata } from "next";
import { Suspense } from "react";

import { ApplicationManager } from "@/components/portal/ApplicationManager";
import { loadStoredApplications } from "@/lib/records";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

async function ApplicationEditor() {
  const loaded = await loadStoredApplications();
  return <ApplicationManager records={loaded.records} detail={loaded.detail} />;
}

export default function AdminApplicationsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading applications…</p>}
    >
      <ApplicationEditor />
    </Suspense>
  );
}
