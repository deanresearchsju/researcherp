import { menuSections } from "@/data/menu-sections";
import { grantableGroups } from "@/data/portal";
import { ROLES, type Role } from "@/types";

const mark = " › ";

function roleOf(pathname: string): Role {
  const first = pathname.split("/").filter(Boolean)[0];
  return (ROLES as readonly string[]).includes(first) ? (first as Role) : "admin";
}

/**
 * Where in the portal a report was made, as one line for its header: the module, the menu and
 * the sub-menu (or the tab on screen), for example "Course work › Course registrations ›
 * Arrears". Read from the page address and the page itself, so every report carries it
 * without the screen having to say it.
 */
export function menuContext(
  pathname: string,
  tab: string | null,
  screenTab?: string | null,
): string {
  const role = roleOf(pathname);
  const groups = grantableGroups[role] ?? [];
  let best: { heading: string; label: string; href: string } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const here = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (here && (!best || item.href.length > best.href.length)) {
        best = { heading: group.heading, label: item.label, href: item.href };
      }
    }
  }
  const parts: string[] = [];
  if (best) {
    if (best.heading && best.heading !== best.label) parts.push(best.heading);
    parts.push(best.label);
    const section = (menuSections[best.href] ?? []).find((item) => item.id === tab);
    const named = section?.label ?? screenTab?.trim();
    if (named && named !== best.label) parts.push(named);
  }
  return parts.join(mark);
}

/** The context of the page open in the browser now; empty outside the browser. */
export function currentMenuContext(): string {
  if (typeof window === "undefined") return "";
  const tab = new URLSearchParams(window.location.search).get("tab");
  const screenTab = document
    .querySelector('main [role="tab"][aria-selected="true"]')
    ?.textContent?.trim();
  return menuContext(window.location.pathname, tab, screenTab);
}
