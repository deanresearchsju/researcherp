import type { Metadata } from "next";

import { ScholarExamTicket } from "@/components/portal/ScholarExamTicket";

export const metadata: Metadata = {
  title: "Hall ticket",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ScholarExamTicket />;
}
