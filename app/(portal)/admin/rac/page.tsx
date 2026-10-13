import type { Metadata } from "next";

import { RacScreen } from "@/components/portal/RacScreen";

export const metadata: Metadata = {
  title: "RAC",
  robots: { index: false, follow: false },
};

export default function AdminRacPage() {
  return <RacScreen mode="admin" />;
}
