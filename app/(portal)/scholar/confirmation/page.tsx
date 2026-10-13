import type { Metadata } from "next";

import { CommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "Ph.D. confirmation",
  robots: { index: false, follow: false },
};

export default function ScholarConfirmationPage() {
  return <CommitteeScreen kind="second" mode="scholar" />;
}
