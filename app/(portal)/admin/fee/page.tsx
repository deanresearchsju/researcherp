import type { Metadata } from "next";

import { FeeCollectionScreen } from "@/components/portal/FeeCollectionScreen";

export const metadata: Metadata = {
  title: "Tuition fees",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FeeCollectionScreen />;
}
