import type { Metadata } from "next";

import { LettersScreen } from "@/components/portal/LettersScreen";

export const metadata: Metadata = {
  title: "Letters",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LettersScreen />;
}
