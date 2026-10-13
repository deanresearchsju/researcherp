import { Suspense } from "react";

import { PortalShell } from "@/components/layout/PortalShell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PortalShell>
        <main id="main">{children}</main>
      </PortalShell>
    </Suspense>
  );
}
