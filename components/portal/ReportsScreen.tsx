"use client";

import {
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  IndianRupee,
  Layers,
  ListChecks,
  type LucideIcon,
  Presentation,
  ShieldAlert,
  UserCog,
  Users,
} from "lucide-react";
import { useState } from "react";

import { PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { alertsOf, batchNames, type ScholarReport } from "@/lib/scholar-report";
import { sameGuide } from "@/lib/register";
import type { GuideOption } from "@/lib/supervision";
import { useScholarReports } from "@/lib/use-report-sources";
import { cn } from "@/lib/utils";

type Table = { headers: string[]; rows: string[][] };

type ReportDefinition = {
  id: string;
  group: "Scholars" | "Supervisors" | "Progress" | "Compliance";
  title: string;
  icon: LucideIcon;
  build: (rows: readonly ScholarReport[], guides: readonly GuideOption[]) => Table;
};

const n = (value: number) => String(value);
const count = (rows: readonly ScholarReport[], test: (row: ScholarReport) => boolean) =>
  n(rows.filter(test).length);
const done = (value: string) =>
  value.startsWith("Approved") || value.startsWith("Completed");

function bySupervisor(rows: readonly ScholarReport[]) {
  return [...rows].sort(
    (a, b) => a.guideName.localeCompare(b.guideName) || a.name.localeCompare(b.name),
  );
}

const reports: ReportDefinition[] = [
  {
    id: "master",
    group: "Scholars",
    title: "Scholar master list",
    icon: Users,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Registration No.",
        "Batch",
        "Subject",
        "Mode",
        "Supervisor",
        "Semester",
        "Email",
        "Phone",
      ],
      rows: rows.map((row) => [
        row.name,
        row.registration,
        row.batchName,
        row.subject,
        row.mode,
        row.guideName,
        row.semester ? n(row.semester) : "",
        row.email,
        row.phone,
      ]),
    }),
  },
  {
    id: "supervisor-scholars",
    group: "Supervisors",
    title: "Supervisor-wise scholar list",
    icon: UserCog,
    build: (rows, guides) => ({
      headers: [
        "Supervisor",
        "Designation",
        "Supervisor subject",
        "Scholar",
        "Registration No.",
        "Batch",
        "Mode",
        "Stage",
      ],
      rows: bySupervisor(rows).map((row) => {
        const guide = guides.find((item) => sameGuide(item.name, row.guideName));
        return [
          row.guideName || "Not allotted",
          guide?.designation ?? "",
          guide?.subject ?? "",
          row.name,
          row.registration,
          row.batchName,
          row.mode,
          row.stage,
        ];
      }),
    }),
  },
  {
    id: "supervisor-summary",
    group: "Supervisors",
    title: "Scholars vs supervisors",
    icon: Layers,
    build: (rows, guides) => {
      const names = [
        ...new Set([
          ...guides.map((guide) => guide.name),
          ...rows.map((row) => row.guideName),
        ]),
      ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return {
        headers: [
          "Supervisor",
          "Designation",
          "Subject",
          "Status",
          "Seats free",
          "Scholars",
          "Full time",
          "Part time",
          "Scholar names",
        ],
        rows: names
          .map((name) => {
            const guide = guides.find((item) => sameGuide(item.name, name));
            const mine = rows.filter((row) => sameGuide(row.guideName, name));
            return [
              name,
              guide?.designation ?? "",
              guide?.subject ?? "",
              guide?.status ?? "",
              guide?.vacancy === null || guide?.vacancy === undefined
                ? ""
                : n(guide.vacancy),
              n(mine.length),
              count(mine, (row) => row.mode === "Full time"),
              count(mine, (row) => row.mode === "Part time"),
              mine.map((row) => row.name).join("; "),
            ];
          })
          .filter((row) => row[5] !== "0" || row[3] === "Active"),
      };
    },
  },
  {
    id: "progress",
    group: "Progress",
    title: "Scholar progress report",
    icon: ClipboardList,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Registration No.",
        "Batch",
        "Mode",
        "Supervisor",
        "Stage",
        "Semester",
        "Course work (passed/papers)",
        "First DC",
        "Confirmation",
        "Third DC",
        "RAC",
        "Six-month (approved/due)",
        "Colloquium (attended/min)",
        "Publications",
        "Synopsis",
        "Thesis",
        "Viva",
      ],
      rows: rows.map((row) => [
        row.name,
        row.registration,
        row.batchName,
        row.mode,
        row.guideName,
        row.stage,
        row.semester ? n(row.semester) : "",
        `${row.coursePassed}/${row.coursePapers}`,
        row.firstDc,
        row.confirmation,
        row.thirdDc,
        row.rac,
        `${row.sixMonthApproved}/${row.sixMonthDue}`,
        `${row.colloquium.attended}/${row.colloquium.required}`,
        n(row.publications),
        row.synopsis,
        row.thesis,
        row.viva,
      ]),
    }),
  },
  {
    id: "batch-progress",
    group: "Progress",
    title: "Batch-wise progress summary",
    icon: GraduationCap,
    build: (rows) => ({
      headers: [
        "Batch",
        "Scholars",
        "Full time",
        "Part time",
        "First DC done",
        "Confirmed",
        "RAC constituted",
        "Colloquium met",
        "Six-month up to date",
        "Synopsis",
        "Thesis",
        "Viva passed",
        "Fee due",
      ],
      rows: batchNames()
        .map((batch) => {
          const mine = rows.filter((row) => row.batchName === batch);
          return [
            batch,
            n(mine.length),
            count(mine, (row) => row.mode === "Full time"),
            count(mine, (row) => row.mode === "Part time"),
            count(mine, (row) => done(row.firstDc)),
            count(mine, (row) => done(row.confirmation)),
            count(mine, (row) => row.rac === "Constituted"),
            count(mine, (row) => row.colloquium.met),
            count(mine, (row) => row.sixMonthApproved >= row.sixMonthDue),
            count(mine, (row) => row.synopsis !== "Not started"),
            count(mine, (row) => row.thesis !== "Not started"),
            count(mine, (row) => row.viva.startsWith("Passed")),
            count(mine, (row) => row.feeBalance > 0),
          ];
        })
        .filter((row) => row[1] !== "0"),
    }),
  },
  {
    id: "supervisor-progress",
    group: "Supervisors",
    title: "Supervisor-wise progress summary",
    icon: ListChecks,
    build: (rows) => {
      const names = [...new Set(rows.map((row) => row.guideName).filter(Boolean))].sort();
      return {
        headers: [
          "Supervisor",
          "Scholars",
          "First DC done",
          "Confirmed",
          "RAC constituted",
          "Six-month pending",
          "Colloquium at risk",
          "Synopsis",
          "Thesis",
          "Viva passed",
        ],
        rows: names.map((name) => {
          const mine = rows.filter((row) => row.guideName === name);
          return [
            name,
            n(mine.length),
            count(mine, (row) => done(row.firstDc)),
            count(mine, (row) => done(row.confirmation)),
            count(mine, (row) => row.rac === "Constituted"),
            count(mine, (row) => row.sixMonthApproved < row.sixMonthDue),
            count(mine, (row) => row.colloquium.status === "At risk"),
            count(mine, (row) => row.synopsis !== "Not started"),
            count(mine, (row) => row.thesis !== "Not started"),
            count(mine, (row) => row.viva.startsWith("Passed")),
          ];
        }),
      };
    },
  },
  {
    id: "course-work",
    group: "Progress",
    title: "Course work & semester",
    icon: BookOpenCheck,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Registration No.",
        "Batch",
        "Semester",
        "Papers registered",
        "Passed",
        "Arrears",
        "Supervisor",
      ],
      rows: rows.map((row) => [
        row.name,
        row.registration,
        row.batchName,
        row.semester ? n(row.semester) : "",
        n(row.coursePapers),
        n(row.coursePassed),
        n(row.courseArrears),
        row.guideName,
      ]),
    }),
  },
  {
    id: "committees",
    group: "Progress",
    title: "Doctoral committees & RAC",
    icon: Users,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Batch",
        "Supervisor",
        "RAC",
        "First DC",
        "Confirmation",
        "Third DC",
      ],
      rows: rows.map((row) => [
        row.name,
        row.batchName,
        row.guideName,
        row.rac,
        row.firstDc,
        row.confirmation,
        row.thirdDc,
      ]),
    }),
  },
  {
    id: "six-month",
    group: "Compliance",
    title: "Six-month report compliance",
    icon: ClipboardList,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Batch",
        "Supervisor",
        "Due so far",
        "Approved",
        "Pending",
        "Status",
      ],
      rows: rows.map((row) => {
        const pending = Math.max(row.sixMonthDue - row.sixMonthApproved, 0);
        return [
          row.name,
          row.batchName,
          row.guideName,
          n(row.sixMonthDue),
          n(row.sixMonthApproved),
          n(pending),
          pending === 0 ? "Up to date" : "Pending",
        ];
      }),
    }),
  },
  {
    id: "colloquium",
    group: "Compliance",
    title: "Colloquium attendance",
    icon: Presentation,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Batch",
        "Mode",
        "Supervisor",
        "Attended",
        "Absent",
        "Minimum",
        "Status",
      ],
      rows: rows.map((row) => [
        row.name,
        row.batchName,
        row.mode,
        row.guideName,
        n(row.colloquium.attended),
        n(row.colloquium.absent),
        `${row.colloquium.required} of ${row.colloquium.total}`,
        row.colloquium.status,
      ]),
    }),
  },
  {
    id: "thesis",
    group: "Progress",
    title: "Synopsis, thesis & viva",
    icon: GraduationCap,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Batch",
        "Supervisor",
        "Publications",
        "Plagiarism",
        "Synopsis",
        "Thesis",
        "Viva",
      ],
      rows: rows.map((row) => [
        row.name,
        row.batchName,
        row.guideName,
        n(row.publications),
        row.plagiarism,
        row.synopsis,
        row.thesis,
        row.viva,
      ]),
    }),
  },
  {
    id: "fee",
    group: "Compliance",
    title: "Fee paid & balance",
    icon: IndianRupee,
    build: (rows) => ({
      headers: [
        "Scholar",
        "Registration No.",
        "Batch",
        "Mode",
        "Paid (₹)",
        "Balance (₹)",
        "Status",
      ],
      rows: rows.map((row) => [
        row.name,
        row.registration,
        row.batchName,
        row.mode,
        row.feePaid.toLocaleString("en-IN"),
        row.feeBalance.toLocaleString("en-IN"),
        row.feeBalance > 0 ? "Due" : "Paid",
      ]),
    }),
  },
  {
    id: "subjects",
    group: "Scholars",
    title: "Subject-wise distribution",
    icon: Layers,
    build: (rows) => {
      const subjects = [
        ...new Set(rows.map((row) => row.subject || "Not recorded")),
      ].sort();
      return {
        headers: ["Subject", "Scholars", "Full time", "Part time", "Supervisors"],
        rows: subjects.map((subject) => {
          const mine = rows.filter((row) => (row.subject || "Not recorded") === subject);
          return [
            subject,
            n(mine.length),
            count(mine, (row) => row.mode === "Full time"),
            count(mine, (row) => row.mode === "Part time"),
            n(new Set(mine.map((row) => row.guideName).filter(Boolean)).size),
          ];
        }),
      };
    },
  },
  {
    id: "alerts",
    group: "Compliance",
    title: "Pending actions & alerts",
    icon: ShieldAlert,
    build: (rows) => ({
      headers: ["Scholar", "Batch", "Supervisor", "Alerts", "Count"],
      rows: rows
        .map((row) => ({ row, alerts: alertsOf(row) }))
        .filter((item) => item.alerts.length > 0)
        .sort((a, b) => b.alerts.length - a.alerts.length)
        .map(({ row, alerts }) => [
          row.name,
          row.batchName,
          row.guideName,
          alerts.join("; "),
          n(alerts.length),
        ]),
    }),
  },
];

const groups = ["Scholars", "Supervisors", "Progress", "Compliance"] as const;

export function ReportsScreen() {
  const data = useScholarReports();
  const [active, setActive] = useState(reports[0].id);
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("");
  const [guide, setGuide] = useState("");
  const [mode, setMode] = useState("");
  const [subject, setSubject] = useState("");

  if (!data.ready)
    return <p className="text-sm text-muted-foreground">Loading reports…</p>;

  const definition = reports.find((item) => item.id === active) ?? reports[0];
  const scoped = data.reports.filter(
    (row) =>
      filterMatches(batch, row.batchName) &&
      filterMatches(guide, row.guideName) &&
      filterMatches(mode, row.mode) &&
      filterMatches(subject, row.subject),
  );
  const table = definition.build(scoped, data.guides);
  const visible = table.rows.filter((row) => textMatches(query, row));
  const option = (values: readonly string[]) =>
    [...new Set(values.filter(Boolean))].sort().map((value) => ({ value, label: value }));
  const filterLabel = [batch, guide, mode, subject]
    .filter(Boolean)
    .map((value) => value.split("\u001f").join(", "))
    .join(" · ");

  return (
    <section className="space-y-5">
      <PageTitle kicker="Center for Research" title="Reports" />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Active scholars", n(data.reports.length)],
          [
            "Supervisors with scholars",
            n(new Set(data.reports.map((row) => row.guideName).filter(Boolean)).size),
          ],
          [
            "Colloquium at risk",
            count(data.reports, (row) => row.colloquium.status === "At risk"),
          ],
          [
            "Scholars with alerts",
            n(data.reports.filter((row) => alertsOf(row).length > 0).length),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Reports" className="space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1 px-2 text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
                {group}
              </p>
              <ul className="space-y-1">
                {reports
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-readonly-allow
                          onClick={() => {
                            setActive(item.id);
                            setQuery("");
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                            active === item.id
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "text-primary hover:bg-muted",
                          )}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          {item.title}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold text-primary">{definition.title}</h2>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "batch",
                label: "Batch",
                value: batch,
                options: batchNames()
                  .filter((name) => data.reports.some((row) => row.batchName === name))
                  .map((name) => ({ value: name, label: name })),
                onChange: setBatch,
              },
              {
                id: "guide",
                label: "Supervisor",
                value: guide,
                options: option(data.reports.map((row) => row.guideName)),
                onChange: setGuide,
              },
              {
                id: "mode",
                label: "Mode",
                value: mode,
                options: option(["Full time", "Part time"]),
                onChange: setMode,
              },
              {
                id: "subject",
                label: "Subject",
                value: subject,
                options: option(data.reports.map((row) => row.subject)),
                onChange: setSubject,
              },
            ]}
            shown={visible.length}
            total={table.rows.length}
            filename={`${definition.id}.csv`}
            title={`${definition.title}${filterLabel ? ` · ${filterLabel}` : ""}`}
            headers={table.headers}
            rows={visible}
          />
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">S. No.</th>
                  {table.headers.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2.5 font-semibold whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={table.headers.length + 1}
                      className="px-3 py-4 text-muted-foreground"
                    >
                      Nothing matches these filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((row, index) => (
                    <tr key={index} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={cn(
                            "px-3 py-2",
                            cellIndex === 0 && "font-medium text-primary",
                            cell.length > 40 ? "min-w-[16rem]" : "whitespace-nowrap",
                          )}
                        >
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
