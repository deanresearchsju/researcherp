import type { Metadata } from "next";

import { ThesisScreen } from "@/components/portal/ThesisScreen";

export const metadata: Metadata = {
  title: "Thesis",
  robots: { index: false, follow: false },
};

export default function AdminThesisPage() {
  return <ThesisScreen mode="admin" />;
}
