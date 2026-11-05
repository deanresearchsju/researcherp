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
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { MotionConfig, animate, motion, useReducedMotion } from "framer-motion";
import { Fragment, useEffect, useState } from "react";

import { MedalBadge } from "@/components/forms/ToppersBoard";
import type { Standing } from "@/components/forms/PublicResearchDesk";
import { DeskModal } from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  allRecords,
  facultySummary,
  filterRecords,
  groupRecords,
  groupingLabel,
  groupings,
  sameCategory,
  type Category,
  type DashboardFilter,
  type Grouping,
} from "@/lib/faculty-dashboard";
import {
  agencyOf,
  courseAgencyOf,
  approvedLabel,
  balanceOf,
  displayValue,
  formatDay,
  fundingStage,
  indexingOf,
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
  "Online course": "bg-secondary/40",
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

const panel = "rounded-xl border border-border bg-card p-3 shadow-card sm:p-4";
const panelTitle =
  "flex items-center gap-1.5 text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase";

/** A number that counts up to its value when it first shows (or at once, for reduced motion). */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setShown(latest),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{format(Math.round(reduce ? value : shown))}</>;
}

const toneStyle = {
  primary: { icon: "bg-primary/10 text-primary", bar: "from-primary to-purple-deep" },
  gold: { icon: "bg-accent/30 text-gold-ink", bar: "from-accent to-gold-ink" },
  maroon: {
    icon: "bg-secondary/10 text-secondary",
    bar: "from-secondary to-secondary/60",
  },
} as const;

function Kpi({
  icon: Icon,
  label,
  value,
  format = (n) => String(n),
  active,
  tone = "primary",
  index = 0,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  format?: (n: number) => string;
  active: boolean;
  tone?: keyof typeof toneStyle;
  /** Its place in the row: the cards come in one after another. */
  index?: number;
  onClick: () => void;
}) {
  const style = toneStyle[tone];
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-card px-3 py-2.5 text-left shadow-card transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-lift",
        active ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-70 transition-opacity group-hover:opacity-100",
          style.bar,
          active && "opacity-100",
        )}
      />
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
          style.icon,
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-xl leading-none font-semibold text-primary tabular-nums">
          <CountUp value={value} format={format} />
        </span>
        <span className="mt-0.5 block truncate text-[0.68rem] font-semibold text-muted-foreground uppercase">
          {label}
        </span>
      </span>
    </motion.button>
  );
}

/** A panel that slides in after the ones before it. */
function Panel({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.4, ease: "easeOut" }}
      className={cn(panel, "transition-shadow hover:shadow-lift", className)}
    >
      {children}
    </motion.section>
  );
}

function StatusBadge({ record }: { record: ResearchRecord }) {
  if (isRejected(record)) return <Badge variant="maroon">{rejectedLabel}</Badge>;
  if (isApproved(record))
    return (
      <Badge variant="gold">
        <BadgeCheck className="mr-1 size-3" aria-hidden="true" />
        {approvedLabel}
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Clock className="mr-1 size-3" aria-hidden="true" />
      {pendingLabel}
    </Badge>
  );
}

/** All the details of one record, in a popup. */
function RecordDetails({
  record,
  onClose,
  onEdit,
}: {
  record: ResearchRecord;
  onClose: () => void;
  onEdit?: (record: ResearchRecord) => void;
}) {
  const v = record.values;
  const kind = record.kind;
  const fields = recordFields(kind).filter(
    (field) => isShown(field, v) && displayValue(field, v) && field.type !== "confirm",
  );
  return (
    <DeskModal title={recordTitle(kind, v)} onClose={onClose} size="md">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge record={record} />
        <span className="text-xs text-muted-foreground">
          {kind === "publication" ? valueText(v, "type") : `Project · ${fundingStage(v)}`}{" "}
          · {formatDay(recordDate(kind, v))}
        </span>
      </div>
      {isRejected(record) && record.reviewNote ? (
        <p className="rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2 text-sm text-secondary">
          Rejected by the research office: {record.reviewNote}
        </p>
      ) : null}
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
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
      {onEdit && !isApproved(record) ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onClose();
              onEdit(record);
            }}
          >
            <PencilLine className="size-4" aria-hidden="true" /> Edit
          </Button>
        </div>
      ) : null}
    </DeskModal>
  );
}

/**
 * A faculty member's own dashboard, compact: the profile and the counts in one strip, the
 * year-wise, category and project-funding panels side by side, and the records as a table
 * (grouped by type, year, status or indexing) whose rows open the full details.
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
  const [open, setOpen] = useState<ResearchRecord | null>(null);
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
      label: item.label,
      count: item.count,
    })),
  ];
  const biggest = Math.max(1, ...categories.map((item) => item.count));
  const filtered = Boolean(filter.year) || filter.category.kind !== "all";

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-3">
        {/* Profile and counts */}
        <Panel index={0} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-heading text-xl text-primary">
                {valueText(profile, "facultyName")}
              </h2>
              {standing && standing.overall <= 3 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-gold-ink">
                  <MedalBadge rank={standing.overall} size="sm" /> University rank{" "}
                  {standing.overall}
                </span>
              ) : null}
              {standing && standing.department <= 3 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-gold-ink">
                  <MedalBadge rank={standing.department} size="sm" /> Department rank{" "}
                  {standing.department}
                </span>
              ) : null}
              {standing && standing.overall > 3 && standing.department > 3 ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Rank {standing.overall} of {standing.of}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[
                valueText(profile, "designation"),
                valueText(profile, "department"),
                valueText(profile, "school"),
                valueText(profile, "campus"),
              ]
                .filter(Boolean)
                .join(" · ")}
              <span className="ml-2 inline-flex items-center gap-1">
                <CalendarDays className="size-3" aria-hidden="true" />
                {joined ? `Joined SJU ${formatDay(joined)}` : "Joining date not given"}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi
              icon={BookOpen}
              label="Publications"
              value={summary.publications}
              index={0}
              active={!filtered}
              onClick={() => setFilter(allRecords)}
            />
            <Kpi
              icon={BadgeCheck}
              label="Approved"
              value={summary.approved}
              index={1}
              tone="gold"
              active={is({ kind: "approved" })}
              onClick={() => setCategory({ kind: "approved" })}
            />
            <Kpi
              icon={Clock}
              label="Waiting"
              value={summary.waiting}
              index={2}
              active={is({ kind: "waiting" })}
              onClick={() => setCategory({ kind: "waiting" })}
            />
            <Kpi
              icon={XCircle}
              label="Rejected"
              value={summary.rejected}
              index={3}
              tone="maroon"
              active={is({ kind: "rejected" })}
              onClick={() => setCategory({ kind: "rejected" })}
            />
            <Kpi
              icon={FolderKanban}
              label="Proposals"
              value={summary.proposals}
              index={4}
              active={is({ kind: "proposals" })}
              onClick={() => setCategory({ kind: "proposals" })}
            />
            <Kpi
              icon={IndianRupee}
              label="Sanctioned"
              value={summary.sanctioned}
              format={(n) => rupees(n) || "₹0"}
              index={5}
              tone="gold"
              active={false}
              onClick={() => setCategory({ kind: "proposals" })}
            />
          </div>
        </Panel>

        {/* Year-wise · categories · project funding */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel index={1}>
            <h3 className={panelTitle}>Year-wise</h3>
            {summary.bars.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No records yet.</p>
            ) : (
              <>
                <div
                  className="mt-2 flex h-36 items-end gap-1.5 overflow-x-auto"
                  role="group"
                  aria-label="Records by year"
                >
                  {summary.bars.map((bar, index) => {
                    const on = filter.year === bar.year;
                    return (
                      <button
                        key={bar.year}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${bar.year}: ${bar.total} record(s)`}
                        onClick={() =>
                          setFilter((current) => ({
                            ...current,
                            year: on ? "" : bar.year,
                          }))
                        }
                        className="group flex h-full min-w-9 flex-1 flex-col items-center justify-end gap-0.5"
                      >
                        <span className="text-[0.65rem] font-semibold text-primary tabular-nums">
                          {bar.total}
                        </span>
                        <motion.span
                          className={cn(
                            "flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-t shadow-sm transition-[box-shadow,filter] group-hover:brightness-110",
                            on ? "ring-2 ring-primary ring-offset-1" : "",
                          )}
                          initial={{ height: "0%" }}
                          animate={{
                            height: `${Math.max(6, (bar.total / summary.busiest) * 100)}%`,
                          }}
                          transition={{
                            delay: 0.25 + index * 0.05,
                            duration: 0.6,
                            ease: [0.16, 1, 0.3, 1],
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
                        </motion.span>
                        <span
                          className={cn(
                            "text-[0.65rem] tabular-nums",
                            on ? "font-bold text-primary" : "text-muted-foreground",
                          )}
                        >
                          {bar.year}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.65rem] text-muted-foreground">
                  {Object.entries(partColour).map(([label, colour]) => (
                    <li key={label} className="inline-flex items-center gap-1">
                      <span
                        className={cn("size-2 rounded-sm", colour)}
                        aria-hidden="true"
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel index={2}>
            <h3 className={panelTitle}>By category</h3>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                        "w-full rounded-md px-1.5 py-1 text-left transition hover:bg-muted disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent",
                        on && "bg-primary/10",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          {item.colour ? (
                            <span
                              className={cn("size-2 shrink-0 rounded-sm", item.colour)}
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="font-semibold text-primary tabular-nums">
                          {item.count}
                        </span>
                      </span>
                      <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-muted">
                        <motion.span
                          className={cn(
                            "block h-full rounded-full",
                            item.colour ?? "bg-primary/60",
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.count / biggest) * 100}%` }}
                          transition={{
                            delay: 0.3,
                            duration: 0.7,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel index={3}>
            <h3 className={panelTitle}>
              <IndianRupee className="size-3" aria-hidden="true" /> Project funding
            </h3>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["Proposed", summary.proposed, "bg-primary/25"],
                  ["Sanctioned", summary.sanctioned, "bg-primary"],
                  ["Received", summary.received, "bg-accent"],
                ] as const
              ).map(([label, value, colour]) => (
                <div key={label} className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <dt className="flex items-center gap-1 text-[0.62rem] font-semibold text-muted-foreground uppercase">
                    <span
                      className={cn("size-2 rounded-sm", colour)}
                      aria-hidden="true"
                    />
                    {label}
                  </dt>
                  <dd className="truncate font-heading text-base font-semibold text-primary tabular-nums">
                    {rupees(value) || "₹0"}
                  </dd>
                </div>
              ))}
            </dl>
            {summary.funding.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No project proposals yet.
              </p>
            ) : (
              <ul
                className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1"
                aria-label="By year"
              >
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
                          onClick={() =>
                            setFilter({
                              year: item.year,
                              category: { kind: "proposals" },
                            })
                          }
                          className="w-full rounded-md px-1 py-0.5 text-left hover:bg-muted"
                        >
                          <span className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="font-semibold text-primary tabular-nums">
                              {item.year}
                            </span>
                            <span className="truncate text-muted-foreground tabular-nums">
                              {rupees(item.proposed) || "₹0"} ·{" "}
                              <strong className="text-primary">
                                {rupees(item.sanctioned) || "₹0"}
                              </strong>{" "}
                              · {rupees(item.received) || "₹0"}
                            </span>
                          </span>
                          <span className="mt-0.5 flex h-1.5 gap-0.5">
                            <motion.span
                              className="rounded-full bg-primary/25"
                              initial={{ width: 0 }}
                              animate={{ width: width(item.proposed) }}
                              transition={{
                                delay: 0.35,
                                duration: 0.7,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          </span>
                          <span className="mt-0.5 flex h-1.5 gap-0.5">
                            <motion.span
                              className="rounded-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: width(item.sanctioned) }}
                              transition={{
                                delay: 0.35,
                                duration: 0.7,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          </span>
                          <span className="mt-0.5 flex h-1.5 gap-0.5">
                            <motion.span
                              className="rounded-full bg-accent"
                              initial={{ width: 0 }}
                              animate={{ width: width(item.received) }}
                              transition={{
                                delay: 0.35,
                                duration: 0.7,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Panel>
        </div>

        {/* Records */}
        <Panel index={4} className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-primary">
                {categoryLabel(filter.category)}
                {filter.year ? ` · ${filter.year}` : ""}{" "}
                <span className="font-normal text-muted-foreground">
                  ({shown.length})
                </span>
              </h3>
              {filtered ? (
                <button
                  type="button"
                  onClick={() => setFilter(allRecords)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <X className="size-3" aria-hidden="true" /> Show all
                </button>
              ) : null}
            </div>
            <div
              role="tablist"
              aria-label="Group records"
              className="flex flex-wrap gap-1"
            >
              {groupings.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={grouping === id}
                  onClick={() => setGrouping(id)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
                    grouping === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-primary hover:border-primary/40",
                  )}
                >
                  {groupingLabel[id]}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No record here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    {["Date", "Type", "Title", "Indexing / agency", "Status", ""].map(
                      (header) => (
                        <th key={header} className="px-3 py-1.5 font-semibold">
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groupRecords(shown, grouping).map((group) => (
                    <Fragment key={group.label}>
                      <tr className="bg-muted/60">
                        <td
                          colSpan={6}
                          className="px-3 py-1 text-xs font-semibold text-primary"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {grouping === "type" && partColour[group.label] ? (
                              <span
                                className={cn(
                                  "size-2 rounded-sm",
                                  partColour[group.label],
                                )}
                                aria-hidden="true"
                              />
                            ) : null}
                            {group.label}
                            <span className="font-normal text-muted-foreground">
                              ({group.records.length})
                            </span>
                          </span>
                        </td>
                      </tr>
                      {group.records.map((record, row) => {
                        const v = record.values;
                        return (
                          <motion.tr
                            key={`${group.label}-${record.id}`}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: Math.min(0.3 + row * 0.03, 0.7),
                              duration: 0.25,
                            }}
                            className="cursor-pointer border-t border-border transition-colors hover:bg-primary/5"
                            onClick={() => setOpen(record)}
                          >
                            <td className="px-3 py-1.5 text-xs whitespace-nowrap tabular-nums">
                              {formatDay(recordDate(record.kind, v))}
                            </td>
                            <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                              {record.kind === "publication"
                                ? valueText(v, "type")
                                : "Proposal"}
                            </td>
                            <td className="max-w-md px-3 py-1.5">
                              <button
                                type="button"
                                className="line-clamp-1 text-left font-medium text-primary hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpen(record);
                                }}
                              >
                                {recordTitle(record.kind, v)}
                              </button>
                            </td>
                            <td className="px-3 py-1.5 text-xs">
                              {record.kind === "publication"
                                ? valueText(v, "type") === "Online course"
                                  ? `${courseAgencyOf(v)} · ${valueText(v, "courseMonth")} ${valueText(v, "year")}`
                                  : indexingOf(v).join(", ") || "—"
                                : `${agencyOf(v)} · ${fundingStage(v)}`}
                            </td>
                            <td className="px-3 py-1.5">
                              <StatusBadge record={record} />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {onEdit && !isApproved(record) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onEdit(record);
                                  }}
                                >
                                  <PencilLine className="size-3.5" aria-hidden="true" />{" "}
                                  Edit
                                </Button>
                              ) : null}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {open ? (
          <RecordDetails record={open} onClose={() => setOpen(null)} onEdit={onEdit} />
        ) : null}
      </div>
    </MotionConfig>
  );
}
