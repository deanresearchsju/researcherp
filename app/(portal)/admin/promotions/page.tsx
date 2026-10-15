import type { Metadata } from "next";

import { SemesterPromotionScreen } from "@/components/portal/SemesterPromotionScreen";

export const metadata: Metadata = {
  title: "Semester promotion",
  robots: { index: false, follow: false },
};

export default function SemesterPromotionPage() {
  return <SemesterPromotionScreen />;
}
