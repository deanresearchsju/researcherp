import type { Metadata } from "next";

import { SupervisorOwnDetails } from "@/components/portal/SupervisorOwnDetails";

export const metadata: Metadata = {
  title: "My details",
  robots: { index: false, follow: false },
};

export default function SupervisorDetailsPage() {
  return <SupervisorOwnDetails />;
}
