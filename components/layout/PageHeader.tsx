import { ChevronRight, Home } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

const heroPhotos = ["/assets/hero-1.jpeg", "/assets/hero-2.jpeg"] as const;

/** The two banner photos alternate by page, so each page always shows the same one. */
function heroPhotoFor(title: string) {
  let sum = 0;
  for (const character of title) sum += character.charCodeAt(0);
  return heroPhotos[sum % heroPhotos.length];
}

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  /** Accepted for older callers; the banner shows the title only. */
  summary?: string;
  children?: ReactNode;
};

/**
 * Banner at the top of every inner page of the public website: a full-width campus image
 * with the page title, and a breadcrumb bar underneath.
 */
export function PageHeader({ eyebrow, title, children }: PageHeaderProps) {
  return (
    <>
      <section
        className="relative isolate overflow-hidden bg-purple-deep text-primary-foreground"
        aria-labelledby="page-hero-title"
      >
        <Image
          src={heroPhotoFor(title)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-purple-deep via-purple-deep/90 to-purple-deep/55" />
        <Container className="py-12 sm:py-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.24em] text-accent uppercase">
            {eyebrow}
          </p>
          <h1
            id="page-hero-title"
            className="mt-3 max-w-3xl font-heading text-4xl leading-tight sm:text-5xl"
          >
            {title}
          </h1>
          <div className="mt-5 h-[3px] w-20 bg-accent" />
        </Container>
        <div className="h-1 bg-accent" />
      </section>
      <div className="border-b border-border bg-card">
        <Container className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-2">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Home className="size-3.5" aria-hidden="true" />
                  Home
                </Link>
              </li>
              {eyebrow !== title ? (
                <li className="inline-flex items-center gap-1.5">
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                  {eyebrow}
                </li>
              ) : null}
              <li className="inline-flex items-center gap-1.5">
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span aria-current="page" className="font-semibold text-primary">
                  {title}
                </span>
              </li>
            </ol>
          </nav>
          {children ? (
            <div className="flex flex-wrap items-center gap-2">{children}</div>
          ) : null}
        </Container>
      </div>
    </>
  );
}
