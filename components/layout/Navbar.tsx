"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { portalBarLabel, primaryNav } from "@/data/navigation";
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 shadow-card backdrop-blur-xl">
      <div className="bg-primary text-primary-foreground">
        <nav
          aria-label="Portal sign-in"
          className="mx-auto flex h-10 w-full max-w-7xl items-stretch justify-end px-4 text-xs sm:px-6 sm:text-sm lg:px-8"
        >
          <span className="mr-auto hidden items-center gap-2 font-semibold tracking-[0.16em] text-primary-foreground/70 uppercase sm:inline-flex">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {portalBarLabel}
          </span>
          {loginRoles.map((role) => (
            <Link
              key={role}
              href={`/login/${role}`}
              className="group flex items-center gap-2 border-l border-primary-foreground/15 px-3 font-semibold text-primary-foreground/85 hover:bg-purple-deep hover:text-primary-foreground sm:px-5"
            >
              {roleProfiles[role].label}
              <ArrowRight
                className="size-3 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-6 px-4 sm:h-24 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo
            priority
            className="h-14 w-auto sm:h-16 lg:h-[4.25rem]"
            alt="St. Joseph University, home"
          />
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden xl:block">
          <ul className="flex items-center gap-1 rounded-2xl border border-border bg-muted p-1.5">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold transition xl:px-4",
                      active
                        ? "bg-primary text-primary-foreground shadow-card"
                        : "text-foreground hover:bg-card hover:text-primary hover:shadow-card",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="ml-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card transition hover:bg-purple-deep focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none xl:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <nav
          className="border-t border-border bg-card px-4 py-4 shadow-lift xl:hidden"
          aria-label="Mobile"
        >
          <div className="mx-auto grid max-w-7xl gap-1.5">
            {primaryNav.map((item, index) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "bg-muted text-foreground hover:bg-muted/80 hover:text-primary",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-[0.65rem] font-bold tracking-wider",
                        active ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </span>
                  <ArrowRight
                    className="size-4 transition group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
