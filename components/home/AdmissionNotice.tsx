"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { currentSiteSettings, defaultSiteSettings, subscribeSiteSettings } from "@/lib/office";

/** One line on the public pages: the admission window is coming, or a link to apply. */
export function AdmissionNotice() {
  const settings = useSyncExternalStore(
    subscribeSiteSettings,
    () => currentSiteSettings() ?? defaultSiteSettings,
    () => defaultSiteSettings,
  );

  if (!settings.phdOpen) {
    return (
      <p className="text-sm font-medium text-muted-foreground sm:text-base">
        Admission window will be open soon.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground sm:text-base">
      Admission window is open.{" "}
      <Link href="/apply" className="font-semibold text-primary underline-offset-4 hover:underline">
        Click here to apply for Ph.D.
      </Link>
    </p>
  );
}
