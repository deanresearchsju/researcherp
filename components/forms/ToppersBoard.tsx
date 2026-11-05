"use client";

import { Award, Crown, Medal, Trophy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type PublicTopper = {
  name: string;
  department: string;
  count: number;
  rank: number;
};
export type PublicToppers = {
  overall: PublicTopper[];
  departments: { department: string; toppers: PublicTopper[] }[];
};

/** Gold, silver and bronze, by rank. */
const medal: Record<number, { ring: string; face: string; label: string }> = {
  1: {
    ring: "ring-amber-300",
    face: "bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 text-amber-950",
    label: "Gold",
  },
  2: {
    ring: "ring-slate-300",
    face: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-900",
    label: "Silver",
  },
  3: {
    ring: "ring-orange-300",
    face: "bg-gradient-to-br from-orange-200 via-amber-600 to-orange-800 text-orange-50",
    label: "Bronze",
  },
};

export function MedalBadge({
  rank,
  size = "md",
}: {
  rank: number;
  size?: "sm" | "md" | "lg";
}) {
  const style = medal[rank] ?? medal[3];
  const Icon = rank === 1 ? Crown : rank === 2 ? Trophy : Medal;
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full shadow-lift ring-4",
        style.ring,
        style.face,
        size === "lg" ? "size-16" : size === "md" ? "size-11" : "size-8",
      )}
      title={`${style.label} · rank ${rank}`}
    >
      <Icon
        className={size === "lg" ? "size-7" : size === "md" ? "size-5" : "size-4"}
        aria-hidden="true"
      />
      <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-card text-[0.65rem] font-bold text-primary shadow-card">
        {rank}
      </span>
    </span>
  );
}

/**
 * The research toppers: the university's top three with large medals, and each department's top
 * three. Counts are of Checked & Approved publications and patents.
 */
export function ToppersBoard({ toppers }: { toppers: PublicToppers }) {
  const [department, setDepartment] = useState(toppers.departments[0]?.department ?? "");
  if (toppers.overall.length === 0) return null;
  const chosen = toppers.departments.find((item) => item.department === department);
  // The podium order: 2nd, 1st, 3rd, as on a winners' stand.
  const podium = [2, 1, 3]
    .flatMap((rank) => toppers.overall.filter((person) => person.rank === rank))
    .slice(0, 5);

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-b from-amber-50 to-card p-4 shadow-card sm:p-6 dark:from-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-xl text-primary">
          <Award className="size-5 text-amber-500" aria-hidden="true" /> Research toppers
        </h3>
        <p className="text-xs text-muted-foreground">
          Checked &amp; Approved publications and patents
        </p>
      </div>

      <ol
        className="mt-5 flex flex-wrap items-end justify-center gap-4 sm:gap-8"
        aria-label="University toppers"
      >
        {podium.map((person) => (
          <li
            key={`${person.rank}-${person.name}`}
            className={cn(
              "flex w-40 flex-col items-center text-center",
              person.rank === 1 ? "order-none sm:-translate-y-3" : "",
            )}
          >
            <MedalBadge rank={person.rank} size={person.rank === 1 ? "lg" : "md"} />
            <p className="mt-3 line-clamp-2 font-semibold text-primary">{person.name}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {person.department}
            </p>
            <p className="mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
              {person.count} approved
            </p>
          </li>
        ))}
      </ol>

      {toppers.departments.length > 0 ? (
        <div className="mt-6 border-t border-amber-300/40 pt-4">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-primary">Department toppers</span>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              aria-label="Department"
              className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
            >
              {toppers.departments.map((item) => (
                <option key={item.department} value={item.department}>
                  {item.department}
                </option>
              ))}
            </select>
          </label>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {(chosen?.toppers ?? []).map((person) => (
              <li
                key={`${person.rank}-${person.name}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <MedalBadge rank={person.rank} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-primary">
                    {person.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {person.count} approved
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The toppers in one compact strip, for the top of a signed-in faculty member's page: the
 * university's top three, and the top three of the faculty member's own department.
 */
export function ToppersStrip({
  toppers,
  department,
}: {
  toppers: PublicToppers;
  department?: string;
}) {
  if (toppers.overall.length === 0) return null;
  const own = toppers.departments.find(
    (item) => item.department.toLowerCase() === (department ?? "").trim().toLowerCase(),
  );
  const row = (people: PublicTopper[]) =>
    people.slice(0, 3).map((person) => (
      <li
        key={`${person.rank}-${person.name}`}
        className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-300/40 bg-card/80 py-1 pr-2.5 pl-1"
      >
        <MedalBadge rank={person.rank} size="sm" />
        <span className="min-w-0">
          <span className="block max-w-40 truncate text-xs font-semibold text-primary">
            {person.name}
          </span>
          <span className="text-[0.65rem] text-muted-foreground tabular-nums">
            {person.count} approved
          </span>
        </span>
      </li>
    ));

  return (
    <section
      aria-label="Research toppers"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-card px-3 py-2 shadow-card dark:from-amber-950/20"
    >
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-primary">
        <Award className="size-4 text-amber-500" aria-hidden="true" /> Research toppers
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.68rem] font-semibold text-muted-foreground uppercase">
          University
        </span>
        <ol className="flex flex-wrap gap-2">{row(toppers.overall)}</ol>
      </div>
      {own && own.toppers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.68rem] font-semibold text-muted-foreground uppercase">
            Department
          </span>
          <ol className="flex flex-wrap gap-2">{row(own.toppers)}</ol>
        </div>
      ) : null}
    </section>
  );
}
