import type { Metadata } from "next";

import { ScholarInfoScreen } from "@/components/portal/ScholarInfoScreen";

export const metadata: Metadata = {
  title: "Scholar information",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ScholarInfoScreen />;
}
