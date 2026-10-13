import type { Metadata } from "next";

import { CommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "Third doctoral committee",
  robots: { index: false, follow: false },
};

export default function AdminThirdDcPage() {
  return <CommitteeScreen kind="third" mode="admin" />;
}
