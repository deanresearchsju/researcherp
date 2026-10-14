import type { Metadata } from "next";

import { ExaminerReportScreen } from "@/components/portal/LifecycleScreens";

export const metadata: Metadata = {
  title: "Examiner reports",
  robots: { index: false, follow: false },
};

export default function ScholarExaminerReportsPage() {
  return <ExaminerReportScreen mode="scholar" />;
}
