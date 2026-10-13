"use client";

import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { notices } from "@/data/portal";
import { roleProfiles } from "@/data/roles";
import { canOpenMenu, effectiveMenus, visibleGroups } from "@/lib/access";
import { clearPreviewSession } from "@/lib/auth";
import { closeOfficeView, isOfficeAction } from "@/lib/office-view";
import { useOfficeView, usePreviewSession } from "@/lib/use-preview-session";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

function roleFromPath(pathname: string): Role {
  if (pathname.startsWith("/supervisor")) return "supervisor";
  if (pathname.startsWith("/admin")) return "admin";
  return "scholar";
}

function isCurrent(pathname: string, href: string) {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <nav aria-label={`${roleProfiles[role].label} portal`} className="space-y-1">
      {groups.map((group) => {
        const active = group.items.some((item) => isCurrent(pathname, item.href));
        const open = active ? !collapsed.has(group.heading) : expanded.has(group.heading);
        return (
          <div key={group.heading}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase hover:bg-muted"
              aria-expanded={open}
              onClick={() => toggle(group.heading, active)}
            >
              {group.heading}
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {open ? (
              <ul className="mb-2 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm",
                        isCurrent(pathname, item.href)
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground hover:bg-muted",
                      )}
                      aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ready = useClientReady();
  const pathRole = roleFromPath(pathname);
  const session = usePreviewSession();
  const view = useOfficeView();
  const [viewNotice, setViewNotice] = useState<string | null>(null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const viewing =
    ready &&
    session?.role === "admin" &&
    view !== null &&
    ((view.role === "scholar" && pathname.startsWith("/scholar")) ||
      (view.role === "supervisor" && pathname.startsWith("/supervisor")));
  const role = viewing && view ? view.role : pathRole;
  const account =
    session && users
      ? users.users.find(
          (user) =>
            user.role === session.role &&
            user.identifier.toLowerCase() === session.identifier.toLowerCase(),
        )
      : undefined;
  const menus = viewing || !users ? null : effectiveMenus(account);
  const groups = visibleGroups(role, menus);
  const allowed = !users || viewing || canOpenMenu(pathname, role, menus);

  useEffect(() => {
    if (ready && session?.mustReset && !viewing) router.replace("/login/reset");
  }, [ready, session, router, viewing]);

  function signOut() {
    closeOfficeView();
    clearPreviewSession();
    router.push(`/login/${pathRole}`);
  }

  function leaveView() {
    const back = view?.role === "supervisor" ? "/admin/supervisors" : "/admin/register";
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
      const label = control.textContent ?? "";
      if (control.type === "submit" || isOfficeAction(label)) {
        event.preventDefault();
        event.stopPropagation();
        setViewNotice(
          "This page is open for reading. The office cannot submit or approve here.",
        );
      }
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

  if (ready && session?.mustReset) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-white md:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
          <Link href={`/${role}/dashboard`} className="rounded-lg">
            <Logo className="h-9 w-auto" alt="St. Joseph University, dashboard" />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <SideNav role={role} pathname={pathname} groups={groups} />
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-white px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open portal menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title={roleProfiles[role].label} side="left">
              <SideNav role={role} pathname={pathname} groups={groups} />
            </SheetContent>
          </Sheet>
          <Link href={`/${role}/dashboard`} className="rounded-lg md:hidden">
            <Logo className="h-10 w-auto" alt="St. Joseph University, dashboard" />
          </Link>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {roleProfiles[role].label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Notifications, 2 unread"
                >
                  <Bell className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {notices.map((notice) => (
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
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">
              {identity}
            </span>
            {viewing ? (
              <Button variant="outline" size="sm" onClick={leaveView}>
                Back to register
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
          className="min-w-0 p-4 sm:p-8"
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
                Your sign-in does not include this menu. Ask the research office to open
                it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
