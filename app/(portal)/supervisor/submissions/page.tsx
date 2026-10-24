import type { Metadata } from "next";

import { SupervisorSubmissions } from "@/components/portal/SupervisorSubmissions";

export const metadata: Metadata = {
  title: "Synopsis & thesis",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SupervisorSubmissions />;
}
