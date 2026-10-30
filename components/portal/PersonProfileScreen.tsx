"use client";

import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonalDetailsPanel } from "@/components/portal/PersonalDetailsPanel";
import { ProfileCard } from "@/components/portal/ProfileCard";
import { personFileCopy } from "@/data/person-file";
import { roleProfiles } from "@/data/roles";
import { visibleGroups } from "@/lib/access";
import { openOfficeView } from "@/lib/office-view";
import { usePreviewSession } from "@/lib/use-preview-session";

function PersonMenus({
  role,
  identifier,
  name,
}: {
  role: "scholar" | "supervisor";
  identifier: string;
  name: string;
}) {
  const router = useRouter();
  const groups = visibleGroups(role, null, true);

  function open(href: string) {
    openOfficeView({
      role,
      name,
      identifier,
      returnTo: `${window.location.pathname}${window.location.search}`,
    });
    router.push(href);
  }

  return (
    <nav
      aria-label={`${name}'s ${roleProfiles[role].label.toLowerCase()} menus`}
      className="rounded-2xl border border-border bg-card p-3 shadow-card"
    >
      <p className="px-2 text-[0.65rem] font-extrabold tracking-[0.2em] text-muted-foreground uppercase">
        {roleProfiles[role].label} menus
      </p>
      <p className="mt-1 px-2 text-xs leading-5 text-muted-foreground">
        Opens {name}&apos;s portal for reading.
      </p>
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.heading || "dashboard"}>
            {group.heading ? (
              <p className="px-2 text-[0.62rem] font-bold tracking-[0.16em] text-secondary uppercase">
                {group.heading}
              </p>
            ) : null}
            <ul className="mt-1 space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <button
                    type="button"
                    data-readonly-allow
                    onClick={() => open(item.href)}
                    className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-primary"
                  >
                    {item.href.endsWith("/dashboard") ? (
                      <LayoutDashboard className="size-4" aria-hidden="true" />
                    ) : null}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function PersonProfileScreen({
  role,
  identifier,
  name,
}: {
  role: "scholar" | "supervisor";
  identifier: string;
  name: string;
}) {
  const label = name.trim() || identifier;
  const session = usePreviewSession();
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <PersonMenus role={role} identifier={identifier} name={label} />
      </aside>
      <div className="min-w-0 space-y-4">
        <header>
          <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
            {personFileCopy.viewProfile}
          </p>
          <h1 className="mt-2 font-heading text-3xl text-primary">{label}</h1>
          {session?.role === "admin" ? (
            <Link
              href={`/admin/audit?person=${encodeURIComponent(identifier)}`}
              className="mt-1 inline-block text-sm font-semibold text-secondary hover:underline"
            >
              See everything this {role} did and everything done for them (audit trail)
            </Link>
          ) : null}
        </header>
        <ProfileCard role={role} identifier={identifier} name={label} />
        <PersonalDetailsPanel role={role} identifier={identifier} name={label} />
      </div>
    </div>
  );
}
