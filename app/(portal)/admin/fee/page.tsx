import type { Metadata } from "next";

import { FeeCollectionScreen } from "@/components/portal/FeeCollectionScreen";

export const metadata: Metadata = {
  title: "Fee collection",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FeeCollectionScreen />;
}
