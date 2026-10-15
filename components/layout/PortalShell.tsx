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
  canOpenMenu,
  effectiveMenus,
  isOfficeRole,
  isPrincipalAdmin,
  visibleGroups,
} from "@/lib/access";
import { currentAdmission, scholarIsAdmitted, subscribeAdmission } from "@/lib/admission";
import { currentInbox, noticesFor, subscribeInbox } from "@/lib/audit";
import { clearPreviewSession, loginHref, type PreviewSession } from "@/lib/auth";
import { university } from "@/lib/constants";
import { closeOfficeView } from "@/lib/office-view";
import { useOfficeView, usePreviewSession } from "@/lib/use-preview-session";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

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

function groupCount(count: number) {
  return String(count).padStart(2, "0");
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

function SideNav({
  role,
  pathname,
  groups,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  groups: ReturnType<typeof visibleGroups>;
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

  function itemClass(href: string, dotted = false) {
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
    dotted = false,
  }: {
    items: (typeof groups)[number]["items"];
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
                className={itemClass(item.href, dotted)}
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
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    );
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
          </Link>
        );
      })}

      {primary ? (
        <div className="mt-5">
          <p className="px-3 text-[0.65rem] font-extrabold tracking-[0.2em] text-muted-foreground uppercase">
            {primary.heading}
          </p>
          <div className="mt-2">
            <ItemList items={primary.items} dotted />
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
                  <span className="ml-auto mr-2 rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] tracking-normal text-muted-foreground">
                    {groupCount(group.items.length)}
                  </span>
                  <ChevronDown
                    className={cn("size-3.5 shrink-0 transition", open && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {open ? (
                  <div className="mt-1 ml-3 border-l border-border pl-4">
                    <ItemList items={group.items} />
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
    (session?.role === "admin" ||
      session?.role === "staff" ||
      session?.role === "dean" ||
      (session?.role === "supervisor" && view.role === "scholar"));
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
    : session && isPrincipalAdmin(session)
      ? null
      : session && session.menus !== undefined
        ? session.menus
        : effectiveMenus(account);
  const scholarId = viewing && view ? view.identifier : (session?.identifier ?? "");
  const admitted =
    role !== "scholar" || viewing || scholarIsAdmitted(scholarId, admission?.cases);
  const groups = visibleGroups(role, menus, admitted);
  const allowed = viewing || canOpenMenu(pathname, role, menus, admitted);
  const alerts =
    session && inbox ? noticesFor(session.role, session.identifier, inbox) : [];
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (ready && session?.mustReset && !viewing) router.replace("/login/reset");
  }, [ready, session, router, viewing]);

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

  function blockOfficeAction(event: SyntheticEvent) {
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
    <SideNav role={role} pathname={pathname} groups={groups} onNavigate={closeSidebar} />
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
                  aria-label={
                    alerts.length
                      ? `Notifications, ${alerts.length} unread`
                      : "Notifications"
                  }
                >
                  <Bell className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {alerts.length === 0 ? (
                  <DropdownMenuItem className="text-sm text-muted-foreground">
                    No notices yet.
                  </DropdownMenuItem>
                ) : (
                  alerts.slice(0, 8).map((notice) => (
                    <DropdownMenuItem
                      key={notice.id}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <span className="font-semibold text-primary">{notice.title}</span>
                      <span className="text-xs leading-5 text-muted-foreground">
                        {notice.detail}
                      </span>
                      <span className="text-[11px] text-secondary">{notice.time}</span>
                    </DropdownMenuItem>
                  ))
                )}
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
