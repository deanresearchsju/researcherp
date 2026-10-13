import type { Metadata } from "next";

import { ScholarAdmission } from "@/components/portal/ScholarAdmission";

export const metadata: Metadata = {
  title: "Admission file",
  robots: { index: false, follow: false },
};

export default function ScholarAdmissionPage() {
  return <ScholarAdmission />;
}
