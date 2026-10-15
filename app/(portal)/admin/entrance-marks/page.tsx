import type { Metadata } from "next";

import { EntranceMarksScreen } from "@/components/portal/EntranceMarksScreen";

export const metadata: Metadata = {
  title: "Entrance marks",
  robots: { index: false, follow: false },
};

export default function EntranceMarksPage() {
  return <EntranceMarksScreen />;
}
