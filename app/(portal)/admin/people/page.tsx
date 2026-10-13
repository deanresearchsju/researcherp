import type { Metadata } from "next";

import { PeopleScreen } from "@/components/portal/PeopleScreen";

export const metadata: Metadata = {
  title: "People",
  robots: { index: false, follow: false },
};

export default function PeoplePage() {
  return <PeopleScreen />;
}
