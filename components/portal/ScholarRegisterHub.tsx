"use client";

import { useSearchParams } from "next/navigation";

import { ScholarInformationViewer } from "@/components/portal/ScholarInformationViewer";
import { ScholarList } from "@/components/portal/ScholarList";
import { menuSections } from "@/data/menu-sections";
import { canOpenSection, resolvedMenus } from "@/lib/access";
import { usePreviewSession } from "@/lib/use-preview-session";

const href = "/admin/register";

/**
 * The Scholar register menu has two sub-menus: Scholar information (a search box: type a name,
 * registration number or e-mail and read that scholar's details one topic at a time) and Scholar
 * list (every scholar, with the entering of details, the fee already paid and the RAC done from
 * each row). The sub-menu chosen in the side bar (?tab=) decides which one is shown.
 */
export function ScholarRegisterHub() {
  const session = usePreviewSession();
  const asked = useSearchParams().get("tab");
  const menus = session ? resolvedMenus(session) : null;
  const sections = (menuSections[href] ?? []).filter((item) =>
    canOpenSection(menus, href, item.id),
  );
  const tab =
    sections.find((item) => item.id === asked)?.id ?? sections[0]?.id ?? "register";

  if (tab === "entry") return <ScholarList />;
  return <ScholarInformationViewer />;
}
