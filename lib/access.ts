import { officeWorkHrefs, portalGroups } from "@/data/portal";
import { readPreviewSession } from "@/lib/auth";
import { officeViewWriteBlock } from "@/lib/office-view";
import { officeRoles, type PortalNavGroup, type Role } from "@/types";

export function isOfficeRole(role: Role) {
  return (officeRoles as readonly string[]).includes(role);
}

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

export const scholarPreAdmissionHrefs = [
  "/scholar/dashboard",
  "/scholar/admission",
] as const;

function scholarMenuOpen(pathname: string, admitted: boolean) {
  if (admitted) return true;
  return scholarPreAdmissionHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function visibleGroups(
  role: Role,
  menus: string[] | null,
  admitted = true,
): PortalNavGroup[] {
  return portalGroups[role]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (role === "scholar" && !scholarMenuOpen(item.href, admitted)) return false;
        return (
          menus === null || menus.includes(item.href) || item.href.endsWith("/dashboard")
        );
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function canOpenMenu(
  pathname: string,
  role: Role,
  menus: string[] | null,
  admitted = true,
) {
  if (role === "scholar" && !scholarMenuOpen(pathname, admitted)) return false;
  const allowed = menus ?? menuHrefs(role);
  const match = menuHrefs(role)
    .slice()
    .sort((left, right) => right.length - left.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
  if (!match) return false;
  return match.endsWith("/dashboard") || allowed.includes(match);
}

export function storedMenus(role: Role, selected: readonly string[]) {
  const catalog = menuHrefs(role);
  const chosen = catalog.filter(
    (href) => href.endsWith("/dashboard") || selected.includes(href),
  );
  return chosen.length === catalog.length ? null : chosen;
}

export function defaultMenuHrefs(role: Role) {
  const catalog = menuHrefs(role);
  if (role === "staff") {
    return catalog.filter(
      (href) =>
        href.endsWith("/dashboard") ||
        (officeWorkHrefs as readonly string[]).includes(href),
    );
  }
  if (role === "dean") {
    return catalog.filter(
      (href) =>
        href.endsWith("/dashboard") ||
        (officeWorkHrefs as readonly string[]).includes(href) ||
        href === "/admin/admission-archive",
    );
  }
  return catalog;
}

export function menuLabels(role: Role, menus: string[] | null) {
  if (menus === null) return null;
  const catalog = portalGroups[role].flatMap((group) => group.items);
  return menus
    .filter((href) => !href.endsWith("/dashboard"))
    .map((href) => catalog.find((item) => item.href === href)?.label ?? href);
}

export function adminActionBlock() {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const session = readPreviewSession();
  if (!session || session.role !== "admin") {
    return {
      ok: false as const,
      message: "Only an administrator can do this.",
    };
  }
  return null;
}

export function registrationWriteBlock(alreadySaved: boolean) {
  if (alreadySaved) return adminActionBlock();
  return officeWriteBlock();
}

export function officeWriteBlock() {
  const viewing = officeViewWriteBlock();
  if (viewing) return viewing;
  const session = readPreviewSession();
  if (!session || (session.role !== "admin" && session.role !== "staff")) {
    return {
      ok: false as const,
      message:
        "Staff complete the open step. The Dean monitors. Only an administrator can clear a blocked step.",
    };
  }
  return null;
}
