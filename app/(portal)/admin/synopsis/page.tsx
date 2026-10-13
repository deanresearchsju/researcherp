import type { Metadata } from "next";

import { SynopsisScreen } from "@/components/portal/SynopsisScreen";

export const metadata: Metadata = {
  title: "Synopsis",
  robots: { index: false, follow: false },
};

export default function AdminSynopsisPage() {
  return <SynopsisScreen mode="admin" />;
}
