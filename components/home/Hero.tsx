"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { researchPage } from "@/data/research-home";
import { heroCopy } from "@/data/sections";
import { currentOffice, defaultSiteSettings, subscribeOffice } from "@/lib/office";

export function Hero() {
  const settings = useSyncExternalStore(
    subscribeOffice,
    () => currentOffice()?.settings ?? defaultSiteSettings,
    () => defaultSiteSettings,
  );

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8" aria-labelledby="hero-title">
      <div className="relative mx-auto min-h-[28rem] max-w-6xl overflow-hidden rounded-3xl sm:min-h-[32rem]">
        <Image
          src="/pic.jpeg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 72rem, 100vw"
          className="object-cover object-center"
        />
        <div className="relative flex min-h-[28rem] items-center p-4 sm:min-h-[32rem] sm:p-8 lg:p-10">
          <div className="w-full max-w-xl rounded-2xl bg-primary px-6 py-7 text-primary-foreground shadow-lift sm:px-8 sm:py-8">
            <h1
              id="hero-title"
              className="font-heading text-4xl leading-tight font-semibold sm:text-5xl"
            >
              {researchPage.title}
            </h1>
            <p className="mt-4 text-sm leading-6 text-primary-foreground/95 sm:text-base sm:leading-7">
              {researchPage.summary}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={settings.phdOpen ? heroCopy.primaryHref : "/admission"}
                className={buttonVariants({ variant: "gold", size: "lg" })}
              >
                {settings.phdOpen ? heroCopy.primaryCta : "Applications closed"}
              </Link>
              <Link
                href={heroCopy.secondaryHref}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                {heroCopy.secondaryCta}
              </Link>
              <Link
                href={heroCopy.tertiaryHref}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-foreground hover:underline"
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
