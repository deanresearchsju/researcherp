"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { primaryNav } from "@/data/navigation";
import { roleProfiles } from "@/data/roles";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const loginRoles: Role[] = ["scholar", "supervisor", "admin"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn("sticky top-0 z-40 border-b border-border bg-card", scrolled && "shadow-card")}
    >
      <div className="bg-primary text-primary-foreground">
        <nav
          aria-label="Portal sign-in"
          className="mx-auto flex h-9 w-full max-w-7xl items-stretch justify-end px-4 text-xs sm:px-6 sm:text-sm lg:px-8"
        >
          <span className="mr-auto hidden items-center font-semibold tracking-[0.16em] text-primary-foreground/80 uppercase sm:inline-flex">
            Sign in
          </span>
          {loginRoles.map((role, index) => (
            <Link
              key={role}
              href={`/login/${role}`}
              className={cn(
                "inline-flex items-center px-3 sm:px-4",
                index > 0 && "border-l border-primary-foreground/25",
                "hover:bg-purple-deep hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              {roleProfiles[role].label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto flex h-[4.75rem] w-full max-w-7xl items-stretch gap-6 px-4 sm:h-[5.5rem] sm:px-6 lg:gap-10 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center self-center">
          <Logo
            priority
            className="h-14 w-auto sm:h-16 lg:h-[4.25rem]"
            alt="St. Joseph University, home"
          />
        </Link>
        <nav aria-label="Primary" className="ml-auto hidden h-full xl:block">
          <ul className="flex h-full items-stretch">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="flex">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center border-b-[3px] px-3.5 text-sm whitespace-nowrap xl:px-4",
                      active
                        ? "border-gold-ink font-semibold text-gold-ink"
                        : "border-transparent font-medium text-foreground hover:border-primary/25 hover:text-gold-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="ml-auto size-10 self-center rounded-lg border-border xl:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent title="Menu">
            <nav aria-label="Mobile">
              <ul className="overflow-hidden rounded-xl border border-border">
                {primaryNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href} className="border-b border-border last:border-b-0">
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center border-l-[3px] px-4 py-3 text-sm font-medium",
                            active
                              ? "border-gold-ink bg-muted font-semibold text-gold-ink"
                              : "border-transparent text-foreground hover:bg-muted",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-6 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Sign in
              </p>
              <ul className="mt-2 overflow-hidden rounded-xl border border-border">
                {loginRoles.map((role) => (
                  <li key={role} className="border-b border-border last:border-b-0">
                    <SheetClose asChild>
                      <Link
                        href={`/login/${role}`}
                        className="flex items-center px-4 py-3 text-sm font-medium text-primary hover:bg-muted"
                      >
                        {roleProfiles[role].label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
