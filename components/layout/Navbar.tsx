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
      className={cn(
        "sticky top-0 z-40 bg-white",
        scrolled ? "shadow-card" : "border-b border-border",
      )}
    >
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex h-9 w-full max-w-7xl items-center justify-end gap-3 px-4 text-xs sm:gap-5 sm:px-6 sm:text-sm lg:px-8">
          {loginRoles.map((role) => (
            <Link key={role} href={`/login/${role}`} className="hover:text-accent">
              {roleProfiles[role].label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto flex h-[4.25rem] w-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:gap-10 lg:px-8">
        <Link href="/" className="shrink-0">
          <Logo priority className="h-11 w-auto sm:h-12" alt="St. Joseph University, home" />
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-4 xl:gap-7">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "text-sm font-medium whitespace-nowrap",
                      active
                        ? "font-semibold text-gold-ink"
                        : "text-foreground hover:text-gold-ink",
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
              className="ml-auto lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent title="Menu">
            <nav aria-label="Mobile">
              <ul className="space-y-1">
                {primaryNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-lg px-3 py-2.5 text-sm font-medium",
                            active
                              ? "font-semibold text-gold-ink"
                              : "text-foreground hover:bg-muted",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
