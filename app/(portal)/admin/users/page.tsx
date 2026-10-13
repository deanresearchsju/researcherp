import type { Metadata } from "next";

import { UserScreen } from "@/components/portal/UserScreen";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <UserScreen />;
}
