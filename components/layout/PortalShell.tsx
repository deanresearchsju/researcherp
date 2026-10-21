"use client";

import {
  Bell,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type SyntheticEvent } from "react";

import { Logo } from "@/components/brand/Logo";
import { useClientReady } from "@/components/forms/ClientGate";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { portalShellCopy } from "@/data/portal";
import { roleProfiles } from "@/data/roles";
import {
  actionForLabel,
  canMenuAction,
  canOpenMenu,
  isOfficeRole,
  matchMenuHref,
  menuActionCopy,
  resolvedMenus,
  visibleGroups,
} from "@/lib/access";
import { currentAdmission, scholarIsAdmitted, subscribeAdmission } from "@/lib/admission";
import {
  currentInbox,
  markNoticesRead,
  subscribeInbox,
  type InboxNotice,
} from "@/lib/audit";
import { clearPreviewSession, loginHref, type PreviewSession } from "@/lib/auth";
import { university } from "@/lib/constants";
import { closeOfficeView } from "@/lib/office-view";
import { useOfficeView, usePreviewSession } from "@/lib/use-preview-session";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { warmPortalData } from "@/lib/portal-warm";
import { cn } from "@/lib/utils";
import type { PortalNavGroup, Role } from "@/types";

function roleFromPath(pathname: string, sessionRole?: Role | null): Role {
  if (pathname.startsWith("/supervisor")) return "supervisor";
  if (pathname.startsWith("/admin")) {
    return sessionRole && isOfficeRole(sessionRole) ? sessionRole : "admin";
  }
  return "scholar";
}

function isCurrent(pathname: string, href: string) {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const noNotices: InboxNotice[] = [];

/** Unread notices that point at this menu (its page or a page under it). */
function unreadFor(notices: readonly InboxNotice[], href: string) {
  return notices.filter((notice) => {
    const path = notice.href.split(/[?#]/)[0] ?? "";
    if (!path) return false;
    if (href.endsWith("/dashboard")) return path === href;
    return path === href || path.startsWith(`${href}/`);
  }).length;
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1.5 text-[0.65rem] font-bold tracking-normal text-secondary-foreground",
        className,
      )}
      aria-label={`${count} new`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function timeAgo(iso: string) {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return iso;
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function WorkspaceIcon({ role }: { role: Role }) {
  const Icon =
    role === "admin"
      ? Users
      : role === "staff"
        ? ClipboardList
        : role === "dean"
          ? Landmark
          : role === "supervisor"
            ? UserRound
            : GraduationCap;
  return <Icon className="size-5" aria-hidden="true" />;
}

function itemClass(pathname: string, href: string, dotted = false) {
  const current = isCurrent(pathname, href);
  return cn(
    "group relative flex min-h-10 items-center rounded-xl text-sm font-semibold transition",
    dotted ? "px-3 pl-10" : "px-3",
    current
      ? "bg-muted text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-primary",
  );
}

function ItemList({
  items,
  pathname,
  notices,
  onNavigate,
  dotted = false,
}: {
  items: PortalNavGroup["items"];
  pathname: string;
  notices: readonly InboxNotice[];
  onNavigate?: () => void;
  dotted?: boolean;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={itemClass(pathname, item.href, dotted)}
              aria-current={current ? "page" : undefined}
            >
              {dotted ? (
                <span
                  className={cn(
                    "absolute left-4 size-1.5 rounded-full transition",
                    current
                      ? "bg-primary ring-4 ring-primary/15"
                      : "bg-border group-hover:bg-primary/60",
                  )}
                  aria-hidden="true"
                />
              ) : null}
              {item.label}
              {current ? (
                <span className="ml-auto rounded-md bg-card px-2 py-0.5 text-[0.6rem] font-bold tracking-wider text-primary uppercase shadow-sm">
                  {portalShellCopy.active}
                </span>
              ) : (
                <UnreadBadge count={unreadFor(notices, item.href)} className="ml-auto" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SideNav({
  role,
  pathname,
  groups,
  notices,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  groups: ReturnType<typeof visibleGroups>;
  notices: readonly InboxNotice[];
  onNavigate?: () => void;
}) {
  const dashboard = groups.find((group) => !group.heading);
  const named = groups.filter((group) => group.heading);
  const [primary, ...collapsible] = named;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(heading: string, active: boolean) {
    const update = (current: ReadonlySet<string>) => {
      const next = new Set(current);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    };
    if (active) setCollapsed(update);
    else setExpanded(update);
  }

  return (
    <nav aria-label={`${roleProfiles[role].label} portal`}>
      {dashboard?.items.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
              current
                ? "bg-muted text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-primary",
            )}
            aria-current={current ? "page" : undefined}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-muted text-primary">
              <LayoutDashboard className="size-4" aria-hidden="true" />
            </span>
            {item.label}
            <UnreadBadge count={unreadFor(notices, item.href)} className="ml-auto" />
          </Link>
        );
      })}

      {primary ? (
        <div className="mt-5">
          <p className="px-3 text-[0.65rem] font-extrabold tracking-[0.2em] text-muted-foreground uppercase">
            {primary.heading}
          </p>
          <div className="mt-2">
            <ItemList
              items={primary.items}
              pathname={pathname}
              notices={notices}
              onNavigate={onNavigate}
              dotted
            />
          </div>
        </div>
      ) : null}

      {collapsible.length > 0 ? (
        <div className="mt-6 space-y-1">
          {collapsible.map((group) => {
            const active = group.items.some((item) => isCurrent(pathname, item.href));
            const open = active
              ? !collapsed.has(group.heading)
              : expanded.has(group.heading);
            return (
              <div key={group.heading}>
                <button
                  type="button"
                  className="group flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[0.68rem] font-extrabold tracking-[0.16em] text-muted-foreground uppercase transition hover:bg-muted hover:text-primary"
                  aria-expanded={open}
                  onClick={() => toggle(group.heading, active)}
                >
                  {group.heading}
                  <span className="mr-2 ml-auto">
                    <UnreadBadge
                      count={group.items.reduce(
                        (sum, item) => sum + unreadFor(notices, item.href),
                        0,
                      )}
                    />
                  </span>
                  <ChevronDown
                    className={cn("size-3.5 shrink-0 transition", open && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {open ? (
                  <div className="mt-1 ml-3 border-l border-border pl-4">
                    <ItemList
                      items={group.items}
                      pathname={pathname}
                      notices={notices}
                      onNavigate={onNavigate}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}

export function PortalShell({
  children,
  signedIn,
}: {
  children: React.ReactNode;
  signedIn: PreviewSession | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const ready = useClientReady();
  const stored = usePreviewSession();
  const session = stored ?? signedIn;
  const pathRole = roleFromPath(pathname, session?.role);
  const view = useOfficeView();
  const [viewNotice, setViewNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const inbox = useSyncExternalStore(subscribeInbox, currentInbox, () => null);
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const viewing =
    ready &&
    Boolean(session) &&
    view !== null &&
    ((view.role === "scholar" && pathname.startsWith("/scholar")) ||
      (view.role === "supervisor" && pathname.startsWith("/supervisor"))) &&
    (session?.role === "admin" || session?.role === "staff" || session?.role === "dean");
  const role = viewing && view ? view.role : pathRole;
  const account =
    session && users
      ? users.users.find(
          (user) =>
            user.role === session.role &&
            user.identifier.toLowerCase() === session.identifier.toLowerCase(),
        )
      : undefined;
  const menus = viewing
    ? null
    : resolvedMenus(
        session
          ? {
              role: session.role,
              identifier: session.identifier,
              menus: session.menus ?? account?.menus ?? null,
            }
          : account,
      );
  const scholarId = viewing && view ? view.identifier : (session?.identifier ?? "");
  const admitted =
    role !== "scholar" || viewing || scholarIsAdmitted(scholarId, admission?.cases);
  const groups = visibleGroups(role, menus, admitted);
  const allowed = viewing || canOpenMenu(pathname, role, menus, admitted);
  const alerts = session && !viewing && inbox ? inbox : noNotices;
  const closeSidebar = () => setSidebarOpen(false);

  // Opening the page a notice points at clears that notice.
  useEffect(() => {
    if (!ready || viewing) return;
    const opened = alerts.filter((notice) => {
      const path = notice.href.split(/[?#]/)[0] ?? "";
      return path && path === pathname;
    });
    if (opened.length > 0) void markNoticesRead(opened.map((notice) => notice.id));
  }, [alerts, pathname, ready, viewing]);

  useEffect(() => {
    if (ready && session?.mustReset && !viewing) router.replace("/login/reset");
  }, [ready, session, router, viewing]);

  const sessionRole = session && !session.mustReset ? session.role : null;
  useEffect(() => {
    if (ready && sessionRole) warmPortalData(sessionRole);
  }, [ready, sessionRole]);

  function signOut() {
    closeOfficeView();
    clearPreviewSession();
    router.push(loginHref(session?.role ?? pathRole));
  }

  function leaveView() {
    const back =
      view?.returnTo && view.returnTo.startsWith("/")
        ? view.returnTo
        : session?.role === "supervisor"
          ? "/supervisor/scholars"
          : "/admin/users";
    closeOfficeView();
    router.push(back);
  }

  // Office sign-ins act only where they hold the right for this menu (add/edit, approve, export).
  const rightsHolder =
    !viewing && session && isOfficeRole(session.role) && pathname.startsWith("/admin")
      ? { role: session.role, identifier: session.identifier, menus }
      : null;
  const menuHref = rightsHolder ? matchMenuHref(pathname, rightsHolder.role) : null;

  function blockByRights(event: SyntheticEvent) {
    if (!rightsHolder || !menuHref) return false;
    const target = event.target;
    if (!(target instanceof Element)) return false;
    const native = event.nativeEvent as SubmitEvent;
    const control =
      event.type === "submit"
        ? (native.submitter ?? null)
        : target.closest("button, a[role='button']");
    if (!control || control.closest("[data-readonly-allow]")) return false;
    const label = control.textContent?.trim() || control.getAttribute("aria-label") || "";
    const kind = actionForLabel(label);
    if (!kind || canMenuAction(rightsHolder, menuHref, kind)) return false;
    event.preventDefault();
    event.stopPropagation();
    setViewNotice(
      `Your sign-in is not permitted to ${menuActionCopy[kind].toLowerCase()} in this menu. Ask the administrator to give the right under Users.`,
    );
    return true;
  }

  function blockOfficeAction(event: SyntheticEvent) {
    if (blockByRights(event)) return;
    if (!viewing) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-readonly-allow]")) return;
    const control = target.closest("button, input, textarea, select");
    if (!control) return;
    if (control instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      setViewNotice(
        "This page is open for reading. The office cannot submit or approve here.",
      );
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setViewNotice(
      "This page is open for reading. The office cannot submit or approve here.",
    );
  }

  const identity =
    viewing && view
      ? view.name
      : session && session.role === pathRole
        ? session.name.trim() || session.identifier
        : roleProfiles[pathRole].label;

  if (ready && !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-heading text-3xl text-primary">Sign in required</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Open the portal with your sign-in.
        </p>
        <Link
          href={loginHref(pathRole)}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (ready && session?.mustReset) {
    return <div className="min-h-screen bg-background" />;
  }

  const nav = (
    <SideNav
      role={role}
      pathname={pathname}
      groups={groups}
      notices={alerts}
      onNavigate={closeSidebar}
    />
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-purple-deep/35 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card shadow-card transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-border px-5">
          <Link href={`/${role}/dashboard`} className="rounded-lg" onClick={closeSidebar}>
            <Logo className="h-11 w-auto" alt="St. Joseph University, dashboard" />
          </Link>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-xl bg-muted text-primary transition hover:bg-muted lg:hidden"
            aria-label="Close menu"
            onClick={closeSidebar}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-border p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-purple-deep p-3 text-primary-foreground shadow-card">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card/15">
              <WorkspaceIcon role={role} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-bold tracking-[0.16em] text-accent uppercase">
                {roleProfiles[role].label} {portalShellCopy.workspace}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold">
                {university.researchOffice}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{nav}</div>

        <div className="border-t border-border p-4">
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-xs font-bold text-primary">
              {portalShellCopy.assistanceTitle}
            </p>
            <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">
              {portalShellCopy.assistanceDetail}
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold tracking-[0.16em] text-gold-ink uppercase">
              {roleProfiles[role].label}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {university.productName}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative"
                  data-readonly-allow
                  aria-label={
                    alerts.length
                      ? `Notifications, ${alerts.length} unread`
                      : "Notifications"
                  }
                >
                  <Bell className={cn("size-4", alerts.length > 0 && "text-primary")} />
                  {alerts.length > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[0.65rem] font-bold text-secondary-foreground ring-2 ring-card">
                      {alerts.length > 99 ? "99+" : alerts.length}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-primary">
                    Notifications{alerts.length ? ` (${alerts.length})` : ""}
                  </p>
                  {alerts.length > 0 ? (
                    <button
                      type="button"
                      data-readonly-allow
                      className="text-xs font-semibold text-secondary hover:underline"
                      onClick={() =>
                        void markNoticesRead(alerts.map((notice) => notice.id))
                      }
                    >
                      Mark all as read
                    </button>
                  ) : null}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      You are all caught up.
                    </p>
                  ) : (
                    alerts.slice(0, 30).map((notice) => (
                      <DropdownMenuItem
                        key={notice.id}
                        data-readonly-allow
                        className="flex cursor-pointer items-start gap-3 rounded-none border-b border-border px-4 py-3 last:border-b-0"
                        onSelect={() => {
                          void markNoticesRead([notice.id]);
                          if (notice.href) router.push(notice.href);
                        }}
                      >
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-primary">
                            {notice.title}
                          </span>
                          {notice.detail ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                              {notice.detail}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[11px] font-medium text-secondary">
                            {timeAgo(notice.time)}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
              {identity}
            </span>
            {viewing ? (
              <Button variant="outline" size="sm" onClick={leaveView}>
                {session?.role === "supervisor"
                  ? "Back to my scholars"
                  : "Back to register"}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            )}
          </div>
        </header>
        <div
          className="min-w-0 p-4 sm:p-6 lg:p-8"
          onSubmitCapture={blockOfficeAction}
          onClickCapture={blockOfficeAction}
          onChangeCapture={blockOfficeAction}
        >
          {viewing && view ? (
            <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-primary shadow-card">
              Reading {view.name}&apos;s {roleProfiles[role].label.toLowerCase()} portal.
              Every menu opens. Submitting and approving stay with this account.
            </p>
          ) : null}
          {viewNotice ? (
            <p role="status" className="mb-4 text-sm text-secondary">
              {viewNotice}
            </p>
          ) : null}
          {allowed ? (
            children
          ) : (
            <div className="max-w-xl">
              <h1 className="font-heading text-3xl text-primary">This menu is closed</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {role === "scholar" && !admitted
                  ? "Course work, requests, and doctoral progress open after the research office completes admission."
                  : "Your sign-in does not include this menu. Ask the research office to open it."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
