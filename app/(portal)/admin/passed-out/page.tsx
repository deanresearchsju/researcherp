import type { Metadata } from "next";

import { PassedOutScreen } from "@/components/portal/PassedOutScreen";

export const metadata: Metadata = {
  title: "Passed-out scholars",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PassedOutScreen />;
}
