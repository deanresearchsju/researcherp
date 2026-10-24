import type { Metadata } from "next";

import { ExamSetupScreen } from "@/components/portal/ExamSetupScreen";

export const metadata: Metadata = {
  title: "Exam setup",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ExamSetupScreen />;
}
