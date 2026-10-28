import type { Metadata } from "next";

import { CourseWorkScreen } from "@/components/portal/CourseWorkScreen";

export const metadata: Metadata = {
  title: "Course work registrations",
  robots: { index: false, follow: false },
};

export default function AdminCourseWorkPage() {
  return <CourseWorkScreen mode="admin" />;
}
