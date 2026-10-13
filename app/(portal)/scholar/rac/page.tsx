import type { Metadata } from "next";

import { RacScreen } from "@/components/portal/RacScreen";

export const metadata: Metadata = {
  title: "RAC members",
  robots: { index: false, follow: false },
};

export default function ScholarRacPage() {
  return <RacScreen mode="scholar" />;
}
