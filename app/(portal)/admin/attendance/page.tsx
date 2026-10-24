import type { Metadata } from "next";

import { AttendanceSheets } from "@/components/portal/AttendanceSheets";

export const metadata: Metadata = {
  title: "Attendance sheets",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AttendanceSheets />;
}
