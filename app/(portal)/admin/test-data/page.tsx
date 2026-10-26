import type { Metadata } from "next";

import { TestDataScreen } from "@/components/portal/TestDataScreen";

export const metadata: Metadata = {
  title: "Clear test data",
  robots: { index: false, follow: false },
};

export default function TestDataPage() {
  return <TestDataScreen />;
}
