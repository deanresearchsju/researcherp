import type { Metadata } from "next";

import { AllocationScreen } from "@/components/portal/AllocationScreen";

export const metadata: Metadata = {
  title: "Scholar allotment",
  robots: { index: false, follow: false },
};

export default function AllocationsPage() {
  return <AllocationScreen />;
}
