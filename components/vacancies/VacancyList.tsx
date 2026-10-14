"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Container } from "@/components/ui/container";
import { vacancyListColumns, vacancyListNote, vacancyListTitle } from "@/data/vacancies";
import { groupVacancies, type Vacancy } from "@/lib/vacancies";
import { cn } from "@/lib/utils";
import type { School } from "@/types";

export function VacancyList({
  rows,
  schools,
}: {
  rows: Vacancy[];
  schools?: readonly School[];
}) {
  const groups = groupVacancies(rows, schools);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(groups.map((group) => group.school)),
  );

  function toggle(school: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(school)) next.delete(school);
      else next.add(school);
      return next;
    });
  }

  return (
    <Container className="py-10">
      <h1 className="font-heading text-3xl font-semibold text-primary sm:text-4xl">
        {vacancyListTitle}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{vacancyListNote}</p>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {groups.map((group) => {
          const expanded = open.has(group.school);
          return (
            <section key={group.school} className="border-t border-border first:border-t-0">
              <h2>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 bg-primary/5 px-4 py-3 text-left font-semibold text-primary"
                  aria-expanded={expanded}
                  onClick={() => toggle(group.school)}
                >
                  {group.school}
                  <ChevronDown
                    className={cn("size-4 shrink-0", expanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              </h2>
              {expanded ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                    <thead className="bg-muted text-primary">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {vacancyListColumns.name}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {vacancyListColumns.designation}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {vacancyListColumns.researchArea}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {vacancyListColumns.vacancy}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="px-4 py-3 align-top font-semibold text-primary">
                            {row.supervisorName}
                          </td>
                          <td className="px-4 py-3 align-top text-muted-foreground">
                            {row.designation}
                          </td>
                          <td className="px-4 py-3 align-top">{row.researchArea}</td>
                          <td className="px-4 py-3 align-top font-semibold">
                            {row.vacancyCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </Container>
  );
}
