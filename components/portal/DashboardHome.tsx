"use client";

import { portalIntro, portalNav } from "@/data/portal";
import { usePreviewSession } from "@/lib/use-preview-session";
import type { Role } from "@/types";

export function DashboardHome({ role }: { role: Role }) {
  const intro = portalIntro[role];
  const session = usePreviewSession();

  const greeting =
    session && session.role === role
      ? `Signed in as ${session.name.trim() || session.identifier}.`
      : "";

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        {intro.title}
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">{intro.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {intro.summary}
      </p>
      {greeting ? <p className="mt-2 text-sm text-foreground">{greeting}</p> : null}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {portalNav[role]
          .filter((item) => !item.ready)
          .map((item) => (
            <li
              key={item.label}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <h2 className="font-semibold text-primary">{item.label}</h2>
            </li>
          ))}
      </ul>
    </div>
  );
}
