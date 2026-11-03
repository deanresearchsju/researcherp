import type { Metadata } from "next";

import { PublicResearchDesk } from "@/components/forms/PublicResearchDesk";
import { PageHeader } from "@/components/layout/PageHeader";
import { facultyToppers, publicToppers } from "@/lib/faculty-toppers";

export const metadata: Metadata = {
  title: "Faculty research",
  description:
    "Faculty submit publications (journal articles, books, chapters, proceedings, patents) and project proposals, and see their own records.",
  alternates: { canonical: "/faculty-research" },
};

export default async function Page() {
  // The toppers are read once a minute for every visitor (an approval refreshes them).
  const toppers = publicToppers(await facultyToppers());
  return (
    <>
      <PageHeader eyebrow="Faculty" title="Publications and project proposals" />
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-10">
        <PublicResearchDesk toppers={toppers} />
      </div>
    </>
  );
}
