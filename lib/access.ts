import { portalGroups } from "@/data/portal";
import type { PortalNavGroup, Role } from "@/types";

export function isPrincipalAdmin(user: { role: Role; identifier: string }) {
  return user.role === "admin" && user.identifier.trim().toLowerCase() === "admin";
}

export function parseMenuRights(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is string => typeof item === "string" && item.startsWith("/"),
  );
}

export function menuHrefs(role: Role) {
  return portalGroups[role].flatMap((group) => group.items.map((item) => item.href));
}

export function effectiveMenus(
  user: { role: Role; identifier: string; menus: string[] | null } | undefined,
) {
  if (!user) return [];
  if (isPrincipalAdmin(user)) return null;
  return user.menus;
}

export function visibleGroups(role: Role, menus: string[] | null): PortalNavGroup[] {
  return portalGroups[role]
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          menus === null || menus.includes(item.href) || item.href.endsWith("/dashboard"),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function canOpenMenu(pathname: string, role: Role, menus: string[] | null) {
  if (menus === null) return true;
  const match = menuHrefs(role)
    .slice()
    .sort((left, right) => right.length - left.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
  if (!match) return false;
  return match.endsWith("/dashboard") || menus.includes(match);
}

export function storedMenus(role: Role, selected: readonly string[]) {
  const catalog = menuHrefs(role);
  const chosen = catalog.filter(
    (href) => href.endsWith("/dashboard") || selected.includes(href),
  );
  return chosen.length === catalog.length ? null : chosen;
}
