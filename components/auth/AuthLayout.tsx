import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-hero">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-28 -right-16 size-80 rounded-full bg-primary/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 size-96 rounded-full bg-accent/25"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 size-64 -translate-x-1/2 rounded-full bg-secondary/5"
        aria-hidden="true"
      />
      <header className="relative flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="inline-flex rounded-xl bg-card px-3 py-2 shadow-card">
          <Logo
            priority
            className="h-10 w-auto"
            alt="St. Joseph University Research, home"
          />
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
      </header>
      <main
        id="main"
        className="relative flex items-center justify-center px-4 pt-4 pb-12 sm:px-8"
      >
        {children}
      </main>
    </div>
  );
}
