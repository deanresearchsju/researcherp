import type { Metadata } from "next";

import { CommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "Fourth doctoral committee",
  robots: { index: false, follow: false },
};

export default function AdminFourthDcPage() {
  return <CommitteeScreen kind="fourth" mode="admin" />;
}
