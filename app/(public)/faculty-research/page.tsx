import type { Metadata } from "next";

import { PublicResearchDesk } from "@/components/forms/PublicResearchDesk";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Faculty research",
  description:
    "Faculty submit publications (journal articles, books, chapters, proceedings, patents) and project proposals, and see their own records.",
  alternates: { canonical: "/faculty-research" },
};

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Faculty" title="Publications and project proposals" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PublicResearchDesk />
      </div>
    </>
  );
}
