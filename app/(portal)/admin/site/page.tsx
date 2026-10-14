import type { Metadata } from "next";

import { SiteScreen } from "@/components/portal/SiteScreen";

export const metadata: Metadata = {
  title: "Application window",
  robots: { index: false, follow: false },
};

export default function SitePage() {
  return <SiteScreen />;
}
