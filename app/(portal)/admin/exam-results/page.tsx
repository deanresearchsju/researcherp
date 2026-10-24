import type { Metadata } from "next";

import { ExamResultsScreen } from "@/components/portal/ExamResultsScreen";

export const metadata: Metadata = {
  title: "Result approval",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ExamResultsScreen />;
}
