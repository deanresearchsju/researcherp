"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { phdWindowCopy } from "@/data/home";
import { heroCopy } from "@/data/sections";
import { currentOffice, defaultSiteSettings, subscribeOffice } from "@/lib/office";

export function PhdApplyCta() {
  const settings = useSyncExternalStore(
    subscribeOffice,
    () => currentOffice()?.settings ?? defaultSiteSettings,
    () => defaultSiteSettings,
  );

  if (!settings.phdOpen) {
    return (
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        {phdWindowCopy.closedStatus}. {phdWindowCopy.closedDetail}
      </p>
    );
  }

  return (
    <Link
      href={heroCopy.primaryHref}
      className={buttonVariants({
        variant: "gold",
        size: "lg",
        className: "shrink-0",
      })}
    >
      {heroCopy.primaryCta}
    </Link>
  );
}
