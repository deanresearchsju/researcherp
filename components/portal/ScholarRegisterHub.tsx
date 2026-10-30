"use client";

import { useSearchParams } from "next/navigation";

import { ResearchRegister } from "@/components/portal/ResearchRegister";
import { ScholarInfoScreen } from "@/components/portal/ScholarInfoScreen";
import { ScholarInformationViewer } from "@/components/portal/ScholarInformationViewer";
import { menuSections } from "@/data/menu-sections";
import { canOpenSection, resolvedMenus } from "@/lib/access";
import { usePreviewSession } from "@/lib/use-preview-session";

const href = "/admin/register";

/**
 * The Scholar register menu: the register itself, Scholar information (find a scholar and read
 * what the scholar sees in the portal), and Entering details (the personal details, the fee
 * already paid and the RAC of every scholar, entered by the research office). The sub-menu
 * chosen in the side bar (?tab=) decides which one is shown.
 */
export function ScholarRegisterHub() {
  const session = usePreviewSession();
  const asked = useSearchParams().get("tab");
  const menus = session ? resolvedMenus(session) : null;
  const sections = (menuSections[href] ?? []).filter((item) =>
    canOpenSection(menus, href, item.id),
  );
  const tab = sections.find((item) => item.id === asked)?.id ?? sections[0]?.id ?? "register";

  if (tab === "information") return <ScholarInformationViewer />;
  if (tab === "entry") return <ScholarInfoScreen />;
  return <ResearchRegister />;
}
