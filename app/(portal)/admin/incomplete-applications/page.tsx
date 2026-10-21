import type { Metadata } from "next";
import { Suspense } from "react";

import { IncompleteApplications } from "@/components/portal/IncompleteApplications";
import { incompleteApplicationsCopy } from "@/data/incomplete-applications";
import { loadIncompleteApplications } from "@/lib/phd-drafts";

export const metadata: Metadata = {
  title: incompleteApplicationsCopy.title,
  robots: { index: false, follow: false },
};

async function IncompleteEditor() {
  const initial = await loadIncompleteApplications();
  return <IncompleteApplications initial={initial} />;
}

export default function AdminIncompleteApplicationsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading incomplete applications…</p>
      }
    >
      <IncompleteEditor />
    </Suspense>
  );
}
