import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { university } from "@/lib/constants";

type AuthLayoutProps = {
  welcome: string;
  description: string;
  benefits: string[];
  children: ReactNode;
};

export function AuthLayout({
  welcome,
  description,
  benefits,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-deep via-primary to-secondary/80"
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-between gap-10 px-6 py-10 sm:px-10 lg:py-14">
          <Link href="/" className="inline-flex w-fit rounded-xl bg-white p-2">
            <Logo className="h-12 w-auto" alt="St. Joseph University Research, home" />
          </Link>
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-accent uppercase">
              {university.researchOffice}
            </p>
            <h1 className="mt-3 max-w-md font-heading text-4xl leading-tight">
              {welcome}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/80">{description}</p>
            <ul className="mt-8 hidden space-y-3 lg:block">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-sm leading-6">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden font-heading text-lg text-accent lg:block">
            {university.tagline}
          </p>
        </div>
      </section>
      <main
        id="main"
        className="flex items-center justify-center bg-background px-4 py-10 sm:px-8"
      >
        {children}
      </main>
    </div>
  );
}
