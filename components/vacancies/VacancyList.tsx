"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Container } from "@/components/ui/container";
import { vacancyListNote, vacancyListTitle } from "@/data/vacancies";
import { groupVacancies, type Vacancy } from "@/lib/vacancies";
import { cn } from "@/lib/utils";

export function VacancyList({ rows }: { rows: Vacancy[] }) {
  const groups = groupVacancies(rows);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(department: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(department)) next.delete(department);
      else next.add(department);
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
          const expanded = open.has(group.department);
          return (
            <section key={group.department} className="border-t border-border first:border-t-0">
              <h2>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 bg-primary/5 px-4 py-3 text-left font-semibold text-primary"
                  aria-expanded={expanded}
                  onClick={() => toggle(group.department)}
                >
                  Department of {group.department}
                  <ChevronDown
                    className={cn("size-4 shrink-0", expanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              </h2>
              {expanded ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                    <thead className="bg-muted text-primary">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          S. No.
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Name of the Supervisor, Designation, Department
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Area of Research
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          No. of Vacancy
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="px-4 py-3 align-top">{row.serialNo}</td>
                          <td className="px-4 py-3 align-top">
                            <span className="font-semibold text-primary">
                              {row.supervisorName}
                            </span>
                            <span className="mt-1 block text-muted-foreground">
                              {row.designation}
                            </span>
                            <span className="mt-1 block text-muted-foreground">
                              Department of {row.department}
                            </span>
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
