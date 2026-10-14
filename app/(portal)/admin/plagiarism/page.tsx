import type { Metadata } from "next";

import { PlagiarismScreen } from "@/components/portal/LifecycleScreens";

export const metadata: Metadata = {
  title: "Plagiarism",
  robots: { index: false, follow: false },
};

export default function AdminPlagiarismPage() {
  return <PlagiarismScreen mode="admin" />;
}
