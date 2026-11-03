"use client";

import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Clock,
  FolderKanban,
  IndianRupee,
  PencilLine,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { MedalBadge } from "@/components/forms/ToppersBoard";
import type { Standing } from "@/components/forms/PublicResearchDesk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  allRecords,
  facultySummary,
  filterRecords,
  groupRecords,
  groupingLabel,
  groupings,
  type Grouping,
  sameCategory,
  type Category,
  type DashboardFilter,
} from "@/lib/faculty-dashboard";
import {
  approvedLabel,
  balanceOf,
  displayValue,
  formatDay,
  fundingStage,
  isApproved,
  isRejected,
  isShown,
  pendingLabel,
  receivedTotal,
  recordDate,
  recordFields,
  recordTitle,
  rejectedLabel,
  rupees,
  valueText,
  type ResearchRecord,
  type ResearchValues,
} from "@/lib/faculty-research";
import { cn } from "@/lib/utils";

/** One colour per kind of work, used in the year bars, the legend and the category list. */
const partColour: Record<string, string> = {
  "Journal article": "bg-primary",
  Book: "bg-secondary",
  "Book chapter": "bg-accent",
  "Conference proceedings": "bg-purple-deep",
  Patent: "bg-gold-ink",
  "Project proposals": "bg-primary/35",
};

function categoryLabel(category: Category) {
  switch (category.kind) {
    case "all":
      return "All records";
    case "type":
    case "indexing":
      return category.value;
    case "proposals":
      return "Project proposals";
    case "approved":
      return approvedLabel;
    case "waiting":
      return pendingLabel;
    case "rejected":
      return rejectedLabel;
  }
}

function Tile({
  icon: Icon,
  label,
  value,
  detail,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "group flex h-full w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift",
          active ? "border-primary ring-2 ring-primary/20" : "border-border",
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-3xl leading-none font-semibold text-primary tabular-nums">
            {value}
          </span>
          <span className="mt-1 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          {detail ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function RecordCard({
  record,
  onEdit,
}: {
  record: ResearchRecord;
  /** Given while the record can still be changed (not yet Checked & Approved). */
  onEdit?: (record: ResearchRecord) => void;
}) {
  const v = record.values;
  const kind = record.kind;
  const fields = recordFields(kind).filter(
    (field) => isShown(field, v) && displayValue(field, v) && field.type !== "confirm",
  );
  return (
    <details className="group rounded-xl border border-border bg-card p-4 shadow-card transition open:border-primary/30">
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
            {kind === "publication"
              ? valueText(v, "type")
              : `Project · ${fundingStage(v)}`}{" "}
            · {formatDay(recordDate(kind, v))}
          </span>
          <span className="mt-1 block font-semibold text-primary">
            {recordTitle(kind, v)}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {onEdit && !isApproved(record) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                // The button sits in the card's heading: it must not open or close the card.
                event.preventDefault();
                onEdit(record);
              }}
            >
              <PencilLine className="size-4" aria-hidden="true" /> Edit
            </Button>
          ) : null}
          {isRejected(record) ? (
            <Badge variant="maroon">{rejectedLabel}</Badge>
          ) : isApproved(record) ? (
            <Badge variant="gold">
              <BadgeCheck className="mr-1 size-3.5" aria-hidden="true" />
              {approvedLabel}
            </Badge>
          ) : (
            <Badge variant="outline">
              <Clock className="mr-1 size-3.5" aria-hidden="true" />
              {pendingLabel}
            </Badge>
          )}
        </span>
      </summary>
      {isRejected(record) && record.reviewNote ? (
        <p className="mt-3 rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2 text-sm text-secondary">
          Rejected by the research office: {record.reviewNote}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.key}
            className={cn("min-w-0", field.type === "instalments" && "sm:col-span-2")}
          >
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="break-words">{displayValue(field, v)}</dd>
          </div>
        ))}
        {kind === "proposal" && valueText(v, "status") === "Accepted" ? (
          <div>
            <dt className="text-xs text-muted-foreground">Received · Balance</dt>
            <dd>
              {rupees(receivedTotal(v)) || "₹0"} · {rupees(balanceOf(v)) || "₹0"}
            </dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}

/**
 * A faculty member's own page: the saved details, figures by year and by kind of work, and the
 * records behind every figure. Click a figure, a year or a category to see its records.
 */
export function FacultyDashboard({
  profile,
  records,
  onEdit,
  standing,
}: {
  profile: ResearchValues;
  records: readonly ResearchRecord[];
  onEdit?: (record: ResearchRecord) => void;
  /** Where the faculty member stands among the research toppers (approved work only). */
  standing?: Standing | null;
}) {
  const [filter, setFilter] = useState<DashboardFilter>(allRecords);
  const [grouping, setGrouping] = useState<Grouping>("type");
  const summary = facultySummary(records);
  const shown = filterRecords(records, filter);
  const setCategory = (category: Category) =>
    setFilter((current) => ({
      ...current,
      category: sameCategory(current.category, category) ? { kind: "all" } : category,
    }));
  const is = (category: Category) => sameCategory(filter.category, category);
  const joined = valueText(profile, "joinedOn");
  const categories: {
    category: Category;
    label: string;
    count: number;
    colour?: string;
  }[] = [
    ...summary.byType.map((item) => ({
      category: { kind: "type", value: item.label } as Category,
      label: item.label,
      count: item.count,
      colour: partColour[item.label],
    })),
    ...summary.byIndexing.map((item) => ({
      category: { kind: "indexing", value: item.label } as Category,
      label: `Indexed in ${item.label}`,
      count: item.count,
    })),
  ];
  const biggest = Math.max(1, ...categories.map((item) => item.count));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-purple-deep p-5 text-primary-foreground shadow-lift sm:p-6">
        <p className="text-[0.65rem] font-bold tracking-[0.2em] uppercase opacity-80">
          Faculty research
        </p>
        <h2 className="mt-1 font-heading text-2xl sm:text-3xl">
          {valueText(profile, "facultyName")}
        </h2>
        <p className="mt-1 text-sm opacity-90">
          {[
            valueText(profile, "designation"),
            valueText(profile, "department"),
            valueText(profile, "school"),
            valueText(profile, "campus"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {joined
            ? `Joined SJU on ${formatDay(joined)}`
            : "Date of joining SJU: give it with your next record"}
        </p>
        {standing ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {standing.overall <= 3 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 py-1 pr-3 pl-1 text-xs font-semibold">
                <MedalBadge rank={standing.overall} size="sm" /> University topper · rank{" "}
                {standing.overall}
              </span>
            ) : null}
            {standing.department <= 3 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 py-1 pr-3 pl-1 text-xs font-semibold">
                <MedalBadge rank={standing.department} size="sm" /> Department topper ·
                rank {standing.department} in {standing.departmentName}
              </span>
            ) : null}
            {standing.overall > 3 && standing.department > 3 ? (
              <span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                Rank {standing.overall} of {standing.of} in the university ·{" "}
                {standing.count} approved
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={BookOpen}
          label="Publications & patents"
          value={String(summary.publications)}
          active={is({ kind: "all" }) && !filter.year}
          onClick={() => setFilter(allRecords)}
        />
        <Tile
          icon={BadgeCheck}
          label={approvedLabel}
          value={String(summary.approved)}
          active={is({ kind: "approved" })}
          onClick={() => setCategory({ kind: "approved" })}
        />
        <Tile
          icon={Clock}
          label={pendingLabel}
          value={String(summary.waiting)}
          detail={summary.rejected ? `${summary.rejected} rejected` : undefined}
          active={is({ kind: "waiting" })}
          onClick={() => setCategory({ kind: "waiting" })}
        />
        <Tile
          icon={FolderKanban}
          label="Project proposals"
          value={String(summary.proposals)}
          detail={
            summary.accepted
              ? `${summary.accepted} accepted · ${rupees(summary.sanctioned)} sanctioned`
              : undefined
          }
          active={is({ kind: "proposals" })}
          onClick={() => setCategory({ kind: "proposals" })}
        />
      </ul>

      {summary.rejected ? (
        <button
          type="button"
          aria-pressed={is({ kind: "rejected" })}
          onClick={() => setCategory({ kind: "rejected" })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition",
            is({ kind: "rejected" })
              ? "border-secondary bg-secondary text-secondary-foreground"
              : "border-secondary/40 text-secondary hover:bg-secondary/10",
          )}
        >
          {rejectedLabel} ({summary.rejected}): see the reasons
        </button>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
            Year-wise
          </h3>
          {summary.bars.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No records yet.</p>
          ) : (
            <>
              <div
                className="mt-4 flex h-48 items-end gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Records by year"
              >
                {summary.bars.map((bar) => {
                  const on = filter.year === bar.year;
                  return (
                    <button
                      key={bar.year}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${bar.year}: ${bar.total} record(s)`}
                      onClick={() =>
                        setFilter((current) => ({ ...current, year: on ? "" : bar.year }))
                      }
                      className="group flex h-full min-w-11 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <span className="text-xs font-semibold text-primary tabular-nums">
                        {bar.total}
                      </span>
                      <span
                        className={cn(
                          "flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t-lg transition-all duration-500 group-hover:opacity-90",
                          on ? "ring-2 ring-primary ring-offset-2" : "",
                        )}
                        style={{
                          height: `${Math.max(8, (bar.total / summary.busiest) * 100)}%`,
                        }}
                      >
                        {bar.parts
                          .filter((part) => part.count > 0)
                          .map((part) => (
                            <span
                              key={part.label}
                              className={partColour[part.label]}
                              style={{ flexGrow: part.count }}
                              title={`${part.label}: ${part.count}`}
                            />
                          ))}
                      </span>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          on ? "font-bold text-primary" : "text-muted-foreground",
                        )}
                      >
                        {bar.year}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(partColour).map(([label, colour]) => (
                  <li key={label} className="inline-flex items-center gap-1.5">
                    <span
                      className={cn("size-2.5 rounded-sm", colour)}
                      aria-hidden="true"
                    />
                    {label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
            By category
          </h3>
          <ul className="mt-3 space-y-1">
            {categories.map((item) => {
              const on = is(item.category);
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={item.count === 0}
                    onClick={() => setCategory(item.category)}
                    className={cn(
                      "w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-muted disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent",
                      on && "bg-primary/10",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        {item.colour ? (
                          <span
                            className={cn("size-2.5 rounded-sm", item.colour)}
                            aria-hidden="true"
                          />
                        ) : null}
                        {item.label}
                      </span>
                      <span className="font-semibold text-primary tabular-nums">
                        {item.count}
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full transition-all duration-500",
                          item.colour ?? "bg-primary/60",
                        )}
                        style={{ width: `${(item.count / biggest) * 100}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {summary.proposals > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <h3 className="flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
            <IndianRupee className="size-3.5" aria-hidden="true" /> Project funding
          </h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Proposed", summary.proposed, "bg-primary/25"],
                ["Sanctioned", summary.sanctioned, "bg-primary"],
                ["Received", summary.received, "bg-accent"],
              ] as const
            ).map(([label, value, colour]) => (
              <li key={label} className="rounded-xl bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span
                    className={cn("size-2.5 rounded-sm", colour)}
                    aria-hidden="true"
                  />
                  {label}
                </p>
                <p className="mt-1 font-heading text-2xl font-semibold text-primary tabular-nums">
                  {rupees(value) || "₹0"}
                </p>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-3" aria-label="Project funding by year">
            {summary.funding
              .slice()
              .reverse()
              .map((item) => {
                const width = (value: number) =>
                  `${summary.largestYear ? Math.max(value ? 2 : 0, (value / summary.largestYear) * 100) : 0}%`;
                return (
                  <li key={item.year}>
                    <button
                      type="button"
                      aria-pressed={
                        filter.year === item.year && is({ kind: "proposals" })
                      }
                      onClick={() =>
                        setFilter({ year: item.year, category: { kind: "proposals" } })
                      }
                      className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-muted"
                    >
                      <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-primary tabular-nums">
                          {item.year}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {item.count} proposal(s)
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Proposed {rupees(item.proposed) || "₹0"} · Sanctioned{" "}
                          <strong className="text-primary">
                            {rupees(item.sanctioned) || "₹0"}
                          </strong>{" "}
                          · Received {rupees(item.received) || "₹0"}
                        </span>
                      </span>
                      <span className="mt-1.5 block space-y-1">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary/25 transition-all duration-500"
                            style={{ width: width(item.proposed) }}
                          />
                        </span>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: width(item.sanctioned) }}
                          />
                        </span>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-accent transition-all duration-500"
                            style={{ width: width(item.received) }}
                          />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-xl text-primary">
            {categoryLabel(filter.category)}
            {filter.year ? ` · ${filter.year}` : ""}{" "}
            <span className="text-base text-muted-foreground">({shown.length})</span>
          </h3>
          {filter.year || filter.category.kind !== "all" ? (
            <button
              type="button"
              onClick={() => setFilter(allRecords)}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <X className="size-3" aria-hidden="true" /> Show all
            </button>
          ) : null}
        </div>
        <div role="tablist" aria-label="Show records" className="flex flex-wrap gap-1.5">
          {groupings.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={grouping === id}
              onClick={() => setGrouping(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                grouping === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-primary hover:border-primary/40",
              )}
            >
              {groupingLabel[id]}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No record here.
          </p>
        ) : (
          <div className="space-y-5">
            {groupRecords(shown, grouping).map((group) => (
              <section key={group.label} className="space-y-2">
                <h4 className="flex items-center gap-2 border-b border-border pb-1 text-sm font-semibold text-primary">
                  {grouping === "type" && partColour[group.label] ? (
                    <span
                      className={cn("size-2.5 rounded-sm", partColour[group.label])}
                      aria-hidden="true"
                    />
                  ) : null}
                  {group.label}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                    {group.records.length}
                  </span>
                </h4>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.records.map((record) => (
                    <RecordCard
                      key={`${group.label}-${record.id}`}
                      record={record}
                      onEdit={onEdit}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
