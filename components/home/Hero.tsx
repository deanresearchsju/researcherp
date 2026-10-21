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
    <section
      className="overflow-hidden px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
      aria-labelledby="hero-title"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="relative min-h-[18rem] overflow-hidden rounded-2xl bg-primary shadow-lift sm:min-h-[22rem] lg:min-h-[24rem]">
          <Image
            src="/pic.jpeg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-purple-deep/85 via-purple-deep/15 to-black/10" />

          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-purple-deep/80 py-1 pr-3 pl-1 text-primary-foreground shadow-card backdrop-blur-md sm:top-4 sm:left-4">
            <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-foreground">
              <FlaskConical className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-[0.6rem] font-bold tracking-[0.16em] uppercase">
              {researchPage.badge}
            </span>
          </div>

          <div className="absolute right-3 bottom-3 left-3 mx-auto max-w-3xl overflow-hidden rounded-xl border border-card/80 bg-card/95 text-center shadow-lift backdrop-blur-md sm:right-5 sm:bottom-4 sm:left-5">
            <div className="mx-auto h-0.5 w-14 rounded-b-full bg-accent" />
            <div className="px-3 py-2.5 sm:px-5 sm:py-3">
              <h1
                id="hero-title"
                className="font-heading text-xl leading-tight font-extrabold tracking-tight text-primary sm:text-2xl"
              >
                {researchPage.title}
              </h1>
              <p className="mx-auto mt-1 max-w-2xl line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-3 sm:text-sm">
                {researchPage.summary}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <Link
                  href={applyHref}
                  className={buttonVariants({ variant: "gold", size: "sm" })}
                >
                  {applyLabel}
                </Link>
                <Link
                  href={heroCopy.secondaryHref}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-border bg-card font-bold",
                  )}
                >
                  {heroCopy.secondaryCta}
                </Link>
                <Link
                  href={heroCopy.tertiaryHref}
                  className="inline-flex items-center justify-center gap-1 text-xs font-bold text-primary transition hover:gap-2 hover:text-gold-ink"
                >
                  {heroCopy.tertiaryCta}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
