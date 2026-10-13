import type { Metadata } from "next";

import { RacScreen } from "@/components/portal/RacScreen";

export const metadata: Metadata = {
  title: "RAC proposal",
  robots: { index: false, follow: false },
};

export default function SupervisorRacPage() {
  return <RacScreen mode="supervisor" />;
}
