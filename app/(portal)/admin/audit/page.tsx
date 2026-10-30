import type { Metadata } from "next";
import { Suspense } from "react";

import { AuditTrailScreen } from "@/components/portal/AuditTrailScreen";

export const metadata: Metadata = {
  title: "Audit trail",
  robots: { index: false, follow: false },
};

export default function AuditTrailPage() {
  return (
    <Suspense fallback={null}>
      <AuditTrailScreen />
    </Suspense>
  );
}
