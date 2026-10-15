"use client";

import { ArrowRight, FlaskConical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { researchPage } from "@/data/research-home";
import { heroCopy } from "@/data/sections";
import { currentOffice, defaultSiteSettings, subscribeOffice } from "@/lib/office";
import { cn } from "@/lib/utils";

export function Hero() {
  const settings = useSyncExternalStore(
    subscribeOffice,
    () => currentOffice()?.settings ?? defaultSiteSettings,
    () => defaultSiteSettings,
  );
  const applyHref = settings.phdOpen ? heroCopy.primaryHref : "/admission";
  const applyLabel = settings.phdOpen ? heroCopy.primaryCta : "Applications closed";

  return (
    <section className="overflow-hidden px-4 py-5 sm:px-6 sm:py-8 lg:px-8" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-6xl">
        <div className="relative min-h-[min(36rem,calc(100dvh-11rem))] overflow-hidden rounded-[2rem] bg-primary shadow-lift sm:min-h-[min(40rem,calc(100dvh-12rem))] lg:min-h-[42rem]">
          <Image
            src="/pic.jpeg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover object-center transition duration-700 hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-purple-deep/80 via-purple-deep/10 to-black/15" />

          <div className="absolute top-5 left-5 flex items-center gap-3 rounded-full border border-primary-foreground/25 bg-purple-deep/75 py-2 pr-4 pl-2 text-primary-foreground shadow-card backdrop-blur-md sm:top-7 sm:left-7">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
              <FlaskConical className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[0.65rem] font-bold tracking-[0.18em] uppercase sm:text-xs">
              {researchPage.badge}
            </span>
          </div>

          <div className="absolute bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 overflow-hidden rounded-2xl border border-card/80 bg-card/95 text-center shadow-lift backdrop-blur-md sm:bottom-6 sm:w-[calc(100%-4rem)]">
            <div className="mx-auto h-1 w-20 rounded-b-full bg-accent" />
            <div className="px-5 py-6 sm:px-8 sm:py-7 lg:px-10">
              <h1
                id="hero-title"
                className="font-heading text-3xl leading-tight font-extrabold tracking-tight text-primary sm:text-4xl"
              >
                {researchPage.title}
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
                {researchPage.summary}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
                <Link href={applyHref} className={buttonVariants({ variant: "gold", size: "lg" })}>
                  {applyLabel}
                </Link>
                <Link
                  href={heroCopy.secondaryHref}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "border-border bg-card font-bold",
                  )}
                >
                  {heroCopy.secondaryCta}
                </Link>
              </div>
              <Link
                href={heroCopy.tertiaryHref}
                className="mt-3 inline-flex items-center justify-center gap-2 text-sm font-bold text-primary transition hover:gap-3 hover:text-gold-ink"
              >
                {heroCopy.tertiaryCta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
