"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { heroCopy } from "@/data/sections";
import { currentSiteSettings, defaultSiteSettings, subscribeSiteSettings } from "@/lib/office";

export function PhdApplyCta() {
  const settings = useSyncExternalStore(
    subscribeSiteSettings,
    () => currentSiteSettings() ?? defaultSiteSettings,
    () => defaultSiteSettings,
  );

  if (!settings.phdOpen) {
    return (
      <p className="max-w-sm text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
        Admission window will be open soon.
      </p>
    );
  }

  return (
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
  );
}
