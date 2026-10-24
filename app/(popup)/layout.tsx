import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/brand/Logo";
import { isOfficeRole } from "@/lib/access";
import { university } from "@/lib/constants";
import { decodeSessionCookie, sessionCookieName } from "@/lib/session";

export default function PopupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto" alt={university.name} />
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.16em] text-gold-ink uppercase">
              {university.researchOffice}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {university.productName}
            </p>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl p-4 sm:p-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <OfficeOnly>{children}</OfficeOnly>
        </Suspense>
      </main>
    </div>
  );
}

async function OfficeOnly({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const signedIn = await decodeSessionCookie(jar.get(sessionCookieName)?.value);
  if (
    !signedIn ||
    !isOfficeRole(signedIn.role) ||
    signedIn.role === "accounts" ||
    signedIn.role === "vc" ||
    signedIn.role === "coe" ||
    signedIn.role === "coeverify"
  ) {
    redirect("/login/admin");
  }
  return children;
}
