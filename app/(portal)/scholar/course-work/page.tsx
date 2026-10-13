import type { Metadata } from "next";

import { CourseWorkScreen } from "@/components/portal/CourseWorkScreen";

export const metadata: Metadata = {
  title: "Course work",
  robots: { index: false, follow: false },
};

export default function ScholarCourseWorkPage() {
  return <CourseWorkScreen mode="scholar" />;
}
