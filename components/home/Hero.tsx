"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { heroCopy } from "@/data/sections";
import { currentOffice, defaultSiteSettings, subscribeOffice } from "@/lib/office";

export function Hero() {
  const settings = useSyncExternalStore(
    subscribeOffice,
    () => currentOffice()?.settings ?? defaultSiteSettings,
    () => defaultSiteSettings,
  );
  return (
    <section className="bg-hero relative overflow-hidden" aria-labelledby="hero-title">
      <div
        className="bg-grid pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-14">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
            {settings.heroEyebrow}
          </p>
          <div className="mt-3 h-px w-12 bg-accent" aria-hidden="true" />
          <h1
            id="hero-title"
            className="mt-4 max-w-xl font-heading text-4xl leading-tight font-semibold text-primary sm:text-5xl"
          >
            {settings.heroTitle}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {settings.heroSummary}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={settings.phdOpen ? heroCopy.primaryHref : "/admission"}
              className={buttonVariants({ variant: "gold", size: "lg" })}
            >
              {settings.phdOpen ? heroCopy.primaryCta : "Applications closed"}
            </Link>
            <Link
              href={heroCopy.secondaryHref}
              className={buttonVariants({ size: "lg" })}
            >
              {heroCopy.secondaryCta}
            </Link>
          </div>
          <Link
            href={heroCopy.tertiaryHref}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {heroCopy.tertiaryCta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/80 bg-white/75 p-5 shadow-lift backdrop-blur-md">
          <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
            {settings.phdOpen ? settings.admissionLabel : "Admissions closed"}
          </p>
          <p className="mt-3 font-heading text-2xl text-primary">
            {settings.admissionSession}
          </p>
          <div className="mt-4 h-px bg-accent" aria-hidden="true" />
          <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {settings.deadlineLabel}
          </p>
          <p className="mt-1 font-heading text-xl text-primary">{settings.deadline}</p>
        </div>
      </div>
    </section>
  );
}
