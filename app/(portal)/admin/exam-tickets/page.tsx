import type { Metadata } from "next";

import { ExamTicketsScreen } from "@/components/portal/ExamTicketsScreen";

export const metadata: Metadata = {
  title: "Hall tickets & seating",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ExamTicketsScreen />;
}
