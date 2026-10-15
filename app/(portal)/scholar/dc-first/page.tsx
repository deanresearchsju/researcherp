import type { Metadata } from "next";

import { CommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "First doctoral committee",
  robots: { index: false, follow: false },
};

export default function ScholarFirstDcPage() {
  return <CommitteeScreen kind="first" mode="scholar" />;
}
