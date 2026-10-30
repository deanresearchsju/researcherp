import type { Metadata } from "next";
import { Suspense } from "react";

import { ScholarRegisterHub } from "@/components/portal/ScholarRegisterHub";

export const metadata: Metadata = {
  title: "Scholar register",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <ScholarRegisterHub />
    </Suspense>
  );
}
