"use client";

import { useSearchParams } from "next/navigation";

import { SupervisorInformationViewer } from "@/components/portal/SupervisorInformationViewer";
import { SupervisorRegister } from "@/components/portal/SupervisorRegister";
import { menuSections } from "@/data/menu-sections";
import { canOpenSection, resolvedMenus } from "@/lib/access";
import type { StoredApplication } from "@/lib/records";
import { usePreviewSession } from "@/lib/use-preview-session";

const href = "/admin/supervisors";

/**
 * The Supervisor register menu: the register itself and Supervisor information (find a
 * supervisor and read what the supervisor sees in the portal). The sub-menu chosen in the side
 * bar (?tab=) decides which one is shown.
 */
export function SupervisorRegisterHub({
  applications,
}: {
  applications: StoredApplication[];
}) {
  const session = usePreviewSession();
  const asked = useSearchParams().get("tab");
  const menus = session ? resolvedMenus(session) : null;
  const sections = (menuSections[href] ?? []).filter((item) =>
    canOpenSection(menus, href, item.id),
  );
  const tab = sections.find((item) => item.id === asked)?.id ?? sections[0]?.id ?? "register";

  if (tab === "information") return <SupervisorInformationViewer />;
  return <SupervisorRegister applications={applications} />;
}
