import type { Metadata } from "next";

import { FormsScreen } from "@/components/portal/FormsScreen";

export const metadata: Metadata = {
  title: "Forms & formats",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FormsScreen mode="reader" />;
}
