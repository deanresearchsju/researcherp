import type { Metadata } from "next";

import { ReviewScreen } from "@/components/portal/ReviewScreen";

export const metadata: Metadata = {
  title: "Scholar requests",
  robots: { index: false, follow: false },
};

export default function SupervisorReviewsPage() {
  return <ReviewScreen />;
}
