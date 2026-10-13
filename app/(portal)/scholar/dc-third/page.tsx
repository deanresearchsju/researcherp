import type { Metadata } from "next";

import { CommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "Third doctoral committee",
  robots: { index: false, follow: false },
};

export default function ScholarThirdDcPage() {
  return <CommitteeScreen kind="third" mode="scholar" />;
}
