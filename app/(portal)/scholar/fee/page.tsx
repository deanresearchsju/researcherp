import type { Metadata } from "next";

import { FeeScreen } from "@/components/portal/FeeScreen";

export const metadata: Metadata = {
  title: "Fee",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FeeScreen />;
}
