import type { Metadata } from "next";

import { SupervisorStatusLookup } from "@/components/forms/supervisor/SupervisorStatusLookup";
import { PageHeader } from "@/components/layout/PageHeader";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Supervisor application status",
  description: `Track a supervisor recognition application at ${university.name} and download the recognition letter once it is approved.`,
  alternates: { canonical: "/supervisor-recognition/status" },
};

export default function SupervisorStatusPage() {
  const copy = pageHeroes.supervisorStatus;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <SupervisorStatusLookup />
      </div>
    </>
  );
}
