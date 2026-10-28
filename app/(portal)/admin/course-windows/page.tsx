import type { Metadata } from "next";

import { CourseWorkScreen } from "@/components/portal/CourseWorkScreen";

export const metadata: Metadata = {
  title: "Registration windows",
  robots: { index: false, follow: false },
};

export default function CourseWindowsPage() {
  return <CourseWorkScreen mode="admin" view="windows" />;
}
