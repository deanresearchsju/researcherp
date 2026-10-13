import type { Metadata } from "next";

import { SiteScreen } from "@/components/portal/SiteScreen";

export const metadata: Metadata = {
  title: "Home and admissions",
  robots: { index: false, follow: false },
};

export default function SitePage() {
  return <SiteScreen />;
}
