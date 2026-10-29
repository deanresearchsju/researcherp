import { grantableGroups, portalGroups } from "@/data/portal";
import { menuSections } from "@/data/menu-sections";
import { readPreviewSession } from "@/lib/auth";
import { officeViewWriteBlock } from "@/lib/office-view";
import { officeRoles, type PortalNavGroup, type Role } from "@/types";

export const menuActionKinds = ["edit", "approve", "export", "upload"] as const;
export type MenuActionKind = (typeof menuActionKinds)[number];

export const menuActionCopy: Record<MenuActionKind, string> = {
  edit: "Add / edit",
  approve: "Approve / decide",
  export: "Export",
  upload: "Upload",
};

/**
 * Saved with every rights list since sub-menu rights (add/edit, approve) were introduced.
 * Lists without it were saved earlier: their granted menus keep add/edit and approve.
 */
export const rightsMarker = "/rights#v2";

/**
 * Saved with a rights list that also names the sections (tabs) of a menu. Lists without it were
 * saved earlier and keep every section of their granted menus.
 */
export const sectionsMarker = "/rights#sections";

export function sectionKey(href: string, id: string) {
  return `${href}#tab:${id}`;
}

export function parseSectionKey(value: string): { href: string; id: string } | null {
  const at = value.indexOf("#tab:");
  if (at < 1) return null;
  return { href: value.slice(0, at), id: value.slice(at + 5) };
}

export function isSectionKey(value: string) {
  return parseSectionKey(value) !== null;
}

/** Every section of the menus a role has, in a fixed order (the order the cookie packs them in). */
export function sectionCatalog(role: Role) {
  return menuHrefs(role).flatMap((href) =>
    (menuSections[href] ?? []).map((section) => sectionKey(href, section.id)),
  );
}

/** May the sign-in open this section (tab) of a menu? Everything is open unless sections were set. */
export function canOpenSection(
  menus: readonly string[] | null | undefined,
  href: string | null,
  id: string,
) {
  if (menus === null || menus === undefined || !href) return true;
  if (!menus.includes(sectionsMarker)) return true;
  if (!menuSections[href]?.some((section) => section.id === id)) return true;
  return menus.includes(sectionKey(href, id));
}

/** The rights list with every section of the granted menus ticked, for rights saved before sections. */
export function withAllSections(role: Role, menus: readonly string[]) {
  if (menus.includes(sectionsMarker)) return [...menus];
  const keys = sectionCatalog(role).filter((key) => {
    const parsed = parseSectionKey(key);
    return parsed !== null && menus.includes(parsed.href);
  });
  return [...menus, ...keys, sectionsMarker];
}

const approveWords =
  /\b(approve|verify|recommend|grant|refuse|reject|return|issue|promote|demote|transfer|allot|shortlist|select|mark|send|remind|accept|decline|move|sign|seal|schedule|check & issue)\b/i;
const editWords =
  /\b(add|edit|save|create|update|delete|remove|upload|reset|publish|record|withdraw|reopen|change|give access|activate|nominate|submit|register|start)\b/i;
const neverBlocked =
  /^(cancel|close|done|clear|clear all|clear filters|back|view|print|select all|clear selection|export csv|export pdf|approved copy|download.*|previous|next|search)$/i;

/** Which right a button needs, from its label. Null for buttons anyone may use. */
export function actionForLabel(label: string): MenuActionKind | null {
  const text = label
    .replace(/\s+/g, " ")
    .replace(/\(\d+\)|·.*$/g, "")
    .trim();
  if (!text || neverBlocked.test(text)) return null;
  if (/^export|download|zip/i.test(text)) return "export";
  if (approveWords.test(text)) return "approve";
  if (editWords.test(text)) return "edit";
  return null;
}

const uploadMenus = new Set([
  "/admin/vacancies",
  "/admin/applications",
  "/admin/team",
  "/admin/registration-numbers",
]);

const skipExportMenus = new Set([
  "/admin/site",
  "/admin/news",
  "/admin/helpdesk",
  "/admin/research-areas",
]);

export function isOfficeRole(role: Role) {
  return (officeRoles as readonly string[]).includes(role);
}

export function isPrincipalAdmin(user: { role: Role; identifier: string }) {
  return user.role === "admin" && user.identifier.trim().toLowerCase() === "admin";
}

export function parseMenuRights(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return moveLegacyMenus(
    value.filter(
      (item): item is string => typeof item === "string" && item.startsWith("/"),
    ),
  );
}

export function menuHrefs(role: Role) {
  return grantableGroups[role].flatMap((group) => group.items.map((item) => item.href));
}

/** The menus a role starts with (what grantableGroups narrows to for a fixed role). */
function ownHrefs(role: Role) {
  return portalGroups[role].flatMap((group) => group.items.map((item) => item.href));
}

export function dashboardHrefs(role: Role) {
  return menuHrefs(role).filter((href) => href.endsWith("/dashboard"));
}

export function menuActionKey(href: string, action: MenuActionKind) {
  return `${href}#${action}`;
}

export function parseMenuActionKey(
  value: string,
): { href: string; action: MenuActionKind } | null {
  const hash = value.indexOf("#");
  if (hash < 1) return null;
  const href = value.slice(0, hash);
  const action = value.slice(hash + 1);
  if (!(menuActionKinds as readonly string[]).includes(action)) return null;
  return { href, action: action as MenuActionKind };
}

export function isMenuActionKey(value: string) {
  return parseMenuActionKey(value) !== null;
}

export function actionsForMenu(href: string, role: Role): MenuActionKind[] {
  if (!isOfficeRole(role)) return [];
  if (href.endsWith("/dashboard")) return [];
  const kinds: MenuActionKind[] = ["edit", "approve"];
  if (!skipExportMenus.has(href)) kinds.push("export");
  if (uploadMenus.has(href)) kinds.push("upload");
  return kinds;
}

type MenuHolder = {
  role: Role;
  identifier: string;
  menus?: string[] | null;
};

/**
 * Accounts, the Vice Chancellor and the two Controller of Examinations sign-ins have a fixed
 * set of menus; they do not start dashboard-only.
 */
export function fixedMenuRole(role: Role) {
  return role === "accounts" || role === "vc" || role === "coe" || role === "coeverify";
}

function fixedMenus(role: Role) {
  const hrefs = ownHrefs(role);
  const pages = hrefs.filter((href) => !href.endsWith("/dashboard"));
  const actions =
    role === "accounts" || role === "coe" || role === "coeverify"
      ? pages.flatMap((href) => [
          menuActionKey(href, "edit"),
          menuActionKey(href, "approve"),
          menuActionKey(href, "export"),
        ])
      : pages.map((href) => menuActionKey(href, "export"));
  return [...hrefs, ...actions, rightsMarker];
}

/** The fee screens of Accounts were merged into Fee approvals; rights given before still work. */
function moveLegacyMenus(menus: string[]) {
  const moved = menus.map((item) =>
    item.startsWith("/admin/accounts/")
      ? item.replace(/^\/admin\/accounts\/[^#]+/, "/admin/payments")
      : item,
  );
  return [...new Set(moved)];
}

export function resolvedMenus(user: MenuHolder | null | undefined): string[] | null {
  if (!user) return [];
  if (isPrincipalAdmin(user)) return null;
  if (Array.isArray(user.menus)) return moveLegacyMenus(user.menus);
  if (user.role === "scholar" || user.role === "supervisor") return menuHrefs(user.role);
  if (fixedMenuRole(user.role)) return fixedMenus(user.role);
  return dashboardHrefs(user.role);
}

export function effectiveMenus(user: MenuHolder | undefined) {
  return resolvedMenus(user);
}

export function matchMenuHref(pathname: string, role: Role) {
  return (
    menuHrefs(role)
      .slice()
      .sort((left, right) => right.length - left.length)
      .find((href) => pathname === href || pathname.startsWith(`${href}/`)) ?? null
  );
}

export function canMenuAction(
  user: MenuHolder | null | undefined,
  href: string | null,
  action: MenuActionKind,
) {
  if (!user || !href) return false;
  if (isPrincipalAdmin(user)) return true;
  const menus = resolvedMenus(user);
  if (menus === null) return true;
  if (menus.includes(menuActionKey(href, action))) return true;
  // Rights saved before sub-menu rights existed keep add/edit and approve on granted menus.
  const legacy = !menus.includes(rightsMarker);
  return legacy && (action === "edit" || action === "approve") && menus.includes(href);
}

export const scholarPreAdmissionHrefs = [
  "/scholar/dashboard",
  "/scholar/admission",
  "/scholar/helpdesk",
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
  return grantableGroups[role]
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
  const match = matchMenuHref(pathname, role);
  if (!match) return false;
  return match.endsWith("/dashboard") || allowed.includes(match);
}

export function storedMenus(role: Role, selected: readonly string[]) {
  const catalog = menuHrefs(role);
  const pages = catalog.filter(
    (href) => href.endsWith("/dashboard") || selected.includes(href),
  );
  const actions = selected.filter((item) => {
    const parsed = parseMenuActionKey(item);
    return parsed !== null && pages.includes(parsed.href);
  });
  const sections = selected.filter((item) => {
    const parsed = parseSectionKey(item);
    return parsed !== null && pages.includes(parsed.href);
  });
  return [
    ...pages,
    ...actions,
    ...sections,
    rightsMarker,
    ...(selected.includes(sectionsMarker) ? [sectionsMarker] : []),
  ];
}

export function defaultMenuHrefs(role: Role) {
  if (role === "scholar" || role === "supervisor") return menuHrefs(role);
  if (fixedMenuRole(role)) return fixedMenus(role);
  return dashboardHrefs(role);
}

export function menuLabels(role: Role, menus: string[] | null) {
  if (menus === null) return null;
  const catalog = grantableGroups[role].flatMap((group) => group.items);
  return menus.flatMap((item) => {
    if (item.endsWith("/dashboard") || item === rightsMarker || item === sectionsMarker)
      return [];
    const section = parseSectionKey(item);
    if (section) {
      const parent = catalog.find((entry) => entry.href === section.href);
      const label = menuSections[section.href]?.find(
        (entry) => entry.id === section.id,
      )?.label;
      return parent && label ? [`${parent.label} · ${label}`] : [];
    }
    const action = parseMenuActionKey(item);
    if (action) {
      const parent = catalog.find((entry) => entry.href === action.href);
      if (!parent) return [];
      return [`${parent.label} · ${menuActionCopy[action.action]}`];
    }
    const page = catalog.find((entry) => entry.href === item);
    return [page?.label ?? item];
  });
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
  if (
    !session ||
    (session.role !== "admin" && session.role !== "staff" && session.role !== "accounts")
  ) {
    return {
      ok: false as const,
      message:
        "Staff complete the open step. The Dean monitors. Only an administrator can clear a blocked step.",
    };
  }
  return null;
}
