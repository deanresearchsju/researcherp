import type { Metadata } from "next";

import { CoeMarksScreen } from "@/components/portal/CoeMarksScreen";

export const metadata: Metadata = {
  title: "Marks entry",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CoeMarksScreen mode="entry" />;
}
