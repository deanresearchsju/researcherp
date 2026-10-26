import type { Metadata } from "next";

import { InvigilationDesk } from "@/components/portal/InvigilationDesk";

export const metadata: Metadata = {
  title: "Entrance invigilation",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <InvigilationDesk scope="entrance" />;
}
