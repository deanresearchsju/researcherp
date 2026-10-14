import type { Metadata } from "next";

import { CompletionScreen } from "@/components/portal/LifecycleScreens";

export const metadata: Metadata = {
  title: "Completion",
  robots: { index: false, follow: false },
};

export default function AdminCompletionPage() {
  return <CompletionScreen mode="admin" />;
}
