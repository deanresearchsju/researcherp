"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { heroCopy } from "@/data/sections";
import { usePublicSettings } from "@/components/home/PublicSiteProvider";

export function PhdApplyCta() {
  const settings = usePublicSettings();

  if (!settings.phdOpen) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-sm text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
          Admission window will be open soon.
        </p>
        <Link
          href="/apply/status"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "shrink-0",
          })}
        >
          Track application
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={heroCopy.primaryHref}
        className={buttonVariants({
          variant: "gold",
          size: "sm",
          className: "shrink-0",
        })}
      >
        {heroCopy.primaryCta}
      </Link>
      <Link
        href="/apply/status"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "shrink-0",
        })}
      >
        Track application
      </Link>
    </div>
  );
}
