import type { Metadata } from "next";

import { StatusLookup } from "@/components/forms/StatusLookup";
import { PageHeader } from "@/components/layout/PageHeader";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Application status",
  description: `Check a Ph.D. application at ${university.name} with the application number and date of birth.`,
  alternates: { canonical: "/apply/status" },
};

export default function StatusPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admissions"
        title="Application status"
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusLookup />
      </div>
    </>
  );
}
