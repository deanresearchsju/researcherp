import type { Metadata } from "next";

import { PublicResearchDesk } from "@/components/forms/PublicResearchDesk";
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
  return <PublicResearchDesk toppers={toppers} />;
}
