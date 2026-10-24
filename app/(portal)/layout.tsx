import { cookies } from "next/headers";
import { Suspense } from "react";

import { PortalShell } from "@/components/layout/PortalShell";
import { TableSorter } from "@/components/portal/TableSorter";
import { decodeSessionCookie, sessionCookieName } from "@/lib/session";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PortalSessionShell>{children}</PortalSessionShell>
    </Suspense>
  );
}

async function PortalSessionShell({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const signedIn = await decodeSessionCookie(jar.get(sessionCookieName)?.value);
  return (
    <PortalShell signedIn={signedIn}>
      <main id="main">{children}</main>
      <TableSorter />
    </PortalShell>
  );
}
