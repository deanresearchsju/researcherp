import type { Metadata } from "next";

import { CommitteeScreen } from "@/components/portal/CommitteeScreen";

export const metadata: Metadata = {
  title: "Ph.D. confirmation",
  robots: { index: false, follow: false },
};

export default function AdminConfirmationPage() {
  return <CommitteeScreen kind="second" mode="admin" />;
}
