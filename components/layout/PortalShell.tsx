"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { notices, portalNav } from "@/data/portal";
import { roleProfiles } from "@/data/roles";
import { clearPreviewSession } from "@/lib/auth";
import { usePreviewSession } from "@/lib/use-preview-session";
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
  onNavigate,
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={`${roleProfiles[role].label} portal`}>
      <ul className="space-y-1">
        {portalNav[role].map((item) =>
          item.ready ? (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "block rounded-xl px-3 py-2.5 text-sm font-semibold",
                  isCurrent(pathname, item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
                aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ) : (
            <li key={item.label}>
              <span
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground"
                aria-disabled="true"
              >
                {item.label}
                <span className="text-[10px] font-semibold tracking-wide uppercase">
                  Soon
                </span>
              </span>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = roleFromPath(pathname);
  const session = usePreviewSession();

  function signOut() {
    clearPreviewSession();
    router.push(`/login/${role}`);
  }

  const identity =
    session && session.role === role
      ? session.name.trim() || session.identifier
      : roleProfiles[role].label;

  return (
    <div className="min-h-screen bg-background">
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
          <SheetContent title={roleProfiles[role].label}>
            <SideNav role={role} pathname={pathname} />
          </SheetContent>
        </Sheet>
        <Link href={`/${role}/dashboard`} className="rounded-lg">
          <Logo className="h-10 w-auto" alt="St. Joseph University, dashboard" />
        </Link>
        <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline">
          {roleProfiles[role].label}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Notifications, 2 unread">
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
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-white p-4 md:block">
          <SideNav role={role} pathname={pathname} />
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
