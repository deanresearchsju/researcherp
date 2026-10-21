import type { Metadata } from "next";

import { ApprovedDocumentsScreen } from "@/components/portal/ApprovedDocumentsScreen";

export const metadata: Metadata = {
  title: "Approved documents",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ApprovedDocumentsScreen mode="scholar" />;
}
