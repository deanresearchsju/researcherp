import type { Metadata } from "next";

import { ResultScreen } from "@/components/portal/ResultScreen";

export const metadata: Metadata = {
  title: "Course results",
  robots: { index: false, follow: false },
};

export default function ScholarResultsPage() {
  return <ResultScreen mode="scholar" />;
}
