import type { Metadata } from "next";

import { VidwanIdScreen } from "@/components/portal/VidwanIdScreen";

export const metadata: Metadata = {
  title: "Vidwan ID",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <VidwanIdScreen />;
}
