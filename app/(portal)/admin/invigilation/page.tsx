import type { Metadata } from "next";

import { InvigilationDesk } from "@/components/portal/InvigilationDesk";

export const metadata: Metadata = {
  title: "Invigilation duty",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <InvigilationDesk scope="course-work" />;
}
